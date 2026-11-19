import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { useStore } from "@tanstack/react-store";
import { useEffect } from "react";
import type { OpenRecordStore } from "@/utils/open-records";
import { openRecordStore, rememberOpenRecord } from "@/utils/open-records";
import { orpc } from "@/utils/orpc";

export function OpenRecordTabs({
	userId,
	store = openRecordStore,
}: {
	userId: string;
	store?: OpenRecordStore;
}) {
	const { projectId, assetRecordId } = useParams({ strict: false });
	const search = useSearch({ strict: false });
	const versionId =
		"versionId" in search && typeof search.versionId === "string"
			? search.versionId
			: undefined;
	const navigate = useNavigate();
	const allTabs = useStore(store, (state) => state);
	const tabs = allTabs.filter(
		(tab) => tab.userId === userId && tab.projectId === projectId
	);
	const options = orpc.assetRecords.get.queryOptions({
		input: { projectId: projectId ?? "", assetRecordId: assetRecordId ?? "" },
	});
	const record = useQuery({
		...options,
		queryKey: [...options.queryKey, "open-record-tab", userId],
		enabled: Boolean(projectId && assetRecordId),
		meta: { errorPresentation: "inline" },
	});
	const name = record.data?.name;
	useEffect(() => {
		if (projectId && assetRecordId && name && record.isSuccess) {
			rememberOpenRecord(store, {
				userId,
				projectId,
				assetRecordId,
				name,
				versionId,
			});
		}
	}, [
		assetRecordId,
		name,
		projectId,
		record.isSuccess,
		store,
		userId,
		versionId,
	]);
	if (!(projectId && tabs.length)) {
		return null;
	}
	const close = (id: string) => {
		store.setState((current) =>
			current.filter(
				(tab) =>
					!(
						tab.userId === userId &&
						tab.projectId === projectId &&
						tab.assetRecordId === id
					)
			)
		);
		if (assetRecordId !== id) {
			return;
		}
		const neighbour = tabs.find((tab) => tab.assetRecordId !== id);
		if (neighbour) {
			void navigate({
				to: "/projects/$projectId/assets/$assetRecordId",
				params: { projectId, assetRecordId: neighbour.assetRecordId },
				search: neighbour.versionId ? { versionId: neighbour.versionId } : {},
			});
		} else {
			void navigate({
				to: "/projects/$projectId/assets",
				params: { projectId },
			});
		}
	};
	return (
		<nav
			aria-label="Open Asset Records"
			className="bg-card flex min-w-0 flex-wrap gap-1 border-b p-2"
		>
			{tabs.map((tab) => (
				<div
					className="flex min-w-0 items-center border"
					key={tab.assetRecordId}
				>
					<Link
						aria-current={
							assetRecordId === tab.assetRecordId ? "page" : undefined
						}
						className="aria-[current=page]:bg-accent inline-flex min-h-11 items-center px-3 text-sm"
						params={{ projectId, assetRecordId: tab.assetRecordId }}
						search={tab.versionId ? { versionId: tab.versionId } : {}}
						to="/projects/$projectId/assets/$assetRecordId"
					>
						{tab.name}
					</Link>
					<Button
						aria-label={`Close ${tab.name}`}
						onClick={() => close(tab.assetRecordId)}
						size="icon"
						type="button"
						variant="ghost"
					>
						×
					</Button>
				</div>
			))}
		</nav>
	);
}
