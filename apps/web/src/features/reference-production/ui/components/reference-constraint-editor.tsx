import type {
	ReferenceFeature,
	ReferenceRole,
} from "../reference-board-contract";
import {
	defaultTransferredFeatures,
	referenceFeatureLabels,
	referenceFeatures,
	referenceRoleLabels,
	referenceRoles,
} from "../reference-board-contract";

export interface ReferenceConstraintDraft {
	contextOverrideRationale: string;
	customPurpose: string;
	forbiddenFeatures: ReferenceFeature[];
	notes: string;
	role: ReferenceRole;
	transferredFeatures: ReferenceFeature[];
}

export const emptyReferenceConstraintDraft = (): ReferenceConstraintDraft => ({
	contextOverrideRationale: "",
	customPurpose: "",
	forbiddenFeatures: [],
	notes: "",
	role: "pose",
	transferredFeatures: ["pose"],
});

function featureChoices({
	legend,
	namePrefix,
	onChange,
	selected,
}: {
	legend: string;
	namePrefix: string;
	onChange: (feature: ReferenceFeature, checked: boolean) => void;
	selected: readonly ReferenceFeature[];
}) {
	return (
		<fieldset className="space-y-2">
			<legend className="font-medium text-sm">{legend}</legend>
			<div className="grid gap-2 sm:grid-cols-2">
				{referenceFeatures.map((feature) => (
					<label
						className="flex min-h-11 items-center gap-2 text-sm"
						key={feature}
					>
						<input
							checked={selected.includes(feature)}
							className="size-4 accent-primary"
							id={`${namePrefix}-${legend}-${feature}`}
							onChange={(event) => onChange(feature, event.target.checked)}
							type="checkbox"
						/>
						<span>{referenceFeatureLabels[feature]}</span>
					</label>
				))}
			</div>
		</fieldset>
	);
}

function toggleFeature(
	current: readonly ReferenceFeature[],
	feature: ReferenceFeature,
	checked: boolean
) {
	return checked
		? [...new Set([...current, feature])]
		: current.filter((item) => item !== feature);
}

export function ReferenceConstraintEditor({
	draft,
	hasCanonicalDesign,
	idPrefix,
	onChange,
	readOnly = false,
}: {
	draft: ReferenceConstraintDraft;
	hasCanonicalDesign: boolean;
	idPrefix: string;
	onChange: (draft: ReferenceConstraintDraft) => void;
	readOnly?: boolean;
}) {
	const identityTransfer =
		draft.transferredFeatures.includes("identity") &&
		!draft.forbiddenFeatures.includes("identity");
	const needsOverride = hasCanonicalDesign && identityTransfer;

	return (
		<div className="space-y-4">
			<label className="block space-y-1 text-sm" htmlFor={`${idPrefix}-role`}>
				<span>Referans kullanım amacı</span>
				<select
					className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
					disabled={readOnly}
					id={`${idPrefix}-role`}
					onChange={(event) => {
						const role = event.target.value as ReferenceRole;
						onChange({
							...draft,
							customPurpose: role === "custom" ? draft.customPurpose : "",
							role,
							transferredFeatures: defaultTransferredFeatures(role),
						});
					}}
					value={draft.role}
				>
					{referenceRoles.map((role) => (
						<option key={role} value={role}>
							{referenceRoleLabels[role]}
						</option>
					))}
				</select>
			</label>
			{draft.role === "custom" ? (
				<label
					className="block space-y-1 text-sm"
					htmlFor={`${idPrefix}-custom-purpose`}
				>
					<span>Özel kullanım amacı</span>
					<input
						className="min-h-11 w-full rounded-md border bg-background px-3 py-2"
						disabled={readOnly}
						id={`${idPrefix}-custom-purpose`}
						maxLength={240}
						onChange={(event) =>
							onChange({ ...draft, customPurpose: event.target.value })
						}
						value={draft.customPurpose}
					/>
				</label>
			) : null}
			{featureChoices({
				legend: "Aktarılabilir özellikler",
				namePrefix: idPrefix,
				onChange: (feature, checked) =>
					onChange({
						...draft,
						transferredFeatures: toggleFeature(
							draft.transferredFeatures,
							feature,
							checked
						),
					}),
				selected: draft.transferredFeatures,
			})}
			{featureChoices({
				legend: "Kaçınılacak özellikler",
				namePrefix: idPrefix,
				onChange: (feature, checked) =>
					onChange({
						...draft,
						forbiddenFeatures: toggleFeature(
							draft.forbiddenFeatures,
							feature,
							checked
						),
					}),
				selected: draft.forbiddenFeatures,
			})}
			<p className="text-muted-foreground text-xs">
				Açıkça yasaklanan özellik aynı referanstaki izni geçersiz kılar. Farklı
				referanslardaki karşıt kurallar kullanıcı çözene kadar çelişki olarak
				kalır.
			</p>
			{needsOverride ? (
				<label
					className="block space-y-1 text-sm"
					htmlFor={`${idPrefix}-context-override`}
				>
					<span>Bağlam Kuralı İstisnası gerekçesi</span>
					<textarea
						aria-describedby={`${idPrefix}-context-override-help`}
						className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
						disabled={readOnly}
						id={`${idPrefix}-context-override`}
						maxLength={1000}
						onChange={(event) =>
							onChange({
								...draft,
								contextOverrideRationale: event.target.value,
							})
						}
						required
						value={draft.contextOverrideRationale}
					/>
					<span
						className="text-muted-foreground text-xs"
						id={`${idPrefix}-context-override-help`}
					>
						Bu Varlık Ailesi Ana Tasarım sürümünün kimlik sınırını aşacağından
						açıklama zorunludur.
					</span>
				</label>
			) : null}
			<label className="block space-y-1 text-sm" htmlFor={`${idPrefix}-notes`}>
				<span>Referans notu</span>
				<textarea
					className="min-h-20 w-full rounded-md border bg-background px-3 py-2"
					disabled={readOnly}
					id={`${idPrefix}-notes`}
					maxLength={1000}
					onChange={(event) =>
						onChange({ ...draft, notes: event.target.value })
					}
					value={draft.notes}
				/>
			</label>
		</div>
	);
}
