import type { SourceMetadataMappingProposal } from "@sprite-anvil/api/source-metadata-mapping";

export function formatFieldValue(value: unknown) {
	return JSON.stringify(value, null, 2) ?? "Bilinmiyor";
}

export function fieldLabel(
	field: SourceMetadataMappingProposal["fields"][number]["field"]
) {
	const labels = {
		frame: "Kare",
		duration: "Süre",
		tag: "Tag",
		slice: "Slice",
		pivot: "Pivot",
		"nine-slice": "9-slice",
		palette: "Palet",
	};
	return labels[field];
}

export function stableValue(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableValue).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const record = value as Record<string, unknown>;
		return `{${Object.keys(record)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableValue(record[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

function proposalFieldValues(proposal: SourceMetadataMappingProposal) {
	const grouped = new Map<string, string[]>();
	for (const field of proposal.fields) {
		const key = `${field.field}\u0000${field.key}`;
		grouped.set(key, [...(grouped.get(key) ?? []), stableValue(field.value)]);
	}
	return new Map(
		[...grouped].map(([key, values]) => [key, [...new Set(values)].sort()])
	);
}

export function proposalFieldChanges(
	current: SourceMetadataMappingProposal,
	previous: SourceMetadataMappingProposal
) {
	const before = proposalFieldValues(previous);
	const after = proposalFieldValues(current);
	return [...new Set([...before.keys(), ...after.keys()])]
		.sort()
		.flatMap((key) => {
			if (stableValue(before.get(key)) === stableValue(after.get(key))) {
				return [];
			}
			const [field, name] = key.split("\u0000");
			const label = `${fieldLabel(field as SourceMetadataMappingProposal["fields"][number]["field"])} · ${name}`;
			let change = "Değişti";
			if (!before.has(key)) {
				change = "Eklendi";
			} else if (!after.has(key)) {
				change = "Kaldırıldı";
			}
			const previousValues = before.get(key)?.join("; ") ?? "Yok";
			const currentValues = after.get(key)?.join("; ") ?? "Yok";
			return [`${change}: ${label} · ${previousValues} → ${currentValues}`];
		});
}
