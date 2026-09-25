import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { SyntheticEvent } from "react";
import { AssetVersionControls } from "@/features/asset-versions/ui/components/asset-version-controls";
import { useAssetVersionWrites } from "@/features/asset-versions/ui/hooks/use-asset-version-writes";
import { client, orpc } from "@/utils/orpc";
import { AssetFamilyCatalogView } from "../components/asset-family-catalog";
import {
	type AssetFamilyFormHandlers,
	AssetFamilyManagementForms,
} from "../components/asset-family-management-forms";
import { useAssetFamilyFormState } from "../hooks/use-asset-family-form-state";
import { useAssetFamilyWrites } from "../hooks/use-asset-family-writes";

const emptyAssetVersionCatalog = { assetVersions: [], canonicalDesigns: [] };

export function AssetFamiliesView({ projectId }: { projectId: string }) {
	const projectsQuery = useQuery({
		...orpc.projectContexts.list.queryOptions(),
	});
	const catalogQuery = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
	});
	const assetVersionQuery = useQuery({
		...orpc.assetVersions.list.queryOptions({ input: { projectId } }),
	});
	const scopeQuery = useQuery({
		...orpc.contextScopes.list.queryOptions({ input: { projectId } }),
	});
	const project = projectsQuery.data?.find((item) => item.id === projectId);
	const catalog = catalogQuery.data;
	const assetVersionCatalog =
		assetVersionQuery.data ?? emptyAssetVersionCatalog;
	const visualWorlds = scopeQuery.data?.visualWorlds ?? [];
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

	return (
		<main className="mx-auto w-full max-w-5xl space-y-8 overflow-y-auto px-4 py-8">
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

			{catalog && !catalogQuery.isError ? (
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
						visualWorlds={visualWorlds}
					/>
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
								Aynı Varlık Kimliği altındaki aileler burada ayrı ayrı görünür.
							</p>
						</div>
						<AssetFamilyCatalogView
							assetVersionCatalog={assetVersionCatalog}
							catalog={catalog}
							visualWorlds={visualWorlds}
						/>
					</section>
					{assetVersionQuery.data ? (
						<AssetVersionControls
							assetVersionCatalog={assetVersionCatalog}
							catalog={catalog}
							writes={assetVersionWrites}
						/>
					) : null}
				</>
			) : null}
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
