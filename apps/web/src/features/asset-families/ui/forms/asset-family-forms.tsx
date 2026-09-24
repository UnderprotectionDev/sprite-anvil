import type {
	AssetFamilyCatalog,
	AssetFamilyRelationshipType,
} from "@sprite-anvil/api/asset-families";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { SyntheticEvent } from "react";

const relationshipOptions: {
	label: string;
	value: AssetFamilyRelationshipType;
}[] = [
	{ label: "Yön", value: "direction" },
	{ label: "Animasyon", value: "animation" },
	{ label: "Durum", value: "state" },
	{ label: "Türetilmiş Varlık", value: "derivative" },
];

export function SubjectIdentityForm({
	disabled,
	isSaving,
	name,
	onNameChange,
	onSubmit,
}: {
	disabled: boolean;
	isSaving: boolean;
	name: string;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
}) {
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={onSubmit}
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
				<Input
					disabled={disabled}
					id="subject-identity-name"
					maxLength={120}
					onChange={(event) => onNameChange(event.target.value)}
					required
					value={name}
				/>
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
	isSaving,
	name,
	onNameChange,
	onSubmit,
	onSubjectIdentityChange,
	onUseContextChange,
	onVisualWorldChange,
	selectedSubjectIdentityId,
	selectedVisualWorldId,
	subjectIdentities,
	useContext,
	visualWorlds,
}: {
	disabled: boolean;
	families: AssetFamilyCatalog["assetFamilies"];
	isSaving: boolean;
	name: string;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	onSubjectIdentityChange: (value: string) => void;
	onUseContextChange: (value: string) => void;
	onVisualWorldChange: (value: string) => void;
	selectedSubjectIdentityId: string;
	selectedVisualWorldId: string;
	subjectIdentities: AssetFamilyCatalog["subjectIdentities"];
	useContext: string;
	visualWorlds: { id: string; name: string }[];
}) {
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={onSubmit}
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
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || subjectIdentities.length === 0}
					id="asset-family-subject-identity"
					onChange={(event) => onSubjectIdentityChange(event.target.value)}
					required
					value={selectedSubjectIdentityId}
				>
					{subjectIdentities.map((identity) => (
						<option key={identity.id} value={identity.id}>
							{identity.name}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-name">Varlık Ailesi adı</Label>
				<Input
					disabled={disabled}
					id="asset-family-name"
					maxLength={120}
					onChange={(event) => onNameChange(event.target.value)}
					required
					value={name}
				/>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-visual-world">Görsel Dünya</Label>
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || visualWorlds.length === 0}
					id="asset-family-visual-world"
					onChange={(event) => onVisualWorldChange(event.target.value)}
					required
					value={selectedVisualWorldId}
				>
					{visualWorlds.map((visualWorld) => (
						<option key={visualWorld.id} value={visualWorld.id}>
							{visualWorld.name}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-family-use-context">Kullanım bağlamı</Label>
				<Input
					disabled={disabled}
					id="asset-family-use-context"
					maxLength={120}
					onChange={(event) => onUseContextChange(event.target.value)}
					placeholder="Örn. oyun içi sprite"
					required
					value={useContext}
				/>
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
	isSaving,
	name,
	onAssetFamilyChange,
	onNameChange,
	onSubmit,
	selectedAssetFamilyId,
}: {
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetRecords: AssetFamilyCatalog["assetRecords"];
	disabled: boolean;
	isSaving: boolean;
	name: string;
	onAssetFamilyChange: (value: string) => void;
	onNameChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	selectedAssetFamilyId: string;
}) {
	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={onSubmit}
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
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || assetFamilies.length === 0}
					id="asset-record-family"
					onChange={(event) => onAssetFamilyChange(event.target.value)}
					required
					value={selectedAssetFamilyId}
				>
					{assetFamilies.map((family) => (
						<option key={family.id} value={family.id}>
							{family.name} — {family.useContext}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="asset-record-name">Varlık Kaydı adı</Label>
				<Input
					disabled={disabled}
					id="asset-record-name"
					maxLength={120}
					onChange={(event) => onNameChange(event.target.value)}
					required
					value={name}
				/>
			</div>
			<Button
				disabled={
					disabled ||
					assetFamilies.length === 0 ||
					name.trim().length === 0 ||
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
	disabled,
	isSaving,
	onFamilyChange,
	onSourceChange,
	onSubmit,
	onTargetChange,
	onTypeChange,
	selectedAssetFamilyId,
	selectedSourceId,
	selectedTargetId,
	type,
}: {
	assetFamilies: AssetFamilyCatalog["assetFamilies"];
	assetRecords: AssetFamilyCatalog["assetRecords"];
	disabled: boolean;
	isSaving: boolean;
	onFamilyChange: (value: string) => void;
	onSourceChange: (value: string) => void;
	onSubmit: (event: SyntheticEvent<HTMLFormElement>) => void;
	onTargetChange: (value: string) => void;
	onTypeChange: (value: AssetFamilyRelationshipType) => void;
	selectedAssetFamilyId: string;
	selectedSourceId: string;
	selectedTargetId: string;
	type: AssetFamilyRelationshipType;
}) {
	const familyRecords = assetRecords.filter(
		(assetRecord) => assetRecord.assetFamilyId === selectedAssetFamilyId
	);
	const hasPair =
		familyRecords.length >= 2 && selectedSourceId !== selectedTargetId;

	return (
		<form
			className="space-y-3 rounded-lg border border-l-2 border-l-primary/70 p-4"
			onSubmit={onSubmit}
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
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || assetFamilies.length === 0}
					id="relationship-family"
					onChange={(event) => onFamilyChange(event.target.value)}
					required
					value={selectedAssetFamilyId}
				>
					{assetFamilies.map((family) => (
						<option key={family.id} value={family.id}>
							{family.name}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-source">Kaynak Varlık Kaydı</Label>
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || familyRecords.length < 2}
					id="relationship-source"
					onChange={(event) => onSourceChange(event.target.value)}
					required
					value={selectedSourceId}
				>
					{familyRecords.map((assetRecord) => (
						<option key={assetRecord.id} value={assetRecord.id}>
							{assetRecord.name}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-type">İlişki türü</Label>
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled}
					id="relationship-type"
					onChange={(event) =>
						onTypeChange(event.target.value as AssetFamilyRelationshipType)
					}
					value={type}
				>
					{relationshipOptions.map((option) => (
						<option key={option.value} value={option.value}>
							{option.label}
						</option>
					))}
				</select>
			</div>
			<div className="space-y-2">
				<Label htmlFor="relationship-target">İlgili Varlık Kaydı</Label>
				<select
					className="min-h-10 w-full rounded-md border bg-background px-3 py-2 text-sm"
					disabled={disabled || familyRecords.length < 2}
					id="relationship-target"
					onChange={(event) => onTargetChange(event.target.value)}
					required
					value={selectedTargetId}
				>
					{familyRecords.map((assetRecord) => (
						<option key={assetRecord.id} value={assetRecord.id}>
							{assetRecord.name}
						</option>
					))}
				</select>
			</div>
			<Button disabled={disabled || !hasPair} type="submit">
				{isSaving ? "Kaydediliyor…" : "İlişki ekle"}
			</Button>
		</form>
	);
}
