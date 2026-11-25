import assert from 'node:assert/strict';
import test from 'node:test';
import { matchColor, matchProduct, normalizeText, similarity } from './catalogMatch.ts';

const products = [
	{ id: 'p1', title: 'Camiseta Polo', modelName: 'Elite' },
	{ id: 'p2', title: 'Camiseta Polo', modelName: 'Pro' },
	{ id: 'p3', title: 'Gorra Plana', modelName: null },
	{ id: 'p4', title: 'Pantalón Deportivo', modelName: null }
];

test('normalizeText strips accents and punctuation', () => {
	assert.equal(normalizeText('  Pantalón-Deportivo!! '), 'pantalon deportivo');
});

test('similarity is 1 for equal text', () => {
	assert.equal(similarity('Gorra', 'gorra'), 1);
});

test('exact title + model', () => {
	const r = matchProduct(products, 'camiseta polo', 'elite');
	assert.equal(r.confidence, 'exacto');
	assert.equal(r.productId, 'p1');
});

test('title without model is ambiguous when several models exist', () => {
	const r = matchProduct(products, 'Camiseta Polo');
	assert.equal(r.confidence, 'ambiguo');
	assert.equal(r.productId, null);
	assert.ok(r.candidates.length >= 2);
});

test('typo resolves as probable', () => {
	const r = matchProduct(products, 'pantalon deportibo');
	assert.equal(r.confidence, 'probable');
	assert.equal(r.productId, 'p4');
});

test('unrelated text has no match', () => {
	const r = matchProduct(products, 'zzzz qqqq');
	assert.equal(r.confidence, 'sin_coincidencia');
});

test('exact title with no model', () => {
	const r = matchProduct(products, 'GORRA PLANA');
	assert.equal(r.confidence, 'exacto');
	assert.equal(r.productId, 'p3');
});

test('matchColor exact and fuzzy', () => {
	const colors = ['negro', 'blanco', 'azul marino'];
	assert.deepEqual(matchColor(colors, 'Negro').color, 'negro');
	assert.equal(matchColor(colors, 'azul marno').color, 'azul marino');
	assert.equal(matchColor(colors, 'verde').color, null);
	assert.equal(matchColor(colors, '').color, null);
});

const covers = [
	{ id: 'c11', title: 'Elite colors', modelName: 'iphone 11' },
	{ id: 'c13p', title: 'Elite colors', modelName: 'iphone 13 pro' },
	{ id: 'c13pm', title: 'Elite colors', modelName: 'iphone 13 pro max' },
	{ id: 'c1314', title: 'Elite colors', modelName: 'iphone 13 / 14' },
	{ id: 'c1415', title: 'Elite colors', modelName: 'iphone 14 / 15 plus' },
	{ id: 'c15', title: 'Elite colors', modelName: 'iphone 15' },
	{ id: 'c17p', title: 'Elite colors', modelName: 'iphone 17 pro' },
	{ id: 'c18p', title: 'Elite colors', modelName: 'iphone 18 pro' },
	{ id: 's11', title: 'Silicone case', modelName: 'iphone 11' }
];

test('device in product text, line in model text', () => {
	assert.equal(matchProduct(covers, 'cover iPhone 11', 'Elite').productId, 'c11');
	assert.equal(matchProduct(covers, 'cover iPhone 13 Pro', 'Elite').productId, 'c13p');
	assert.equal(matchProduct(covers, 'cover iPhone 13 Pro Max', 'Elite').productId, 'c13pm');
	assert.equal(matchProduct(covers, 'iPhone 13 / 14', 'Elite').productId, 'c1314');
	assert.equal(matchProduct(covers, 'iPhone 14 PLUS / 15 Plus', 'Elite').productId, 'c1415');
	assert.equal(matchProduct(covers, 'iPhone 15', 'Elite').productId, 'c15');
});

test('two models in one text stay ambiguous', () => {
	const r = matchProduct(covers, 'iPhone 17 Pro / 18 Pro', 'Elite');
	assert.equal(r.productId, null);
	assert.deepEqual(
		r.candidates
			.slice(0, 2)
			.map((c) => c.productId)
			.sort(),
		['c17p', 'c18p']
	);
});

test('matchColor synonyms and alternatives', () => {
	const colors = ['negro', 'clear', 'transparente', 'azul oscuro', 'azul claro'];
	assert.equal(matchColor(colors, 'Azul marino').color, 'azul oscuro');
	assert.equal(matchColor(colors, 'Clear / Transparente').color, null);
	assert.deepEqual(matchColor(colors, 'Clear / Transparente').candidates, [
		'clear',
		'transparente'
	]);
	assert.equal(matchColor(['negro', 'clear'], 'Clear / Transparente').color, 'clear');
	assert.equal(matchColor(colors, 'Azul claro').color, 'azul claro');
});
