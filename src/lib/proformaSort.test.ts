import assert from 'node:assert/strict';
import test from 'node:test';
import { sortProformaItems, type ProformaSortState, type SortableItem } from './proformaSort.ts';

const productTitles: Record<string, string> = {
	alphaSedan: 'Alpha',
	alphaSuv: 'Alpha',
	beta: 'Beta'
};

const modelNames: Record<string, string> = {
	alphaSedan: 'Sedan',
	alphaSuv: 'SUV',
	beta: 'Coupe'
};

const colorRanks: Record<string, number> = {
	red: 1,
	blue: 2
};

function item(id: string, product_id: string, color: string): SortableItem {
	return { id, product_id, color, quantity: 1, unit_price: 1 };
}

function sort(items: SortableItem[], state: ProformaSortState): string[] {
	const sequence = new Map(items.map((entry, index) => [entry.id, index]));
	return sortProformaItems(items, state, {
		productTitle: (productId) => productTitles[productId] ?? '',
		modelName: (productId) => modelNames[productId] ?? '',
		colorRank: (color) => colorRanks[color] ?? Number.POSITIVE_INFINITY,
		seqOf: (id) => sequence.get(id) ?? Number.MAX_SAFE_INTEGER
	}).map((entry) => entry.id);
}

test('sorts by product, configured color order, then model', () => {
	const items = [
		item('beta', 'beta', 'red'),
		item('blue-suv', 'alphaSuv', 'blue'),
		item('red-suv', 'alphaSuv', 'red'),
		item('red-sedan', 'alphaSedan', 'red')
	];

	assert.deepEqual(sort(items, { key: 'producto_color', dir: 'asc' }), [
		'red-sedan',
		'red-suv',
		'blue-suv',
		'beta'
	]);
});

test('reverses product and configured color order', () => {
	const items = [
		item('red', 'alphaSuv', 'red'),
		item('blue', 'alphaSuv', 'blue'),
		item('beta', 'beta', 'red')
	];

	assert.deepEqual(sort(items, { key: 'producto_color', dir: 'desc' }), ['beta', 'blue', 'red']);
});

test('keeps unknown colors, blank colors, and empty rows last', () => {
	const items = [
		item('blank', 'alphaSuv', ''),
		item('empty-row', '', ''),
		item('unknown', 'alphaSuv', 'green'),
		item('known', 'alphaSuv', 'red')
	];

	assert.deepEqual(sort(items, { key: 'producto_color', dir: 'asc' }), [
		'known',
		'blank',
		'unknown',
		'empty-row'
	]);
});

test('preserves arrival order for exact ties', () => {
	const items = [item('first', 'alphaSuv', 'red'), item('second', 'alphaSuv', 'red')];

	assert.deepEqual(sort(items, { key: 'producto_color', dir: 'desc' }), ['first', 'second']);
});
