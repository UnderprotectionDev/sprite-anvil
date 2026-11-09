import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { Button } from "@sprite-anvil/ui/components/button";
import { useQueries, useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import type { FamilyListChoice } from "../../lib/delivery-target-form";
import { DeliveryTargetDraftForm } from "../forms/delivery-target-draft-form";

function FamilyListsLoader({
	contextRevision,
	families,
	onClose,
	projectId,
	target,
}: {
	contextRevision: { id: string; isActive: boolean; revisionNumber: number };
	families: { id: string; name: string }[];
	onClose: () => void;
	projectId: string;
	target: DeliveryTarget | null;
}) {
	const lists = useQueries({
		queries: families.map((family) => ({
			...orpc.familyReadiness.list.queryOptions({
				input: { assetFamilyId: family.id, projectId },
			}),
			meta: { suppressGlobalErrorToast: true },
		})),
	});
	if (lists.some((list) => list.isPending)) {
		return (
			<p aria-live="polite" role="status">
				Loading Required Items Lists…
			</p>
		);
	}
	if (lists.some((list) => list.isError)) {
		return (
			<div className="space-y-2" role="alert">
				<p>The Required Items Lists could not be loaded.</p>
				<Button
					className="min-h-11"
					onClick={() => {
						for (const list of lists) {
							void list.refetch();
						}
					}}
					type="button"
					variant="outline"
				>
					Retry
				</Button>
			</div>
		);
	}
	const choices: FamilyListChoice[] = families.map((family, index) => ({
		id: family.id,
		name: family.name,
		revisions: (lists[index]?.data?.revisions ?? [])
			.map((revision) => ({
				id: revision.id,
				isActive: revision.isActive,
				revisionNumber: revision.revisionNumber,
			}))
			.sort((a, b) => b.revisionNumber - a.revisionNumber),
	}));
	return (
		<DeliveryTargetDraftForm
			contextRevision={contextRevision}
			families={choices}
			onClose={onClose}
			projectId={projectId}
			target={target}
		/>
	);
}

/** Loads what a draft pins (current Context Revision, families and their Required Items List revisions) before the form opens. */
export function DeliveryTargetFormLoader({
	onClose,
	projectId,
	target,
}: {
	onClose: () => void;
	projectId: string;
	target: DeliveryTarget | null;
}) {
	const project = useQuery({
		...orpc.projectContexts.list.queryOptions(),
		meta: { suppressGlobalErrorToast: true },
	});
	const catalog = useQuery({
		...orpc.assetFamilies.list.queryOptions({ input: { projectId } }),
		meta: { suppressGlobalErrorToast: true },
	});
	if (project.isPending || catalog.isPending) {
		return (
			<p aria-live="polite" role="status">
				Loading project scope…
			</p>
		);
	}
	if (project.isError || catalog.isError) {
		return (
			<div className="space-y-2" role="alert">
				<p>The project scope could not be loaded.</p>
				<Button
					className="min-h-11"
					onClick={() => {
						void project.refetch();
						void catalog.refetch();
					}}
					type="button"
					variant="outline"
				>
					Retry
				</Button>
			</div>
		);
	}
	const revision = project.data.find(
		(candidate) => candidate.id === projectId
	)?.currentContextRevision;
	if (!revision) {
		return (
			<p role="alert">This project's Context Revision could not be found.</p>
		);
	}
	return (
		<FamilyListsLoader
			contextRevision={{
				id: revision.id,
				isActive: revision.isActive,
				revisionNumber: revision.revisionNumber,
			}}
			families={catalog.data.assetFamilies.map((family) => ({
				id: family.id,
				name: family.name,
			}))}
			onClose={onClose}
			projectId={projectId}
			target={target}
		/>
	);
}
