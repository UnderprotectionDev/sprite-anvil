import type {
	AssetFamilyCatalog,
	AssetFamilyRecord,
} from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import {
	type PortraitIdentityReviewInput,
	type PortraitIdentityReviewRecord,
	type PortraitReviewItem,
	portraitIdentityReviewInputSchema,
	portraitReviewObservationSchema,
} from "@sprite-anvil/api/portrait-identity-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { type SyntheticEvent, useId, useState } from "react";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { PortraitReviewItemFields } from "./portrait-review-item-fields";

const observationFields = [
	["identity", "Kimlik tutarlılığı"],
	["expression", "İfade tutarlılığı"],
	["crop", "Kırpma ve yüz görünürlüğü"],
] as const;
const outcomeLabels = {
	passed: "Geçti",
	failed: "Başarısız",
	inconclusive: "Sonuçsuz",
};
interface Props {
	activation: ProjectProfileContractActivation;
	assetRecords: AssetRecord[];
	family: AssetFamilyRecord;
	familyCatalog: AssetFamilyCatalog;
	versionCatalog: AssetVersionCatalog;
}
function makeItem(
	version: AssetVersionCatalog["assetVersions"][number]
): PortraitReviewItem {
	const naturalSize = version.sourceImageDimensions ?? { width: 1, height: 1 };
	return {
		assetRecordId: version.assetRecordId,
		assetVersionId: version.id,
		expression: "",
		usagePurpose: "dialogue",
		naturalSize,
		crop: { x: 0, y: 0, ...naturalSize },
		targetSize: { width: 160, height: 160 },
		background: "light",
	};
}
function SavedReview({ record }: { record: PortraitIdentityReviewRecord }) {
	return (
		<li className="space-y-2 rounded border p-3">
			<p>
				{record.familyName} · {outcomeLabels[record.outcome]} ·{" "}
				{new Date(record.createdAt).toLocaleString("tr-TR")}
			</p>
			<p>{record.rationale}</p>
			<details>
				<summary className="cursor-pointer">
					İnceleme ayrıntılarını göster
				</summary>
				<p>
					Varlık Kimliği: {record.subjectIdentityId} · Görsel Dünya:{" "}
					{record.visualWorldId} · Ana Tasarım: {record.canonicalAssetVersionId}
				</p>
				<ul>
					{record.items.map((item) => (
						<li key={JSON.stringify(item)}>
							{
								record.versionPins.find(
									(p) => p.assetVersionId === item.assetVersionId
								)?.assetRecordName
							}{" "}
							· {item.expression} ·{" "}
							{item.usagePurpose === "dialogue" ? "Diyalog" : "Arayüz"} ·{" "}
							{item.targetSize.width} × {item.targetSize.height} px · Kırpma:{" "}
							{item.crop.x}, {item.crop.y}, {item.crop.width} ×{" "}
							{item.crop.height} ·{" "}
							{
								{ light: "Açık", dark: "Koyu", transparent: "Şeffaf" }[
									item.background
								]
							}
						</li>
					))}
				</ul>
				{observationFields.map(([key, label]) => (
					<p key={key}>
						{label}: {outcomeLabels[record.observations[key].outcome]} ·{" "}
						{record.observations[key].notes}
					</p>
				))}
				<p>Sabitlenen sözleşme: {record.contractRevisionId}</p>
			</details>
		</li>
	);
}
export function PortraitIdentityReviewManager({
	activation,
	family,
	familyCatalog,
	versionCatalog,
	assetRecords,
}: Props) {
	const formId = useId();
	const query = useQuery(
		orpc.portraitIdentityReviews.list.queryOptions({
			input: { projectId: family.projectId, assetFamilyId: family.id },
		})
	);
	const canonical = versionCatalog.canonicalDesigns
		.filter((c) => c.assetFamilyId === family.id)
		.at(-1);
	const names = new Map(assetRecords.map((r) => [r.id, r.name]));
	const eligibleRecords = new Set(
		assetRecords
			.filter(
				(r) =>
					r.assetCategory === "portrait_logo_marketing" &&
					r.availability !== "erased"
			)
			.map((r) => r.id)
	);
	const versions = versionCatalog.assetVersions.filter(
		(v) =>
			v.assetFamilyId === family.id &&
			eligibleRecords.has(v.assetRecordId) &&
			v.integrityVerified &&
			v.contentDigest &&
			v.sourceImageDimensions &&
			(v.id === canonical?.assetVersionId ||
				familyCatalog.relationships.some(
					(link) =>
						link.type === "derivative" &&
						link.assetFamilyId === family.id &&
						link.sourceAssetVersionId === canonical?.assetVersionId &&
						link.targetAssetRecordId === v.assetRecordId
				))
	);
	const [items, setItems] = useState(() =>
		versions.slice(0, 2).map((version) => ({
			key: crypto.randomUUID(),
			value: makeItem(version),
		}))
	);
	const [observations, setObservations] = useState<
		PortraitIdentityReviewInput["observations"]
	>({
		identity: { outcome: "inconclusive", notes: "" },
		expression: { outcome: "inconclusive", notes: "" },
		crop: { outcome: "inconclusive", notes: "" },
	});
	const [rationale, setRationale] = useState("");
	const [ready, setReady] = useState<Set<string>>(() => new Set());
	const [pending, setPending] = useState<PortraitIdentityReviewInput | null>(
		null
	);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	const locked = saving || pending !== null;
	const input = portraitIdentityReviewInputSchema.safeParse({
		id: crypto.randomUUID(),
		projectId: family.projectId,
		assetFamilyId: family.id,
		visualWorldId: family.visualWorldId,
		subjectIdentityId: family.subjectIdentityId,
		canonicalDesignId: canonical?.id,
		contractRevisionId: activation.contractRevisionId,
		items: items.map((i) => i.value),
		observations,
		rationale,
	});
	const canSave =
		input.success &&
		items.every((i) => ready.has(JSON.stringify(i.value))) &&
		items.every((i) => versions.some((v) => v.id === i.value.assetVersionId)) &&
		versionCatalog.assetVersions.find((v) => v.id === canonical?.assetVersionId)
			?.reviewDisposition === "approved" &&
		!query.isPending &&
		!query.isError;
	async function submit(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (locked || !canSave || !input.success) {
			return;
		}
		setSaving(true);
		setMessage("");
		try {
			const saved = await client.portraitIdentityReviews.save(input.data);
			const result = await query.refetch();
			if (result.isError || !result.data?.some((r) => r.id === saved.id)) {
				setPending(input.data);
				setMessage("Kayıt sonucu doğrulanamadı. Kaydı yeniden kontrol edin.");
			} else {
				setMessage("Portre incelemesi kaydedildi.");
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setPending(input.data);
			}
			setMessage(getErrorMessage(error, "Portre incelemesi kaydedilemedi."));
		} finally {
			setSaving(false);
		}
	}
	async function reconcile() {
		if (!pending) {
			return;
		}
		setSaving(true);
		try {
			await client.portraitIdentityReviews.save(pending);
			const result = await query.refetch();
			if (result.isError || !result.data?.some((r) => r.id === pending.id)) {
				throw new Error("Kayıt sonucu doğrulanamadı.");
			}
			setPending(null);
			setMessage("Portre incelemesi kaydedildi.");
		} catch (error) {
			setMessage(getErrorMessage(error, "Portre incelemesi kaydedilemedi."));
		} finally {
			setSaving(false);
		}
	}
	const subject = familyCatalog.subjectIdentities.find(
		(s) => s.id === family.subjectIdentityId
	);
	const related = familyCatalog.assetFamilies.filter(
		(f) =>
			f.id !== family.id && f.subjectIdentityId === family.subjectIdentityId
	);
	return (
		<section
			aria-label="Portre Kimliğini ve Kırpmayı İnceleme"
			className="space-y-4 rounded-lg border p-4"
		>
			<h3 className="font-semibold">
				Portre Kimliğini ve Kırpmayı İnceleme · {family.name}
			</h3>
			<p>
				Varlık Kimliği: {subject?.name ?? family.subjectIdentityId} · Kullanım:{" "}
				{family.useContext}. Bu ailenin Görsel Dünya ve Ana Tasarım soyu
				korunur.
			</p>
			{related.length > 0 ? (
				<p>
					Aynı Varlık Kimliğindeki ayrı aileler:{" "}
					{related.map((f) => f.name).join(", ")}
				</p>
			) : null}
			<p>
				Ana Tasarım: {names.get(canonical?.assetRecordId ?? "") ?? "Seçilmedi"}{" "}
				· Sürüm{" "}
				{versionCatalog.assetVersions.find(
					(v) => v.id === canonical?.assetVersionId
				)?.versionNumber ?? "—"}
			</p>
			{versions.length < 2 ? (
				<p>
					En az iki ifade için portre sürümleri yükleyin ve Türetilmiş Varlık
					bağlarını bu ailenin onaylı Ana Tasarımına bağlayın.
				</p>
			) : null}
			<form className="space-y-4" onSubmit={submit}>
				<div className="grid gap-4 lg:grid-cols-2">
					{items.map((item, index) => (
						<PortraitReviewItemFields
							disabled={locked}
							index={index}
							item={item.value}
							key={item.key}
							names={names}
							onChange={(value) =>
								setItems((current) =>
									current.map((i) => (i.key === item.key ? { ...i, value } : i))
								)
							}
							onReady={(isReady) =>
								setReady((current) => {
									const next = new Set(current);
									const key = JSON.stringify(item.value);
									if (isReady) {
										next.add(key);
									} else {
										next.delete(key);
									}
									return next;
								})
							}
							onRemove={() =>
								setItems((current) => current.filter((i) => i.key !== item.key))
							}
							versions={versions}
						/>
					))}
				</div>
				<Button
					disabled={locked || versions.length === 0 || items.length >= 24}
					onClick={() => {
						const [version] = versions;
						if (version) {
							setItems((current) => [
								...current,
								{ key: crypto.randomUUID(), value: makeItem(version) },
							]);
						}
					}}
					type="button"
					variant="outline"
				>
					İfade ekle
				</Button>
				<fieldset className="space-y-3" disabled={locked}>
					<legend>Karşılaştırma gözlemleri</legend>
					{observationFields.map(([key, label]) => (
						<div className="grid gap-2 sm:grid-cols-2" key={key}>
							<div className="grid gap-1">
								<label htmlFor={`${formId}-${key}`}>{label}</label>
								<select
									className="rounded border p-2"
									id={`${formId}-${key}`}
									onChange={(e) =>
										setObservations((current) => ({
											...current,
											[key]: {
												...current[key],
												outcome:
													portraitReviewObservationSchema.shape.outcome.parse(
														e.target.value
													),
											},
										}))
									}
									value={observations[key].outcome}
								>
									{Object.entries(outcomeLabels).map(([value, text]) => (
										<option key={value} value={value}>
											{text}
										</option>
									))}
								</select>
							</div>
							<label className="grid gap-1">
								{label} notu
								<textarea
									className="rounded border p-2"
									maxLength={1000}
									onChange={(e) =>
										setObservations((current) => ({
											...current,
											[key]: { ...current[key], notes: e.target.value },
										}))
									}
									required
									value={observations[key].notes}
								/>
							</label>
						</div>
					))}
					<label className="grid gap-1">
						İnceleme gerekçesi
						<textarea
							className="rounded border p-2"
							maxLength={2000}
							onChange={(e) => setRationale(e.target.value)}
							required
							value={rationale}
						/>
					</label>
				</fieldset>
				<p className="text-muted-foreground text-sm">
					İki farklı ifadeyi yüklenmiş önizlemelerde karşılaştırın ve gözlemleri
					doldurun. Görsel değerlendirme sizin kararınızdır; kayıt aileyi
					tamamlanmış veya dışa aktarıma hazır yapmaz.
				</p>
				<Button disabled={locked || !canSave} type="submit">
					{saving ? "Kaydediliyor…" : "Portre incelemesini kaydet"}
				</Button>
			</form>
			{message ? <p role="status">{message}</p> : null}
			{pending ? (
				<Button
					disabled={saving}
					onClick={() => void reconcile()}
					type="button"
					variant="outline"
				>
					Kaydı yeniden kontrol et
				</Button>
			) : null}
			{query.isError ? (
				<p role="alert">
					İncelemeler yüklenemedi.{" "}
					<Button
						onClick={() => void query.refetch()}
						type="button"
						variant="outline"
					>
						Yeniden yükle
					</Button>
				</p>
			) : null}
			<h4 className="font-medium">Kaydedilen portre incelemeleri</h4>
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<SavedReview key={record.id} record={record} />
				))}
			</ul>
		</section>
	);
}
export function PortraitIdentityReviewSections({
	activation,
	assetRecords,
	familyCatalog,
	versionCatalog,
	families,
}: Omit<Props, "family" | "activation"> & {
	activation?: ProjectProfileContractActivation;
	families: AssetFamilyRecord[];
}) {
	if (activation?.contract.profileId !== "portrait_logo_marketing") {
		return null;
	}
	const recordIds = new Set(
		assetRecords
			.filter((r) => r.assetCategory === "portrait_logo_marketing")
			.map((r) => r.id)
	);
	return families
		.filter((f) =>
			familyCatalog.assetRecords.some(
				(r) => r.assetFamilyId === f.id && recordIds.has(r.id)
			)
		)
		.map((family) => (
			<PortraitIdentityReviewManager
				activation={activation}
				assetRecords={assetRecords}
				family={family}
				familyCatalog={familyCatalog}
				key={`${family.id}-${activation.contractRevisionId}`}
				versionCatalog={versionCatalog}
			/>
		));
}
