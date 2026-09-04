// MAC-T5 / PD-29: botón "Instalar comando mdviedit en PATH" (Preferencias →
// Sistema, solo visible en macOS — UI-SCREENS §8). El comando siempre se
// registra en `generate_handler!` (ver lib.rs) para no complicar esa macro
// con condicionales; en plataformas que no son macOS simplemente devuelve
// un error, algo que nunca ocurre en la práctica porque el botón que lo
// invoca solo se renderiza en macOS.
//
// Mecanismo elegido para la elevación: `osascript ... with administrator
// privileges`, que dispara el diálogo nativo de autorización de macOS una
// sola vez. Se descarta `AuthorizationExecuteWithPrivileges` (deprecado por
// Apple desde 10.7, exige bindings FFI inseguros para una API en vías de
// desaparecer) y no se usa el plugin `shell` de Tauri (deshabilitado por
// SEC-008: "no se ejecutan comandos del sistema") — este es un
// `std::process::Command` puntual y fijo lanzado desde un comando Rust
// propio, no una capacidad de shell genérica expuesta al frontend.
#[cfg(target_os = "macos")]
const SYMLINK_TARGET: &str = "/usr/local/bin/mdviedit";

#[cfg(target_os = "macos")]
fn fallback_command(exe: &str) -> String {
    format!("sudo ln -sf '{exe}' '{SYMLINK_TARGET}'")
}

/// El símlink apunta al ejecutable actual (`std::env::current_exe`), no a
/// una ruta fija de `/Applications/MDviedit.app` — así funciona aunque el
/// usuario haya movido el bundle, cubriendo igual el caso típico descrito
/// en MAC-T5.
#[cfg(target_os = "macos")]
#[tauri::command]
pub fn install_path_command() -> Result<(), String> {
    let exe = std::env::current_exe().map_err(|err| err.to_string())?;
    let exe_str = exe.to_string_lossy();
    let script = format!(
        "do shell script \"mkdir -p /usr/local/bin && ln -sf '{exe_str}' '{SYMLINK_TARGET}'\" with administrator privileges"
    );
    let status = std::process::Command::new("osascript")
        .arg("-e")
        .arg(&script)
        .status()
        .map_err(|err| err.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err(fallback_command(&exe_str))
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub fn install_path_command() -> Result<(), String> {
    Err("Solo disponible en macOS".to_string())
}
