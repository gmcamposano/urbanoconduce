# magikalInvoice

Sistema de facturación e inventario para un negocio que vende productos físicos
con variantes (modelo + color), manteniendo precios acordados por cliente.

## Language

### Precios

**Precio de catálogo**:
Precio por defecto de un producto en el catálogo global. Vive en `products.price_without_taxes`. Aplica a cualquier cliente que no tenga un precio por cliente asignado. Es el precio que se muestra y edita en la página `/products`.
_Avoid_: precio base, precio sin impuestos (como concepto; es el nombre de la columna, no del término)

**Precio por cliente**:
Precio específico que un cliente paga por un producto. Vive en `client_product_prices.unit_price`. Reemplaza al precio de catálogo al facturar: si existe para (cliente, producto), se usa ese; si no, cae al precio de catálogo. No es un descuento relativo — es un precio absoluto. Su granularidad es (cliente, producto), no por variante ni color.
_Avoid_: precio especial, precio personalizado, precio acordado

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
- Un **Cliente** puede tener cero o más **Precios por cliente**, cada uno referenciando un **Producto**
- Al facturar, el precio unitario de una línea = **Precio por cliente** si existe para (cliente, producto), si no **Precio de catálogo**
- Una **Factura** pertenece a un **Cliente** y tiene una o más líneas que referencian **Variantes**
- Las líneas de factura snapshotan el precio al emitir; cambios posteriores a precios no afectan facturas emitidas

## Example dialogue

> **Dev:** "Si le subo el precio de catálogo a un producto, ¿se actualizan las facturas viejas?"
> **Domain expert:** "No — las facturas son snapshots. Solo afecta a las nuevas facturas, y solo si el cliente no tiene precio por cliente. Si tiene precio por cliente, ni siquiera lo toca."
>
> **Dev:** "¿Y el precio por cliente es por color o por variante?"
> **Domain expert:** "No, es por producto. Si el cliente acordó $150 para 'Cover Elite', ese precio aplica a cualquier color de ese producto."

## Flagged ambiguities

- "precio" sin calificador era ambiguo: podía referirse al precio de catálogo (`products.price_without_taxes`) o al precio por cliente (`client_product_prices.unit_price`). Resuelto: siempre calificar como "precio de catálogo" o "precio por cliente".
- Tras la migración de consolidación de catálogo (`20260717000000_consolidate_product_catalog.sql`), los productos dejaron de pertenecer a un cliente. `products.client_id` existe pero es legacy/nullable y no debe usarse para lógica de pricing — el pricing por cliente vive en `client_product_prices`.
