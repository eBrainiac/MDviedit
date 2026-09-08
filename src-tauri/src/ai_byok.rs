// BL-113/114/115 / SPEC-CORE-022 / ADR-010: BYOK habla por HTTP (reqwest)
// desde Rust — nunca `fetch`/XHR desde el webview (ver nota de arquitectura
// de red en lib.rs) — así la CSP del frontend (`connect-src 'none'`) no
// necesita abrirse; el único punto de acceso a red es este módulo y
// ai_download.rs, ambos comandos Tauri explícitos.
//
// La construcción de la petición (`build_request`) y la extracción de la
// respuesta (`parse_reply`) están separadas del envío real por HTTP
// (`ai_byok_send_message`) a propósito, mismo criterio que
// `recent-files-open.ts` en el frontend: la lógica de mapeo por proveedor es
// justo la clase de cosa que se rompe en silencio (BUG-02) y aquí sí se
// puede cubrir con `cargo test` sin red real.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

// BL-119/ADR-010 (actualización PD-77/78): "provider" aquí es el ESQUEMA de
// API, no el preset elegido en Preferencias → IA — "openai" cubre cualquier
// endpoint OpenAI-compatible (OpenAI, OpenRouter, Nous Portal, Together,
// Groq, o uno personalizado), distinguidos entre sí solo por `base_url`;
// "anthropic" es el único esquema nativo aparte (PD-78). Nunca "none" (el
// frontend lo valida antes de invocar este comando).
//
// NOTA (bug real encontrado en IT-10, no detectado en IT-9 por verificarse
// solo con el puente IPC mockeado de Chrome/dev-server): sin
// `#[serde(rename_all = "camelCase")]`, este struct esperaba `base_url`/
// `api_key` en el JSON mientras el frontend siempre mandó `baseUrl`/
// `apiKey` — la deserialización real de Tauri habría fallado en cualquier
// build nativo.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ByokRequest {
    pub provider: String,
    pub base_url: Option<String>,
    pub model: String,
    pub api_key: String,
    pub messages: Vec<ChatMessage>,
    /// AI-SEC-002 — viene de `appConfig.behavior.aiByokTimeoutMs` (RULE-001),
    /// nunca hardcodeado en Rust.
    pub timeout_ms: u64,
    /// AI-SEC-003 — viene de `appConfig.behavior.aiByokMaxResponseBytes`.
    pub max_response_bytes: u64,
}

struct BuiltRequest {
    url: String,
    headers: Vec<(&'static str, String)>,
    body: Value,
}

fn build_request(req: &ByokRequest) -> Result<BuiltRequest, String> {
    // AI-SEC-001 (defensa en profundidad — el rechazo real ocurre al
    // guardar en Preferencias → IA, `preferences.svelte.ts`): nunca enviar
    // una petición BYOK real a un endpoint que no sea `https://`.
    if let Some(base) = &req.base_url {
        if !base.starts_with("https://") {
            return Err("La URL base del proveedor BYOK debe usar https://".to_string());
        }
    }
    match req.provider.as_str() {
        "openai" => {
            let base = req
                .base_url
                .clone()
                .unwrap_or_else(|| "https://api.openai.com/v1".to_string());
            Ok(BuiltRequest {
                url: format!("{}/chat/completions", base.trim_end_matches('/')),
                headers: vec![("Authorization", format!("Bearer {}", req.api_key))],
                body: json!({
                    "model": req.model,
                    "messages": req.messages.iter().map(|m| json!({"role": m.role, "content": m.content})).collect::<Vec<_>>(),
                }),
            })
        }
        "anthropic" => {
            let base = req
                .base_url
                .clone()
                .unwrap_or_else(|| "https://api.anthropic.com/v1".to_string());
            // La API de Anthropic separa los mensajes "system" del arreglo
            // `messages` (a diferencia del formato OpenAI-compatible).
            let system: Vec<&str> = req
                .messages
                .iter()
                .filter(|m| m.role == "system")
                .map(|m| m.content.as_str())
                .collect();
            let conversation: Vec<Value> = req
                .messages
                .iter()
                .filter(|m| m.role != "system")
                .map(|m| json!({"role": m.role, "content": m.content}))
                .collect();
            let mut body = json!({
                "model": req.model,
                "max_tokens": 4096,
                "messages": conversation,
            });
            if !system.is_empty() {
                body["system"] = json!(system.join("\n\n"));
            }
            Ok(BuiltRequest {
                url: format!("{}/messages", base.trim_end_matches('/')),
                headers: vec![
                    ("x-api-key", req.api_key.clone()),
                    ("anthropic-version", "2023-06-01".to_string()),
                ],
                body,
            })
        }
        other => Err(format!("Proveedor BYOK desconocido: {other}")),
    }
}

fn parse_reply(provider: &str, response: &Value) -> Result<String, String> {
    match provider {
        "openai" => response
            .get("choices")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(|c| c.as_str())
            .map(str::to_string)
            .ok_or_else(|| format!("Respuesta inesperada del proveedor: {response}")),
        "anthropic" => response
            .get("content")
            .and_then(|c| c.get(0))
            .and_then(|c| c.get("text"))
            .and_then(|t| t.as_str())
            .map(str::to_string)
            .ok_or_else(|| format!("Respuesta inesperada del proveedor: {response}")),
        other => Err(format!("Proveedor BYOK desconocido: {other}")),
    }
}

/// AI-SEC-003: si el proveedor ya declara `Content-Length` por encima del
/// límite, se rechaza sin leer el cuerpo — separado de `ai_byok_send_message`
/// para poder cubrirlo con `cargo test` sin un servidor HTTP real.
fn reject_declared_length_over_limit(content_length: Option<u64>, max_response_bytes: u64) -> Result<(), String> {
    if let Some(len) = content_length {
        if len > max_response_bytes {
            return Err(format!(
                "Respuesta del proveedor supera el límite de tamaño ({len} > {max_response_bytes} bytes)"
            ));
        }
    }
    Ok(())
}

/// AT-094/096/098: única función que de verdad toca la red para BYOK.
///
/// AI-SEC-002/003: timeout de 30s y límite de 10MB (`app.config.ts`,
/// RULE-001) sobre una petición a un `aiBaseUrl` arbitrario aportado por el
/// usuario — el cuerpo se transmite por partes y se corta apenas se excede
/// el límite, nunca se procesa parcialmente en silencio.
#[tauri::command]
pub async fn ai_byok_send_message(req: ByokRequest) -> Result<String, String> {
    let built = build_request(&req)?;
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_millis(req.timeout_ms))
        .build()
        .map_err(|err| err.to_string())?;
    let mut request = client.post(&built.url).json(&built.body);
    for (key, value) in &built.headers {
        request = request.header(*key, value);
    }
    let response = request.send().await.map_err(|err| err.to_string())?;
    reject_declared_length_over_limit(response.content_length(), req.max_response_bytes)?;

    let status = response.status();
    let mut body_bytes: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|err| err.to_string())?;
        body_bytes.extend_from_slice(&chunk);
        if body_bytes.len() as u64 > req.max_response_bytes {
            return Err(format!(
                "Respuesta del proveedor supera el límite de tamaño ({} bytes)",
                req.max_response_bytes
            ));
        }
    }

    if !status.is_success() {
        let text = String::from_utf8_lossy(&body_bytes).to_string();
        return Err(format!("El proveedor respondió {status}: {text}"));
    }
    let json_body: Value = serde_json::from_slice(&body_bytes).map_err(|err| err.to_string())?;
    parse_reply(&req.provider, &json_body)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn msg(role: &str, content: &str) -> ChatMessage {
        ChatMessage { role: role.to_string(), content: content.to_string() }
    }

    fn req(provider: &str, base_url: Option<&str>) -> ByokRequest {
        ByokRequest {
            provider: provider.to_string(),
            base_url: base_url.map(str::to_string),
            model: "m".to_string(),
            api_key: "k".to_string(),
            messages: vec![msg("user", "hola")],
            timeout_ms: 30_000,
            max_response_bytes: 10_485_760,
        }
    }

    #[test]
    fn openai_request_uses_default_base_and_bearer_auth() {
        let built = build_request(&req("openai", None)).unwrap();
        assert_eq!(built.url, "https://api.openai.com/v1/chat/completions");
        assert_eq!(built.headers, vec![("Authorization", "Bearer k".to_string())]);
        assert_eq!(built.body["model"], "m");
    }

    /// BL-119/PD-77: cualquier preset OpenAI-compatible (OpenRouter, Nous
    /// Portal, Together, Groq, personalizado) llega aquí como esquema
    /// "openai" con su propia `base_url` — una sola implementación.
    #[test]
    fn openai_scheme_uses_custom_base_url_when_provided() {
        let built = build_request(&req("openai", Some("https://openrouter.ai/api/v1"))).unwrap();
        assert_eq!(built.url, "https://openrouter.ai/api/v1/chat/completions");
    }

    #[test]
    fn anthropic_request_separates_system_message() {
        let mut request = req("anthropic", None);
        request.messages = vec![msg("system", "eres útil"), msg("user", "hola")];
        let built = build_request(&request).unwrap();
        assert_eq!(built.url, "https://api.anthropic.com/v1/messages");
        assert_eq!(built.body["system"], "eres útil");
        assert_eq!(built.body["messages"].as_array().unwrap().len(), 1);
    }

    /// AI-SEC-001 (defensa en profundidad): una `base_url` que llegara sin
    /// pasar por la validación de guardado del frontend igual se rechaza
    /// antes de tocar la red.
    #[test]
    fn build_request_rejects_non_https_base_url() {
        assert!(build_request(&req("openai", Some("http://inseguro.example"))).is_err());
    }

    #[test]
    fn parse_reply_extracts_openai_content() {
        let response = json!({"choices": [{"message": {"content": "hola de vuelta"}}]});
        assert_eq!(parse_reply("openai", &response).unwrap(), "hola de vuelta");
    }

    #[test]
    fn parse_reply_extracts_anthropic_content() {
        let response = json!({"content": [{"type": "text", "text": "hola de vuelta"}]});
        assert_eq!(parse_reply("anthropic", &response).unwrap(), "hola de vuelta");
    }

    #[test]
    fn parse_reply_rejects_unexpected_shape() {
        let response = json!({"unexpected": true});
        assert!(parse_reply("openai", &response).is_err());
    }

    /// AI-SEC-003: `Content-Length` declarado por encima del límite se
    /// rechaza sin necesidad de un servidor HTTP real en el test.
    #[test]
    fn declared_length_over_limit_is_rejected() {
        assert!(reject_declared_length_over_limit(Some(20_000_000), 10_485_760).is_err());
        assert!(reject_declared_length_over_limit(Some(1_000), 10_485_760).is_ok());
        assert!(reject_declared_length_over_limit(None, 10_485_760).is_ok());
    }

    /// Bug real de IT-10 (ver nota sobre `ByokRequest`): confirma que el
    /// struct deserializa el JSON camelCase que de verdad manda el
    /// frontend (`baseUrl`/`apiKey`/`timeoutMs`/`maxResponseBytes`), no el
    /// snake_case que tenía el struct sin `rename_all`.
    #[test]
    fn byok_request_deserializes_camel_case_json_from_frontend() {
        let json_from_frontend = json!({
            "provider": "openai",
            "baseUrl": "https://openrouter.ai/api/v1",
            "model": "openrouter/some-model",
            "apiKey": "sk-test",
            "messages": [{"role": "user", "content": "hola"}],
            "timeoutMs": 30_000,
            "maxResponseBytes": 10_485_760,
        });
        let parsed: ByokRequest = serde_json::from_value(json_from_frontend).unwrap();
        assert_eq!(parsed.base_url.as_deref(), Some("https://openrouter.ai/api/v1"));
        assert_eq!(parsed.api_key, "sk-test");
        assert_eq!(parsed.timeout_ms, 30_000);
        assert_eq!(parsed.max_response_bytes, 10_485_760);
    }
}
