// BL-109 / ADR-010 / UI-SCREENS §8: la clave de API de BYOK nunca vive en
// `tauri-plugin-store` (JSON en texto plano, ADR-006) — se guarda en el
// almacén de credenciales del sistema operativo (Windows Credential Manager
// / macOS Keychain vía el crate `keyring`, feature `apple-native-keyring-store`
// en Cargo.toml). Desviación explícita de ADR-006, ya autorizada en el propio
// ADR-010 ("Consecuencias").
const SERVICE_NAME: &str = "mx.mdviedit.app.ai";
const USERNAME: &str = "ai-api-key";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE_NAME, USERNAME).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn ai_keychain_set_api_key(api_key: String) -> Result<(), String> {
    entry()?.set_password(&api_key).map_err(|err| err.to_string())
}

/// `Ok(None)` si nunca se configuró una clave (distinto de un error real de
/// acceso al almacén del SO).
#[tauri::command]
pub fn ai_keychain_get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(err.to_string()),
    }
}

#[tauri::command]
pub fn ai_keychain_delete_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(err.to_string()),
    }
}
