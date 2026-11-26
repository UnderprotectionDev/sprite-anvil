import { Button } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
	Link,
	useNavigate,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { useSelector } from "@tanstack/react-store";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
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
	const allTabs = useSelector(store, (state) => state);
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
			className="border-workbench-divider bg-workbench-sidebar flex min-w-0 flex-wrap gap-2 border-b px-3 py-2"
		>
			{tabs.map((tab) => (
				<OpenRecordTab
					key={tab.assetRecordId}
					name={tab.name}
					onClose={() => close(tab.assetRecordId)}
					renderTitle={(titleProps) => (
						<Link
							{...titleProps}
							params={{ projectId, assetRecordId: tab.assetRecordId }}
							search={tab.versionId ? { versionId: tab.versionId } : {}}
							to="/projects/$projectId/assets/$assetRecordId"
						/>
					)}
					selected={assetRecordId === tab.assetRecordId}
				/>
			))}
		</nav>
	);
}

interface OpenRecordTabTitleProps {
	"aria-current": "page" | undefined;
	children: ReactNode;
	className: string;
}

// Paper · 07 Shell + library · Closable Asset Tab. A 34px tab, radius 6, Inter 14 600.
// Hover raises the #3F3F3F utility face; the selected tab is the #EBEBEB nav chip with
// its #B4B4B4 bevel and dark ink. The title and the 28px close target are separate
// focus stops; the title's focus ring is drawn around the whole tab.
function OpenRecordTab({
	name,
	selected,
	onClose,
	renderTitle,
	className,
}: {
	name: string;
	selected: boolean;
	onClose: () => void;
	renderTitle: (titleProps: OpenRecordTabTitleProps) => ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"group/asset-tab rounded-control-sm text-workbench-muted-text has-[a:focus-visible]:focus-ring hover:bevel hover:bevel-utility hover:bg-workbench-utility hover:text-workbench-text data-selected:bevel data-selected:bevel-nav data-selected:bg-workbench-nav data-selected:text-workbench-nav-ink data-selected:hover:bevel-nav data-selected:hover:bg-workbench-nav data-selected:hover:text-workbench-nav-ink flex h-8.5 max-w-56 min-w-0 items-center gap-1.5 pr-1 pl-3 transition-colors duration-120 hover:pb-[3px] data-selected:pb-[3px] data-selected:font-bold",
				className
			)}
			data-selected={selected || undefined}
			data-slot="asset-tab"
		>
			{renderTitle({
				"aria-current": selected ? "page" : undefined,
				className:
					"min-w-0 flex-1 truncate font-semibold text-data outline-none focus-visible:outline-none! group-data-selected/asset-tab:font-bold",
				children: name,
			})}
			<Button
				aria-label={`Close ${name}`}
				className="text-workbench-muted-text hover:bevel hover:bevel-utility hover:bg-workbench-utility hover:text-workbench-text group-data-selected/asset-tab:text-workbench-nav-ink group-data-selected/asset-tab:hover:text-workbench-text hover:[--bevel-depth:3px] hover:[--bevel-edge:var(--color-pixel-utility-low)]!"
				onClick={onClose}
				size="icon-xs"
				type="button"
				variant="ghost"
			>
				<XIcon aria-hidden="true" />
			</Button>
		</div>
	);
}
