import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCurrentRowsCsv } from './proformaCsv.ts';

const products = [
	{ id: 'first', title: 'Producto, "Uno"', model: 'model-one' },
	{ id: 'second', title: 'Producto; Dos\nEspecial', model: null }
];

const models = [{ id: 'model-one', model: 'Modelo, Premium' }];

test('builds import-compatible BOM CSV and preserves current row order and quantities', () => {
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: 'second', color: '', quantity: 2.5 },
			{ product_id: 'first', color: 'Azul', quantity: 7 }
		],
		products,
		models
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\n"Producto; Dos\nEspecial",,,2.5\n"Producto, ""Uno""","Modelo, Premium",Azul,7\n'
	);
});

test('escapes commas, semicolons, quotes, and newlines in current row fields', () => {
	const csv = buildCurrentRowsCsv(
		[{ product_id: 'first', color: 'Azul; "claro"\nmate', quantity: 3 }],
		products,
		models
	);

	assert.match(csv, /"Producto, ""Uno""","Modelo, Premium","Azul; ""claro""\nmate",3/);
});

test('omits empty and unknown product rows without disturbing known row order', () => {
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: '', color: 'Rojo', quantity: 1 },
			{ product_id: 'first', color: '', quantity: 2 },
			{ product_id: 'missing', color: 'Verde', quantity: 3 },
			{ product_id: 'second', color: 'Negro', quantity: 4 }
		],
		products,
		models
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\n"Producto, ""Uno""","Modelo, Premium",,2\n"Producto; Dos\nEspecial",,Negro,4\n'
	);
});
