import { dev } from '$app/environment';
import type { Cookies } from '@sveltejs/kit';

const COOKIE_NAME = 'accounting_stock_warning';
const COOKIE_PATH = '/dashboard/accounting';
const COOKIE_MAX_AGE_SECONDS = 60;

export type AccountingStockWarning = {
	warningCount: number;
	warningInvoiceCount: number;
};

function isPositiveSafeInteger(value: unknown): value is number {
	return Number.isSafeInteger(value) && typeof value === 'number' && value > 0;
}

export function setAccountingStockWarningFlash(
	cookies: Cookies,
	warning: AccountingStockWarning
): void {
	cookies.set(COOKIE_NAME, JSON.stringify(warning), {
		path: COOKIE_PATH,
		maxAge: COOKIE_MAX_AGE_SECONDS,
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev
	});
}

export function clearAccountingStockWarningFlash(cookies: Cookies): void {
	cookies.delete(COOKIE_NAME, { path: COOKIE_PATH });
}

export function consumeAccountingStockWarningFlash(
	cookies: Cookies
): AccountingStockWarning | null {
	const value = cookies.get(COOKIE_NAME);
	clearAccountingStockWarningFlash(cookies);

	if (!value || value.length > 128) return null;

	try {
		const parsed: unknown = JSON.parse(value);
		if (!parsed || typeof parsed !== 'object') return null;

		const warning = parsed as Record<string, unknown>;
		if (
			!isPositiveSafeInteger(warning.warningCount) ||
			!isPositiveSafeInteger(warning.warningInvoiceCount)
		) {
			return null;
		}

		return {
			warningCount: warning.warningCount,
			warningInvoiceCount: warning.warningInvoiceCount
		};
	} catch {
		return null;
	}
}
