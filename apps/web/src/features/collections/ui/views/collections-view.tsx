import { buttonVariants } from "@sprite-anvil/ui/components/button";
import { Link } from "@tanstack/react-router";
import { CollectionListPanel } from "../components/collection-list-panel";
import { CollectionMembershipPanel } from "../components/collection-membership-panel";
import { CollectionPageStatus } from "../components/collection-page-status";
import { useCollectionsManager } from "../hooks/use-collections-manager";

export function CollectionsView({ projectId }: { projectId: string }) {
	const manager = useCollectionsManager(projectId);

	return (
		<main className="mx-auto w-full max-w-6xl space-y-8 overflow-y-auto px-4 py-8">
			<PageHeader projectId={projectId} projectName={manager.project?.name} />
			<CollectionPageStatus
				catalogError={manager.catalogQuery.isError}
				catalogPending={manager.catalogQuery.isPending}
				isCheckingOutcome={manager.isCheckingOutcome}
				onCheckOutcome={() => void manager.checkWriteOutcome()}
				onRetry={() => void manager.catalogQuery.refetch()}
				projectMissing={manager.projectsQuery.isSuccess && !manager.project}
				projectsPending={manager.projectsQuery.isPending}
				statusMessage={manager.statusMessage}
				writeOutcomeUncertain={manager.writeOutcomeUncertain}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.6fr)]">
				<CollectionListPanel
					collectionName={manager.collectionName}
					collections={manager.collections}
					memberships={manager.allMemberships}
					onCollectionNameChange={manager.setCollectionName}
					onCreateCollection={manager.createCollection}
					onSelectCollection={manager.selectCollection}
					savingOperation={manager.savingOperation}
					selectedCollectionId={manager.selectedCollection?.id ?? null}
					writesDisabled={manager.writesDisabled}
				/>
				<CollectionMembershipPanel
					assetRecordsById={manager.assetRecordsById}
					availableAssetRecords={manager.availableAssetRecords}
					memberships={manager.memberships ?? []}
					onAddAssetRecord={manager.addAssetRecord}
					onRemoveAssetRecord={manager.removeAssetRecord}
					onSelectedAssetRecordChange={manager.setSelectedAssetRecordId}
					savingOperation={manager.savingOperation}
					selectedAssetRecordId={manager.selectedAssetRecordId}
					selectedCollection={manager.selectedCollection}
					writesDisabled={manager.writesDisabled}
				/>
			</div>
		</main>
	);
}

function PageHeader({
	projectId,
	projectName,
}: {
	projectId: string;
	projectName?: string;
}) {
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Link
					className="text-muted-foreground text-sm underline underline-offset-4"
					to="/projects"
				>
					Oyun projelerine dön
				</Link>
				<Link
					className={`${buttonVariants({ variant: "outline" })} min-h-11`}
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Varlık kayıtları
				</Link>
				<Link
					className={`${buttonVariants({ variant: "outline" })} min-h-11`}
					params={{ projectId }}
					to="/projects/$projectId/asset-families"
				>
					Varlık Aileleri
				</Link>
			</div>
			<header className="space-y-2">
				<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
					Varlık kütüphanesi / {projectName ?? "Oyun projesi"}
				</p>
				<h1 className="font-medium font-serif text-4xl tracking-tight">
					Koleksiyonlar
				</h1>
				<p className="max-w-2xl text-muted-foreground">
					Farklı Varlık Ailelerindeki Varlık Kayıtlarını çalışma düzeninize göre
					bir araya getirin.
				</p>
			</header>
		</div>
	);
}
