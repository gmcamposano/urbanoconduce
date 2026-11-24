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
