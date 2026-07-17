# Catálogo de productos global con precios por cliente

El catálogo de productos (`products`) pasó de pertenecer a un único cliente a ser
global: un producto es único por (título normalizado + modelo) y no pertenece a
nadie. Los precios acordados por cliente viven en `client_product_prices`
(cliente, producto, precio), que ya existía pero no se usaba. Decidimos esto
porque el inventario se keya por (producto + modelo + color), no por cliente —
tener el mismo "Cover Elite" duplicado por cliente impedía consolidar stock y
obligaba a mantener precios en N filas. Los precios por cliente se preservan
como overrides absolutos (no relativos) y se aplican al facturar; las facturas
emitidas son snapshots inmutables. La migración `20260717000000` fusionó los
duplicados conservando el más antiguo como sobreviviente y migrando cada
precio por cliente al sobreviviente.

_La alternativa rechazada_ era mantener productos por cliente y añadir una capa
de "producto canónico" sobre los duplicados: más compleja, no resolvía el
inventario, y dejaba los precios viviendo en la columna equivocada
(`products.price_without_taxes` por cliente).
