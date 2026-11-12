import assert from 'node:assert/strict';
import test from 'node:test';
import { isOverdueBalance } from './overdue.ts';

test('counts positive balances only after the due date', () => {
	const today = '2026-11-11';
	assert.equal(isOverdueBalance('2026-11-10', 10, today), true);
	assert.equal(isOverdueBalance('2026-11-11', 10, today), false);
	assert.equal(isOverdueBalance('2026-11-12', 10, today), false);
	assert.equal(isOverdueBalance('2026-11-10', 0, today), false);
	assert.equal(isOverdueBalance('2026-11-10', -1, today), false);
	assert.equal(isOverdueBalance(null, 10, today), false);
	assert.equal(isOverdueBalance('', 10, today), false);
	assert.equal(isOverdueBalance('invalid', 10, today), false);
});
