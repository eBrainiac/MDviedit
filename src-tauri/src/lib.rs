pub mod ai_byok;
pub mod ai_download;
mod ai_keychain;
pub mod ai_local;
mod cli;
mod files;
mod macos;

use tauri::{Emitter, Manager};
use tauri_plugin_cli::CliExt;

/// BL-052 / INST-014: `mdviedit --version` imprime la versión y termina
/// antes de crear cualquier ventana. `tauri_plugin_cli` arma el parser con
/// `try_get_matches` (no `get_matches`): cuando clap detecta `--version`/
/// `-V`, en vez de imprimir y salir por sí solo, el plugin captura
/// `ErrorKind::DisplayVersion` e inserta la clave "version" en
/// `matches.args` con `ArgData::default()` (`value: Value::Null` — NO
/// `Bool(true)`, ver tauri-plugin-cli/src/parser.rs `get_matches`). Lo que
/// importa es la presencia de la clave, no su valor.
fn handle_version_flag(app: &tauri::App) -> bool {
    let Ok(matches) = app.cli().matches() else { return false };
    if matches.args.contains_key("version") {
        println!("{}", app.package_info().version);
        true
    } else {
        false
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        // BL-052: una segunda invocación reenvía su argv crudo aquí en vez
        // de abrir una segunda ventana. No pasa por tauri-plugin-cli (ese
        // solo parsea el proceso ACTUAL), así que se parsea a mano con las
        // mismas reglas (ver cli::parse_raw_args) y se reenvía al frontend
        // de la ventana ya existente vía evento.
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let parsed = cli::parse_raw_args(&args[1..]);
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
            let _ = app.emit("cli-open", parsed);
        }));
    }

    let app = builder
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_window_state::Builder::default().build())
        // BL-052 / INST-014: `--version` NO se declara en
        // `tauri.conf.json -> plugins.cli` — el clap::Command que arma
        // tauri-plugin-cli ya trae un `--version`/`-V` propio (usa la
        // versión de Cargo.toml); declarar uno propio con el mismo nombre
        // choca con ese (panic en debug: "Argument names must be unique").
        // Se lee igual desde `matches.args["version"]`, ver handle_version_flag.
        .plugin(tauri_plugin_cli::init())
        // BL-116 / SPEC-CORE-022 / RULE-005: decisión de arquitectura de
        // red — la CSP del webview (`tauri.conf.json -> app.security.csp`)
        // se queda en `connect-src 'none'`, sin abrirse a ningún host. TODA
        // petición de red del Chat de IA (BYOK y descarga del modelo local)
        // vive del lado de Rust vía `reqwest` (ai_byok.rs/ai_download.rs),
        // nunca `fetch`/XHR desde el frontend. Es una forma más estricta de
        // cumplir "único punto de la app con acceso a red" que abrir CSP:
        // el webview sigue sin poder hablar con nada por su cuenta aunque
        // el Chat esté activo, y el acceso real queda acotado a dos
        // comandos Tauri explícitos.
        .manage(ai_download::AiDownloadState::default())
        .manage(ai_local::AiLocalState::default())
        // BUG-13 / SPEC-CORE-024 / SEC-012: se maneja del lado de Rust, no
        // con `getCurrentWindow().onDragDropEvent()` del frontend — ese
        // listener JS se registra de forma asíncrona tras la hidratación de
        // Svelte, mientras que la ventana ya acepta drops nativos de OS
        // desde el momento en que se crea (antes de que exista ningún
        // frontend). Un drop que llegue en esa ventana se perdía en
        // silencio (sin buffer/reintento del lado del puente de eventos de
        // Tauri) — coincide con "ni abre el archivo ni muestra ningún
        // error". `on_window_event` corre en Rust desde el arranque, sin
        // depender de que el JS ya haya terminado de montar. Reenvía al
        // mismo evento "cli-open" que ya escuchan `+layout.svelte` (mac
        // `RunEvent::Opened` arriba) y `tauri-plugin-single-instance`, así
        // que reutiliza la misma resolución/validación (`resolve_cli_paths`,
        // SEC-011) sin duplicar lógica de apertura.
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::DragDrop(tauri::DragDropEvent::Drop { paths, .. }) = event {
                // SPEC-CORE-024 / PD-92 / IN-041: un solo archivo por evento;
                // más de uno queda fuera de alcance, sin comportamiento
                // definido — se ignora en vez de abrir todos como el CLI.
                if paths.len() == 1 {
                    let paths: Vec<String> = paths.iter().map(|p| p.to_string_lossy().into_owned()).collect();
                    let _ = window.emit("cli-open", cli::CliOpenArgs { new: false, paths });
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            files::read_text_file,
            files::write_text_file_atomic,
            files::validate_existing_paths,
            files::allow_asset_folder,
            files::allow_watch_path,
            files::resolve_local_image,
            files::resolve_cli_paths,
            macos::install_path_command,
            ai_keychain::ai_keychain_set_api_key,
            ai_keychain::ai_keychain_get_api_key,
            ai_keychain::ai_keychain_delete_api_key,
            ai_byok::ai_byok_send_message,
            ai_download::ai_model_download_start,
            ai_download::ai_model_download_cancel,
            ai_local::ai_local_model_status,
            ai_local::ai_local_model_load,
            ai_local::ai_local_model_unload,
            ai_local::ai_local_generate,
        ])
        .setup(|app| {
            if handle_version_flag(app) {
                app.handle().exit(0);
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|app_handle, event| {
        // BL-052 (mac): Finder "Abrir con" / doble clic en un .md asociado
        // llega como RunEvent::Opened, no como argv — se reenvía al mismo
        // evento "cli-open" que ya escucha el frontend para CLI/single-instance.
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = event {
            let paths: Vec<String> = urls
                .into_iter()
                .filter_map(|url| url.to_file_path().ok())
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            if !paths.is_empty() {
                let _ = app_handle.emit("cli-open", cli::CliOpenArgs { new: false, paths });
            }
        }
        #[cfg(not(target_os = "macos"))]
        {
            let _ = (app_handle, event);
        }
    });
}
