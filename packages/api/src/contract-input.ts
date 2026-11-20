import type { Schema } from "@orpc/contract";

export function requireContractInput<TInput, TOutput>(contract: {
	"~orpc": { inputSchema?: Schema<TInput, TOutput> };
}) {
	const schema = contract["~orpc"].inputSchema;
	if (!schema) {
		throw new Error("This oRPC contract does not declare an input schema.");
	}
	return schema;
}
