//! Arnés de verificación real para BL-110/111/112 (AT-095…098, AT-108/109) —
//! NO forma parte de la app distribuida. Ejecuta el mismo código de
//! producción que los comandos Tauri (`mdviedit_lib::ai_local::AiLocalState`,
//! `mdviedit_lib::ai_download::download_and_verify`) fuera del runtime de
//! Tauri, porque `@tauri-apps/api/core.invoke` no resuelve nada en Chrome
//! contra el dev server de Vite (sin puente IPC real) — la única forma de
//! probar descarga/inferencia/RAM real sin automatizar clics en la ventana
//! nativa de Windows (fuera del alcance de Claude-in-Chrome).
//!
//! Completamente autónomo (sin sincronización por stdin): mide su propia RAM
//! de proceso en cada punto de interés (antes de todo, tras cargar el
//! modelo, tras generar, tras soltarlo) invocando `Get-Process -Id <propio
//! PID>` — evita depender de un driver externo para un proceso que puede
//! tardar bastante (descarga real de 2.74 GB + varias generaciones reales).
use mdviedit_lib::ai_byok::ChatMessage;
use mdviedit_lib::ai_download::download_and_verify;
use mdviedit_lib::ai_local::AiLocalState;
use std::io::Write;
use std::process::Command;

const MODEL_URL: &str = "https://huggingface.co/unsloth/Qwen3.5-4B-GGUF/resolve/main/Qwen3.5-4B-Q4_K_M.gguf";
const MODEL_SHA256: &str = "00fe7986ff5f6b463e62455821146049db6f9313603938a70800d1fb69ef11a4";

// Mismo texto que `SYSTEM_PROMPT` en src/lib/stores/ai-chat.svelte.ts (BL-115)
// — se repite aquí a propósito para ejercitar el protocolo real de "cambio
// propuesto" con el mismo prompt que vería el modelo en la app de verdad.
const SYSTEM_PROMPT: &str = "Eres el asistente de IA integrado en MDviedit, un editor de Markdown. \
    Responde en el idioma del usuario. Si el usuario pide un cambio al archivo activo, responde con una \
    breve explicación y, envuelto en un bloque de código con la etiqueta mdviedit-proposed-change, el \
    CONTENIDO COMPLETO del archivo ya modificado (no solo el fragmento cambiado).";

fn working_set_mb(pid: u32) -> Option<f64> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            &format!("(Get-Process -Id {pid}).WorkingSet64"),
        ])
        .output()
        .ok()?;
    String::from_utf8_lossy(&output.stdout).trim().parse::<f64>().ok().map(|bytes| bytes / 1024.0 / 1024.0)
}

fn report_ram(label: &str) {
    let pid = std::process::id();
    match working_set_mb(pid) {
        Some(mb) => println!("RAM:{label} {mb:.1}MB"),
        None => println!("RAM:{label} error-midiendo"),
    }
    std::io::stdout().flush().ok();
}

fn msg(role: &str, content: &str) -> ChatMessage {
    ChatMessage { role: role.to_string(), content: content.to_string() }
}

#[tokio::main]
async fn main() {
    println!("PID:{}", std::process::id());
    let model_path = std::env::args().nth(1).expect("uso: ai_local_harness <ruta-destino-del-modelo.gguf>");

    report_ram("before-anything");

    if !std::path::Path::new(&model_path).exists() {
        println!("DOWNLOAD:start");
        std::io::stdout().flush().ok();
        let mut last_reported = 0u64;
        let result = download_and_verify(
            MODEL_URL,
            &model_path,
            Some(MODEL_SHA256),
            |downloaded, total| {
                // Solo imprime cada ~256 MB para no inundar la salida durante 2.74 GB reales.
                if downloaded - last_reported >= 256 * 1024 * 1024 || downloaded == total {
                    println!("DOWNLOAD:progress {downloaded}/{total}");
                    std::io::stdout().flush().ok();
                    last_reported = downloaded;
                }
            },
            || false,
        )
        .await;
        match result {
            Ok(()) => println!("DOWNLOAD:ok"),
            Err(err) => {
                println!("DOWNLOAD:error {err}");
                return;
            }
        }
    } else {
        println!("DOWNLOAD:skipped-already-present");
    }
    std::io::stdout().flush().ok();

    let state = AiLocalState::default();
    match state.load(&model_path) {
        Ok(status) => println!("LOAD:ok loaded={} engineAvailable={}", status.loaded, status.engine_available),
        Err(err) => {
            println!("LOAD:error {err}");
            return;
        }
    }
    report_ram("after-load");

    // AT-096: resumir un archivo.
    let file_a = "# Notas de la reunión\n\nAsistieron Ana y Luis. Se decidió mover el lanzamiento a marzo \
        y priorizar el bug de exportación a PDF antes que las nuevas paletas de color.";
    let summarize_one = vec![
        msg("system", SYSTEM_PROMPT),
        msg("user", &format!("Resume este archivo en 2 líneas:\n\n{file_a}")),
    ];
    match state.generate(&summarize_one) {
        Ok(reply) => println!("GENERATE:summarize_one_file ok\n---\n{reply}\n---"),
        Err(err) => println!("GENERATE:summarize_one_file error {err}"),
    }
    std::io::stdout().flush().ok();
    report_ram("after-gen-1");

    // AT-097 (map-reduce): dos "archivos" resumidos por separado — el propio
    // combinado de resúmenes es lógica de `summarize.ts` (ya cubierta por
    // `summarize.test.ts` con el backend mockeado); lo que este arnés
    // verifica es que la llamada real de generación subyacente que usaría
    // cada paso "map" funciona con contenido real, no mockeado.
    let file_b = "# Backlog\n\nQuedan pendientes: soporte de tablas anchas, atajo para insertar \
        enlaces, y una revisión de accesibilidad del modo oscuro.";
    let summarize_two =
        vec![msg("system", SYSTEM_PROMPT), msg("user", &format!("Resume este archivo en 2 líneas:\n\n{file_b}"))];
    match state.generate(&summarize_two) {
        Ok(reply) => println!("GENERATE:summarize_second_file ok\n---\n{reply}\n---"),
        Err(err) => println!("GENERATE:summarize_second_file error {err}"),
    }
    std::io::stdout().flush().ok();
    report_ram("after-gen-2");

    // AT-098: proponer un cambio real sobre un archivo activo.
    let propose_change = vec![
        msg("system", SYSTEM_PROMPT),
        msg(
            "user",
            "El archivo activo es:\n\n# Tareas\n\n- comprar leche\n\nAgrega un segundo punto: \"revisar PR #13\".",
        ),
    ];
    match state.generate(&propose_change) {
        Ok(reply) => {
            let has_proposal = reply.contains("```mdviedit-proposed-change");
            println!("GENERATE:propose_change ok has_proposal_block={has_proposal}\n---\n{reply}\n---");
        }
        Err(err) => println!("GENERATE:propose_change error {err}"),
    }
    std::io::stdout().flush().ok();
    report_ram("after-gen-3");

    // Dos turnos extra (no ligados a ningún AT específico) solo para ver si
    // la curva de RAM sigue creciendo turno tras turno o si se estabiliza —
    // diagnóstico del hallazgo de AT-108 (ver comentario de módulo en
    // `ai_local.rs`).
    for i in 4..=5 {
        let extra = vec![msg("system", SYSTEM_PROMPT), msg("user", &format!("Turno de diagnóstico número {i}. Responde solo con 'ok {i}'."))];
        match state.generate(&extra) {
            Ok(reply) => println!("GENERATE:diagnostic_turn_{i} ok\n---\n{reply}\n---"),
            Err(err) => println!("GENERATE:diagnostic_turn_{i} error {err}"),
        }
        std::io::stdout().flush().ok();
        report_ram(&format!("after-gen-{i}"));
    }

    let unload_status = state.unload();
    println!("UNLOAD:ok loaded={}", unload_status.loaded);
    report_ram("after-unload");

    println!("DONE");
}
