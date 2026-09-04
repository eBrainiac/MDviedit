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
        .invoke_handler(tauri::generate_handler![
            files::read_text_file,
            files::write_text_file_atomic,
            files::validate_existing_paths,
            files::allow_asset_folder,
            files::allow_watch_path,
            files::resolve_local_image,
            files::resolve_cli_paths,
            macos::install_path_command,
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
