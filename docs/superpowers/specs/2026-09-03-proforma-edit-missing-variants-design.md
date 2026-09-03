# Variantes faltantes al editar proformas

## Problema

La creación de proformas permite confirmar y crear variantes de inventario faltantes, pero la edición falla inmediatamente cuando no encuentra una variante para un producto y color.

## Comportamiento esperado

La edición debe seguir el flujo existente de creación:

1. Detectar y deduplicar variantes faltantes por producto y color.
2. Devolver la lista al editor sin perder los datos del formulario.
3. Mostrar un diálogo de confirmación.
4. Si el usuario confirma, crear las variantes con stock inicial y stock mínimo en cero.
5. Resolver sus identificadores y guardar la proforma.
6. Si el usuario cancela, no modificar la proforma ni el inventario.

## Alcance

- Actualizar la acción `updateInvoice` de la ruta de edición.
- Añadir al editor el estado y diálogo ya usados por la ruta de creación.
- Mantener permisos, validaciones, precios y cálculos actuales.
- No cambiar el esquema de base de datos ni aplicar migraciones.

## Errores

- Un fallo al consultar o crear variantes debe impedir el guardado y mostrar un mensaje accionable.
- Variantes repetidas dentro de la misma proforma deben crearse una sola vez.
- La creación requiere confirmación explícita; el primer envío nunca crea inventario.

## Verificación

- Ejecutar comprobación de tipos/Svelte y lint.
- Verificar que una edición sin variantes faltantes conserve el flujo actual.
- Verificar que una edición con variantes faltantes solicite confirmación, cree las variantes y guarde.
- Verificar que cancelar no cree variantes ni guarde cambios.

## Diseño visual

Reutilizar `Dialog`, colores, tipografía, radios y botones actuales, conforme a `DESIGN.md`. No introducir nuevos patrones visuales.
