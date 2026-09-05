import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCurrentRowsCsv, parseProformaCsv } from './proformaCsv.ts';

const products = [
	{ id: 'first', title: 'Producto, "Uno"', model: 'model-one' },
	{ id: 'second', title: 'Producto; Dos\nEspecial', model: null }
];

const models = [{ id: 'model-one', model: 'Modelo, Premium' }];
const colors = [
	{ id: 'red', color: 'Rojo', sort_order: 1 },
	{ id: 'blue', color: 'Azul', sort_order: 2 }
];

test('separates new rows from changed quantities and ignores unchanged matches', () => {
	const result = parseProformaCsv(
		'producto,modelo,color,cantidad\nProducto,Modelo,Rojo,4\nProducto,Modelo,Azul,2\nNuevo,,Rojo,3\n',
		[
			{ id: 'product', title: 'Producto', model: 'model' },
			{ id: 'new', title: 'Nuevo', model: null }
		],
		[{ id: 'model', model: 'Modelo' }],
		colors,
		[
			{ product_id: 'product', color: 'rojo', quantity: 1 },
			{ product_id: 'product', color: 'AZUL', quantity: 2 }
		]
	);

	assert.deepEqual(result.rows, [
		{ productId: 'new', productTitle: 'Nuevo', color: 'Rojo', quantity: 3 }
	]);
	assert.deepEqual(result.replacements, [
		{ productId: 'product', productTitle: 'Producto', color: 'Rojo', quantity: 4 }
	]);
	assert.deepEqual(result.errors, []);
});

test('merges duplicate CSV rows before comparing current quantity', () => {
	const result = parseProformaCsv(
		'producto,modelo,color,cantidad\nProducto,Modelo,Rojo,2\nProducto,Modelo,rojo,3\n',
		[{ id: 'product', title: 'Producto', model: 'model' }],
		[{ id: 'model', model: 'Modelo' }],
		colors,
		[{ product_id: 'product', color: 'ROJO', quantity: '5' }]
	);

	assert.deepEqual(result.rows, []);
	assert.deepEqual(result.replacements, []);
	assert.deepEqual(result.errors, []);
});

test('matches blank colors when replacing quantities', () => {
	const result = parseProformaCsv(
		'producto,modelo,color,cantidad\nProducto,Modelo,,6\n',
		[{ id: 'product', title: 'Producto', model: 'model' }],
		[{ id: 'model', model: 'Modelo' }],
		colors,
		[{ product_id: 'product', color: '', quantity: 1 }]
	);

	assert.deepEqual(result.rows, []);
	assert.deepEqual(result.replacements, [
		{ productId: 'product', productTitle: 'Producto', color: '', quantity: 6 }
	]);
});

test('keeps invalid rows as errors without creating changes', () => {
	const result = parseProformaCsv(
		'producto,modelo,color,cantidad\nProducto,Modelo,Rojo,0\n',
		[{ id: 'product', title: 'Producto', model: 'model' }],
		[{ id: 'model', model: 'Modelo' }],
		colors,
		[{ product_id: 'product', color: 'Rojo', quantity: 1 }]
	);

	assert.deepEqual(result.rows, []);
	assert.deepEqual(result.replacements, []);
	assert.equal(result.errors.length, 1);
});

test('builds import-compatible BOM CSV in canonical product and color order', () => {
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: 'second', color: '', quantity: 2.5 },
			{ product_id: 'first', color: 'Azul', quantity: 7 }
		],
		products,
		models,
		colors
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\n"Producto, ""Uno""","Modelo, Premium",Azul,7\n"Producto; Dos\nEspecial",,,2.5\n'
	);
});

test('escapes commas, semicolons, quotes, and newlines in current row fields', () => {
	const csv = buildCurrentRowsCsv(
		[{ product_id: 'first', color: 'Azul; "claro"\nmate', quantity: 3 }],
		products,
		models,
		colors
	);

	assert.match(csv, /"Producto, ""Uno""","Modelo, Premium","Azul; ""claro""\nmate",3/);
});

test('omits empty and unknown product rows', () => {
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: '', color: 'Rojo', quantity: 1 },
			{ product_id: 'first', color: '', quantity: 2 },
			{ product_id: 'missing', color: 'Verde', quantity: 3 },
			{ product_id: 'second', color: 'Negro', quantity: 4 }
		],
		products,
		models,
		colors
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\n"Producto, ""Uno""","Modelo, Premium",,2\n"Producto; Dos\nEspecial",,Negro,4\n'
	);
});

test('uses configured color order instead of current row order', () => {
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: 'first', color: 'Azul', quantity: 2 },
			{ product_id: 'first', color: '', quantity: 3 },
			{ product_id: 'first', color: 'Desconocido', quantity: 4 },
			{ product_id: 'first', color: 'Rojo', quantity: 1 }
		],
		products,
		models,
		colors
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\n"Producto, ""Uno""","Modelo, Premium",Rojo,1\n"Producto, ""Uno""","Modelo, Premium",Azul,2\n"Producto, ""Uno""","Modelo, Premium",,3\n"Producto, ""Uno""","Modelo, Premium",Desconocido,4\n'
	);
});

test('matches shared product-id grouping when labels and models are duplicates', () => {
	const duplicateProducts = [
		{ id: 'zeta', title: 'Duplicado', model: 'shared-model' },
		{ id: 'alpha', title: 'Duplicado', model: 'shared-model' }
	];
	const duplicateModels = [{ id: 'shared-model', model: 'Mismo' }];
	const csv = buildCurrentRowsCsv(
		[
			{ product_id: 'zeta', color: 'Rojo', quantity: 1 },
			{ product_id: 'alpha', color: 'Azul', quantity: 2 },
			{ product_id: 'zeta', color: 'Azul', quantity: 3 },
			{ product_id: 'alpha', color: 'Rojo', quantity: 4 }
		],
		duplicateProducts,
		duplicateModels,
		colors
	);

	assert.equal(
		csv,
		'\uFEFFproducto,modelo,color,cantidad\nDuplicado,Mismo,Rojo,4\nDuplicado,Mismo,Azul,2\nDuplicado,Mismo,Rojo,1\nDuplicado,Mismo,Azul,3\n'
	);
});
