import type {
	AssetFamilyCatalog,
	AssetFamilyRelationshipType,
} from "@sprite-anvil/api/asset-families";
import type { AssetRecordIdentityCriterion } from "@sprite-anvil/api/asset-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useSelector } from "@tanstack/react-form";
import type { SyntheticEvent } from "react";
import type { AssetFamilyForms } from "../../hooks/use-asset-family-forms";

const selectClassName = "w-full [&>select]:min-h-10";

const relationshipOptions: {
	label: string;
	value: AssetFamilyRelationshipType;
}[] = [
	{ label: "Direction", value: "direction" },
	{ label: "Animation", value: "animation" },
	{ label: "State", value: "state" },
	{ label: "Derived Asset", value: "derivative" },
];

const identityCriterionOptions: {
	label: string;
	value: AssetRecordIdentityCriterion;
}[] = [
	{
		label: "Independent product meaning",
		value: "independent_product_meaning",
	},
	{ label: "Independent lifecycle", value: "independent_lifecycle" },
	{ label: "Delivery identity", value: "delivery_identity" },
];

function submitWith(form: { handleSubmit: () => Promise<unknown> }) {
	return (event: SyntheticEvent<HTMLFormElement>) => {
		event.preventDefault();
		event.stopPropagation();
		void form.handleSubmit();
	};
}

export function SubjectIdentityForm({
	disabled,
	form,
	isSaving,
}: {
	disabled: boolean;
	form: AssetFamilyForms["subjectIdentityForm"];
	isSaving: boolean;
}) {
	const name = useSelector(form.store, (state) => state.values.name);
	return (
		<form
			className="border-l-primary/70 space-y-3 rounded-lg border border-l-2 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="text-primary font-mono text-xs tracking-widest uppercase">
				01 / Kimlik
			</p>
			<h3 className="font-serif text-xl font-semibold">
				Create Subject Identity
			</h3>
			<p className="text-muted-foreground text-sm">
				Use this identity to link the same character or subject across Asset
				Families.
			</p>
			<div className="space-y-2">
				<Label htmlFor="subject-identity-name">Subject Identity name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							disabled={disabled}
							id="subject-identity-name"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<Button disabled={disabled || name.trim().length === 0} type="submit">
				{isSaving ? "Saving…" : "Create Subject Identity"}
			</Button>
		</form>
	);
}

export function AssetFamilyForm({
	disabled,
	families,
	form,
	isSaving,
	selectedSubjectIdentityId,
	selectedVisualWorldId,
	subjectIdentities,
	visualWorlds,
}: {
	disabled: boolean;
	families: AssetFamilyCatalog["assetFamilies"];
	form: AssetFamilyForms["assetFamilyForm"];
	isSaving: boolean;
	selectedSubjectIdentityId: string;
	selectedVisualWorldId: string;
	subjectIdentities: AssetFamilyCatalog["subjectIdentities"];
	visualWorlds: { id: string; name: string }[];
}) {
	const name = useSelector(form.store, (state) => state.values.name);
	const useContext = useSelector(
		form.store,
		(state) => state.values.useContext
	);
	return (
		<form
			className="border-l-primary/70 space-y-3 rounded-lg border border-l-2 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="text-primary font-mono text-xs tracking-widest uppercase">
				02 / Family
			</p>
			<h3 className="font-serif text-xl font-semibold">Create Asset Family</h3>
			<p className="text-muted-foreground text-sm">
				Each family belongs to one Visual World and usage context. Keep separate
				design lineages in different families under the same identity.
			</p>
			<div className="space-y-2">
				<Label htmlFor="asset-family-subject-identity">Subject Identity</Label>
				<form.Field name="subjectIdentityId">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled || subjectIdentities.length === 0}
							id="asset-family-subject-identity"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={selectedSubjectIdentityId}
						>
							{subjectIdentities.map((identity) => (
								<NativeSelectOption key={identity.id} value={identity.id}>
									{identity.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-name">Asset Family name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							disabled={disabled}
							id="asset-family-name"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-visual-world">Visual World</Label>
				<form.Field name="visualWorldId">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled || visualWorlds.length === 0}
							id="asset-family-visual-world"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={selectedVisualWorldId}
						>
							{visualWorlds.map((visualWorld) => (
								<NativeSelectOption key={visualWorld.id} value={visualWorld.id}>
									{visualWorld.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-use-context">Usage context</Label>
				<form.Field name="useContext">
					{(field) => (
						<Input
							disabled={disabled}
							id="asset-family-use-context"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="e.g. in-game sprite"
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<Button
				disabled={
					disabled ||
					subjectIdentities.length === 0 ||
					visualWorlds.length === 0 ||
					name.trim().length === 0 ||
					useContext.trim().length === 0 ||
					families.some(
						(family) =>
							family.subjectIdentityId === selectedSubjectIdentityId &&
							family.name.toLowerCase() === name.trim().toLowerCase()
					)
				}
				type="submit"
			>
				{isSaving ? "Saving…" : "Create Asset Family"}
			</Button>
		</form>
	);
}

export function AssetRecordForm({
	assetFamilies,
	assetRecords,
	disabled,
	form,
	isSaving,
	selectedAssetFamilyId,
}: {
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetRecords: AssetFamilyCatalog["assetRecords"];
	disabled: boolean;
	form: AssetFamilyForms["assetRecordForm"];
	isSaving: boolean;
	selectedAssetFamilyId: string;
}) {
	const name = useSelector(form.store, (state) => state.values.name);
	const identityCriteria = useSelector(
		form.store,
		(state) => state.values.identityCriteria
	);
	return (
		<form
			className="border-l-primary/70 space-y-3 rounded-lg border border-l-2 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="text-primary font-mono text-xs tracking-widest uppercase">
				03 / Record
			</p>
			<h3 className="font-serif text-xl font-semibold">Add Asset Record</h3>
			<p className="text-muted-foreground text-sm">
				Splitting a file for technical reasons alone does not create a new Asset
				Record.
			</p>
			<div className="space-y-2">
				<Label htmlFor="asset-record-family">Asset Family</Label>
				<form.Field name="assetFamilyId">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled || assetFamilies.length === 0}
							id="asset-record-family"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={selectedAssetFamilyId}
						>
							{assetFamilies.map((family) => (
								<NativeSelectOption key={family.id} value={family.id}>
									{family.name} — {family.useContext}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-record-name">Asset Record name</Label>
				<form.Field name="name">
					{(field) => (
						<Input
							disabled={disabled}
							id="asset-record-name"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					)}
				</form.Field>
			</div>
			<FieldSet className="gap-2">
				<FieldLegend className="mb-0 text-sm font-medium">
					Record rationale
				</FieldLegend>
				<form.Field name="identityCriteria">
					{(field) =>
						identityCriterionOptions.map((criterion) => (
							<Label
								className="flex items-center gap-2 text-sm"
								key={criterion.value}
							>
								<Checkbox
									checked={field.state.value.includes(criterion.value)}
									disabled={disabled}
									onCheckedChange={(checked) =>
										field.handleChange(
											checked
												? [...field.state.value, criterion.value]
												: field.state.value.filter(
														(value) => value !== criterion.value
													)
										)
									}
								/>
								{criterion.label}
							</Label>
						))
					}
				</form.Field>
			</FieldSet>
			<Button
				disabled={
					disabled ||
					assetFamilies.length === 0 ||
					name.trim().length === 0 ||
					identityCriteria.length === 0 ||
					assetRecords.some(
						(assetRecord) =>
							assetRecord.assetFamilyId === selectedAssetFamilyId &&
							assetRecord.name.toLowerCase() === name.trim().toLowerCase()
					)
				}
				type="submit"
			>
				{isSaving ? "Saving…" : "Add Asset Record"}
			</Button>
		</form>
	);
}

export function AssetFamilyRelationshipForm({
	assetFamilies,
	assetRecords,
	canonicalDesign,
	disabled,
	form,
	isSaving,
	selectedAssetFamilyId,
	selectedSourceId,
	selectedTargetId,
}: {
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetRecords: AssetFamilyCatalog["assetRecords"];
	canonicalDesign: {
		assetRecordId: string;
		assetVersionId: string;
		recordName: string;
		versionNumber: number;
	} | null;
	disabled: boolean;
	form: AssetFamilyForms["relationshipForm"];
	isSaving: boolean;
	selectedAssetFamilyId: string;
	selectedSourceId: string;
	selectedTargetId: string;
}) {
	const type = useSelector(form.store, (state) => state.values.type);
	const familyRecords = assetRecords.filter(
		(assetRecord) => assetRecord.assetFamilyId === selectedAssetFamilyId
	);
	const sourceAssetRecordId =
		type === "derivative"
			? (canonicalDesign?.assetRecordId ?? "")
			: selectedSourceId;
	const targetAssetRecordId =
		selectedTargetId === sourceAssetRecordId
			? (familyRecords.find(
					(assetRecord) => assetRecord.id !== sourceAssetRecordId
				)?.id ?? "")
			: selectedTargetId;
	const hasPair =
		familyRecords.length >= 2 &&
		sourceAssetRecordId.length > 0 &&
		targetAssetRecordId.length > 0 &&
		sourceAssetRecordId !== targetAssetRecordId;

	return (
		<form
			className="border-l-primary/70 space-y-3 rounded-lg border border-l-2 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="text-primary font-mono text-xs tracking-widest uppercase">
				04 / Relationship
			</p>
			<h3 className="font-serif text-xl font-semibold">
				Add family relationship
			</h3>
			<p className="text-muted-foreground text-sm">
				Direction, animation, state, and Derived Asset relationships stay within
				the same Asset Family.
			</p>
			<div className="space-y-2">
				<Label htmlFor="relationship-family">Asset Family</Label>
				<form.Field name="assetFamilyId">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled || assetFamilies.length === 0}
							id="relationship-family"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => {
								field.handleChange(event.target.value);
								form.setFieldValue("sourceAssetRecordId", "");
								form.setFieldValue("targetAssetRecordId", "");
							}}
							required
							value={selectedAssetFamilyId}
						>
							{assetFamilies.map((family) => (
								<NativeSelectOption key={family.id} value={family.id}>
									{family.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-source">Source Asset Record</Label>
				{type === "derivative" ? (
					<p className="bg-muted/40 min-h-10 rounded-md border px-3 py-2 text-sm">
						{canonicalDesign
							? `${canonicalDesign.recordName} · Canonical Design Version ${canonicalDesign.versionNumber}`
							: "Select an approved Canonical Design first."}
					</p>
				) : (
					<form.Field name="sourceAssetRecordId">
						{(field) => (
							<NativeSelect
								className={selectClassName}
								disabled={disabled || familyRecords.length < 2}
								id="relationship-source"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								required
								value={selectedSourceId}
							>
								{familyRecords.map((assetRecord) => (
									<NativeSelectOption
										key={assetRecord.id}
										value={assetRecord.id}
									>
										{assetRecord.name}
									</NativeSelectOption>
								))}
							</NativeSelect>
						)}
					</form.Field>
				)}
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-type">Relationship type</Label>
				<form.Field name="type">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled}
							id="relationship-type"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) =>
								field.handleChange(
									event.target.value as AssetFamilyRelationshipType
								)
							}
							value={field.state.value}
						>
							{relationshipOptions.map((option) => (
								<NativeSelectOption key={option.value} value={option.value}>
									{option.label}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-target">Related Asset Record</Label>
				<form.Field name="targetAssetRecordId">
					{(field) => (
						<NativeSelect
							className={selectClassName}
							disabled={disabled || familyRecords.length < 2}
							id="relationship-target"
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={targetAssetRecordId}
						>
							{familyRecords.map((assetRecord) => (
								<NativeSelectOption
									disabled={assetRecord.id === sourceAssetRecordId}
									key={assetRecord.id}
									value={assetRecord.id}
								>
									{assetRecord.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					)}
				</form.Field>
			</div>
			<Button
				disabled={
					disabled || !hasPair || (type === "derivative" && !canonicalDesign)
				}
				type="submit"
			>
				{isSaving ? "Saving…" : "Add relationship"}
			</Button>
		</form>
	);
}
