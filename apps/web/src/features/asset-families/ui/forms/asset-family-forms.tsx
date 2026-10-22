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
import { useStore } from "@tanstack/react-form";
import type { SyntheticEvent } from "react";
import type { AssetFamilyForms } from "../../hooks/use-asset-family-forms";

const selectClassName = "w-full [&>select]:min-h-10";

const relationshipOptions: {
	label: string;
	value: AssetFamilyRelationshipType;
}[] = [
	{ label: "Yön", value: "direction" },
	{ label: "Animasyon", value: "animation" },
	{ label: "Durum", value: "state" },
	{ label: "Türetilmiş Varlık", value: "derivative" },
];

const identityCriterionOptions: {
	label: string;
	value: AssetRecordIdentityCriterion;
}[] = [
	{ label: "Bağımsız ürün anlamı", value: "independent_product_meaning" },
	{ label: "Bağımsız yaşam döngüsü", value: "independent_lifecycle" },
	{ label: "Teslimat kimliği", value: "delivery_identity" },
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
	const name = useStore(form.store, (state) => state.values.name);
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="font-mono text-primary text-xs uppercase tracking-widest">
				01 / Kimlik
			</p>
			<h3 className="font-semibold font-serif text-xl">
				Varlık Kimliği oluştur
			</h3>
			<p className="text-muted-foreground text-sm">
				Aynı karakteri veya konuyu farklı Varlık Ailelerinde bu kimlikle
				bağlayın.
			</p>
			<div className="space-y-2">
				<Label htmlFor="subject-identity-name">Varlık Kimliği adı</Label>
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
				{isSaving ? "Kaydediliyor…" : "Varlık Kimliği oluştur"}
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
	const name = useStore(form.store, (state) => state.values.name);
	const useContext = useStore(form.store, (state) => state.values.useContext);
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="font-mono text-primary text-xs uppercase tracking-widest">
				02 / Aile
			</p>
			<h3 className="font-semibold font-serif text-xl">
				Varlık Ailesi oluştur
			</h3>
			<p className="text-muted-foreground text-sm">
				Her aile tek bir Görsel Dünya ve kullanım bağlamında kalır. Ayrı tasarım
				soylarını aynı kimlik altında farklı ailelerde tutabilirsiniz.
			</p>
			<div className="space-y-2">
				<Label htmlFor="asset-family-subject-identity">Varlık Kimliği</Label>
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
				<Label htmlFor="asset-family-name">Varlık Ailesi adı</Label>
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
				<Label htmlFor="asset-family-visual-world">Görsel Dünya</Label>
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
				<Label htmlFor="asset-family-use-context">Kullanım bağlamı</Label>
				<form.Field name="useContext">
					{(field) => (
						<Input
							disabled={disabled}
							id="asset-family-use-context"
							maxLength={120}
							name={field.name}
							onBlur={field.handleBlur}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Örn. oyun içi sprite"
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
				{isSaving ? "Kaydediliyor…" : "Varlık Ailesi oluştur"}
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
	const name = useStore(form.store, (state) => state.values.name);
	const identityCriteria = useStore(
		form.store,
		(state) => state.values.identityCriteria
	);
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="font-mono text-primary text-xs uppercase tracking-widest">
				03 / Kayıt
			</p>
			<h3 className="font-semibold font-serif text-xl">Varlık Kaydı ekle</h3>
			<p className="text-muted-foreground text-sm">
				Teknik dosya bölünmesi tek başına yeni Varlık Kaydı oluşturmaz.
			</p>
			<div className="space-y-2">
				<Label htmlFor="asset-record-family">Varlık Ailesi</Label>
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
				<Label htmlFor="asset-record-name">Varlık Kaydı adı</Label>
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
				<FieldLegend className="mb-0 font-medium text-sm">
					Kayıt gerekçesi
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
				{isSaving ? "Kaydediliyor…" : "Varlık Kaydı ekle"}
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
	const type = useStore(form.store, (state) => state.values.type);
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
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={submitWith(form)}
		>
			<p className="font-mono text-primary text-xs uppercase tracking-widest">
				04 / İlişki
			</p>
			<h3 className="font-semibold font-serif text-xl">Aile içi ilişki ekle</h3>
			<p className="text-muted-foreground text-sm">
				Yön, animasyon, durum ve Türetilmiş Varlık ilişkileri aynı Varlık
				Ailesinde kalır.
			</p>
			<div className="space-y-2">
				<Label htmlFor="relationship-family">Varlık Ailesi</Label>
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
				<Label htmlFor="relationship-source">Kaynak Varlık Kaydı</Label>
				{type === "derivative" ? (
					<p className="min-h-10 rounded-md border bg-muted/40 px-3 py-2 text-sm">
						{canonicalDesign
							? `${canonicalDesign.recordName} · Ana Tasarım Sürüm ${canonicalDesign.versionNumber}`
							: "Önce onaylı bir Ana Tasarım seçin."}
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
				<Label htmlFor="relationship-type">İlişki türü</Label>
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
				<Label htmlFor="relationship-target">İlgili Varlık Kaydı</Label>
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
				{isSaving ? "Kaydediliyor…" : "İlişki ekle"}
			</Button>
		</form>
	);
}
