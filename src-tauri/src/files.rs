// Comandos de archivo (ADR-007). Se implementan como comandos propios en
// lugar de los comandos del plugin `fs` para poder garantizar la escritura
// atómica (SEC-007) en una sola llamada IPC y validar la extensión en un
// único lugar. Las rutas llegan aquí solo desde un diálogo nativo
// (`tauri-plugin-dialog`, que ya las agrega a su propio scope) o desde una
// sesión restaurada ya validada por `validate_existing_paths` (SEC-002).
//
// La lista de extensiones debe coincidir con `app.config.ts -> fileFilters`
// (SPEC-CORE-001, PD-23); duplicarla aquí es inevitable cruzando el límite
// Rust/TypeScript.
const ALLOWED_EXTENSIONS: [&str; 3] = ["md", "markdown", "txt"];

/// Debe coincidir con `app.config.ts -> behavior.maxFolderOpen` (PD-26).
const MAX_FOLDER_OPEN: usize = 20;

fn has_allowed_extension(path: &str) -> bool {
    std::path::Path::new(path)
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ALLOWED_EXTENSIONS.contains(&ext.to_lowercase().as_str()))
        .unwrap_or(false)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    if !has_allowed_extension(&path) {
        return Err(format!("Extensión no permitida: {path}"));
    }
    std::fs::read_to_string(&path).map_err(|err| err.to_string())
}

/// SEC-007: escribe a `{path}.tmp` y renombra sobre el original, para no
/// dejar el archivo corrupto si falla a medias.
#[tauri::command]
pub fn write_text_file_atomic(path: String, contents: String) -> Result<(), String> {
    if !has_allowed_extension(&path) {
        return Err(format!("Extensión no permitida: {path}"));
    }
    let tmp_path = format!("{path}.tmp");
    std::fs::write(&tmp_path, contents.as_bytes()).map_err(|err| err.to_string())?;
    std::fs::rename(&tmp_path, &path).map_err(|err| {
        // Best-effort: si el rename falla no dejamos el .tmp huérfano.
        let _ = std::fs::remove_file(&tmp_path);
        err.to_string()
    })
}

/// SPEC-CORE-016 / SEC-002: al restaurar sesión, cada ruta se revalida
/// (existe + extensión permitida) antes de que el frontend intente leerla.
/// Las rutas inválidas se descartan silenciosamente.
#[tauri::command]
pub fn validate_existing_paths(paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|path| has_allowed_extension(path) && std::path::Path::new(path).exists())
        .collect()
}

/// SPEC-CORE-020 / SEC-006: agrega la carpeta del archivo abierto al scope
/// dinámico del protocolo `asset:` (BL-034), para que sus imágenes locales
/// puedan mostrarse en vista Formato. No persiste entre reinicios (SEC-002:
/// "el scope change is not persisted"), cada apertura la vuelve a otorgar.
#[tauri::command]
pub fn allow_asset_folder(app: tauri::AppHandle, dir: String) -> Result<(), String> {
    use tauri::Manager;
    app.asset_protocol_scope()
        .allow_directory(&dir, true)
        .map_err(|err| err.to_string())
}

/// SPEC-CORE-019 / SEC-010 (BUG-03): equivalente a `allow_asset_folder` pero
/// para el scope dinámico del plugin `fs` — `fs:allow-watch` (capabilities/
/// main.json) habilita el comando `watch()` "sin ningún scope preconfigurado"
/// (acl-manifests.json), así que sin esto cualquier ruta ajena a
/// `fs:scope-appconfig` se rechaza en silencio. Se otorga por archivo
/// (no por carpeta) porque solo se vigilan archivos individuales; como
/// `allow_asset_folder`, no persiste entre reinicios (SEC-002) — cada
/// apertura y cada `syncFileWatchers()` lo vuelve a otorgar.
#[tauri::command]
pub fn allow_watch_path(app: tauri::AppHandle, path: String) -> Result<(), String> {
    use tauri_plugin_fs::FsExt;
    app.fs_scope().allow_file(&path).map_err(|err| err.to_string())
}

/// SEC-006 / PD-22: resuelve una ruta de imagen relativa al Markdown contra
/// la carpeta del archivo y rechaza cualquier resultado que escape de ella
/// (`../` traversal). Devuelve la ruta absoluta canónica lista para
/// `convertFileSrc(..., "asset")`.
#[tauri::command]
pub fn resolve_local_image(base_dir: String, relative_path: String) -> Result<String, String> {
    let base = std::fs::canonicalize(&base_dir).map_err(|err| err.to_string())?;
    let candidate = base.join(&relative_path);
    let canonical = std::fs::canonicalize(&candidate).map_err(|err| err.to_string())?;
    if !canonical.starts_with(&base) {
        return Err("La imagen está fuera de la carpeta del archivo".to_string());
    }
    Ok(canonical.to_string_lossy().into_owned())
}

/// BL-052 / SEC-011: resuelve argumentos CLI crudos (archivos y/o carpetas)
/// a una lista plana de rutas de archivo válidas y existentes. Cada carpeta
/// se expande solo a su primer nivel, hasta `MAX_FOLDER_OPEN` archivos
/// (PD-26); las rutas inválidas, inexistentes o con extensión no permitida
/// se descartan en silencio, igual que `validate_existing_paths`.
#[tauri::command]
pub fn resolve_cli_paths(paths: Vec<String>) -> Vec<String> {
    let mut result = Vec::new();
    for raw in paths {
        let Ok(canonical) = std::fs::canonicalize(&raw) else { continue };
        if canonical.is_dir() {
            let Ok(entries) = std::fs::read_dir(&canonical) else { continue };
            let mut files: Vec<String> = entries
                .filter_map(|entry| entry.ok())
                .map(|entry| entry.path())
                .filter(|path| path.is_file() && has_allowed_extension(&path.to_string_lossy()))
                .map(|path| path.to_string_lossy().into_owned())
                .collect();
            files.sort();
            files.truncate(MAX_FOLDER_OPEN);
            result.extend(files);
        } else if canonical.is_file() && has_allowed_extension(&canonical.to_string_lossy()) {
            result.push(canonical.to_string_lossy().into_owned());
        }
    }
    result
}
