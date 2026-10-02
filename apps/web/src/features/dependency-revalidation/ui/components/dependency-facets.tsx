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

export function DependencyFacets({
	value,
	onChange,
	other,
	onOtherChange,
	legend,
}: {
	value: string[];
	onChange: (value: string[]) => void;
	other: string;
	onOtherChange: (value: string) => void;
	legend: string;
}) {
	const otherId = useId();
	return (
		<fieldset className="space-y-3">
			<legend className="font-medium">{legend}</legend>
			<div className="flex flex-wrap gap-4">
				{facetLabels.map(([facet, label]) => (
					<label className="flex items-center gap-2" key={facet}>
						<input
							checked={value.includes(facet)}
							onChange={(event) =>
								onChange(
									event.target.checked
										? [...value, facet]
										: value.filter((selected) => selected !== facet)
								)
							}
							type="checkbox"
						/>
						{label}
					</label>
				))}
			</div>
			<label className="block space-y-1" htmlFor={otherId}>
				<span>Diğer özellik</span>
				<input
					className="w-full rounded border px-3 py-2"
					id={otherId}
					maxLength={80}
					onChange={(event) => onOtherChange(event.target.value)}
					value={other}
				/>
			</label>
		</fieldset>
	);
}

export function selectedDependencyFacets(facets: string[], other: string) {
	return [...new Set([...facets, ...(other.trim() ? [other.trim()] : [])])];
}

export function dependencyFacetLabel(facet: string) {
	return facetLabels.find(([value]) => value === facet)?.[1] ?? facet;
}
