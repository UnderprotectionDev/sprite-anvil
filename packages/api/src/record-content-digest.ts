function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map((item) => canonicalJson(item ?? null)).join(",")}]`;
	}
	if (value && typeof value === "object") {
		const members = Object.entries(value as Record<string, unknown>)
			.filter(([, member]) => member !== undefined)
			.sort(([left], [right]) => Number(left > right) - Number(left < right))
			.map(
				([key, member]) => `${JSON.stringify(key)}:${canonicalJson(member)}`
			);
		return `{${members.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

/**
 * SHA-256 (hex) of a JSON value's canonical text: sorted keys, no whitespace,
 * undefined members dropped. A value survives a JSON column round trip with the
 * same digest, so a final record's content can be verified after it is read back.
 */
export async function recordContentDigest(value: unknown): Promise<string> {
	const bytes = new TextEncoder().encode(canonicalJson(value));
	const digest = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}
