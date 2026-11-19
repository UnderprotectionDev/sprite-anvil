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
import { StatusMessage } from "@/components/status-message";
import { RightsRecordDetails } from "@/features/rights-evidence/ui/components/rights-record-details";
import { getErrorMessage } from "@/utils/get-error-message";
import { orpc } from "@/utils/orpc";
import {
	referenceFeatureLabels,
	referenceRoleLabels,
} from "@/utils/reference-board-contract";

const rightsRecordStateLabels: Record<RightsRecordState, string> = {
	assertion_only: "Declaration only",
	documented: "Belgelendi",
	restricted: "Restricted",
	unknown: "Unknown",
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
	assetRecordsById: Map<string, Pick<AssetRecord, "id" | "name">>;
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
	assetVersionCatalog: AssetVersionCatalog,
	currentRecord: AssetRecord
): SourceCatalogIndex {
	const assetRecordsById = new Map<string, Pick<AssetRecord, "id" | "name">>();
	for (const record of assetFamilyCatalog.assetRecords) {
		assetRecordsById.set(record.id, record);
	}
	assetRecordsById.set(currentRecord.id, currentRecord);

	return {
		assetRecordsById,
		assetVersionsById: new Map(
			assetVersionCatalog.assetVersions.map((version) => [version.id, version])
		),
	};
}

function describeReferenceRole(reference: GenerationPackageReference) {
	const details = [
		`Usage purpose: ${referenceRoleLabels[reference.role]}`,
		reference.customPurpose
			? `Custom usage purpose: ${reference.customPurpose}`
			: null,
		reference.notes,
		reference.transferredFeatures.length > 0
			? `Transferable: ${reference.transferredFeatures
					.map((feature) => referenceFeatureLabels[feature])
					.join(", ")}`
			: null,
		reference.forbiddenFeatures.length > 0
			? `Avoided: ${reference.forbiddenFeatures
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
		unresolvedReasons.push(
			"Canonical Design was not found in the Asset Record catalog."
		);
	}
	if (canonicalVersion?.assetRecordId !== assetRecordId) {
		unresolvedReasons.push(
			"Canonical Design was not found in the Asset Version catalog."
		);
	}

	return {
		assetRecordId,
		description: null,
		key: `package:${generationPackageId}:canonical-design`,
		referenceId: null,
		title: `Canonical Design · ${canonicalRecord?.name ?? "Canonical Design"} · Version ${versionNumber}`,
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
		unresolvedReasons.push(
			"Source Asset Version was not found in the catalog."
		);
	}
	if (!assetRecordId) {
		unresolvedReasons.push(
			"The source Asset Record ID could not be resolved; Rights Record history cannot be shown."
		);
	} else if (!assetRecord) {
		unresolvedReasons.push("Source Asset Record was not found in the catalog.");
	}
	if (assetVersion && !assetVersionMatchesRecord) {
		unresolvedReasons.push(
			"Source Asset Version does not match the Asset Record in the snapshot."
		);
	}

	const recordName =
		assetRecord?.name ?? reference.assetRecordName ?? "Asset Version";
	const versionLabel = versionNumber ? ` · Version ${versionNumber}` : "";
	return {
		assetRecordId,
		description: describeReferenceRole(reference),
		key: `package:${generationPackageId}:reference:${reference.id}`,
		referenceId: null,
		title: `Reference · ${referenceRoleLabels[reference.role]} · ${recordName}${versionLabel}`,
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
		reference.fileName ?? assetRecord?.name ?? "Reference image";
	const unresolvedReasons: string[] = [];

	if (!assetRecordId) {
		unresolvedReasons.push(
			"The reference image Asset Record could not be resolved."
		);
	} else if (!assetRecord) {
		unresolvedReasons.push(
			"The reference image Asset Record was not found in the catalog."
		);
	}

	return {
		assetRecordId,
		description: describeReferenceRole(reference),
		key: `package:${generationPackageId}:reference:${id}`,
		referenceId: id,
		title: `Reference · ${displayName}`,
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
			"The dependent source Asset Record was not found in the catalog."
		);
	}
	if (versionMatchesRecord) {
		description = `Source Asset Version · Version ${sourceAssetVersion.versionNumber}`;
	} else {
		unresolvedReasons.push(
			"The dependent source Asset Version could not be resolved."
		);
	}

	return {
		assetRecordId: sourceAssetRecordId,
		description,
		key: `dependent:${id}`,
		referenceId: null,
		title: `Dependent source · ${sourceAssetRecord?.name ?? "Asset Record"} · Derived`,
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
			<RightsRecordDetails projectId={projectId} record={record} />
		</li>
	);
}

function TrackingHistoryError({ onRetry }: { onRetry: () => void }) {
	return (
		<div className="space-y-2">
			<StatusMessage tone="error">
				Could not load Asset Record source history.
			</StatusMessage>
			<Button onClick={onRetry} type="button" variant="outline">
				Reload
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
			<StatusMessage tone="error">
				Could not load source Asset Records or Versions.
			</StatusMessage>
			<Button
				disabled={isFetching}
				onClick={onRetry}
				type="button"
				variant="outline"
			>
				Reload
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
			<StatusMessage tone="error">
				{getErrorMessage(
					error,
					"Could not load Generation Package sources.",
					"query"
				)}
			</StatusMessage>
			<Button
				disabled={isFetching}
				onClick={onRetry}
				type="button"
				variant="outline"
			>
				Reload
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
		return createSourceCatalogIndex(
			assetFamilyCatalog,
			assetVersionCatalog,
			record
		);
	}, [assetFamilyCatalogQuery.data, assetVersionCatalogQuery.data, record]);
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
				<h2 className="text-xl font-semibold" id="rights-lineage-heading">
					Rights Lineage
				</h2>
				<p className="text-muted-foreground text-sm">
					The result’s own Rights Record is shown separately above. Source
					declarations do not automatically transfer to a Derived Asset; this
					view does not determine a license’s legal validity.
				</p>
			</header>

			{isLoading && (
				<p aria-live="polite" className="text-muted-foreground text-sm">
					Loading Rights Lineage sources…
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
				Generation Package sources
			</h3>
			{!hasLinkedPackageIds && (
				<p className="text-muted-foreground text-sm">
					No Generation Package was found for this result.
				</p>
			)}
			{!isGenerationPackagesError && unresolvedPackageCount > 0 && (
				<p className="text-muted-foreground text-sm" role="status">
					The linked Generation Package could not be resolved.
				</p>
			)}
			{!isGenerationPackagesError &&
				packageGroups.length === 0 &&
				hasLinkedPackageIds && (
					<p className="text-muted-foreground text-sm">
						The linked Generation Package source declarations cannot be shown.
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
					This Generation Package has no Canonical Design or Reference source.
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
				Dependent sources
			</h3>
			{sources.length === 0 && (
				<p className="text-muted-foreground text-sm">
					No dependent sources are associated with this result.
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
				Rights Record history cannot be shown for this source.
			</p>
		);
	}
	if (historyQuery.isPending) {
		return (
			<p aria-live="polite" className="text-muted-foreground text-sm">
				Loading Rights Record history…
			</p>
		);
	}
	if (historyQuery.isError) {
		return (
			<div className="space-y-2">
				<StatusMessage tone="error">
					{getErrorMessage(
						historyQuery.error,
						"Could not load this source’s Rights Record history.",
						"query"
					)}
				</StatusMessage>
				<Button
					disabled={historyQuery.isFetching}
					onClick={() => void historyQuery.refetch()}
					type="button"
					variant="outline"
				>
					Reload
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
			<p className="text-muted-foreground rounded-md border border-dashed p-3 text-sm">
				No Rights Records for this source yet.
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
