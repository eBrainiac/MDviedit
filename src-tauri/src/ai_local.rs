// BL-110/112 / SPEC-CORE-022 / ADR-010 / PD-65 / AT-108/109.
//
// ESTADO REAL (ver reporte de cierre de la continuación de IT-9): esta
// máquina SÍ tiene ahora el toolchain completo (CMake + MSVC Build Tools +
// LLVM/clang para bindgen) — `llama-cpp-2` compila la dependencia nativa de
// verdad (`cargo check`/`cargo build` enlazan llama.cpp real). `generate()`
// ejecuta inferencia real: carga el `.gguf`, aplica la plantilla de chat del
// propio modelo, tokeniza, decodifica el prompt completo y genera token por
// token con un sampler real hasta un token de fin de generación o un tope de
// tokens nuevos.
//
// Diseño deliberado: el modelo (`LlamaModel`) se mantiene cargado en
// `AiLocalState` entre llamadas (para que "cargado" == RAM real reservada,
// AT-108), pero el `LlamaContext` (que pide una ventana de contexto fija y
// reserva su propia caché KV) se crea DE NUEVO en cada `generate()` y se
// descarta al terminar. El frontend ya manda el historial completo de la
// conversación en cada turno (ver `provider.ts` / `ai-chat.svelte.ts`), así
// que no hay estado de caché KV que valga la pena conservar entre turnos —
// esto evita además el problema de vida útil de `LlamaContext<'a>` (pide
// prestado el modelo) sin tener que recurrir a structs auto-referenciales.
//
// Tamaño de contexto real de inferencia, NO los 262144 que anuncia el modelo
// (`aiLocalContextTokens` en app.config.ts — esa cifra es el presupuesto que
// usa BL-114/summarize.ts para decidir cuándo recurrir a map-reduce, un
// cálculo del lado del frontend que no tiene por qué coincidir con la
// ventana real que este backend reserva).
//
// INVESTIGACIÓN DE RAM (hotfix `fix/ai-local-ram-leak`, posterior al cierre
// de IT-9-cont): AT-108 medía +3977 MB tras 3 generaciones, por encima del
// presupuesto de NFR-009 (≤ 3.5 GB). Diagnóstico con el arnés instrumentado
// turno a turno (5 generaciones reales): la RAM salta UNA sola vez, en la
// PRIMERA generación de todo el proceso (2691 MB → 3996 MB), y se queda
// EXACTAMENTE plana en las 4 siguientes — **nunca fue un leak que crece sin
// límite**. Instrumentación más fina (medición dentro de `generate()`, no
// solo al final) localizó el salto en el paso exacto: ocurre dentro de
// `ctx.decode()` al procesar el prompt por primera vez en el proceso (no en
// `new_context()`, que solo cuesta ~160 MB — KV cache + el compute buffer
// de ~31 MB que el propio llama.cpp reporta en su log de `sched_reserve`,
// una cifra demasiado pequeña para explicar el salto). Se probó reducir
// `n_ctx` (8192→3072) y `n_batch`/`n_ubatch` (2048/512→512/128 y hasta
// 64/32, que directamente rompe el `GGML_ASSERT(n_tokens_all <=
// cparams.n_batch)` de llama.cpp si el prompt no cabe en `n_batch` — ver
// abajo) sin que el salto se moviera de forma significativa: la causa no
// era el tamaño de la caché KV ni del compute buffer.
//
// Causa raíz real, confirmada por eliminación: `LlamaModelParams::default()`
// usa `mmap` para el `.gguf` (comportamiento por defecto de llama.cpp). Con
// mmap, el archivo se mapea en memoria virtual pero el sistema operativo
// solo trae a RAM física (working set) las páginas que de verdad se leen —
// y la carga del modelo NO lee todos los tensores, solo los toca la
// PRIMERA pasada real hacia adelante (`ctx.decode()` del prompt), que
// recorre cada capa. Ese primer decode fuerza a Windows a traer a RAM el
// resto del archivo mapeado de golpe: de ahí el salto de ~1300 MB, que no
// depende de `n_ctx` ni de `n_batch`/`n_ubatch` porque no tiene nada que
// ver con la caché KV ni con los buffers de cómputo — es simplemente el
// resto del modelo entrando a RAM por primera vez. Confirmado desactivando
// mmap (`with_use_mmap(false)`, ver `load_model` abajo): el salto
// desaparece por completo, el costo total se paga de una sola vez al
// cargar el modelo (RAM estable en ~2687 MB en las 5 generaciones de
// verificación, +2679 MB sobre la línea base — bajo el límite de 3.5 GB
// con margen real, sin sacrificar `n_ctx`). Compromiso aceptado: mmap
// también permite que el SO comparta páginas de solo lectura entre
// procesos y las descargue bajo presión de memoria — al desactivarlo, el
// modelo completo vive en heap propio del proceso sin esa flexibilidad;
// dado que MDviedit es de un solo proceso y el Chat ya es opt-in con
// descarga explícita de RAM al desactivarse (PD-65/AT-109), este costo no
// se considera significativo frente al beneficio de un presupuesto de RAM
// predecible.
//
// De paso, la misma investigación encontró un bug real independiente de la
// RAM: el código nunca fijaba `n_batch` en función de `n_ctx` (quedaba en
// el default de llama.cpp, 2048), así que un prompt de entre 2048 y
// `n_ctx` tokens habría pasado la validación de abajo (`tokens.len() <
// n_ctx`) pero reventado con el mismo `GGML_ASSERT` al llegar a
// `ctx.decode()`, porque el código pasa el prompt completo en una sola
// llamada. Corregido fijando `n_batch = LOCAL_INFERENCE_N_CTX` (así el
// prompt más grande que puede pasar la validación de `n_ctx` siempre cabe
// en un solo `decode()`).
use crate::ai_byok::ChatMessage;
use encoding_rs::UTF_8;
use llama_cpp_2::context::params::LlamaContextParams;
use llama_cpp_2::llama_backend::LlamaBackend;
use llama_cpp_2::llama_batch::LlamaBatch;
use llama_cpp_2::model::params::LlamaModelParams;
use llama_cpp_2::model::{AddBos, LlamaChatMessage, LlamaModel};
use llama_cpp_2::sampling::LlamaSampler;
use serde::Serialize;
use std::num::NonZeroU32;
use std::sync::Mutex;
use tauri::State;

/// Ventana de contexto real reservada para la inferencia local (ver comentario
/// de módulo arriba — deliberadamente menor que `aiLocalContextTokens`). Ya
/// no hace falta sacrificar este valor por RAM (la causa real era `mmap`,
/// ver arriba) — se mantiene el mismo tamaño que antes de la investigación.
const LOCAL_INFERENCE_N_CTX: u32 = 8192;
/// Fijado explícitamente a `LOCAL_INFERENCE_N_CTX` (en vez de dejar el
/// default de llama.cpp, 2048) para que cualquier prompt que pase la
/// validación de `n_ctx` de abajo quepa también en una sola llamada a
/// `ctx.decode()` — ver el bug real documentado en el comentario de módulo.
const LOCAL_INFERENCE_N_BATCH: u32 = LOCAL_INFERENCE_N_CTX;
/// Tope de tokens nuevos por respuesta — evita generaciones sin fin si el
/// modelo nunca emite un token de fin de generación real.
const MAX_NEW_TOKENS: usize = 1024;

struct Loaded {
    model: LlamaModel,
    path: String,
}

pub struct AiLocalState {
    backend: LlamaBackend,
    loaded: Mutex<Option<Loaded>>,
}

impl Default for AiLocalState {
    fn default() -> Self {
        // `LlamaBackend::init()` solo puede llamarse una vez por proceso —
        // aquí se llama exactamente una vez, al construir el estado
        // administrado de Tauri (ver `lib.rs`), no en cada comando.
        let backend = LlamaBackend::init().expect("el backend de llama.cpp solo se inicializa una vez por proceso");
        Self { backend, loaded: Mutex::new(None) }
    }
}

#[derive(Clone, Serialize, PartialEq, Debug)]
#[serde(rename_all = "camelCase")]
pub struct LocalModelStatus {
    pub loaded: bool,
    /// Siempre `true` en este build (el motor real está enlazado) — se
    /// conserva el campo para no romper el contrato ya cableado con el
    /// frontend (`ai-model.svelte.ts`), que lo usa para decidir si mostrar
    /// "motor local no disponible".
    pub engine_available: bool,
}

fn status_of(loaded: &Option<Loaded>) -> LocalModelStatus {
    LocalModelStatus { loaded: loaded.is_some(), engine_available: true }
}

fn load_model(backend: &LlamaBackend, loaded: &mut Option<Loaded>, model_path: &str) -> Result<LocalModelStatus, String> {
    if let Some(existing) = loaded.as_ref() {
        if existing.path == model_path {
            return Ok(status_of(loaded));
        }
    }
    if !std::path::Path::new(model_path).exists() {
        return Err("El modelo local no está descargado todavía".to_string());
    }
    // `use_mmap(false)`: fix real del hotfix de RAM — ver comentario de módulo
    // arriba (causa raíz del salto de ~1300 MB medido en AT-108).
    let params = LlamaModelParams::default().with_use_mmap(false);
    let model = LlamaModel::load_from_file(backend, model_path, &params)
        .map_err(|err| format!("No se pudo cargar el modelo local: {err}"))?;
    *loaded = Some(Loaded { model, path: model_path.to_string() });
    Ok(status_of(loaded))
}

/// PD-65 / AT-109: soltar `Some(Loaded)` libera de verdad la memoria del
/// modelo (`LlamaModel` implementa `Drop` sobre el puntero nativo de
/// llama.cpp) — ya no es solo una bandera de estado.
fn unload_model(loaded: &mut Option<Loaded>) -> LocalModelStatus {
    *loaded = None;
    status_of(loaded)
}

/// PD-61/ADR-010: Qwen3.5 razona por defecto (bloques `<think>...</think>`
/// largos — verificados en la práctica de más de 2500 caracteres, capaces de
/// agotar `MAX_NEW_TOKENS` sin llegar a cerrarse). **Probado y descartado**:
/// inyectar `/no_think` como texto en el mensaje de sistema (mecanismo de
/// `transformers`) no tiene efecto real aquí — `apply_chat_template` de
/// llama.cpp NO interpreta la plantilla Jinja completa embebida en el
/// `.gguf` (con su lógica condicional de `enable_thinking`); cae a un
/// renderizado ChatML genérico donde `/no_think` es texto inerte (confirmado
/// con un volcado del prompt real: `/no_think<|im_end|>` sin ningún efecto
/// en el comportamiento del modelo — ver reporte de cierre).
///
/// Técnica que sí funciona (usada en la comunidad de llama.cpp para modelos
/// híbridos como Qwen3.x cuando no hay acceso al parámetro `enable_thinking`
/// de `transformers`): "prellenar" un bloque de pensamiento ya vacío y
/// cerrado justo después del preámbulo del turno del asistente. El modelo
/// continúa la generación como si ya hubiera terminado de razonar y pasa
/// directo a la respuesta.
const EMPTY_THINK_PREFILL: &str = "<think>\n\n</think>\n\n";

/// Salvaguarda independiente del mecanismo de plantilla de arriba: nunca se
/// expone un bloque de razonamiento al frontend aunque `/no_think` falle o el
/// modelo lo ignore (PD-61 — "modo de pensamiento desactivado por defecto").
fn strip_thinking_blocks(text: &str) -> String {
    let mut result = String::with_capacity(text.len());
    let mut rest = text;
    loop {
        match rest.find("<think>") {
            None => {
                result.push_str(rest);
                break;
            }
            Some(start) => {
                result.push_str(&rest[..start]);
                match rest[start..].find("</think>") {
                    Some(end_rel) => {
                        rest = &rest[start + end_rel + "</think>".len()..];
                    }
                    None => break, // bloque sin cerrar: se descarta el resto, nunca se expone a medias.
                }
            }
        }
    }
    result.trim().to_string()
}

fn generate(backend: &LlamaBackend, loaded: &Option<Loaded>, messages: &[ChatMessage]) -> Result<String, String> {
    let Some(Loaded { model, .. }) = loaded else {
        return Err("El modelo local no está cargado".to_string());
    };

    let chat_template = model
        .chat_template(None)
        .map_err(|err| format!("El modelo no trae una plantilla de chat: {err}"))?;
    let llama_messages: Vec<LlamaChatMessage> = messages
        .iter()
        .map(|m| LlamaChatMessage::new(m.role.clone(), m.content.clone()))
        .collect::<Result<_, _>>()
        .map_err(|err| format!("Mensaje inválido para la plantilla de chat: {err}"))?;
    let rendered = model
        .apply_chat_template(&chat_template, &llama_messages, true)
        .map_err(|err| format!("No se pudo aplicar la plantilla de chat: {err}"))?;
    let prompt = format!("{rendered}{EMPTY_THINK_PREFILL}");

    let ctx_params =
        LlamaContextParams::default().with_n_ctx(NonZeroU32::new(LOCAL_INFERENCE_N_CTX)).with_n_batch(LOCAL_INFERENCE_N_BATCH);
    let mut ctx = model
        .new_context(backend, ctx_params)
        .map_err(|err| format!("No se pudo crear el contexto de inferencia: {err}"))?;

    let tokens = model
        .str_to_token(&prompt, AddBos::Always)
        .map_err(|err| format!("No se pudo tokenizar el prompt: {err}"))?;
    if tokens.len() as u32 >= ctx.n_ctx() {
        return Err(
            "El contenido seleccionado excede la ventana de contexto del motor local (BL-114 debería haber \
             recurrido a map-reduce antes de llegar aquí)"
                .to_string(),
        );
    }

    let mut batch = LlamaBatch::new(tokens.len().max(LOCAL_INFERENCE_N_CTX as usize / 16), 1);
    batch
        .add_sequence(&tokens, 0, false)
        .map_err(|err| format!("No se pudo preparar el lote de tokens: {err:?}"))?;
    ctx.decode(&mut batch).map_err(|err| format!("Fallo al decodificar el prompt: {err}"))?;

    let mut sampler = LlamaSampler::chain(
        [LlamaSampler::top_k(40), LlamaSampler::top_p(0.9, 1), LlamaSampler::min_p(0.05, 1), LlamaSampler::temp(0.7), LlamaSampler::dist(1234)],
        false,
    );

    let mut decoder = UTF_8.new_decoder();
    let mut output = String::new();
    let mut n_cur = tokens.len() as i32;

    for _ in 0..MAX_NEW_TOKENS {
        let token = sampler.sample(&ctx, -1);
        sampler.accept(token);

        if model.is_eog_token(token) {
            break;
        }

        let piece = model
            .token_to_piece(token, &mut decoder, true, None)
            .map_err(|err| format!("No se pudo decodificar un token generado: {err}"))?;
        output.push_str(&piece);

        if n_cur as u32 >= ctx.n_ctx() {
            break; // se llenó la ventana de contexto — se devuelve lo generado hasta aquí, no es un error.
        }

        batch.clear();
        batch
            .add(token, n_cur, &[0], true)
            .map_err(|err| format!("No se pudo continuar la generación: {err:?}"))?;
        n_cur += 1;
        ctx.decode(&mut batch).map_err(|err| format!("Fallo al decodificar durante la generación: {err}"))?;
    }

    eprintln!("DEBUG_RAW_OUTPUT len={} bytes={:?}", output.len(), output);
    Ok(strip_thinking_blocks(&output))
}

impl AiLocalState {
    /// API `pub` sobre el estado administrado — usada tanto por los comandos
    /// Tauri de abajo como por el arnés de verificación real
    /// (`src/bin/ai_local_harness.rs`, AT-095…098/108/109): ambos ejecutan
    /// exactamente el mismo código de producción, no una copia para pruebas.
    pub fn status(&self) -> LocalModelStatus {
        let loaded = self.loaded.lock().expect("mutex de estado del modelo local envenenado");
        status_of(&loaded)
    }

    pub fn load(&self, model_path: &str) -> Result<LocalModelStatus, String> {
        let mut loaded = self.loaded.lock().expect("mutex de estado del modelo local envenenado");
        load_model(&self.backend, &mut loaded, model_path)
    }

    /// PD-65 / AT-109: soltar `Some(Loaded)` libera la RAM real del modelo
    /// (`LlamaModel::drop`), no solo una bandera de estado.
    pub fn unload(&self) -> LocalModelStatus {
        let mut loaded = self.loaded.lock().expect("mutex de estado del modelo local envenenado");
        unload_model(&mut loaded)
    }

    pub fn generate(&self, messages: &[ChatMessage]) -> Result<String, String> {
        let loaded = self.loaded.lock().expect("mutex de estado del modelo local envenenado");
        generate(&self.backend, &loaded, messages)
    }
}

#[tauri::command]
pub fn ai_local_model_status(state: State<'_, AiLocalState>) -> LocalModelStatus {
    state.status()
}

#[tauri::command]
pub fn ai_local_model_load(state: State<'_, AiLocalState>, model_path: String) -> Result<LocalModelStatus, String> {
    state.load(&model_path)
}

/// PD-65 / AT-109: se llama al desactivar el Chat (switch maestro o
/// `AIChatToggle`), no solo al ocultar el panel del frontend.
#[tauri::command]
pub fn ai_local_model_unload(state: State<'_, AiLocalState>) -> LocalModelStatus {
    state.unload()
}

#[tauri::command]
pub fn ai_local_generate(state: State<'_, AiLocalState>, messages: Vec<ChatMessage>) -> Result<String, String> {
    state.generate(&messages)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::OnceLock;

    /// `LlamaBackend::init()` solo puede tener éxito una vez por proceso — los
    /// tests de este módulo comparten un único backend vía `OnceLock` en vez
    /// de que cada `#[test]` intente inicializar el suyo (el binario de
    /// pruebas de `cargo test` ejecuta todos los `#[test]` de este archivo en
    /// el mismo proceso).
    fn test_backend() -> &'static LlamaBackend {
        static BACKEND: OnceLock<LlamaBackend> = OnceLock::new();
        BACKEND.get_or_init(|| LlamaBackend::init().expect("backend de llama.cpp para pruebas"))
    }

    fn msg(role: &str, content: &str) -> ChatMessage {
        ChatMessage { role: role.to_string(), content: content.to_string() }
    }

    #[test]
    fn load_fails_when_model_file_missing() {
        let backend = test_backend();
        let mut loaded = None;
        let result = load_model(backend, &mut loaded, "C:/no/existe/modelo.gguf");
        assert!(result.is_err());
        assert!(loaded.is_none());
    }

    #[test]
    fn unload_always_clears_loaded_state() {
        let mut loaded: Option<Loaded> = None;
        let status = unload_model(&mut loaded);
        assert!(!status.loaded);
    }

    #[test]
    fn generate_requires_loaded_model_first() {
        let backend = test_backend();
        let loaded: Option<Loaded> = None;
        assert!(generate(backend, &loaded, &[msg("user", "hola")]).is_err());
    }

    #[test]
    fn strip_thinking_blocks_removes_single_block() {
        let text = "<think>razonando en voz alta</think>respuesta final";
        assert_eq!(strip_thinking_blocks(text), "respuesta final");
    }

    #[test]
    fn strip_thinking_blocks_removes_multiple_blocks() {
        let text = "<think>uno</think>parte A<think>dos</think>parte B";
        assert_eq!(strip_thinking_blocks(text), "parte Aparte B");
    }

    #[test]
    fn strip_thinking_blocks_discards_unclosed_block() {
        let text = "texto previo<think>nunca se cierra";
        assert_eq!(strip_thinking_blocks(text), "texto previo");
    }

    #[test]
    fn strip_thinking_blocks_passes_through_plain_text() {
        let text = "respuesta sin bloques de pensamiento";
        assert_eq!(strip_thinking_blocks(text), text);
    }
}
