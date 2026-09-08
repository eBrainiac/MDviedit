// BL-111 / SPEC-CORE-022 / PD-61/62 / AT-095: descarga del modelo local bajo
// demanda, con progreso real, verificación de integridad (sha256) y
// cancelación. La URL, ruta destino y hash esperado los decide el frontend
// (`app.config.ts` — ADR-006 capa 2), este módulo es agnóstico del modelo
// concreto. Repo/archivo exacto de Hugging Face para Qwen3.5-4B GGUF Q4_K_M
// NO está fijado en ADR-010/PD-61/62 (solo el nombre y tamaño aproximado) —
// ver marcador de posición documentado en app.config.ts y el reporte de
// cierre de IT-9.
//
// NOTA DE VERIFICACIÓN (igual que AT-089 en IT-8): no se descarga el
// archivo real de ~2.74 GB en esta sesión (tiempo/ancho de banda del
// entorno). Lo que sí se verifica con `cargo test` es la lógica pura que no
// depende de una descarga real: el cálculo de progreso y la verificación de
// sha256 contra bytes ya en memoria.
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};

#[derive(Default)]
pub struct AiDownloadState {
    cancel_flag: std::sync::Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DownloadProgress {
    downloaded_bytes: u64,
    total_bytes: u64,
    fraction: f64,
}

/// Evita división por cero cuando el servidor no manda `Content-Length`
/// (se reporta 0.0 en vez de NaN/Infinity — el frontend trata 0 como
/// "progreso indeterminado", no como error).
pub fn download_progress_fraction(downloaded: u64, total: u64) -> f64 {
    if total == 0 {
        0.0
    } else {
        (downloaded as f64 / total as f64).clamp(0.0, 1.0)
    }
}

pub fn verify_sha256(bytes: &[u8], expected_hex: &str) -> Result<(), String> {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    let actual_hex = digest.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
    if actual_hex.eq_ignore_ascii_case(expected_hex) {
        Ok(())
    } else {
        Err(format!("sha256 no coincide: esperado {expected_hex}, obtenido {actual_hex}"))
    }
}

/// Lógica real de descarga+verificación, independiente de `AppHandle`/
/// `State` de Tauri — así el arnés de verificación real
/// (`src/bin/ai_local_harness.rs`, AT-095) puede ejecutar EXACTAMENTE este
/// código fuera de un contexto de app Tauri, no una copia paralela. El
/// comando `ai_model_download_start` de abajo es un envoltorio delgado que
/// conecta `on_progress`/`should_cancel` a eventos/estado reales de Tauri.
pub async fn download_and_verify(
    url: &str,
    dest_path: &str,
    expected_sha256: Option<&str>,
    mut on_progress: impl FnMut(u64, u64),
    mut should_cancel: impl FnMut() -> bool,
) -> Result<(), String> {
    let dest = std::path::PathBuf::from(dest_path);
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent).map_err(|err| err.to_string())?;
    }
    let tmp_path = dest.with_extension("part");

    // Bloque `async` directo (no una clausura `|| async {}` inmediatamente
    // invocada): con `on_progress`/`should_cancel` tomados por referencia
    // mutable, envolverlo en una clausura `FnMut` hace que el borrow checker
    // rechace el `Future` devuelto por "escapar" del cuerpo de la clausura.
    let result: Result<(), String> = async {
        let response = reqwest::get(url).await.map_err(|err| err.to_string())?;
        if !response.status().is_success() {
            return Err(format!("Descarga falló con estado {}", response.status()));
        }
        let total_bytes = response.content_length().unwrap_or(0);
        let mut file = std::fs::File::create(&tmp_path).map_err(|err| err.to_string())?;
        let mut downloaded: u64 = 0;
        let mut stream = response.bytes_stream();
        use futures_util::StreamExt;
        while let Some(chunk) = stream.next().await {
            if should_cancel() {
                return Err("cancelled".to_string());
            }
            let chunk = chunk.map_err(|err| err.to_string())?;
            file.write_all(&chunk).map_err(|err| err.to_string())?;
            downloaded += chunk.len() as u64;
            on_progress(downloaded, total_bytes);
        }
        drop(file);

        if let Some(expected) = expected_sha256 {
            let bytes = std::fs::read(&tmp_path).map_err(|err| err.to_string())?;
            if let Err(err) = verify_sha256(&bytes, expected) {
                let _ = std::fs::remove_file(&tmp_path);
                return Err(err);
            }
        }
        std::fs::rename(&tmp_path, &dest).map_err(|err| err.to_string())?;
        Ok(())
    }
    .await;

    if result.is_err() {
        let _ = std::fs::remove_file(&tmp_path);
    }
    result
}

#[tauri::command]
pub async fn ai_model_download_start(
    app: AppHandle,
    state: State<'_, AiDownloadState>,
    url: String,
    dest_path: String,
    expected_sha256: Option<String>,
) -> Result<(), String> {
    let cancel_flag = Arc::new(AtomicBool::new(false));
    {
        let mut guard = state.cancel_flag.lock().map_err(|err| err.to_string())?;
        *guard = Some(cancel_flag.clone());
    }

    let result = download_and_verify(
        &url,
        &dest_path,
        expected_sha256.as_deref(),
        |downloaded_bytes, total_bytes| {
            let _ = app.emit(
                "ai-model-download-progress",
                DownloadProgress {
                    downloaded_bytes,
                    total_bytes,
                    fraction: download_progress_fraction(downloaded_bytes, total_bytes),
                },
            );
        },
        || cancel_flag.load(Ordering::SeqCst),
    )
    .await;

    {
        let mut guard = state.cancel_flag.lock().map_err(|err| err.to_string())?;
        *guard = None;
    }

    if let Err(err) = &result {
        if err == "cancelled" {
            let _ = app.emit("ai-model-download-cancelled", ());
        }
    }
    result
}

#[tauri::command]
pub fn ai_model_download_cancel(state: State<'_, AiDownloadState>) -> Result<(), String> {
    let guard = state.cancel_flag.lock().map_err(|err| err.to_string())?;
    if let Some(flag) = guard.as_ref() {
        flag.store(true, Ordering::SeqCst);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn progress_fraction_clamps_and_avoids_div_by_zero() {
        assert_eq!(download_progress_fraction(0, 0), 0.0);
        assert_eq!(download_progress_fraction(50, 100), 0.5);
        assert_eq!(download_progress_fraction(150, 100), 1.0);
    }

    #[test]
    fn sha256_matches_known_vector() {
        // sha256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
        let expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        assert!(verify_sha256(b"", expected).is_ok());
    }

    #[test]
    fn sha256_mismatch_is_rejected() {
        assert!(verify_sha256(b"contenido real", "0000000000000000000000000000000000000000000000000000000000000000").is_err());
    }

    #[test]
    fn sha256_check_is_case_insensitive() {
        let mut hasher = Sha256::new();
        hasher.update(b"hola");
        let digest = hasher.finalize();
        let hex_upper = digest.iter().map(|byte| format!("{byte:02X}")).collect::<String>();
        assert!(verify_sha256(b"hola", &hex_upper).is_ok());
    }
}
