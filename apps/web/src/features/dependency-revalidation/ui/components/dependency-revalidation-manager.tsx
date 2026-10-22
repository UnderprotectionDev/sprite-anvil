import type {
	AssetVersionReviewInput,
	AssetVersionSourceKind,
} from "@sprite-anvil/api/asset-versions";
import type {
	ChangeFacetInput,
	DependencyLinkInput,
} from "@sprite-anvil/api/dependency-revalidation";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import type z from "zod";
import { orpc } from "@/utils/orpc";
import { changeFacetFormSchema, dependencyLinkFormSchema } from "../../schemas";
import {
	DependencyFacets,
	dependencyFacetLabel,
	selectedDependencyFacets,
} from "./dependency-facets";
import { DerivativeReReviewForm } from "./derivative-re-review-form";

interface Props {
	canonicalVersionIds: string[];
	onImpactSaved?: () => Promise<void>;
	projectId: string;
	records: { id: string; name: string }[];
	versions: {
		id: string;
		assetRecordId: string;
		assetFamilyId?: string;
		reviewDisposition?: AssetVersionReviewInput["decision"];
		previewUrl?: string;
		versionNumber: number;
		sourceKind?: AssetVersionSourceKind;
	}[];
}

export function DependencyRevalidationManager({
	projectId,
	versions,
	records,
	canonicalVersionIds,
	onImpactSaved,
}: Props) {
	const query = useQuery({
		...orpc.dependencyRevalidation.list.queryOptions({ input: { projectId } }),
	});
	const queryClient = useQueryClient();
	const createLinkMutation = useMutation(
		orpc.dependencyRevalidation.createLink.mutationOptions()
	);
	const determineMutation = useMutation(
		orpc.dependencyRevalidation.determine.mutationOptions()
	);
	const reReviewMutation = useMutation(
		orpc.dependencyRevalidation.reReview.mutationOptions()
	);
	const identifier = useId();
	const linkDefaults: z.input<typeof dependencyLinkFormSchema> = {
		kind: "asset_version",
		sourceId: "",
		targetId: "",
		facets: [],
		other: "",
	};
	const linkForm = useForm({
		defaultValues: linkDefaults,
		onSubmit: ({ value }) => {
			void save(
				() =>
					createLinkMutation.mutateAsync({
						projectId,
						source: { kind: value.kind, id: value.sourceId },
						targetAssetVersionId: value.targetId,
						facets: selectedDependencyFacets(value.facets, value.other),
					}),
				"Bağımlılık Bağlantısı kaydedildi."
			);
		},
		validators: { onSubmit: dependencyLinkFormSchema },
	});
	const changeDefaults: z.input<typeof changeFacetFormSchema> = {
		kind: "canonical_design",
		sourceId: "",
		facets: [],
		other: "",
	};
	const changeForm = useForm({
		defaultValues: changeDefaults,
		onSubmit: ({ value }) => {
			void save(
				() =>
					determineMutation.mutateAsync({
						projectId,
						source: { kind: value.kind, id: value.sourceId },
						facets: selectedDependencyFacets(value.facets, value.other),
					}),
				"Değişiklik etkisi kaydedildi."
			);
		},
		validators: { onSubmit: changeFacetFormSchema },
	});
	const link = useStore(linkForm.store, (state) => state.values);
	const change = useStore(changeForm.store, (state) => state.values);
	const linkKind: DependencyLinkInput["source"]["kind"] = link.kind;
	const changeKind: ChangeFacetInput["source"]["kind"] = change.kind;
	const [busy, setBusy] = useState(false);
	const [uncertain, setUncertain] = useState(false);
	const [message, setMessage] = useState("");
	const disabled = busy || uncertain || !query.isSuccess || query.isError;
	const names = new Map(records.map((record) => [record.id, record.name]));
	const versionLabels = new Map(
		versions.map((version) => [
			version.id,
			`${names.get(version.assetRecordId) ?? version.assetRecordId} · v${version.versionNumber}`,
		])
	);
	const contexts = query.data?.contextRevisions ?? [];
	const contextOptions = contexts.map((revision) => ({
		id: revision.id,
		label: `Bağlam Sürümü ${revision.revisionNumber}${revision.isActive ? " (etkin)" : ""}`,
	}));
	function dependencySourceLabel(source: DependencyLinkInput["source"]) {
		if (source.kind === "context_revision") {
			return (
				contextOptions.find((option) => option.id === source.id)?.label ??
				source.id
			);
		}
		return versionLabels.get(source.id) ?? source.id;
	}
	const linkOptions =
		linkKind === "context_revision"
			? contextOptions
			: versions.map((version) => ({
					id: version.id,
					label: versionLabels.get(version.id) ?? version.id,
				}));
	const changeOptions =
		changeKind === "context_revision"
			? contextOptions
			: versions
					.filter((version) => canonicalVersionIds.includes(version.id))
					.map((version) => ({
						id: version.id,
						label: versionLabels.get(version.id) ?? version.id,
					}));

	async function save(
		operation: () => Promise<unknown>,
		successMessage: string
	) {
		if (disabled) {
			return;
		}
		setBusy(true);
		setMessage("");
		try {
			await operation();
			let rereadFailed = false;
			try {
				await queryClient.invalidateQueries(
					{
						queryKey: orpc.dependencyRevalidation.list.queryKey({
							input: { projectId },
						}),
					},
					{ throwOnError: true }
				);
			} catch {
				rereadFailed = true;
			}
			await onImpactSaved?.();
			if (rereadFailed) {
				setUncertain(true);
				setMessage(
					"Kayıt kaydedildi ancak sonuç yeniden okunamadı. Durumu kontrol edin."
				);
			} else {
				setMessage(successMessage);
			}
		} catch {
			setUncertain(true);
			setMessage(
				"İşlem tamamlanamadı veya sonucu doğrulanamadı. Yeniden kaydetmeden önce durumu kontrol edin."
			);
		} finally {
			setBusy(false);
		}
	}

	async function checkStatus() {
		setBusy(true);
		try {
			const result = await query.refetch();
			await onImpactSaved?.();
			if (!result.isError) {
				setUncertain(false);
				setMessage(
					"Kalıcı kayıtlar yeniden okundu. Kaydetmeden önce sonucu kontrol edin."
				);
			}
		} catch {
			setMessage("Kayıtlar yeniden okunamadı. Durumu tekrar kontrol edin.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<section
			aria-labelledby={`${identifier}-heading`}
			className="space-y-5 rounded-lg border p-5"
		>
			<h2 className="font-semibold text-2xl" id={`${identifier}-heading`}>
				Değişiklik Etkisini Belirleme
			</h2>
			<p className="text-muted-foreground text-sm">
				Bağımlılıkları kesin sürümlere bağlayın. Değişen özellikleri
				onayladığınızda ilgili doğrudan ve dolaylı Türetilmiş Varlıklar yeniden
				doğrulama ister. Geçmiş onay ve kalite kanıtları değişmez.
			</p>
			{query.isPending ? (
				<p role="status">Bağımlılık kayıtları yükleniyor…</p>
			) : null}
			{query.isError ? (
				<p role="alert">Bağımlılık kayıtları okunamadı.</p>
			) : null}
			{message ? (
				<p aria-live="polite" role="status">
					{message}
				</p>
			) : null}
			{uncertain || query.isError ? (
				<Button
					disabled={busy}
					onClick={() => void checkStatus()}
					type="button"
					variant="outline"
				>
					Durumu kontrol et
				</Button>
			) : null}
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void linkForm.handleSubmit();
				}}
			>
				<FieldSet className="space-y-4" disabled={disabled}>
					<FieldLegend className="font-semibold">
						Bağımlılık Bağlantısı
					</FieldLegend>
					<linkForm.Field name="kind">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-link-kind`}>
									Bağımlılık kaynak türü
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-link-kind`}
									onChange={(event) => {
										field.handleChange(
											event.target.value === "context_revision"
												? "context_revision"
												: "asset_version"
										);
										linkForm.setFieldValue("sourceId", "");
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="asset_version">
										Varlık Sürümü
									</NativeSelectOption>
									<NativeSelectOption value="context_revision">
										Bağlam Sürümü
									</NativeSelectOption>
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="sourceId">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-link-source`}>
									Bağımlılık kaynağı
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-link-source`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">Kaynak seçin</NativeSelectOption>
									{linkOptions.map((option) => (
										<NativeSelectOption key={option.id} value={option.id}>
											{option.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="targetId">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-target`}>
									Türetilmiş Varlık Sürümü
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-target`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">Sürüm seçin</NativeSelectOption>
									{versions
										.filter(
											(version) =>
												version.sourceKind === "derived" &&
												(linkKind !== "asset_version" ||
													version.id !== link.sourceId)
										)
										.map((version) => (
											<NativeSelectOption key={version.id} value={version.id}>
												{versionLabels.get(version.id)}
											</NativeSelectOption>
										))}
								</NativeSelect>
							</>
						)}
					</linkForm.Field>
					<linkForm.Field name="facets">
						{(facetsField) => (
							<linkForm.Field name="other">
								{(otherField) => (
									<DependencyFacets
										disabled={disabled}
										facetsField={facetsField}
										legend="Bağımlı özellikler"
										otherField={otherField}
									/>
								)}
							</linkForm.Field>
						)}
					</linkForm.Field>
					<p className="text-muted-foreground text-sm">
						Özellik seçilmezse bağlantı eksik tanımlanmış sayılır ve
						değişikliklerde güvenli tarafta işaretlenir.
					</p>
					<Button
						disabled={
							disabled || !dependencyLinkFormSchema.safeParse(link).success
						}
						type="submit"
					>
						Bağımlılık Bağlantısını Kaydet
					</Button>
				</FieldSet>
			</form>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void changeForm.handleSubmit();
				}}
			>
				<FieldSet className="space-y-4" disabled={disabled}>
					<FieldLegend className="font-semibold">Değişiklik Tanımı</FieldLegend>
					<changeForm.Field name="kind">
						{(field) => (
							<>
								<Label className="block" htmlFor={`${identifier}-change-kind`}>
									Değişen kaynak türü
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-change-kind`}
									onChange={(event) => {
										field.handleChange(
											event.target.value === "context_revision"
												? "context_revision"
												: "canonical_design"
										);
										changeForm.setFieldValue("sourceId", "");
									}}
									value={field.state.value}
								>
									<NativeSelectOption value="canonical_design">
										Ana Tasarım
									</NativeSelectOption>
									<NativeSelectOption value="context_revision">
										Bağlam Sürümü
									</NativeSelectOption>
								</NativeSelect>
							</>
						)}
					</changeForm.Field>
					<changeForm.Field name="sourceId">
						{(field) => (
							<>
								<Label
									className="block"
									htmlFor={`${identifier}-change-source`}
								>
									Değişen kaynak
								</Label>
								<NativeSelect
									className="w-full"
									id={`${identifier}-change-source`}
									onChange={(event) => field.handleChange(event.target.value)}
									required
									value={field.state.value}
								>
									<NativeSelectOption value="">Kaynak seçin</NativeSelectOption>
									{changeOptions.map((option) => (
										<NativeSelectOption key={option.id} value={option.id}>
											{option.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							</>
						)}
					</changeForm.Field>
					<changeForm.Field name="facets">
						{(facetsField) => (
							<changeForm.Field name="other">
								{(otherField) => (
									<DependencyFacets
										disabled={disabled}
										facetsField={facetsField}
										legend="Değişen özellikler"
										otherField={otherField}
									/>
								)}
							</changeForm.Field>
						)}
					</changeForm.Field>
					<Button
						disabled={
							disabled || !changeFacetFormSchema.safeParse(change).success
						}
						type="submit"
					>
						Değişiklik Etkisini Belirle
					</Button>
				</FieldSet>
			</form>
			{query.data ? (
				<div className="space-y-4">
					<h3 className="font-semibold">Kalıcı Bağımlılık Bağlantıları</h3>
					<ul className="space-y-2">
						{query.data.dependencyLinks.map((savedLink) => (
							<li key={savedLink.id}>
								{dependencySourceLabel(savedLink.source)} →{" "}
								{versionLabels.get(savedLink.targetAssetVersionId) ??
									savedLink.targetAssetVersionId}
								:{" "}
								{savedLink.facets.length > 0
									? savedLink.facets.map(dependencyFacetLabel).join(", ")
									: "Eksik Bağımlılık Bağlantısı"}
							</li>
						))}
					</ul>
					<h3 className="font-semibold">Güncel Yeniden Doğrulama Gerekli</h3>
					{query.data.revalidationRequiredVersionIds.length === 0 ? (
						<p>Kaydedilmiş değişikliklerden etkilenen sürüm yok.</p>
					) : (
						<ul className="space-y-2">
							{query.data.revalidationRequiredVersionIds.map((versionId) => (
								<li key={versionId}>
									{versionLabels.get(versionId) ?? versionId}: Yeniden Doğrulama
									Gerekli
								</li>
							))}
						</ul>
					)}
					<h3 className="font-semibold">Kaydedilmiş Değişiklik Etkileri</h3>
					{query.data.revalidationRequiredVersionIds.map((versionId) => {
						const version = versions.find((entry) => entry.id === versionId);
						if (!version) {
							return null;
						}
						const activeContext = contexts.find((entry) => entry.isActive);
						const canonicalId = query.data.canonicalDesigns.find(
							(entry) => entry.assetFamilyId === version.assetFamilyId
						)?.assetVersionId;
						const canonical = versions.find(
							(entry) => entry.id === canonicalId
						);
						return (
							<DerivativeReReviewForm
								assetVersionId={versionId}
								canonicalDesignVersionId={canonicalId}
								canonicalLabel={
									versionLabels.get(canonicalId ?? "") ?? "Ana Tasarım"
								}
								canonicalPreviewUrl={canonical?.previewUrl}
								canonicalVersionNumber={canonical?.versionNumber}
								changeImpactIds={query.data.changeImpacts
									.filter((impact) =>
										impact.affectedVersions.some(
											(entry) => entry.assetVersionId === versionId
										)
									)
									.map((impact) => impact.id)}
								contextRevisionId={activeContext?.id}
								contextRevisionNumber={activeContext?.revisionNumber}
								disabled={disabled}
								key={versionId}
								label={versionLabels.get(versionId) ?? versionId}
								onReview={(input) =>
									void save(
										() => reReviewMutation.mutateAsync(input),
										input.decision === "approved"
											? "Güncel uygunluk için yeni İnceleme Kaydı kaydedildi."
											: "İçerik düzeltmesi için Aday inceleme kaydı kaydedildi. Yeni Birim veya Birleşik Sürüm hazırlayın; Yeniden Doğrulama Gerekli korunur."
									)
								}
								previewUrl={version.previewUrl}
								projectId={projectId}
								versionNumber={version.versionNumber}
							/>
						);
					})}
					<h3 className="font-semibold">Yeniden İnceleme Kayıtları</h3>
					<ul className="space-y-2">
						{query.data.reviews.map((review) => (
							<li key={review.id}>
								{versionLabels.get(review.assetVersionId) ??
									review.assetVersionId}{" "}
								—{" "}
								{review.decision === "approved"
									? "Güncel uygunluk onaylandı"
									: "İçerik düzeltmesi gerekli"}{" "}
								— Bağlam Sürümü{" "}
								{contexts.find((entry) => entry.id === review.contextRevisionId)
									?.revisionNumber ?? review.contextRevisionId}{" "}
								— Ana Tasarım:{" "}
								{versionLabels.get(review.canonicalDesignVersionId) ??
									review.canonicalDesignVersionId}{" "}
								— {review.rationale}
							</li>
						))}
					</ul>
					<ul className="space-y-3">
						{query.data.changeImpacts.map((impact) => (
							<li key={impact.id}>
								{impact.facets.map(dependencyFacetLabel).join(", ")} —{" "}
								{impact.affectedVersions.length} etkilenen sürüm
								<ul>
									{impact.affectedVersions.map((version) => (
										<li key={version.assetVersionId}>
											{versionLabels.get(version.assetVersionId) ??
												version.assetVersionId}
											:{" "}
											{version.reason === "incomplete_dependency"
												? "Eksik Bağımlılık Bağlantısı"
												: "Eşleşen Bağımlılık Bağlantısı"}
										</li>
									))}
								</ul>
							</li>
						))}
					</ul>
				</div>
			) : null}
		</section>
	);
}
