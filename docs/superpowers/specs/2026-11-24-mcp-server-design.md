# Servidor MCP de magikalInvoice

Fecha: 2026-11-24 · Estado: borrador para aprobar

## Objetivo

Manejar la app desde Claude (claude.ai, móvil y Claude Code): consultar datos, crear y editar
Proformas desde un CSV o Excel con **formato libre**, registrar pagos y convertir a Factura, sin
cargar nada a mano.

## Decisiones

| Tema | Decisión |
| --- | --- |
| Despliegue | Ruta `/mcp` dentro de la misma app SvelteKit. Se despliega en Coolify junto con la app. |
| Transporte | MCP Streamable HTTP, sin estado (`@modelcontextprotocol/sdk`, transporte web estándar). |
| Permisos | Cada llamada usa **el usuario que inició sesión**: token de Supabase → cliente con `Authorization: Bearer`. RLS y roles (admin/editor/viewer) aplican igual que en la web. Nada de service role. |
| Login | OAuth 2.1 con **Supabase Auth como servidor OAuth** (registro dinámico de clientes activado). La app sirve `/.well-known/oauth-protected-resource` y una pantalla de consentimiento `/oauth/consent`. |
| Formato libre | Claude lee el archivo (columnas variadas) y manda líneas de texto al MCP. El MCP compara contra el catálogo y devuelve coincidencias, dudas y precios. Nunca adivina en silencio. |
| Reglas de negocio | Se sacan de los form actions a `src/lib/server/services/`. La web y el MCP llaman las mismas funciones: una sola fuente de reglas (precio por cliente, colores válidos, variantes faltantes, stock, impuestos 18 %). |
| Escrituras | Toda escritura tiene paso de vista previa. Pagos y conversión a Factura exigen `confirmar: true` tras mostrar la vista previa. |

## Herramientas

### Consulta (cualquier rol con acceso)
- `buscar_clientes(texto)`
- `buscar_productos(texto, cliente_id?)` → producto, modelo, colores, precio que pagaría ese Cliente.
- `consultar_stock(texto | variante)`
- `listar_proformas(filtros)` y `ver_proforma(id)` (líneas, total, pagado, saldo).
- `saldos_vencidos(cliente_id?)` (misma regla que `src/lib/overdue.ts`).

### Proformas (admin o editor)
- `preparar_proforma(cliente, lineas[])` — **no escribe**. Cada línea: texto de producto, modelo, color,
  cantidad, precio opcional. Devuelve líneas resueltas, ambiguas (con candidatos) y sin coincidencia,
  variantes faltantes, precios y total.
- `crear_proforma(cliente_id, lineas_resueltas[], fecha, vencimiento, notas, impuestos, descuento, crear_variantes_faltantes)`
- `editar_proforma(id, cambios)` — agregar, quitar o cambiar cantidad/precio de líneas; datos de cabecera.
  Respeta `proformaPaymentGuard` (no cambia montos de una Proforma con pagos asignados).

### Pagos (admin o editor, igual que la web) y Facturas (admin)
- `registrar_pago(cliente_id, monto, metodo, fecha?, referencia?, notas?, confirmar)` — usa el RPC `record_accounting_payment`; se aplica a las Proformas pendientes más antiguas primero. Sin `confirmar` muestra cómo se aplicaría.
- `convertir_a_factura(proforma_id, tipo, confirmar)` — usa `clonePaidProformaToInvoice`.

## Mejorar la app

El MCP no modifica código. Para mejorar la app se sigue usando Claude Code en este repo.
(Opcional después: herramienta `enviar_sugerencia` que guarde ideas en una tabla.)

## Pasos

1. Sacar la lógica de crear/editar Proforma, pagos y conversión a servicios; los form actions los usan. Tests con `node:test`.
2. Endpoint `/mcp` + validación del token + herramientas de consulta.
3. Herramientas de Proforma (preparar, crear, editar).
4. Pagos y conversión con confirmación.
5. OAuth: metadata, pantalla de consentimiento, configuración en Supabase.
6. Probar directo contra `supabase-prod` (decisión del usuario, 2026-11-24). No hay migraciones.

## Requisitos fuera del código

- Supabase: activar *OAuth Server* y *Dynamic client registration* (Authentication → OAuth Server),
  poner la URL de consentimiento `https://<app>/oauth/consent`. Primero en dev.
- Coolify: ya existe `PUBLIC_SITE_URL` (`https://conduce.caribedata.com`); no hace falta nada nuevo.
- claude.ai: Ajustes → Conectores → agregar conector personalizado `https://<app>/mcp`.

## Riesgos

- Sin transacciones: crear Proforma hoy borra a mano si falla. Se mantiene igual en el servicio
  (posible mejora: función RPC en Postgres).
- La función OAuth Server de Supabase es reciente; si el proyecto no la tiene, plan B: token personal
  generado en la app y guardado con hash (sirve en Claude Code; claude.ai necesita OAuth).
