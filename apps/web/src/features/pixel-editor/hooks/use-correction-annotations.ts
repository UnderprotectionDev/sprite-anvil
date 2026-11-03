import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import { useState } from "react";

export type CorrectionAnnotation = NonNullable<
	GenerationPackage["correction"]
>["annotations"][number];

export interface AnnotationEntry {
	id: string;
	mark: CorrectionAnnotation;
}

/** The marks being prepared for a correction; they travel with the package and never touch pixels. */
export function useCorrectionAnnotations() {
	const [entries, setEntries] = useState<AnnotationEntry[]>([]);
	return {
		entries,
		marks: entries.map((entry) => entry.mark),
		add: (mark: CorrectionAnnotation) =>
			setEntries((current) => [...current, { id: crypto.randomUUID(), mark }]),
		remove: (id: string) =>
			setEntries((current) => current.filter((entry) => entry.id !== id)),
	};
}
