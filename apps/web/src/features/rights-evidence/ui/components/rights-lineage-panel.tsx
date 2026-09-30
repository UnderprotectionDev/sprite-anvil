import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetRecordTracking } from "@sprite-anvil/api/asset-record-tracking";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { GenerationPackage } from "@sprite-anvil/api/generation-packages";
import type {
	RightsRecord,
	RightsRecordState,
} from "@sprite-anvil/api/rights-records";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
	referenceFeatureLabels,
	referenceRoleLabels,
} from "@/features/reference-production/ui/reference-board-contract";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import { rightsRecordEvidenceFileUrl } from "./rights-record-api";

const rightsRecordStateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Yalnız Beyan",
	documented: "Belgelendi",
	restricted: "Kısıtlı",
	unknown: "Bilinmiyor",
};

type TrackingStatus = "error" | "loading" | "success";
type GenerationPackageReference = GenerationPackage["referenceRoles"][number];
type AssetVersionReference = GenerationPackageReference & {
	kind: "asset_version";
};
type ReferenceImageReference = GenerationPackageReference & {
	kind: "reference_image";
};
type RightsRecordHistoryQuery = ReturnType<typeof useQuery<RightsRecord[]>>;

interface RightsLineageSource {
	assetRecordId: string | null;
	description: string | null;
	key: string;
	referenceId: string | null;
	title: string;
	unresolvedReason: string | null;
}

interface RightsHistoryTarget {
	assetRecordId: string;
	referenceId: string | null;
}

interface SourceCatalogIndex {
	assetRecordsById: Map<string, AssetFamilyCatalog["assetRecords"][number]>;
	assetVersionsById: Map<string, AssetVersionCatalog["assetVersions"][number]>;
}

interface RightsLineagePackageGroup {
	id: string;
	sources: RightsLineageSource[];
	targetTask: string;
}

function getHistoryTargetKey(target: RightsHistoryTarget) {
	return JSON.stringify([target.assetRecordId, target.referenceId]);
}

function createSourceCatalogIndex(
	assetFamilyCatalog: AssetFamilyCatalog,
	assetVersionCatalog: AssetVersionCatalog
): SourceCatalogIndex {
	return {
		assetRecordsById: new Map(
			assetFamilyCatalog.assetRecords.map((record) => [record.id, record])
		),
		assetVersionsById: new Map(
			assetVersionCatalog.assetVersions.map((version) => [version.id, version])
		),
	};
}

function describeReferenceRole(reference: GenerationPackageReference) {
	const details = [
		`Kullanım amacı: ${referenceRoleLabels[reference.role]}`,
		reference.customPurpose
			? `Özel kullanım amacı: ${reference.customPurpose}`
			: null,
		reference.notes,
		reference.transferredFeatures.length > 0
			? `Aktarılabilir: ${reference.transferredFeatures
					.map((feature) => referenceFeatureLabels[feature])
					.join(", ")}`
			: null,
		reference.forbiddenFeatures.length > 0
			? `Kaçınılacak: ${reference.forbiddenFeatures
					.map((feature) => referenceFeatureLabels[feature])
					.join(", ")}`
			: null,
	].filter((value): value is string => Boolean(value));
	return details.join(" · ");
}

function isAssetVersionReference(
	reference: GenerationPackageReference
): reference is AssetVersionReference {
	return reference.kind === "asset_version";
}

function isReferenceImageReference(
	reference: GenerationPackageReference
): reference is ReferenceImageReference {
	return reference.kind === "reference_image";
}

function buildCanonicalDesignSource(
	generationPackageId: string,
	canonicalDesign: NonNullable<GenerationPackage["canonicalDesign"]>,
	catalogIndex: SourceCatalogIndex
): RightsLineageSource {
	const { assetRecordId, assetVersionId, versionNumber } = canonicalDesign;
	const canonicalRecord = catalogIndex.assetRecordsById.get(assetRecordId);
	const canonicalVersion = catalogIndex.assetVersionsById.get(assetVersionId);
	const unresolvedReasons: string[] = [];

	if (!canonicalRecord) {
		unresolvedReasons.push("Ana Tasarım Varlık Kaydı kataloğunda bulunamadı.");
	}
	if (canonicalVersion?.assetRecordId !== assetRecordId) {
		unresolvedReasons.push("Ana Tasarım Varlık Sürümü kataloğunda bulunamadı.");
	}

	return {
		assetRecordId,
		description: null,
		key: `package:${generationPackageId}:canonical-design`,
		referenceId: null,
		title: `Ana Tasarım · ${canonicalRecord?.name ?? "Ana Tasarım"} · Sürüm ${versionNumber}`,
		unresolvedReason: unresolvedReasons.join(" "),
	};
}

function buildAssetVersionReferenceSource(
	generationPackageId: string,
	reference: AssetVersionReference,
	catalogIndex: SourceCatalogIndex
): RightsLineageSource {
	const assetVersion = reference.assetVersionId
		? catalogIndex.assetVersionsById.get(reference.assetVersionId)
		: undefined;
	const assetRecordId =
		reference.assetRecordId ?? assetVersion?.assetRecordId ?? null;
	const assetRecord = assetRecordId
		? catalogIndex.assetRecordsById.get(assetRecordId)
		: undefined;
	const assetVersionMatchesRecord =
		!reference.assetRecordId ||
		assetVersion?.assetRecordId === reference.assetRecordId;
	const versionNumber =
		reference.versionNumber ??
		(assetVersionMatchesRecord ? assetVersion?.versionNumber : null) ??
		null;
	const unresolvedReasons: string[] = [];

	if (!assetVersion) {
		unresolvedReasons.push("Kaynak Varlık Sürümü kataloğunda bulunamadı.");
	}
	if (!assetRecordId) {
		unresolvedReasons.push(
			"Kaynak Varlık Kaydı kimliği çözümlenemedi; Hak Kaydı geçmişi gösterilemiyor."
		);
	} else if (!assetRecord) {
		unresolvedReasons.push("Kaynak Varlık Kaydı kataloğunda bulunamadı.");
	}
	if (assetVersion && !assetVersionMatchesRecord) {
		unresolvedReasons.push(
			"Kaynak Varlık Sürümü snapshot'taki Varlık Kaydıyla eşleşmiyor."
		);
	}

	const recordName =
		assetRecord?.name ?? reference.assetRecordName ?? "Varlık Sürümü";
	const versionLabel = versionNumber ? ` · Sürüm ${versionNumber}` : "";
	return {
		assetRecordId,
		description: describeReferenceRole(reference),
		key: `package:${generationPackageId}:reference:${reference.id}`,
		referenceId: null,
		title: `Referans · ${referenceRoleLabels[reference.role]} · ${recordName}${versionLabel}`,
		unresolvedReason: unresolvedReasons.join(" "),
	};
}

function buildReferenceImageSource(
	generationPackageId: string,
	reference: ReferenceImageReference,
	catalogIndex: SourceCatalogIndex
): RightsLineageSource {
	const { assetRecordId, id } = reference;
	const assetRecord = assetRecordId
		? catalogIndex.assetRecordsById.get(assetRecordId)
		: undefined;
	const displayName =
		assetRecord?.name ?? reference.fileName ?? "Referans görseli";
	const unresolvedReasons: string[] = [];

	if (!assetRecordId) {
		unresolvedReasons.push("Referans görselinin Varlık Kaydı çözümlenemedi.");
	} else if (!assetRecord) {
		unresolvedReasons.push(
			"Referans görselinin Varlık Kaydı kataloğunda bulunamadı."
		);
	}

	return {
		assetRecordId,
		description: describeReferenceRole(reference),
		key: `package:${generationPackageId}:reference:${id}`,
		referenceId: id,
		title: `Referans · ${displayName}`,
		unresolvedReason: unresolvedReasons.join(" "),
	};
}

function buildGenerationPackageSources(
	generationPackage: GenerationPackage,
	catalogIndex: SourceCatalogIndex
) {
	const { canonicalDesign, id, referenceRoles } = generationPackage;
	const sources: RightsLineageSource[] = [];

	if (canonicalDesign) {
		sources.push(buildCanonicalDesignSource(id, canonicalDesign, catalogIndex));
	}
	for (const reference of referenceRoles) {
		if (isAssetVersionReference(reference)) {
			sources.push(
				buildAssetVersionReferenceSource(id, reference, catalogIndex)
			);
			continue;
		}
		if (isReferenceImageReference(reference)) {
			sources.push(buildReferenceImageSource(id, reference, catalogIndex));
		}
	}

	return sources;
}

function buildDependentSource(
	relationship: AssetFamilyCatalog["relationships"][number],
	catalogIndex: SourceCatalogIndex
): RightsLineageSource {
	const { sourceAssetRecordId, sourceAssetVersionId, id } = relationship;
	const sourceAssetRecord =
		catalogIndex.assetRecordsById.get(sourceAssetRecordId);
	const sourceAssetVersion = sourceAssetVersionId
		? catalogIndex.assetVersionsById.get(sourceAssetVersionId)
		: undefined;
	const versionMatchesRecord =
		sourceAssetVersion?.assetRecordId === sourceAssetRecordId;
	const unresolvedReasons: string[] = [];
	let description: string | null = null;

	if (!sourceAssetRecord) {
		unresolvedReasons.push(
			"Bağımlı kaynak Varlık Kaydı kataloğunda bulunamadı."
		);
	}
	if (versionMatchesRecord) {
		description = `Kaynak Varlık Sürümü · Sürüm ${sourceAssetVersion.versionNumber}`;
	} else {
		unresolvedReasons.push("Bağımlı kaynağın Varlık Sürümü çözümlenemedi.");
	}

	return {
		assetRecordId: sourceAssetRecordId,
		description,
		key: `dependent:${id}`,
		referenceId: null,
		title: `Bağımlı kaynak · ${sourceAssetRecord?.name ?? "Varlık Kaydı"} · Türetilmiş`,
		unresolvedReason: unresolvedReasons.join(" "),
	};
}

function buildDependentSources(
	resultAssetRecordId: string,
	assetFamilyCatalog: AssetFamilyCatalog,
	catalogIndex: SourceCatalogIndex
) {
	return assetFamilyCatalog.relationships
		.filter(
			(relationship) =>
				relationship.type === "derivative" &&
				relationship.targetAssetRecordId === resultAssetRecordId
		)
		.map((relationship) => buildDependentSource(relationship, catalogIndex));
}

function getLinkedPackageIds(tracking?: AssetRecordTracking) {
	return Array.from(
		new Set(
			(tracking?.manualImportEvidence ?? []).map(
				(evidence) => evidence.generationPackageId
			)
		)
	);
}

function getLinkedPackages(
	packages: GenerationPackage[] | undefined,
	packageIds: string[]
) {
	return (packages ?? []).filter((item) => packageIds.includes(item.id));
}

function buildPackageGroups(
	packages: GenerationPackage[],
	catalogIndex: SourceCatalogIndex
): RightsLineagePackageGroup[] {
	return packages.map((generationPackage) => ({
		id: generationPackage.id,
		sources: buildGenerationPackageSources(generationPackage, catalogIndex),
		targetTask: generationPackage.targetTask,
	}));
}

function buildHistoryTargets(sources: RightsLineageSource[]) {
	const targetsByKey = new Map<string, RightsHistoryTarget>();
	for (const source of sources) {
		if (!source.assetRecordId) {
			continue;
		}
		const target = {
			assetRecordId: source.assetRecordId,
			referenceId: source.referenceId,
		};
		targetsByKey.set(getHistoryTargetKey(target), target);
	}
	return Array.from(targetsByKey.values());
}

function getHistoryQueryForSource(
	source: RightsLineageSource,
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>
) {
	if (!source.assetRecordId) {
		return;
	}
	return historyQueriesByTargetKey.get(
		getHistoryTargetKey({
			assetRecordId: source.assetRecordId,
			referenceId: source.referenceId,
		})
	);
}

function shouldShowLoading(
	trackingStatus: TrackingStatus,
	isAssetFamilyPending: boolean,
	isAssetVersionPending: boolean,
	hasLinkedPackageIds: boolean,
	isGenerationPackagesPending: boolean
) {
	if (trackingStatus === "loading") {
		return true;
	}
	if (trackingStatus !== "success") {
		return false;
	}
	return (
		isAssetFamilyPending ||
		isAssetVersionPending ||
		(hasLinkedPackageIds && isGenerationPackagesPending)
	);
}

function RightsRecordRevision({
	projectId,
	record,
}: {
	projectId: string;
	record: RightsRecord;
}) {
	return (
		<li className="space-y-3 rounded-md border p-3">
			<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
				<h5 className="font-medium">Revizyon {record.versionNumber}</h5>
				<p className="text-muted-foreground text-sm">
					{new Intl.DateTimeFormat("tr-TR", {
						dateStyle: "medium",
						timeStyle: "short",
					}).format(new Date(record.createdAt))}
				</p>
			</div>
			<p className="text-sm">{rightsRecordStateLabels[record.state]}</p>
			<dl className="grid gap-3 sm:grid-cols-2">
				<HistoryField label="Kaynak" value={record.source} />
				<HistoryField
					label="Hak sahibi veya sağlayıcı"
					value={record.rightsHolderOrProvider}
				/>
				<HistoryField
					label="Beyan edilen izin kapsamı"
					value={record.assertedScope}
				/>
				<HistoryField
					label="Hak kaydını destekleyen kanıt"
					value={record.evidence}
				/>
				{record.evidenceFile ? (
					<div>
						<dt className="font-medium text-sm">Kanıt dosyası</dt>
						<dd className="mt-1 text-sm">
							<a
								download={record.evidenceFile.fileName}
								href={rightsRecordEvidenceFileUrl(
									projectId,
									record.assetRecordId,
									record.id,
									record.referenceId ?? null
								)}
							>
								{record.evidenceFile.fileName}
							</a>
						</dd>
					</div>
				) : null}
				<HistoryField label="Bilinen kısıtlar" value={record.restrictions} />
				<HistoryField label="Belirsizlik" value={record.uncertainty} />
			</dl>
		</li>
	);
}

function HistoryField({
	label,
	value,
}: {
	label: string;
	value: string | null;
}) {
	return (
		<div>
			<dt className="font-medium text-sm">{label}</dt>
			<dd className="mt-1 whitespace-pre-wrap break-words text-muted-foreground text-sm">
				{value || "Belirtilmedi"}
			</dd>
		</div>
	);
}

function TrackingHistoryError({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="space-y-2">
			<p role="alert">Varlık Kaydı kaynak geçmişi yüklenemedi.</p>
			<Button onClick={onRetry} type="button" variant="outline">
				Yeniden yükle
			</Button>
		</div>
	);
}

function SourceCatalogError({
	isFetching,
	onRetry,
}: {
	isFetching: boolean;
	onRetry: () => void;
}) {
	return (
		<div className="space-y-2">
			<p role="alert">Kaynak Varlık Kayıtları veya Sürümleri yüklenemedi.</p>
			<Button
				disabled={isFetching}
				onClick={onRetry}
				type="button"
				variant="outline"
			>
				Yeniden yükle
			</Button>
		</div>
	);
}

function GenerationPackageError({
	error,
	isFetching,
	onRetry,
}: {
	error: unknown;
	isFetching: boolean;
	onRetry: () => void;
}) {
	return (
		<div className="space-y-2">
			<p role="alert">
				{getErrorMessage(
					error,
					"Üretim Paketi kaynakları yüklenemedi.",
					"query"
				)}
			</p>
			<Button
				disabled={isFetching}
				onClick={onRetry}
				type="button"
				variant="outline"
			>
				Yeniden yükle
			</Button>
		</div>
	);
}

export function RightsLineagePanel({
	onRetryTracking,
	projectId,
	record,
	tracking,
	trackingStatus,
}: {
	onRetryTracking: () => void;
	projectId: string;
	record: AssetRecord;
	tracking?: AssetRecordTracking;
	trackingStatus: TrackingStatus;
}) {
	const packageIds = useMemo(() => getLinkedPackageIds(tracking), [tracking]);
	const hasLinkedPackageIds = packageIds.length > 0;
	const generationPackagesQuery = useQuery({
		...orpc.generationPackages.list.queryOptions({
			input: { assetRecordId: record.id, projectId },
		}),
		enabled: trackingStatus === "success" && hasLinkedPackageIds,
		meta: { errorPresentation: "inline" },
	});
	const assetFamilyCatalogQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
		enabled: trackingStatus === "success",
		meta: { errorPresentation: "inline" },
	});
	const assetVersionCatalogQuery = useQuery({
		...orpc.assetVersions.list.queryOptions({ input: { projectId } }),
		enabled: trackingStatus === "success",
		meta: { errorPresentation: "inline" },
	});
	const linkedPackages = useMemo(
		() => getLinkedPackages(generationPackagesQuery.data, packageIds),
		[generationPackagesQuery.data, packageIds]
	);
	const sourceCatalogIndex = useMemo(() => {
		const assetFamilyCatalog = assetFamilyCatalogQuery.data;
		const assetVersionCatalog = assetVersionCatalogQuery.data;
		if (!(assetFamilyCatalog && assetVersionCatalog)) {
			return null;
		}
		return createSourceCatalogIndex(assetFamilyCatalog, assetVersionCatalog);
	}, [assetFamilyCatalogQuery.data, assetVersionCatalogQuery.data]);
	const packageGroups = useMemo(() => {
		if (!sourceCatalogIndex) {
			return [];
		}
		return buildPackageGroups(linkedPackages, sourceCatalogIndex);
	}, [linkedPackages, sourceCatalogIndex]);
	const dependentSources = useMemo(() => {
		const assetFamilyCatalog = assetFamilyCatalogQuery.data;
		if (!(assetFamilyCatalog && sourceCatalogIndex)) {
			return [];
		}
		return buildDependentSources(
			record.id,
			assetFamilyCatalog,
			sourceCatalogIndex
		);
	}, [assetFamilyCatalogQuery.data, record.id, sourceCatalogIndex]);
	const sources = useMemo(
		() => [
			...packageGroups.flatMap((group) => group.sources),
			...dependentSources,
		],
		[dependentSources, packageGroups]
	);
	const historyTargets = useMemo(() => buildHistoryTargets(sources), [sources]);
	const rightsHistoryQueries = useQueries({
		queries: historyTargets.map((target) =>
			orpc.rightsRecords.list.queryOptions({
				input: { ...target, projectId },
				meta: { errorPresentation: "inline" },
			})
		),
	});
	const historyQueriesByTargetKey = new Map(
		historyTargets.map((target, index) => [
			getHistoryTargetKey(target),
			rightsHistoryQueries[index],
		])
	);
	const isLoading = shouldShowLoading(
		trackingStatus,
		assetFamilyCatalogQuery.isPending,
		assetVersionCatalogQuery.isPending,
		hasLinkedPackageIds,
		generationPackagesQuery.isPending
	);
	const sourceCatalogError =
		assetFamilyCatalogQuery.isError || assetVersionCatalogQuery.isError;
	const packageError = hasLinkedPackageIds && generationPackagesQuery.isError;
	const isFetchingSources =
		assetFamilyCatalogQuery.isFetching ||
		assetVersionCatalogQuery.isFetching ||
		generationPackagesQuery.isFetching;
	const unresolvedPackageCount = generationPackagesQuery.isSuccess
		? packageIds.length - linkedPackages.length
		: 0;
	const canShowSources =
		trackingStatus === "success" && !isLoading && !sourceCatalogError;
	const retrySourceCatalogs = () => {
		void assetFamilyCatalogQuery.refetch();
		void assetVersionCatalogQuery.refetch();
	};

	return (
		<section
			aria-labelledby="rights-lineage-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-2">
				<h2 className="font-semibold text-xl" id="rights-lineage-heading">
					Hak Geçmişi
				</h2>
				<p className="text-muted-foreground text-sm">
					Sonucun kendi Hak Kaydı yukarıda ayrı gösterilir. Kaynaklardaki
					beyanlar Türetilmiş Varlığa otomatik aktarılmaz; bu görünüm lisansın
					hukuki geçerliliği hakkında karar vermez.
				</p>
			</header>

			{isLoading && (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Hak Geçmişi kaynakları yükleniyor…
				</p>
			)}
			{trackingStatus === "error" && (
				<TrackingHistoryError onRetry={onRetryTracking} />
			)}
			{Boolean(sourceCatalogError) && (
				<SourceCatalogError
					isFetching={isFetchingSources}
					onRetry={retrySourceCatalogs}
				/>
			)}
			{Boolean(packageError) && (
				<GenerationPackageError
					error={generationPackagesQuery.error}
					isFetching={generationPackagesQuery.isFetching}
					onRetry={() => void generationPackagesQuery.refetch()}
				/>
			)}
			{Boolean(canShowSources) && (
				<RightsLineageContent
					dependentSources={dependentSources}
					hasLinkedPackageIds={hasLinkedPackageIds}
					historyQueriesByTargetKey={historyQueriesByTargetKey}
					isGenerationPackagesError={packageError}
					packageGroups={packageGroups}
					projectId={projectId}
					unresolvedPackageCount={unresolvedPackageCount}
				/>
			)}
		</section>
	);
}

function RightsLineageContent({
	dependentSources,
	hasLinkedPackageIds,
	historyQueriesByTargetKey,
	isGenerationPackagesError,
	packageGroups,
	projectId,
	unresolvedPackageCount,
}: {
	dependentSources: RightsLineageSource[];
	hasLinkedPackageIds: boolean;
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>;
	isGenerationPackagesError: boolean;
	packageGroups: RightsLineagePackageGroup[];
	projectId: string;
	unresolvedPackageCount: number;
}) {
	return (
		<>
			<PackageSourceSection
				hasLinkedPackageIds={hasLinkedPackageIds}
				historyQueriesByTargetKey={historyQueriesByTargetKey}
				isGenerationPackagesError={isGenerationPackagesError}
				packageGroups={packageGroups}
				projectId={projectId}
				unresolvedPackageCount={unresolvedPackageCount}
			/>
			<DependentSourceSection
				historyQueriesByTargetKey={historyQueriesByTargetKey}
				projectId={projectId}
				sources={dependentSources}
			/>
		</>
	);
}

function PackageSourceSection({
	hasLinkedPackageIds,
	historyQueriesByTargetKey,
	isGenerationPackagesError,
	packageGroups,
	projectId,
	unresolvedPackageCount,
}: {
	hasLinkedPackageIds: boolean;
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>;
	isGenerationPackagesError: boolean;
	packageGroups: RightsLineagePackageGroup[];
	projectId: string;
	unresolvedPackageCount: number;
}) {
	return (
		<section
			aria-labelledby="rights-lineage-packages-heading"
			className="space-y-3"
		>
			<h3 className="font-medium" id="rights-lineage-packages-heading">
				Üretim Paketi kaynakları
			</h3>
			{!hasLinkedPackageIds && (
				<p className="text-muted-foreground text-sm">
					Sonuçla ilişkilendirilmiş bir Üretim Paketi bulunamadı.
				</p>
			)}
			{!isGenerationPackagesError && unresolvedPackageCount > 0 && (
				<p className="text-muted-foreground text-sm" role="status">
					Bağlı Üretim Paketi çözümlenemedi.
				</p>
			)}
			{!isGenerationPackagesError &&
				packageGroups.length === 0 &&
				hasLinkedPackageIds && (
					<p className="text-muted-foreground text-sm">
						Bağlı Üretim Paketi kaynak beyanları gösterilemiyor.
					</p>
				)}
			{packageGroups.map((group) => (
				<GenerationPackageSourceGroup
					group={group}
					historyQueriesByTargetKey={historyQueriesByTargetKey}
					key={group.id}
					projectId={projectId}
				/>
			))}
		</section>
	);
}

function GenerationPackageSourceGroup({
	group,
	historyQueriesByTargetKey,
	projectId,
}: {
	group: RightsLineagePackageGroup;
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>;
	projectId: string;
}) {
	return (
		<section className="space-y-3 rounded-md border p-4">
			<h4 className="font-medium">{group.targetTask}</h4>
			{group.sources.length > 0 ? (
				<RightsLineageSourceList
					historyQueriesByTargetKey={historyQueriesByTargetKey}
					projectId={projectId}
					sources={group.sources}
				/>
			) : (
				<p className="text-muted-foreground text-sm">
					Bu Üretim Paketinde Ana Tasarım veya Referans kaynağı yok.
				</p>
			)}
		</section>
	);
}

function DependentSourceSection({
	historyQueriesByTargetKey,
	projectId,
	sources,
}: {
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>;
	projectId: string;
	sources: RightsLineageSource[];
}) {
	return (
		<section
			aria-labelledby="rights-lineage-dependencies-heading"
			className="space-y-3"
		>
			<h3 className="font-medium" id="rights-lineage-dependencies-heading">
				Bağımlı kaynaklar
			</h3>
			{sources.length === 0 && (
				<p className="text-muted-foreground text-sm">
					Bu sonuçla ilişkili bağımlı kaynak yok.
				</p>
			)}
			{sources.length > 0 && (
				<RightsLineageSourceList
					historyQueriesByTargetKey={historyQueriesByTargetKey}
					projectId={projectId}
					sources={sources}
				/>
			)}
		</section>
	);
}

function RightsLineageSourceList({
	historyQueriesByTargetKey,
	projectId,
	sources,
}: {
	historyQueriesByTargetKey: Map<string, RightsRecordHistoryQuery>;
	projectId: string;
	sources: RightsLineageSource[];
}) {
	return (
		<ul className="space-y-3">
			{sources.map((source) => (
				<RightsLineageSource
					historyQuery={getHistoryQueryForSource(
						source,
						historyQueriesByTargetKey
					)}
					key={source.key}
					projectId={projectId}
					source={source}
				/>
			))}
		</ul>
	);
}

function RightsLineageSource({
	historyQuery,
	projectId,
	source,
}: {
	historyQuery: RightsRecordHistoryQuery | undefined;
	projectId: string;
	source: RightsLineageSource;
}) {
	return (
		<li className="space-y-3 rounded-md border p-4">
			<div className="space-y-2">
				<h4 className="font-medium">{source.title}</h4>
				{Boolean(source.description) && (
					<p className="text-muted-foreground text-sm">{source.description}</p>
				)}
				{Boolean(source.unresolvedReason) && (
					<p className="text-muted-foreground text-sm" role="status">
						{source.unresolvedReason}
					</p>
				)}
			</div>
			<RightsRecordHistory historyQuery={historyQuery} projectId={projectId} />
		</li>
	);
}

function RightsRecordHistory({
	historyQuery,
	projectId,
}: {
	historyQuery: RightsRecordHistoryQuery | undefined;
	projectId: string;
}) {
	if (!historyQuery) {
		return (
			<p className="text-muted-foreground text-sm">
				Bu kaynak için Hak Kaydı geçmişi gösterilemiyor.
			</p>
		);
	}
	if (historyQuery.isPending) {
		return (
			<p aria-live="polite" className="text-muted-foreground text-sm">
				Hak Kaydı geçmişi yükleniyor…
			</p>
		);
	}
	if (historyQuery.isError) {
		return (
			<div className="space-y-2">
				<p role="alert">
					{getErrorMessage(
						historyQuery.error,
						"Bu kaynağın Hak Kaydı geçmişi yüklenemedi.",
						"query"
					)}
				</p>
				<Button
					disabled={historyQuery.isFetching}
					onClick={() => void historyQuery.refetch()}
					type="button"
					variant="outline"
				>
					Yeniden yükle
				</Button>
			</div>
		);
	}
	if (!historyQuery.isSuccess) {
		return null;
	}

	const history = historyQuery.data.toSorted(
		(left, right) => right.versionNumber - left.versionNumber
	);
	if (history.length === 0) {
		return (
			<p className="rounded-md border border-dashed p-3 text-muted-foreground text-sm">
				Bu kaynak için henüz Hak Kaydı yok.
			</p>
		);
	}

	return (
		<ul className="space-y-3">
			{history.map((record) => (
				<RightsRecordRevision
					key={record.id}
					projectId={projectId}
					record={record}
				/>
			))}
		</ul>
	);
}
