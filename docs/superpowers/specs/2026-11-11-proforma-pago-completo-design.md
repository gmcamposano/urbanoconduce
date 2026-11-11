# Pago completo en lista de proformas

## Objetivo

Dejar claro que el importe principal es el total de la proforma y distinguir visualmente las proformas pagadas por completo de aquellas con abonos parciales.

## Diseño

En `/dashboard/proforma`, reutilizar el estado de cobranza existente. Cuando sea `paid`, reemplazar la línea «Abonado» por la etiqueta «Pagado» con fondo verde suave, siguiendo la paleta de `DESIGN.md`. No repetir el importe pagado, que coincide con el total cuando el pago cubre exactamente la proforma. Mantener visible el restante.

Para pagos parciales, conservar «Abonado» y «Restante». No modificar cálculos ni datos contables; si un pago excede el total, no alterar los datos registrados en la base de datos.

## Redirección después de un pago

Al registrar un pago desde `/dashboard/accounting/new`, redirigir a Contabilidad sin mostrar el aviso de productos pendientes de inventario. Mantener intactos el registro del pago, la salida de inventario y los controles de existencias.

## Verificación

Comprobar proformas sin pago, parcialmente pagadas y completamente pagadas; verificar que la presentación de pagos parciales y los saldos no cambien. Ejecutar las comprobaciones disponibles del proyecto y del componente Svelte.

Comprobar que un pago con faltantes redirige a Contabilidad sin mostrar el aviso, y que el procesamiento contable y de inventario no cambia.
