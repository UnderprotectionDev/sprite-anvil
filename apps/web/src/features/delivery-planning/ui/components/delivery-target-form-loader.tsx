import type { DeliveryTarget } from "@sprite-anvil/api/delivery-planning-outputs";
import { useQueries, useQuery } from "@tanstack/react-query";
import { LoadErrorAlert } from "@/components/load-error-alert";
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
			<LoadErrorAlert
				message="The Required Items Lists could not be loaded."
				onRetry={() => {
					for (const list of lists) {
						void list.refetch();
					}
				}}
			/>
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
			<LoadErrorAlert
				message="The project scope could not be loaded."
				onRetry={() => {
					void project.refetch();
					void catalog.refetch();
				}}
			/>
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
