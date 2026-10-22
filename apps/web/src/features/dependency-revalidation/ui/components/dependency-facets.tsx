import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useId } from "react";

const facetLabels = [
	["identity", "Kimlik"],
	["silhouette", "Siluet"],
	["equipment", "Ekipman"],
	["palette", "Palet"],
	["theme", "Tema"],
	["perspective", "Perspektif"],
	["timing", "Zamanlama"],
] as const;

interface ValueField<T> {
	handleBlur: () => void;
	handleChange: (value: T) => void;
	state: { value: T };
}

export function DependencyFacets({
	facetsField,
	otherField,
	disabled,
	legend,
}: {
	facetsField: ValueField<string[]>;
	otherField: ValueField<string>;
	disabled: boolean;
	legend: string;
}) {
	const otherId = useId();
	const { value } = facetsField.state;
	return (
		<FieldSet className="space-y-3">
			<FieldLegend className="font-medium">{legend}</FieldLegend>
			<div className="flex flex-wrap gap-4">
				{facetLabels.map(([facet, label]) => (
					<Label className="flex items-center gap-2" key={facet}>
						<Checkbox
							checked={value.includes(facet)}
							disabled={disabled}
							onCheckedChange={(checked) =>
								facetsField.handleChange(
									checked
										? [...value, facet]
										: value.filter((selected) => selected !== facet)
								)
							}
						/>
						{label}
					</Label>
				))}
			</div>
			<Label className="block space-y-1" htmlFor={otherId}>
				<span>Diğer özellik</span>
				<Input
					className="w-full"
					id={otherId}
					maxLength={80}
					onBlur={otherField.handleBlur}
					onChange={(event) => otherField.handleChange(event.target.value)}
					value={otherField.state.value}
				/>
			</Label>
		</FieldSet>
	);
}

export function selectedDependencyFacets(facets: string[], other: string) {
	return [...new Set([...facets, ...(other.trim() ? [other.trim()] : [])])];
}

export function dependencyFacetLabel(facet: string) {
	return facetLabels.find(([value]) => value === facet)?.[1] ?? facet;
}
