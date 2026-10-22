import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import {
	createIconFamilyReviewArchive,
	type IconFamilyReviewInput,
	type IconFamilyReviewRecord,
} from "@sprite-anvil/api/icon-family-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useState } from "react";
import { ENV } from "@/env";
import {
	type IconFamilyReviewFormValues,
	iconFamilyReviewFormSchema,
} from "@/features/icon-profile/schemas";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

type ReviewableVersion = Pick<
	AssetVersion,
	| "assetFamilyId"
	| "assetRecordId"
	| "contentDigest"
	| "contentLength"
	| "contentType"
	| "id"
	| "integrityVerified"
	| "previewUrl"
	| "versionNumber"
>;

type ReviewAssetRecord = Pick<
	AssetRecord,
	"assetCategory" | "availability" | "id" | "name"
>;

export interface IconFamilyReviewManagerProps {
	activation?: ProjectProfileContractActivation | null;
	assetFamilyId: string;
	assetRecords: ReviewAssetRecord[];
	familyName: string;
	projectId: string;
	versions: ReviewableVersion[];
}

interface ReviewItemDraft {
	assetRecordId: string;
	assetVersionId: string;
	height: string;
	key: string;
	usageVariant: string;
	width: string;
}

type ComparisonKey = keyof IconFamilyReviewInput["comparisons"];
interface ComparisonDraft {
	assessment: string;
	notes: string;
}
type ComparisonsDraft = Record<ComparisonKey, ComparisonDraft>;

const comparisonFields = [
	{ key: "objectScale", label: "Nesne ölçeği" },
	{ key: "lightingDirection", label: "Işık yönü" },
	{ key: "outline", label: "Kontur" },
	{ key: "detailDensity", label: "Ayrıntı yoğunluğu" },
	{ key: "stateOrRarityColor", label: "Durum veya nadirlik rengi" },
] as const satisfies readonly { key: ComparisonKey; label: string }[];

const assessmentOptions: Record<ComparisonKey, readonly [string, string][]> = {
	detailDensity: [
		["consistent", "Tutarlı"],
		["needs_follow_up", "Takip gerekli"],
		["inconclusive", "Sonuçsuz"],
	],
	lightingDirection: [
		["consistent", "Tutarlı"],
		["needs_follow_up", "Takip gerekli"],
		["inconclusive", "Sonuçsuz"],
	],
	objectScale: [
		["consistent", "Tutarlı"],
		["needs_follow_up", "Takip gerekli"],
		["inconclusive", "Sonuçsuz"],
	],
	outline: [
		["consistent", "Tutarlı"],
		["needs_follow_up", "Takip gerekli"],
		["inconclusive", "Sonuçsuz"],
	],
	stateOrRarityColor: [
		["identity_preserved", "Kimlik korundu"],
		["identity_changed", "Kimlik değişti"],
		["inconclusive", "Sonuçsuz"],
	],
};

const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/, "") ?? "";

function makeComparisonDrafts(): ComparisonsDraft {
	return {
		detailDensity: { assessment: "consistent", notes: "" },
		lightingDirection: { assessment: "consistent", notes: "" },
		objectScale: { assessment: "consistent", notes: "" },
		outline: { assessment: "consistent", notes: "" },
		stateOrRarityColor: { assessment: "identity_preserved", notes: "" },
	};
}

function makeItemDraft(
	assetRecordId: string,
	assetVersionId: string,
	width: number,
	key = crypto.randomUUID()
): ReviewItemDraft {
	return {
		assetRecordId,
		assetVersionId,
		height: String(width),
		key,
		usageVariant: "",
		width: String(width),
	};
}

function makeInitialItems(
	assetRecords: ReviewAssetRecord[],
	versions: ReviewableVersion[]
): ReviewItemDraft[] {
	return [24, 64].map((size, index) => {
		const assetRecordId = assetRecords[index]?.id ?? "";
		const assetVersionId =
			versions.find((version) => version.assetRecordId === assetRecordId)?.id ??
			"";
		return makeItemDraft(assetRecordId, assetVersionId, size);
	});
}

function getAssessmentLabel(key: ComparisonKey, assessment: string) {
	return (
		assessmentOptions[key].find(([value]) => value === assessment)?.[1] ??
		assessment
	);
}

function SavedIconFamilyReview({
	onDownload,
	record,
}: {
	onDownload: (record: IconFamilyReviewRecord) => void;
	record: IconFamilyReviewRecord;
}) {
	return (
		<li className="space-y-2 rounded-md border p-3">
			<p className="font-medium">
				{new Date(record.createdAt).toLocaleString("tr-TR")} ·{" "}
				{record.outcome === "consistent" ? "Tutarlı" : "Takip gerekli"}
			</p>
			<p className="text-muted-foreground text-sm">
				{record.versionPins
					.map(
						(pin) =>
							`${pin.assetRecordName} · Sürüm ${pin.versionNumber} · ${pin.contentDigest.slice(0, 12)}`
					)
					.join(" / ")}
			</p>
			<details className="space-y-3 text-sm">
				<summary className="cursor-pointer font-medium">
					İnceleme ayrıntılarını göster
				</summary>
				<div className="space-y-3">
					<p>
						<strong>İnceleme gerekçesi:</strong> {record.rationale}
					</p>
					<div>
						<h5 className="font-medium">Karşılaştırılan ikon sürümleri</h5>
						<ul className="mt-1 space-y-2">
							{record.items.map((item) => {
								const pin = record.versionPins.find(
									(versionPin) =>
										versionPin.assetRecordId === item.assetRecordId &&
										versionPin.assetVersionId === item.assetVersionId
								);
								return (
									<li key={`${item.assetVersionId}-${item.usageVariant}`}>
										<p>
											{pin?.assetRecordName ?? item.assetRecordId} ·{" "}
											{item.usageVariant} · {item.logicalSize.width} ×{" "}
											{item.logicalSize.height} px
										</p>
										{pin ? (
											<p className="break-all text-muted-foreground">
												Varlık Sürümü: {pin.assetVersionId} · Sürüm{" "}
												{pin.versionNumber} · {pin.contentType} ·{" "}
												{pin.contentLength} bayt · SHA-256 {pin.contentDigest}
											</p>
										) : null}
									</li>
								);
							})}
						</ul>
					</div>
					<div>
						<h5 className="font-medium">Aile karşılaştırmaları</h5>
						<dl className="mt-1 space-y-2">
							{comparisonFields.map(({ key, label }) => {
								const comparison = record.comparisons[key];
								return (
									<div key={key}>
										<dt className="font-medium">
											{label}: {getAssessmentLabel(key, comparison.assessment)}
										</dt>
										<dd className="text-muted-foreground">
											{comparison.notes}
										</dd>
									</div>
								);
							})}
						</dl>
					</div>
					<p>
						Arka planlar:{" "}
						{record.testedBackgrounds
							.map((background) => (background === "light" ? "Açık" : "Koyu"))
							.join(", ")}
						· Gri tonlama karşılaştırıldı
					</p>
				</div>
			</details>
			<Button
				onClick={() => onDownload(record)}
				type="button"
				variant="outline"
			>
				JSON arşivini indir
			</Button>
		</li>
	);
}

export function IconFamilyReviewManager({
	activation,
	assetFamilyId,
	assetRecords,
	familyName,
	projectId,
	versions,
}: IconFamilyReviewManagerProps) {
	const idPrefix = useId();
	const iconRecords = assetRecords.filter(
		(record) =>
			record.assetCategory === "icon" && record.availability !== "erased"
	);
	const iconRecordIds = new Set(iconRecords.map((record) => record.id));
	const reviewableVersions = versions.filter(
		(version) =>
			version.assetFamilyId === assetFamilyId &&
			iconRecordIds.has(version.assetRecordId) &&
			version.integrityVerified &&
			version.contentDigest !== null &&
			version.contentLength > 0
	);
	const itemCatalogSignature = JSON.stringify({
		recordIds: iconRecords.map((record) => record.id),
		versions: reviewableVersions.map((version) => [
			version.assetRecordId,
			version.id,
		]),
	});
	const [pendingId, setPendingId] = useState<string | null>(null);
	const [pendingInput, setPendingInput] =
		useState<IconFamilyReviewInput | null>(null);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const reviewSchema = iconFamilyReviewFormSchema({
		assetFamilyId,
		contractRevisionId: activation?.contractRevisionId ?? "",
		projectId,
	});
	const [defaultValues] = useState(
		(): IconFamilyReviewFormValues => ({
			comparisons: makeComparisonDrafts(),
			items: makeInitialItems(iconRecords, reviewableVersions),
			outcome: "needs_follow_up",
			rationale: "",
		})
	);
	const form = useForm({
		defaultValues,
		onSubmit: ({ value }) => {
			void save(reviewSchema.parse(value));
		},
		onSubmitInvalid: ({ formApi }) => {
			const issue = formApi.state.errorMap.onSubmit;
			setMessage(
				typeof issue === "string" ? issue : "İnceleme bilgilerini kontrol edin."
			);
		},
		validators: {
			onSubmit: ({ value }) => {
				const result = reviewSchema.safeParse(value);
				return result.success
					? undefined
					: (result.error.issues[0]?.message ??
							"İnceleme bilgilerini kontrol edin.");
			},
		},
	});
	const items = useStore(form.store, (state) => state.values.items);
	const [itemsTouched, setItemsTouched] = useState(false);
	const [initializedItemCatalog, setInitializedItemCatalog] =
		useState(itemCatalogSignature);
	useEffect(() => {
		if (
			itemsTouched ||
			iconRecords.length < 2 ||
			initializedItemCatalog === itemCatalogSignature
		) {
			return;
		}
		form.setFieldValue(
			"items",
			makeInitialItems(iconRecords, reviewableVersions),
			{ dontUpdateMeta: true }
		);
		setInitializedItemCatalog(itemCatalogSignature);
	}, [
		form,
		iconRecords,
		initializedItemCatalog,
		itemCatalogSignature,
		itemsTouched,
		reviewableVersions,
	]);
	const reviewQuery = useQuery({
		...orpc.iconFamilyReviews.list.queryOptions({
			input: { assetFamilyId, projectId },
		}),
		enabled:
			activation?.contract.profileId === "icon" && iconRecords.length >= 2,
	});

	const queryClient = useQueryClient();
	const saveMutation = useMutation(
		orpc.iconFamilyReviews.save.mutationOptions({
			...mutationMeta,
			onSuccess: async (_saved, input) => {
				setPendingInput(null);
				const reviewsKey = orpc.iconFamilyReviews.list.queryKey({
					input: { assetFamilyId, projectId },
				});
				await queryClient.invalidateQueries({ queryKey: reviewsKey });
				const refreshed =
					queryClient.getQueryState<IconFamilyReviewRecord[]>(reviewsKey);
				const persisted = refreshed?.data?.find(
					(record) => record.id === input.id
				);
				if (refreshed?.status === "error" || !persisted) {
					setUncertain(true);
					setMessage(
						"İnceleme kaydedildi; ancak kalıcı kayıt yeniden okunamadı. Güncel kayıtları kontrol edin."
					);
					return;
				}
				setPendingId(null);
				setUncertain(false);
				setMessage("İnceleme kalıcı kayıttan doğrulandı.");
			},
		})
	);
	const saving = saveMutation.isPending;

	if (activation?.contract.profileId !== "icon" || iconRecords.length < 2) {
		return null;
	}
	const versionsByRecord = new Map<string, ReviewableVersion[]>();
	for (const version of reviewableVersions) {
		const recordVersions = versionsByRecord.get(version.assetRecordId) ?? [];
		recordVersions.push(version);
		versionsByRecord.set(version.assetRecordId, recordVersions);
	}
	const recordsById = new Map(iconRecords.map((record) => [record.id, record]));
	const versionsById = new Map(
		reviewableVersions.map((version) => [version.id, version])
	);

	async function checkCurrentRecords() {
		const result = await reviewQuery.refetch();
		const persisted = result.data?.find((record) => record.id === pendingId);
		if (persisted && !result.isError) {
			setPendingId(null);
			setUncertain(false);
			setPendingInput(null);
			setMessage("İnceleme kalıcı kayıttan doğrulandı.");
			return;
		}
		setMessage(
			result.isError
				? "Kayıtlar yeniden okunamadı. Aynı incelemeyi göndermeden önce tekrar kontrol edin."
				: "İnceleme kalıcı listede görünmüyor. Sonuç belirsiz kaldı; aynı incelemeyi yeniden gönderebilir veya kayıtları tekrar kontrol edebilirsiniz."
		);
	}

	async function save(input: IconFamilyReviewInput) {
		setPendingId(input.id);
		setPendingInput(input);
		setMessage("");
		try {
			await saveMutation.mutateAsync(input);
		} catch (error) {
			if (!isWriteOutcomeUncertain(error)) {
				setPendingId(null);
				setUncertain(false);
				setPendingInput(null);
				setMessage(getErrorMessage(error, "İnceleme kaydedilemedi."));
				return;
			}
			setUncertain(true);
			setMessage(
				"Kaydetme sonucu doğrulanamadı. Güncel kayıtları kontrol edin; kayıt yoksa aynı incelemeyi yeniden gönderebilirsiniz."
			);
		}
	}

	function resendPendingReview() {
		if (pendingInput) {
			void save(pendingInput);
		}
	}

	function downloadArchive(record: IconFamilyReviewRecord) {
		try {
			const archive = createIconFamilyReviewArchive(record);
			const blob = new Blob([JSON.stringify(archive, null, 2)], {
				type: "application/json",
			});
			const url = URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `icon-family-review-${record.id}.json`;
			anchor.click();
			setTimeout(() => URL.revokeObjectURL(url), 1000);
			setMessage("İkon ailesi inceleme JSON arşivi indirildi.");
		} catch {
			setMessage("İkon ailesi inceleme JSON arşivi oluşturulamadı.");
		}
	}

	return (
		<section
			aria-labelledby={`${idPrefix}-heading`}
			className="space-y-4 rounded-lg border p-4"
		>
			<div>
				<h3 className="font-semibold text-xl" id={`${idPrefix}-heading`}>
					{familyName} · İkon Ailesi Tutarlılığını İnceleme
				</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Kesin ikon sürümlerini kullanım çeşidi ve mantıksal ölçüyle yan yana
					karşılaştırın. Açık, koyu ve gri tonlama önizlemeleri ekranda görünür;
					indirilen JSON inceleme kaydını, sürüm kimliklerini ve özetlerini
					taşır, görsel dosyalarını içermez.
				</p>
			</div>
			{reviewQuery.isPending ? (
				<p aria-live="polite" role="status">
					İkon aile incelemeleri yükleniyor…
				</p>
			) : null}
			{reviewQuery.isError ? (
				<p role="alert">
					İkon aile incelemeleri okunamadı. Kayıtları yeniden okuyun.
				</p>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{uncertain ? (
				<div className="flex flex-wrap gap-2">
					<Button
						disabled={reviewQuery.isFetching || saving}
						onClick={() => void checkCurrentRecords()}
						type="button"
					>
						Güncel kayıtları kontrol et
					</Button>
					{pendingInput ? (
						<Button
							disabled={reviewQuery.isFetching || saving}
							onClick={resendPendingReview}
							type="button"
							variant="outline"
						>
							Aynı incelemeyi yeniden gönder
						</Button>
					) : null}
				</div>
			) : null}
			{reviewQuery.data?.length ? (
				<section aria-label="Kaydedilmiş ikon ailesi incelemeleri">
					<h4 className="font-medium">Kaydedilmiş incelemeler</h4>
					<ul className="mt-2 space-y-3">
						{reviewQuery.data.map((record) => (
							<SavedIconFamilyReview
								key={record.id}
								onDownload={downloadArchive}
								record={record}
							/>
						))}
					</ul>
				</section>
			) : null}
			<form
				className="space-y-5"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					setMessage("");
					void form.handleSubmit();
				}}
			>
				<form.Field mode="array" name="items">
					{(itemsField) => (
						<FieldSet className="space-y-3">
							<FieldLegend className="font-medium">
								Karşılaştırma öğeleri
							</FieldLegend>
							{itemsField.state.value.map((item, index) => {
								const rowId = `${idPrefix}-item-${index}`;
								return (
									<FieldSet
										aria-label={`Karşılaştırma öğesi ${index + 1}`}
										className="space-y-3 rounded-md border p-3"
										key={item.key}
									>
										<FieldLegend className="px-1 font-medium text-sm">
											Karşılaştırma öğesi {index + 1}
										</FieldLegend>
										<div className="grid gap-3 sm:grid-cols-2">
											<form.Field name={`items[${index}].assetRecordId`}>
												{(field) => (
													<Label
														className="block space-y-1 text-sm"
														htmlFor={`${rowId}-record`}
													>
														<span>Varlık Kaydı</span>
														<NativeSelect
															className="w-full"
															id={`${rowId}-record`}
															onChange={(event) => {
																const assetRecordId = event.currentTarget.value;
																setItemsTouched(true);
																field.handleChange(assetRecordId);
																form.setFieldValue(
																	`items[${index}].assetVersionId`,
																	versionsByRecord.get(assetRecordId)?.[0]
																		?.id ?? ""
																);
															}}
															value={field.state.value}
														>
															{iconRecords.map((option) => (
																<NativeSelectOption
																	key={option.id}
																	value={option.id}
																>
																	{option.name}
																</NativeSelectOption>
															))}
														</NativeSelect>
													</Label>
												)}
											</form.Field>
											<form.Field name={`items[${index}].assetVersionId`}>
												{(field) => (
													<Label
														className="block space-y-1 text-sm"
														htmlFor={`${rowId}-version`}
													>
														<span>Varlık Sürümü</span>
														<NativeSelect
															className="w-full"
															id={`${rowId}-version`}
															onChange={(event) => {
																setItemsTouched(true);
																field.handleChange(event.currentTarget.value);
															}}
															value={field.state.value}
														>
															{(
																versionsByRecord.get(item.assetRecordId) ?? []
															).map((option) => (
																<NativeSelectOption
																	key={option.id}
																	value={option.id}
																>
																	Sürüm {option.versionNumber} ·{" "}
																	{option.contentDigest?.slice(0, 12)}
																</NativeSelectOption>
															))}
														</NativeSelect>
													</Label>
												)}
											</form.Field>
											<form.Field name={`items[${index}].usageVariant`}>
												{(field) => (
													<Label
														className="block space-y-1 text-sm"
														htmlFor={`${rowId}-variant`}
													>
														<span>Kullanım çeşidi</span>
														<Input
															id={`${rowId}-variant`}
															maxLength={100}
															onChange={(event) => {
																setItemsTouched(true);
																field.handleChange(event.currentTarget.value);
															}}
															required
															value={field.state.value}
														/>
													</Label>
												)}
											</form.Field>
											<form.Field name={`items[${index}].width`}>
												{(field) => (
													<Label
														className="block space-y-1 text-sm"
														htmlFor={`${rowId}-width`}
													>
														<span>Mantıksal genişlik (px)</span>
														<Input
															id={`${rowId}-width`}
															max={4096}
															min={1}
															onChange={(event) => {
																setItemsTouched(true);
																field.handleChange(event.currentTarget.value);
															}}
															required
															type="number"
															value={field.state.value}
														/>
													</Label>
												)}
											</form.Field>
											<form.Field name={`items[${index}].height`}>
												{(field) => (
													<Label
														className="block space-y-1 text-sm"
														htmlFor={`${rowId}-height`}
													>
														<span>Mantıksal yükseklik (px)</span>
														<Input
															id={`${rowId}-height`}
															max={4096}
															min={1}
															onChange={(event) => {
																setItemsTouched(true);
																field.handleChange(event.currentTarget.value);
															}}
															required
															type="number"
															value={field.state.value}
														/>
													</Label>
												)}
											</form.Field>
										</div>
										{itemsField.state.value.length > 2 ? (
											<Button
												aria-label={`Karşılaştırma öğesi ${index + 1} satırını kaldır`}
												onClick={() => {
													setItemsTouched(true);
													itemsField.removeValue(index);
												}}
												type="button"
												variant="outline"
											>
												Satırı kaldır
											</Button>
										) : null}
									</FieldSet>
								);
							})}
							<Button
								disabled={itemsField.state.value.length >= 24}
								onClick={() => {
									setItemsTouched(true);
									const assetRecordId = iconRecords[0]?.id ?? "";
									const assetVersionId =
										versionsByRecord.get(assetRecordId)?.[0]?.id ?? "";
									itemsField.pushValue(
										makeItemDraft(assetRecordId, assetVersionId, 48)
									);
								}}
								type="button"
								variant="outline"
							>
								Kullanım çeşidi ekle
							</Button>
						</FieldSet>
					)}
				</form.Field>
				<section
					aria-labelledby={`${idPrefix}-family-comparison-heading`}
					className="space-y-3"
				>
					<div>
						<h4
							className="font-medium"
							id={`${idPrefix}-family-comparison-heading`}
						>
							İkon ailesini yan yana karşılaştırma
						</h4>
						<p className="mt-1 text-muted-foreground text-sm">
							Seçili kesin ikon sürümleri; kullanım çeşidi, mantıksal ölçü, açık
							ve koyu arka plan ile gri tonlamada birlikte görünür.
						</p>
					</div>
					<div className="overflow-x-auto pb-1">
						<div
							aria-label="İkon ailesi karşılaştırma ızgarası"
							className="grid gap-3"
							role="group"
							style={{
								display: "grid",
								gridTemplateColumns: `repeat(${items.length}, minmax(12rem, 1fr))`,
							}}
						>
							{items.map((item, index) => {
								const record = recordsById.get(item.assetRecordId);
								const version = versionsById.get(item.assetVersionId);
								const logicalWidth = Number(item.width) || 24;
								const logicalHeight = Number(item.height) || 24;
								const itemName =
									record?.name ?? `Karşılaştırma öğesi ${index + 1}`;
								const usageVariant =
									item.usageVariant || "Kullanım çeşidi belirtilmedi";
								return (
									<article
										aria-label={`${itemName} · ${usageVariant} · ${logicalWidth} × ${logicalHeight} px`}
										className="min-w-0 space-y-3 rounded-md border p-3"
										key={item.key}
									>
										<div>
											<h5 className="font-medium">{itemName}</h5>
											<p className="text-muted-foreground text-sm">
												{usageVariant} · {logicalWidth} × {logicalHeight} px
											</p>
										</div>
										{version && record ? (
											<div className="grid grid-cols-3 gap-2">
												<IconPreview
													background="light"
													height={logicalHeight}
													name={record.name}
													version={version}
													width={logicalWidth}
												/>
												<IconPreview
													background="dark"
													height={logicalHeight}
													name={record.name}
													version={version}
													width={logicalWidth}
												/>
												<IconPreview
													background="grayscale"
													height={logicalHeight}
													name={record.name}
													version={version}
													width={logicalWidth}
												/>
											</div>
										) : (
											<p className="text-muted-foreground text-sm">
												Bu Varlık Kaydı için bütünlüğü doğrulanmış ikon sürümü
												yok.
											</p>
										)}
									</article>
								);
							})}
						</div>
					</div>
				</section>

				<FieldSet className="space-y-3">
					<FieldLegend className="font-medium">
						Aile karşılaştırmaları
					</FieldLegend>
					<div className="grid gap-3 sm:grid-cols-2">
						{comparisonFields.map(({ key, label }) => (
							<div className="space-y-2" key={key}>
								<form.Field name={`comparisons.${key}.assessment`}>
									{(field) => (
										<Label
											className="block space-y-1 text-sm"
											htmlFor={`${idPrefix}-${key}-assessment`}
										>
											<span>{label} değerlendirmesi</span>
											<NativeSelect
												className="w-full"
												id={`${idPrefix}-${key}-assessment`}
												onChange={(event) =>
													field.handleChange(event.currentTarget.value)
												}
												value={field.state.value}
											>
												{assessmentOptions[key].map(([value, optionLabel]) => (
													<NativeSelectOption key={value} value={value}>
														{optionLabel}
													</NativeSelectOption>
												))}
											</NativeSelect>
										</Label>
									)}
								</form.Field>
								<form.Field name={`comparisons.${key}.notes`}>
									{(field) => (
										<Label
											className="block space-y-1 text-sm"
											htmlFor={`${idPrefix}-${key}-notes`}
										>
											<span>{label} notu</span>
											<Textarea
												className="min-h-20"
												id={`${idPrefix}-${key}-notes`}
												maxLength={1000}
												onChange={(event) =>
													field.handleChange(event.currentTarget.value)
												}
												required
												value={field.state.value}
											/>
										</Label>
									)}
								</form.Field>
							</div>
						))}
					</div>
				</FieldSet>

				<div className="grid gap-3 sm:grid-cols-2">
					<form.Field name="outcome">
						{(field) => (
							<Label
								className="block space-y-1 text-sm"
								htmlFor={`${idPrefix}-outcome`}
							>
								<span>İnceleme sonucu</span>
								<NativeSelect
									className="w-full"
									id={`${idPrefix}-outcome`}
									onChange={(event) =>
										field.handleChange(
											event.currentTarget.value as
												| "consistent"
												| "needs_follow_up"
										)
									}
									value={field.state.value}
								>
									<NativeSelectOption value="consistent">
										Tutarlı
									</NativeSelectOption>
									<NativeSelectOption value="needs_follow_up">
										Takip gerekli
									</NativeSelectOption>
								</NativeSelect>
							</Label>
						)}
					</form.Field>
					<form.Field name="rationale">
						{(field) => (
							<Label
								className="block space-y-1 text-sm"
								htmlFor={`${idPrefix}-rationale`}
							>
								<span>İnceleme gerekçesi</span>
								<Textarea
									className="min-h-20"
									id={`${idPrefix}-rationale`}
									maxLength={2000}
									onChange={(event) =>
										field.handleChange(event.currentTarget.value)
									}
									required
									value={field.state.value}
								/>
							</Label>
						)}
					</form.Field>
				</div>
				<p className="text-muted-foreground text-sm">
					Tek bir ışık veya nadirlik rengi proje genelinde yeni bir sanat kuralı
					oluşturmaz.
				</p>
				<Button
					disabled={
						saving ||
						uncertain ||
						reviewQuery.isPending ||
						reviewQuery.isError ||
						items.some((item) => !versionsById.has(item.assetVersionId))
					}
					type="submit"
				>
					{saving ? "İnceleme kaydediliyor…" : "İncelemeyi kaydet"}
				</Button>
			</form>
		</section>
	);
}

function IconPreview({
	background,
	height,
	name,
	version,
	width,
}: {
	background: "dark" | "grayscale" | "light";
	height: number;
	name: string;
	version: ReviewableVersion;
	width: number;
}) {
	const { imageClass, label, stageClass } = {
		dark: {
			imageClass: "",
			label: "Koyu arka plan",
			stageClass: "bg-zinc-900",
		},
		grayscale: {
			imageClass: "grayscale",
			label: "Gri tonlama",
			stageClass: "bg-neutral-300",
		},
		light: {
			imageClass: "",
			label: "Açık arka plan",
			stageClass: "bg-white",
		},
	}[background];
	const renderBound = 80;
	const scaledNote =
		width > renderBound || height > renderBound
			? ` · ${renderBound} px'e ölçeklendi`
			: "";
	const imageSize = (size: number) =>
		`${Math.min(Math.max(size, 1), renderBound)}px`;
	return (
		<figure className="space-y-1 text-center">
			<figcaption className="text-muted-foreground text-xs">
				{label}
				{scaledNote}
			</figcaption>
			<div
				className={`flex min-h-24 items-center justify-center overflow-hidden rounded border p-2 ${stageClass}`}
			>
				<img
					alt={`${name} · ${label}${scaledNote}`}
					className={imageClass}
					height={Math.min(Math.max(height, 1), renderBound)}
					src={`${serverUrl}${version.previewUrl}`}
					style={{
						height: imageSize(height),
						maxHeight: "80px",
						maxWidth: "80px",
						objectFit: "contain",
						width: imageSize(width),
					}}
					width={Math.min(Math.max(width, 1), renderBound)}
				/>
			</div>
		</figure>
	);
}
