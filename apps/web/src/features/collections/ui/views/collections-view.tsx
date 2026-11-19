import { buttonVariants } from "@sprite-anvil/ui/components/button";
import { Link } from "@tanstack/react-router";
import { useCollectionsManager } from "../../hooks/use-collections-manager";
import { CollectionListPanel } from "../components/collection-list-panel";
import { CollectionMembershipPanel } from "../components/collection-membership-panel";
import { CollectionPageStatus } from "../components/collection-page-status";

export function CollectionsView({ projectId }: { projectId: string }) {
	const manager = useCollectionsManager(projectId);

	return (
		<main className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8">
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
					collectionForm={manager.collectionForm}
					collections={manager.collections}
					memberships={manager.allMemberships}
					onSelectCollection={manager.selectCollection}
					savingOperation={manager.savingOperation}
					selectedCollectionId={manager.selectedCollection?.id ?? null}
					writesDisabled={manager.writesDisabled}
				/>
				<CollectionMembershipPanel
					assetRecordsById={manager.assetRecordsById}
					availableAssetRecords={manager.availableAssetRecords}
					membershipForm={manager.membershipForm}
					memberships={manager.memberships ?? []}
					onRemoveAssetRecord={manager.removeAssetRecord}
					savingOperation={manager.savingOperation}
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
					Back to projects
				</Link>
				<Link
					className={`${buttonVariants({ variant: "outline" })} min-h-11`}
					params={{ projectId }}
					to="/projects/$projectId/assets"
				>
					Asset Records
				</Link>
				<Link
					className={`${buttonVariants({ variant: "outline" })} min-h-11`}
					params={{ projectId }}
					to="/projects/$projectId/asset-families"
				>
					Asset Families
				</Link>
			</div>
			<header className="space-y-2">
				<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
					Asset library / {projectName ?? "Oyun projesi"}
				</p>
				<h1 className="font-serif text-4xl font-medium tracking-tight">
					Collections
				</h1>
				<p className="text-muted-foreground max-w-2xl">
					Bring Asset Records from different Asset Families together to suit
					your workflow.
				</p>
			</header>
		</div>
	);
}
