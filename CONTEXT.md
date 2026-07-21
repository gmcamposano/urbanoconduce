# magikalInvoice

Sistema de facturación e inventario para un negocio que vende productos físicos
con variantes (modelo + color), manteniendo precios acordados por cliente.

## Language

### Precios

**Precio de catálogo**:
Precio por defecto de un producto en el catálogo global. Vive en `products.price_without_taxes`. Aplica a cualquier cliente que no tenga un precio por cliente asignado. Es el precio que se muestra y edita en la página `/products`.
_Avoid_: precio base, precio sin impuestos (como concepto; es el nombre de la columna, no del término)

**Precio por cliente**:
Precio específico que un cliente paga por un producto. Vive en `client_product_prices.unit_price`. Es la capa más específica de pricing: si existe para (cliente, producto), se usa ese al facturar. No es un descuento relativo — es un precio absoluto. Su granularidad es (cliente, producto), no por variante ni color. Funciona como excepción encima de la tarifa asignada al cliente.
_Avoid_: precio especial, precio personalizado, precio acordado

**Tarifa**:
Colección nombrable de precios por producto, asignable a uno o más clientes. Vive en `price_lists` (cabecera) y `price_list_entries` (precio por producto dentro de la tarifa). Permite que N clientes compartan la misma estructura de precios sin duplicar filas. Un cliente tiene asignada una tarifa vía `client_price_list_assignments` (con vigencia `valid_from`/`valid_to`). La granularidad de una entrada es (tarifa, producto), no por variante ni color. Cada entrada es EITHER un precio absoluto (`unit_price`) OR un % de descuento live sobre el catálogo (`discount_percentage`).
_Avoid_: lista de precios, nivel de precios, price list, pricelist

**Precio efectivo**:
El precio que se aplica al facturar una línea a un cliente. Se resuelve en tres niveles, del más específico al más general: (1) precio por cliente si existe para (cliente, producto), si no (2) entrada de la tarifa asignada al cliente (asignación vigente: `valid_from <= hoy AND (valid_to IS NULL OR valid_to >= hoy)`) si existe para ese producto, si no (3) precio de catálogo. Para entradas de tarifa en modo % (descuento relativo), el precio efectivo se computa como `catalog * (1 - descuento/100)` al momento de facturar. Vive en la función `resolveUnitPrices` (server) y `resolveEffectivePrice` (client), y se snapshotan en `invoice_items.unit_price` al emitir.
_Avoid_: precio final, precio calculado

### Catálogo

**Producto**:
Una entrada del catálogo global identificada por (título normalizado + modelo). Es único en todo el sistema — no pertenece a ningún cliente. Tiene un precio de catálogo. Vive en `products`.
_Avoid_: artículo, ítem (ese es un concepto de factura)

**Variante**:
Combinación (producto + color) que tiene existencia física en inventario. Cada variante tiene su propio stock, SKU, stock mínimo y costo de compra. Vive en `product_variants`.
_Avoid_: presentación, combinación

**Modelo**:
Sub-clasificación de un producto (ej. "Elite", "Pro"). Forma parte de la unicidad del producto: dos productos con el mismo título pero distinto modelo son productos distintos. Vive en `product_models`.
_Avoid_: tipo, categoría

### Comercial

**Cliente**:
Persona o empresa a la que se le factura. Puede tener precios por cliente asignados a productos específicos. Vive en `clients`.
_Avoid_: cuenta, comprador

**Factura**:
Documento comercial emitido a un cliente. Sus líneas (invoice*items) son snapshots: guardan descripción, precio unitario y monto al momento de emisión — no se recalculan si el precio cambia después. Vive en `invoices`; las líneas en `invoice_items`.
\_Avoid*: recibo, cuenta

## Relationships

- Un **Producto** tiene cero o más **Variantes** (una por color)
- Un **Producto** tiene un **Precio de catálogo**
- Una **Tarifa** tiene cero o más entradas, cada una referenciando un **Producto** con un precio absoluto o un % de descuento live
- Un **Cliente** puede tener asignadas una o más **Tarifas** vía `client_price_list_assignments` (con vigencia `valid_from`/`valid_to`), pero solo una vigente a la vez
- Un **Cliente** puede tener cero o más **Precios por cliente**, cada uno referenciando un **Producto**
- Al facturar, el precio unitario de una línea = **Precio efectivo** = **Precio por cliente** si existe para (cliente, producto), si no entrada de la **Tarifa** vigente asignada si existe para ese producto, si no **Precio de catálogo**
- Una **Factura** pertenece a un **Cliente** y tiene una o más líneas que referencian **Variantes**
- Las líneas de factura snapshotan el precio al emitir; cambios posteriores a precios no afectan facturas emitidas

## Example dialogue

> **Dev:** "Si le subo el precio de catálogo a un producto, ¿se actualizan las facturas viejas?"
> **Domain expert:** "No — las facturas son snapshots. Solo afecta a las nuevas facturas, y solo si el cliente no tiene precio por cliente. Si tiene precio por cliente, ni siquiera lo toca."
>
> **Dev:** "¿Y el precio por cliente es por color o por variante?"
> **Domain expert:** "No, es por producto. Si el cliente acordó $150 para 'Cover Elite', ese precio aplica a cualquier color de ese producto."

## Flagged ambiguities

- "precio" sin calificador era ambiguo: podía referirse al precio de catálogo (`products.price_without_taxes`) o al precio por cliente (`client_product_prices.unit_price`). Resuelto: siempre calificar como "precio de catálogo", "precio por cliente", "precio de tarifa" o "precio efectivo".
- Tras la migración de consolidación de catálogo (`20260717000000_consolidate_product_catalog.sql`), los productos dejaron de pertenecer a un cliente. `products.client_id` existe pero es legacy/nullable y no debe usarse para lógica de pricing — el pricing por cliente vive en `client_product_prices`.
- Antes de las tarifas (`20260721000000_create_price_lists.sql`), la resolución era binaria (precio por cliente > catálogo). Con tarifas es ternaria (precio por cliente > entrada de tarifa > catálogo). Los 12 overrides preexistentes en `client_product_prices` se dejaron como excepciones — no se migraron a tarifas.
