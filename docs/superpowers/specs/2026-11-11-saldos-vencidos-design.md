# Unificar cálculo de saldos vencidos

## Regla

Una deuda está vencida si tiene saldo pendiente positivo y fecha de vencimiento anterior a la fecha actual. La fecha de hoy todavía no está vencida. Aplicar la misma regla en Proformas y Contabilidad, sin depender del estado `overdue` guardado.

## Alcance

Compartir la comparación de fechas entre pantallas y el resumen contable por cliente, incluido el formulario de pagos. Conservar los conjuntos de documentos que cada pantalla carga, los saldos pendientes y las conversiones existentes. No modificar estados, pagos, asignaciones ni otros datos en la base de datos.

## Verificación

Comprobar fechas anteriores, iguales y posteriores a hoy; documentos sin fecha; y saldos completamente pagados. Con los datos de producción observados el 11 de noviembre de 2026, ambas pantallas deben mostrar RD$173,521.10 vencidos para el conjunto actual de proformas pendientes. Ejecutar comprobaciones disponibles y validación Svelte.
