export interface OperationCount {
	count: number;
	type: string;
}

export function countOperations(operations: { type: string }[]) {
	const counts = new Map<string, number>();
	for (const { type } of operations) {
		counts.set(type, (counts.get(type) ?? 0) + 1);
	}
	return [...counts.entries()].map(
		([type, count]): OperationCount => ({ type, count })
	);
}

/** "pen x2, fill x1", or "no operations". */
export function describeCounts(counts: OperationCount[]) {
	return counts.length === 0
		? "no operations"
		: counts.map(({ type, count }) => `${type} x${count}`).join(", ");
}
