/** Dates from the database are ISO calendar dates; use UTC consistently on server and client. */
export function isOverdueBalance(
	dueDate: string | null | undefined,
	balance: number,
	today: string = new Date().toISOString().slice(0, 10)
): boolean {
	return balance > 0 && !!dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) && dueDate < today;
}
