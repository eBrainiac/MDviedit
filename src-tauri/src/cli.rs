// BL-052 / INST-014: argumentos CLI compartidos entre el arranque normal
// (tauri-plugin-cli, ver lib.rs) y la reinvocación de single-instance, que
// recibe el argv crudo de la segunda instancia y no pasa por el plugin CLI.
use serde::Serialize;

#[derive(Serialize, Clone, Default)]
pub struct CliOpenArgs {
    pub new: bool,
    pub paths: Vec<String>,
}

/// Parsea argv sin el nombre del binario, con las mismas reglas declaradas
/// en `tauri.conf.json -> plugins.cli`: `--new` es una bandera, todo lo demás
/// que no empiece con `-` es una ruta (archivo o carpeta).
pub fn parse_raw_args(args: &[String]) -> CliOpenArgs {
    let mut result = CliOpenArgs::default();
    for arg in args {
        if arg == "--new" {
            result.new = true;
        } else if !arg.starts_with('-') {
            result.paths.push(arg.clone());
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_new_flag_and_paths() {
        let args = vec!["--new".to_string(), "a.md".to_string(), "b.md".to_string()];
        let parsed = parse_raw_args(&args);
        assert!(parsed.new);
        assert_eq!(parsed.paths, vec!["a.md", "b.md"]);
    }

    #[test]
    fn ignores_unknown_flags() {
        let args = vec!["--version".to_string(), "a.md".to_string()];
        let parsed = parse_raw_args(&args);
        assert!(!parsed.new);
        assert_eq!(parsed.paths, vec!["a.md"]);
    }

    #[test]
    fn empty_args_yield_defaults() {
        let parsed = parse_raw_args(&[]);
        assert!(!parsed.new);
        assert!(parsed.paths.is_empty());
    }
}
