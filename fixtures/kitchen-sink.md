---
title: Kitchen Sink
author: Sebastian
date: 2026-09-02
tags: [markdown, gfm, fixture]
draft: false
---

# Encabezado 1

## Encabezado 2

### Encabezado 3

#### Encabezado 4

##### Encabezado 5

###### Encabezado 6

Un párrafo con **negrita**, *cursiva*, ***negrita y cursiva***, ~~tachado~~,
`código en línea` y un [enlace](https://example.com "Ejemplo") además de un
enlace automático <https://example.com/auto>.

Salto de línea duro al final de esta línea.\
Segunda línea del mismo párrafo.

---

## Listas

- Elemento sin ordenar 1
- Elemento sin ordenar 2
  - Sub-elemento anidado
  - Otro sub-elemento
- Elemento sin ordenar 3

1. Elemento ordenado 1
2. Elemento ordenado 2
   1. Sub-elemento ordenado
   2. Otro sub-elemento ordenado
3. Elemento ordenado 3

## Tareas (GFM)

- [x] Tarea completada
- [ ] Tarea pendiente
- [ ] Otra tarea pendiente
  - [x] Sub-tarea completada

## Cita

> Esta es una cita.
>
> > Cita anidada dentro de otra cita.

## Código

Código en línea: `const x = 1;`

```js
function saludo(nombre) {
  return `Hola, ${nombre}!`;
}
```

```
Bloque de código sin lenguaje especificado.
```

## Tabla (GFM)

| Columna A                 | Columna B | Columna C |
| ------------------------- | :-------: | --------: |
| izquierda                 |   centro  |   derecha |
| 1                         |     2     |         3 |
| texto largo en esta celda |   corto   |        42 |

## Línea horizontal

---

## Imagen

![Texto alternativo](./kitchen-sink-image.png "Título de la imagen")

## HTML embebido

<div class="nota-personalizada">
  <strong>Nota:</strong> este bloque es HTML crudo dentro del Markdown y
  debe conservarse intacto (ADR-004) y sanitizarse en vista Formato (SEC-005).
</div>

<details>
<summary>Detalles expandibles</summary>

Contenido dentro de un bloque `<details>` de HTML.

</details>

<!-- Un comentario HTML que no debería renderizarse -->

Un <mark>resaltado en línea</mark> usando una etiqueta HTML inline.

## Front-matter y bloques no soportados

El bloque YAML al inicio de este archivo (front-matter) debe conservarse
intacto sin ser interpretado como contenido Markdown (ADR-004 §"Modelo
único").

## Caracteres especiales y escapes

Un asterisco literal: \*no es cursiva\*. Un guion bajo literal: \_no es
cursiva\_. Símbolos: & < > " ' © ® ™ — – … "comillas tipográficas".

## Nota al pie (GFM extendido)

Este texto tiene una nota al pie[^1].

[^1]: Contenido de la nota al pie.
