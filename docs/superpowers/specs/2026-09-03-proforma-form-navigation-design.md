# Navegación automática en formularios de proforma

## Problema

Los errores aparecen sobre formularios largos sin llevar al usuario hasta el aviso. Añadir filas desde una posición alejada también obliga a desplazarse manualmente hasta la nueva fila.

## Alcance

Aplicar el mismo comportamiento a la creación y edición de proformas. No cambiar acciones servidor, datos ni esquema de base de datos.

## Errores

- Tras una respuesta fallida que incluya `error`, esperar que Svelte renderice el aviso.
- Desplazar suavemente el aviso al inicio visible y moverle el foco.
- Procesar también errores presentes durante la carga inicial.
- Añadir `role="alert"` y `tabindex="-1"` al aviso.
- Mantener el diálogo actual para variantes faltantes; no tratar ese flujo de confirmación como error.

## Botón flotante

- Mostrarlo cuando existan dos o más filas.
- Ubicarlo al centro-derecha en escritorio y en la esquina inferior derecha en móvil.
- Mantener los botones actuales de añadir fila.
- Deshabilitarlo durante carga o cuando la última fila no permita añadir otra.
- Al activarlo, añadir una fila, esperar su render, desplazarla suavemente a la vista y enfocar su selector de producto.

## Implementación

- Reutilizar una función local por formulario para añadir y navegar a la fila.
- Identificar cada fila mediante su ID ya existente.
- Añadir un selector estable al control de producto de cada fila para poder enfocarlo.
- Respetar movimiento reducido del sistema usando desplazamiento instantáneo cuando corresponda.

## Diseño y accesibilidad

- Usar verde primario, texto oscuro, radio de 6 px y sombras existentes según `DESIGN.md`.
- Incluir nombre accesible en el botón flotante.
- Mantener objetivo táctil mínimo de 36 por 36 px.
- Evitar que el botón tape acciones importantes en móvil.

## Verificación

- Probar error inicial y error devuelto por acción en ambas rutas.
- Probar botón con menos y más de dos filas, fila incompleta y estado de carga.
- Probar desplazamiento y foco en escritorio y móvil.
- Ejecutar autofixer Svelte, comprobación focalizada, Prettier, ESLint y build.
