# Visibilidad de proformas convertidas

## Problema

Al emitir una factura desde una proforma totalmente pagada, el sistema crea la factura y conserva la proforma en la lista de Proformas. Esto hace que un mismo proceso comercial parezca activo en ambos módulos.

## Comportamiento

- Una proforma pagada permanece en Proformas mientras no haya originado una factura.
- Al emitir la factura, la proforma convertida desaparece de `/dashboard/proforma`.
- La factura generada permanece en `/dashboard/invoices`.
- Abrir directamente la URL de una proforma convertida redirige a su factura generada.
- La fila fuente de la proforma, sus partidas contables y su historial de inventario se conservan.

## Implementación

- Usar `invoices.source_proforma_id` como relación canónica de conversión.
- En la carga de la lista, consultar las facturas que tengan `source_proforma_id` y excluir sus proformas fuente.
- En la carga del detalle, buscar una factura cuyo `source_proforma_id` coincida con la proforma solicitada y redirigir al detalle de esa factura.
- Mantener sin cambios la acción de emisión y su protección idempotente.
- No eliminar filas, cambiar `factura_tipo`, transferir pagos ni añadir estados o migraciones.

## Errores

- Si falla la consulta de conversiones en la lista, registrar el error y devolver una lista vacía para no mostrar como activa una proforma potencialmente convertida.
- Si falla la comprobación de conversión en el detalle, registrar el error y volver a la lista de Proformas.

## Verificación

- Confirmar que proformas no pagadas y pagadas sin emitir siguen visibles.
- Confirmar que una proforma emitida desaparece de Proformas.
- Confirmar que la factura generada aparece en Facturas.
- Confirmar que la URL antigua redirige a la factura correcta.
- Ejecutar comprobación TypeScript/Svelte, lint y build.
