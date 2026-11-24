import assert from 'node:assert/strict';
import test from 'node:test';
import { changesAllocatedProforma } from './proformaPaymentGuard.ts';

const invoice = {
	clientId: 'client',
	invoiceDate: '2026-09-01',
	dueDate: '2026-10-01',
	status: 'pending',
	totalAmount: 100
};

test('protects allocated proformas against changes to payment ordering or balance', () => {
	for (const change of [
		{ clientId: 'other' },
		{ invoiceDate: '2026-09-02' },
		{ dueDate: '2026-10-02' },
		{ status: 'paid' },
		{ totalAmount: 100.01 }
	]) {
		assert.equal(changesAllocatedProforma(invoice, { ...invoice, ...change }, true), true);
		assert.equal(changesAllocatedProforma(invoice, { ...invoice, ...change }, false), false);
	}
	assert.equal(changesAllocatedProforma(invoice, { ...invoice }, true), false);
});
