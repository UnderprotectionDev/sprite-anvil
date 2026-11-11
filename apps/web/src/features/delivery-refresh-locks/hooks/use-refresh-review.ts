import {
	checkDeliveryRefreshLockContract,
	classifyDeliveryRefreshPaths,
	type DeliveryRefreshDecision,
	type DeliveryRefreshDecisionKind,
	planDeliveryRefresh,
} from "@sprite-anvil/api/delivery-refresh-classification";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { orpc } from "@/utils/orpc";
import {
	type ChosenFolder,
	observeTargetFolder,
} from "../lib/read-target-folder";

const quiet = { meta: { suppressGlobalErrorToast: true } };

/**
 * Reads the chosen lock and bundle, observes only the paths they name in the destination
 * folder, and classifies them with the shared module. Nothing else in the folder is read.
 */
export function useRefreshReview(input: {
	bundleId: string;
	decided: Record<string, DeliveryRefreshDecisionKind>;
	lockId: string;
	projectId: string;
	target: ChosenFolder | null;
}) {
	const { bundleId, decided, lockId, projectId, target } = input;
	const lock = useQuery({
		...orpc.deliveryRefreshLocks.get.queryOptions({
			input: { lockId, projectId },
		}),
		enabled: lockId !== "",
		...quiet,
	}).data;
	const bundle = useQuery({
		...orpc.exportBundles.get.queryOptions({ input: { bundleId, projectId } }),
		enabled: bundleId !== "",
		...quiet,
	}).data;

	const contract = lock
		? checkDeliveryRefreshLockContract({
				...lock,
				profileId: lock.profile.profileId,
				profileRevisionId: lock.profile.revisionId,
			})
		: null;
	const ready = Boolean(lock && bundle && contract?.ok);
	const paths = useMemo(
		() =>
			lock && bundle
				? [
						...new Set([
							...lock.files.map((file) => file.path),
							...bundle.files.map((file) => file.path),
						]),
					]
				: [],
		[lock, bundle]
	);
	const observation = useQuery({
		enabled: ready && target !== null,
		queryFn: () =>
			target ? observeTargetFolder(target.files, paths) : Promise.resolve([]),
		queryKey: ["delivery-refresh-observation", target?.token, lockId, bundleId],
	}).data;

	const classification = useMemo(
		() =>
			lock && bundle && observation
				? classifyDeliveryRefreshPaths({
						next: bundle.files,
						observed: observation,
						previous: lock.files,
					})
				: null,
		[lock, bundle, observation]
	);
	const decisions: DeliveryRefreshDecision[] = Object.entries(decided).map(
		([path, decision]) => ({ decision, path })
	);
	const plan = classification
		? planDeliveryRefresh(classification, decisions)
		: null;

	return {
		bundle,
		classification,
		contract,
		decisions,
		lock,
		observation,
		plan,
	};
}
