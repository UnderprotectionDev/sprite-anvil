import type { SpecializedProfileContractsListOutput } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";
import { TaskWorkspace } from "@/components/task-workspace";
import { AssetVersionControls } from "@/features/asset-versions/ui/components/asset-version-controls";
import { useAssetVersionWrites } from "@/features/asset-versions/ui/hooks/use-asset-version-writes";
import { BackgroundLayerLayoutSections } from "@/features/background-parallax-profile/ui/components/background-layer-layout-sections";
import { AnimationTimingReviewManager } from "@/features/character-animation-profile/ui/components/animation-timing-review-manager";
import { DirectionalReviewSections } from "@/features/character-animation-profile/ui/components/directional-review-sections";
import { DependencyRevalidationManager } from "@/features/dependency-revalidation/ui/components/dependency-revalidation-manager";
import { HistoricalCompositionManager } from "@/features/dependency-revalidation/ui/components/historical-composition-manager";
import { FamilyReadinessManager } from "@/features/family-readiness/ui/components/family-readiness-manager";
import { IconFamilyReviewSections } from "@/features/icon-profile/ui/components/icon-family-review-sections";
import { AssetFamilyComparisonSections } from "@/features/object-equipment-profile/ui/components/asset-family-comparison-sections";
import { TextureRepetitionReviewSections } from "@/features/tileset-texture-profile/ui/components/texture-repetition-review-sections";
import { TilesetAdjacencyReviewSections } from "@/features/tileset-texture-profile/ui/components/tileset-adjacency-review-sections";
import { VfxAppearanceSections } from "@/features/vfx-profile/ui/components/vfx-appearance-sections";
import { VfxSynchronizationSections } from "@/features/vfx-profile/ui/components/vfx-synchronization-sections";
import { client, orpc } from "@/utils/orpc";
import { AssetFamilyCatalogView } from "../components/asset-family-catalog";
import {
	type AssetFamilyFormHandlers,
	AssetFamilyManagementForms,
} from "../components/asset-family-management-forms";
import { useAssetFamilyFormState } from "../hooks/use-asset-family-form-state";
import { useAssetFamilyWrites } from "../hooks/use-asset-family-writes";

const emptyAssetVersionCatalog = {
	assetVersions: [],
	canonicalDesigns: [],
	unitVersions: [],
	compositeVersions: [],
};

function getActiveProfileContract(
	data: SpecializedProfileContractsListOutput | undefined,
	profileId: string
) {
	return (
		data?.profiles.find((profile) => profile.definition.profileId === profileId)
			?.activeContract ?? undefined
	);
}

export function AssetFamiliesView({ projectId }: { projectId: string }) {
	const queryClient = useQueryClient();
	const projectsQuery = useQuery({
		...orpc.projectContexts.list.queryOptions(),
	});
	const catalogQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
	});
	const assetVersionQuery = useQuery({
		...orpc.assetVersions.list.queryOptions({ input: { projectId } }),
	});
	const assetRecordQuery = useQuery({
		...orpc.assetRecords.list.queryOptions({ input: { projectId } }),
	});
	const scopeQuery = useQuery({
		...orpc.contextScopes.list.queryOptions({ input: { projectId } }),
	});
	const profileContractsQuery = useQuery({
		...orpc.specializedProfileContracts.list.queryOptions({
			input: { projectId },
		}),
	});
	const project = projectsQuery.data?.find((item) => item.id === projectId);
	const catalog = catalogQuery.data;
	const [selectedFamilyId, setSelectedFamilyId] = useState("");
	const selectedFamily =
		catalog?.assetFamilies.find((family) => family.id === selectedFamilyId) ??
		catalog?.assetFamilies[0];
	const reviewFamilies = selectedFamily ? [selectedFamily] : [];
	const reviewCatalog = catalog
		? { ...catalog, assetFamilies: reviewFamilies }
		: undefined;

	const assetVersionCatalog =
		assetVersionQuery.data ?? emptyAssetVersionCatalog;
	// The catalog lists canonical designs ascending by creation, so the last
	// entry per family is the current selection.
	const latestCanonicalVersionIdsByFamily = new Map<string, string>();
	for (const design of assetVersionCatalog.canonicalDesigns) {
		latestCanonicalVersionIdsByFamily.set(
			design.assetFamilyId,
			design.assetVersionId
		);
	}
	const assetRecords = assetRecordQuery.data ?? [];
	const assetCategoriesById = new Map(
		assetRecords.map((record) => [record.id, record.assetCategory ?? null])
	);
	const logicalResolutionsByRecordId = new Map(
		assetRecords.map(
			(record) =>
				[record.id, record.measurements.logicalResolution.confirmed] as const
		)
	);
	const assetRecordsById = new Map(
		assetRecords.map((record) => [record.id, record])
	);
	const visualWorlds = scopeQuery.data?.visualWorlds ?? [];
	const usageTestAssetRecords = assetRecords.map(
		({ assetCategory, id, name }) => ({
			assetCategory: assetCategory ?? null,
			id,
			name,
		})
	);
	const usageTestAssetVersions = assetVersionCatalog.assetVersions.map(
		({ assetRecordId, id, reviewDisposition, versionNumber }) => ({
			assetRecordId,
			id,
			reviewDisposition,
			versionNumber,
		})
	);
	// Directional Review records character-profile identity checks, so the
	// section stays hidden until the character Specialized Profile Contract is
	// active; unrelated asset groups never see character-review guidance.
	const effectProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"visual_effect_projectile_shadow_mark"
	);
	const characterProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"character_creature_animation"
	);
	const backgroundProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"background_parallax"
	);
	const iconProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"icon"
	);
	const objectEquipmentProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"object_weapon_equipment_states"
	);
	const textureProfileActivation = getActiveProfileContract(
		profileContractsQuery.data,
		"tileset_terrain_texture"
	);
	const form = useAssetFamilyFormState(catalog, visualWorlds);
	const writes = useAssetFamilyWrites(catalogQuery.refetch);
	const refreshAssetCatalogs = async () => {
		const results = await Promise.all([
			catalogQuery.refetch(),
			assetVersionQuery.refetch(),
		]);
		return { isError: results.some((result) => result.isError) };
	};
	const assetVersionWrites = useAssetVersionWrites(
		projectId,
		refreshAssetCatalogs
	);
	const writesDisabled =
		writes.writesDisabled || assetVersionWrites.writesDisabled;
	const { state: formState } = form;

	function submitSubjectIdentity(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"subject-identity",
			() =>
				client.assetFamilies.createSubjectIdentity({
					projectId,
					name: formState.subjectIdentityName,
				}),
			(record) => form.created.subjectIdentity(record.id),
			"Varlık Kimliği kaydedildi."
		);
	}

	function submitAssetFamily(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"asset-family",
			() =>
				client.assetFamilies.createAssetFamily({
					projectId,
					subjectIdentityId: formState.selectedSubjectIdentityId,
					name: formState.familyName,
					visualWorldId: formState.selectedVisualWorldId,
					useContext: formState.familyUseContext,
				}),
			(record) => form.created.assetFamily(record.id),
			"Varlık Ailesi kaydedildi."
		);
	}

	function submitAssetRecord(event: SyntheticEvent<HTMLFormElement>) {
		void writes.save(
			event,
			"asset-record",
			() =>
				client.assetFamilies.createAssetRecord({
					projectId,
					assetFamilyId: formState.selectedAssetRecordFamilyId,
					name: formState.assetRecordName,
					identityCriteria: formState.assetRecordIdentityCriteria,
				}),
			(record) => form.created.assetRecord(record.id),
			"Varlık Kaydı kaydedildi."
		);
	}

	function submitRelationship(event: SyntheticEvent<HTMLFormElement>) {
		const canonicalDesign = assetVersionCatalog.canonicalDesigns
			.filter(
				(design) =>
					design.assetFamilyId === formState.selectedRelationshipFamilyId
			)
			.at(-1);
		const sourceAssetVersionId =
			formState.relationshipType === "derivative"
				? canonicalDesign?.assetVersionId
				: undefined;
		const sourceAssetRecordId =
			formState.relationshipType === "derivative"
				? (canonicalDesign?.assetRecordId ?? "")
				: formState.selectedRelationshipSourceId;
		const targetAssetRecordId =
			formState.selectedRelationshipTargetId === sourceAssetRecordId
				? (catalog?.assetRecords.find(
						(record) =>
							record.assetFamilyId === formState.selectedRelationshipFamilyId &&
							record.id !== sourceAssetRecordId
					)?.id ?? "")
				: formState.selectedRelationshipTargetId;
		void writes.save(
			event,
			"relationship",
			() =>
				client.assetFamilies.createRelationship({
					projectId,
					assetFamilyId: formState.selectedRelationshipFamilyId,
					sourceAssetRecordId,
					targetAssetRecordId,
					type: formState.relationshipType,
					...(sourceAssetVersionId ? { sourceAssetVersionId } : {}),
				}),
			() => undefined,
			"İlişki kaydedildi."
		);
	}

	const formHandlers: AssetFamilyFormHandlers = {
		...form.changeHandlers,
		submitAssetFamily,
		submitAssetRecord,
		submitRelationship,
		submitSubjectIdentity,
	};

	function renderFamilyWorkspace() {
		if (!catalog || catalogQuery.isError) {
			return null;
		}
		return (
			<>
				{catalog.assetFamilies.length > 0 ? (
					<label className="block space-y-2 text-sm">
						<span className="font-medium">
							İnceleme ve tamamlanma için aile
						</span>
						<select
							className="min-h-11 w-full rounded-md border bg-background px-3"
							onChange={(event) => setSelectedFamilyId(event.target.value)}
							value={selectedFamily?.id ?? ""}
						>
							{catalog.assetFamilies.map((family) => (
								<option key={family.id} value={family.id}>
									{family.name}
								</option>
							))}
						</select>
					</label>
				) : (
					<p className="rounded-lg border border-dashed p-5">
						Henüz Varlık Ailesi yok. Aile ve temsil ilişkileri alanından
						başlayın.
					</p>
				)}
				<TaskWorkspace
					label="Aile çalışma alanları"
					sections={[
						{
							id: "catalog",
							label: "Aile kataloğu",
							description:
								"Varlık Kimliğine göre aileleri, üyelerini ve Ana Tasarımlarını bulun.",
							content: (
								<>
									<section
										aria-labelledby="asset-family-catalog-heading"
										className="space-y-4"
									>
										<div>
											<h2
												className="font-semibold text-2xl"
												id="asset-family-catalog-heading"
											>
												Kaydedilmiş Varlık Aileleri
											</h2>
											<p className="mt-1 text-muted-foreground text-sm">
												Aynı Varlık Kimliği altındaki aileler burada ayrı ayrı
												görünür.
											</p>
										</div>
										<AssetFamilyCatalogView
											assetVersionCatalog={assetVersionCatalog}
											catalog={catalog}
											visualWorlds={visualWorlds}
										/>
									</section>
								</>
							),
						},
						{
							id: "relationships",
							label: "Aile ve temsil ilişkileri",
							description:
								"Önce Varlık Kimliği ve Görsel Dünya belirleyin; ardından aileyi, kayıtlarını ve ilişkilerini oluşturun.",
							content: (
								<>
									<AssetFamilyManagementForms
										assetVersionCatalog={assetVersionCatalog}
										catalog={catalog}
										disabled={writesDisabled}
										formHandlers={formHandlers}
										formState={formState}
										isSaving={writes.savingOperation}
										isScopeError={scopeQuery.isError}
										isScopeLoaded={scopeQuery.isSuccess}
										projectId={projectId}
										visualWorlds={visualWorlds}
									/>
								</>
							),
						},
						{
							id: "readiness",
							label: "Tamamlanma ve kanıtlar",
							description:
								"Aşağıdaki aile seçimi için Gerekli Öğeler Listesini ve tamamlanma kanıtlarını yönetin.",
							content: (
								<>
									<section
										aria-labelledby="family-readiness-heading"
										className="space-y-4"
									>
										<div>
											<h2
												className="font-semibold text-2xl"
												id="family-readiness-heading"
											>
												Aile Tamamlanması ve Kanıtlar
											</h2>
											<p className="mt-1 text-muted-foreground text-sm">
												Her aile için sürümlü bir Gerekli Öğeler Listesi
												hazırlayın; kanıtlar güncel Varlık Sürümlerine ve etkin
												Bağlam Sürümüne sabitlenir.
											</p>
										</div>
										<Link
											className="inline-flex min-h-11 items-center text-sm underline"
											params={{ projectId }}
											to="/projects/$projectId/profile-contracts"
										>
											Özel profil sözleşmelerini yönet
										</Link>
										{reviewFamilies.map((family) => (
											<FamilyReadinessManager
												assetFamilyId={family.id}
												assetRecords={catalog.assetRecords
													.filter(
														(record) => record.assetFamilyId === family.id
													)
													.map(({ id, name }) => ({
														assetCategory: assetCategoriesById.get(id) ?? null,
														id,
														logicalResolution:
															logicalResolutionsByRecordId.get(id) ?? null,
														name,
													}))}
												assetVersions={assetVersionCatalog.assetVersions.filter(
													(version) => version.assetFamilyId === family.id
												)}
												familyName={family.name}
												key={family.id}
												profileContracts={profileContractsQuery.data ?? null}
												projectId={projectId}
												usageTestAssetRecords={usageTestAssetRecords}
												usageTestAssetVersions={usageTestAssetVersions}
											/>
										))}
									</section>
								</>
							),
						},
						{
							id: "reviews",
							label: "Profil incelemeleri",
							description:
								"Seçili ailenin etkin Özel Profil Sözleşmelerine bağlı kullanım testlerini açın.",
							content: (
								<>
									<Link
										className="inline-flex min-h-11 items-center underline"
										params={{ projectId }}
										to="/projects/$projectId/profile-contracts"
									>
										Özel profil sözleşmelerini aç
									</Link>
									<p className="text-muted-foreground text-sm">
										İnceleme kontrolleri ilgili profil etkinleştirildiğinde
										görünür. Henüz aile yoksa Aile ve temsil ilişkileri
										alanından oluşturun.
									</p>
									{assetVersionQuery.data ? (
										<>
											{characterProfileActivation
												? reviewFamilies.map((family) => (
														<AnimationTimingReviewManager
															activation={characterProfileActivation}
															assetFamilyId={family.id}
															catalog={assetVersionQuery.data}
															familyName={family.name}
															key={family.id}
															projectId={projectId}
															recordNames={Object.fromEntries(
																catalog.assetRecords.map((record) => [
																	record.id,
																	record.name,
																])
															)}
														/>
													))
												: null}
											<VfxSynchronizationSections
												activation={effectProfileActivation}
												assetFamilies={reviewFamilies}
												catalog={assetVersionCatalog}
												categories={Object.fromEntries(assetCategoriesById)}
												projectId={projectId}
												recordNames={Object.fromEntries(
													catalog.assetRecords.map((record) => [
														record.id,
														record.name,
													])
												)}
											/>
											<VfxAppearanceSections
												activation={effectProfileActivation}
												assetRecords={assetRecordQuery.data ?? []}
												catalog={reviewCatalog ?? catalog}
												projectId={projectId}
												versionCatalog={assetVersionCatalog}
											/>
											<DirectionalReviewSections
												activation={characterProfileActivation}
												assetFamilies={reviewFamilies}
												assetRecords={catalog.assetRecords}
												catalog={assetVersionQuery.data}
												projectId={projectId}
											/>
											<TextureRepetitionReviewSections
												activation={textureProfileActivation}
												families={reviewFamilies}
												projectId={projectId}
												records={assetRecords}
												units={assetVersionQuery.data.unitVersions}
												versions={assetVersionQuery.data.assetVersions}
											/>
											<TilesetAdjacencyReviewSections
												activation={getActiveProfileContract(
													profileContractsQuery.data,
													"tileset_terrain_texture"
												)}
												assetFamilies={reviewFamilies}
												assetFamilyRecords={catalog.assetRecords}
												assetRecords={assetRecords}
												catalog={assetVersionCatalog}
												projectId={projectId}
											/>
											<BackgroundLayerLayoutSections
												activation={backgroundProfileActivation}
												assetRecords={assetRecords}
												families={reviewFamilies}
												familyRecords={catalog.assetRecords}
												projectId={projectId}
												versions={assetVersionQuery.data.assetVersions}
											/>
											<IconFamilyReviewSections
												activation={iconProfileActivation}
												assetFamilies={reviewFamilies}
												assetFamilyRecords={catalog.assetRecords}
												assetRecordsById={assetRecordsById}
												projectId={projectId}
												versions={assetVersionQuery.data.assetVersions}
											/>
											<AssetFamilyComparisonSections
												activation={objectEquipmentProfileActivation}
												assetRecordDetails={assetRecordQuery.data}
												catalog={reviewCatalog ?? catalog}
												projectId={projectId}
												versionCatalog={assetVersionQuery.data}
											/>
										</>
									) : null}
								</>
							),
						},
						{
							id: "versions",
							label: "Sürüm ve bağımlılık işlemleri",
							description:
								"Proje genelindeki kesin sürümleri, bileşimleri ve değişiklik etkilerini yönetin. Bir kayda görsel yüklemek için kaydın ayrıntısını açın.",
							content: (
								<>
									{assetVersionQuery.data ? (
										<>
											<HistoricalCompositionManager
												canonicalDesigns={
													assetVersionQuery.data.canonicalDesigns
												}
												composites={assetVersionQuery.data.compositeVersions}
												projectId={projectId}
												records={catalog.assetRecords}
												versions={assetVersionQuery.data.assetVersions}
											/>
											<DependencyRevalidationManager
												canonicalVersionIds={[
													...latestCanonicalVersionIdsByFamily.values(),
												]}
												onImpactSaved={async () => {
													await Promise.all([
														queryClient.invalidateQueries({
															queryKey: orpc.assetVersions.list.queryOptions({
																input: { projectId },
															}).queryKey,
														}),
														...catalog.assetFamilies.map((family) =>
															queryClient.invalidateQueries({
																queryKey:
																	orpc.familyReadiness.list.queryOptions({
																		input: {
																			projectId,
																			assetFamilyId: family.id,
																		},
																	}).queryKey,
															})
														),
													]);
												}}
												projectId={projectId}
												records={catalog.assetRecords}
												versions={assetVersionCatalog.assetVersions}
											/>
											<AssetVersionControls
												assetVersionCatalog={assetVersionCatalog}
												catalog={catalog}
												writes={assetVersionWrites}
											/>
										</>
									) : null}
								</>
							),
						},
					]}
				/>
			</>
		);
	}

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-8">
			<PageHeader projectName={project?.name} />
			<QueryLoadingState
				isPending={projectsQuery.isPending}
				loadingMessage="Projeler yükleniyor…"
			/>
			{projectsQuery.isSuccess && !project ? (
				<p role="alert">Bu Proje bulunamadı.</p>
			) : null}
			{writes.statusMessage ? (
				<p aria-live="polite" role="status">
					{writes.statusMessage}
				</p>
			) : null}
			{writes.writeOutcomeUncertain ? (
				<Button
					disabled={writes.isCheckingOutcome}
					onClick={() => void writes.checkWriteOutcome()}
					type="button"
					variant="outline"
				>
					{writes.isCheckingOutcome
						? "Durum kontrol ediliyor…"
						: "Durumu kontrol et"}
				</Button>
			) : null}

			<QueryLoadingState
				isPending={catalogQuery.isPending}
				loadingMessage="Varlık Aileleri yükleniyor…"
			/>
			<QueryLoadingState
				isPending={assetVersionQuery.isPending}
				loadingMessage="Varlık Sürümleri yükleniyor…"
			/>
			<QueryLoadingState
				isPending={scopeQuery.isPending}
				loadingMessage="Görsel Dünyalar yükleniyor…"
			/>

			{catalogQuery.isError ? (
				<div className="space-y-3" role="alert">
					<p>Varlık Aileleri yüklenemedi.</p>
					<Button
						onClick={() => void catalogQuery.refetch()}
						type="button"
						variant="outline"
					>
						Aileleri yeniden yükle
					</Button>
				</div>
			) : null}
			{assetVersionQuery.isError ? (
				<div role="alert">
					<p>
						Varlık Sürümleri yüklenemedi. İnceleme için sürümleri yeniden
						yükleyin.
					</p>
					<Button
						onClick={() => void assetVersionQuery.refetch()}
						type="button"
						variant="outline"
					>
						Sürümleri yeniden yükle
					</Button>
				</div>
			) : null}
			{profileContractsQuery.isError ? (
				<div role="alert">
					<p>Özel profil sözleşmeleri yüklenemedi.</p>
					<Button
						onClick={() => void profileContractsQuery.refetch()}
						type="button"
						variant="outline"
					>
						Sözleşmeleri yeniden yükle
					</Button>
				</div>
			) : null}
			{renderFamilyWorkspace()}
		</main>
	);
}

function PageHeader({ projectName }: { projectName?: string }) {
	return (
		<div className="space-y-3">
			<Link
				className="text-muted-foreground text-sm underline underline-offset-4"
				to="/projects"
			>
				Oyun projelerine dön
			</Link>
			<header className="space-y-2">
				<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
					Varlık kütüphanesi / {projectName ?? "Oyun projesi"}
				</p>
				<h1 className="font-medium font-serif text-4xl tracking-tight">
					Varlık Kimliği ve Aileler
				</h1>
				<p className="text-muted-foreground">
					{projectName ?? "Oyun projesi"} içindeki temsilleri ortak kimliklere
					bağlayın ve aile sınırlarını koruyun.
				</p>
			</header>
		</div>
	);
}

function QueryLoadingState({
	isPending,
	loadingMessage,
}: {
	isPending: boolean;
	loadingMessage: string;
}) {
	if (isPending) {
		return (
			<p aria-live="polite" role="status">
				{loadingMessage}
			</p>
		);
	}
	return null;
}
