/**
 * Config de remark compartida entre WysiwygEditorView y la prueba de
 * round-trip (BL-031), para que nunca puedan desincronizarse.
 *
 * BL-031 / ADR-004: normalización documentada al convertir Markdown ↔
 * documento — viñetas "-", énfasis "*"/"**". `rule: "-"` no está en la
 * lista de UI-SCREENS §3, pero es una consecuencia inevitable de la
 * conversión: mdast representa cualquier línea horizontal (`---`, `***`,
 * `___`) como el mismo nodo `thematicBreak` sin recordar el carácter
 * original, así que el serializador necesariamente elige uno solo.
 */
export const remarkStringifyOptions = {
  bullet: "-",
  emphasis: "*",
  strong: "*",
  rule: "-",
} as const;
