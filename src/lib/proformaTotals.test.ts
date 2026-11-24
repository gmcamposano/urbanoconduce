import assert from 'node:assert/strict';
import test from 'node:test';
import { computeProformaTotals, parseTaxMode } from './proformaTotals.ts';

test('parseTaxMode falls back to none', () => {
	assert.equal(parseTaxMode('included'), 'included');
	assert.equal(parseTaxMode(' added '), 'added');
	assert.equal(parseTaxMode('x'), 'none');
	assert.equal(parseTaxMode(null), 'none');
});

test('no tax subtracts discount only', () => {
	const t = computeProformaTotals(1000, 'none', 100);
	assert.equal(t.taxRate, 0);
	assert.equal(t.totalAmount, 900);
});

test('added tax applies 18% after discount', () => {
	const t = computeProformaTotals(1000, 'added', 100);
	assert.equal(t.taxRate, 18);
	assert.ok(Math.abs(t.totalAmount - 1062) < 1e-9);
});

test('included tax extracts 18% from line total', () => {
	const t = computeProformaTotals(1180, 'included', 0);
	assert.ok(Math.abs(t.subtotal - 1000) < 1e-9);
	assert.ok(Math.abs(t.totalAmount - 1180) < 1e-9);
});

test('discount never makes base negative', () => {
	assert.equal(computeProformaTotals(50, 'none', 100).totalAmount, 0);
});
