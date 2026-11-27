import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@sprite-anvil/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import {
	Link,
	useMatches,
	useMatchRoute,
	useParams,
	useSearch,
} from "@tanstack/react-router";
import { Archive, ChartNoAxesCombined, LayoutGrid } from "lucide-react";
import UserMenu from "@/features/account-access/ui/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { ModeToggle } from "./mode-toggle";
import { OperationsDock } from "./operations-dock";
import { ProjectNavigation } from "./project-navigation";
import { WorkbenchSearch } from "./workbench-search";

export default function Header() {
	const { data: session } = authClient.useSession();
	const { onDetails, archiveTask, paperWorkspace, projectId, routeId } =
		useWorkspaceNavigation();
	if (!session) {
		return null;
	}
	return (
		<Sidebar>
			<SidebarHeader>
				<Link
					className="font-heading flex h-[60px] items-center gap-[10px] px-2 text-lg font-bold"
					to="/projects"
				>
					<img
						alt=""
						className="size-11"
						height={44}
						src="/logo.svg"
						width={44}
					/>
					Sprite Anvil
				</Link>
				{projectId ? <WorkbenchSearch projectId={projectId} /> : null}
				<p className="text-label text-workbench-faint-text px-2 font-mono tracking-widest uppercase">
					Workspace
				</p>
				<WorkspaceMenu
					archiveTask={archiveTask}
					paperWorkspace={paperWorkspace}
					projectsActive={onDetails || routeId === "/_auth/projects"}
				/>
			</SidebarHeader>
			<SidebarContent>
				{projectId ? (
					<ProjectNavigation key={projectId} projectId={projectId} />
				) : null}
				{projectId || paperWorkspace ? null : (
					<SidebarMenu>
						<SidebarMenuItem>
							<SidebarMenuButton
								render={<Link search={{}} to="/context-proposals" />}
							>
								Context Proposals
							</SidebarMenuButton>
						</SidebarMenuItem>
					</SidebarMenu>
				)}
			</SidebarContent>
			<SidebarFooter
				className={
					paperWorkspace ? "border-workbench-border-strong border-t" : undefined
				}
			>
				{projectId ? (
					<OperationsDock projectId={projectId} userId={session.user.id} />
				) : null}
				<div className="flex items-center gap-2">
					{paperWorkspace ? null : <ModeToggle />}
					<UserMenu />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}

function useWorkspaceNavigation() {
	const params = useParams({ strict: false });
	const search = useSearch({ strict: false });
	const routeId = useMatches({ select: (matches) => matches.at(-1)?.routeId });
	const onDetails = routeId === "/_auth/projects_/$projectId/details";
	const archiveTask =
		routeId === "/_auth/projects_/$projectId/project-archives" &&
		"task" in search &&
		Boolean(search.task);
	const paperWorkspace =
		onDetails ||
		archiveTask ||
		routeId === "/_auth/projects" ||
		routeId === "/_auth/project-archives" ||
		routeId === "/_auth/account-settings";
	const projectId =
		onDetails || archiveTask
			? undefined
			: (params.projectId ??
				("projectId" in search ? search.projectId : undefined));
	return { onDetails, archiveTask, paperWorkspace, projectId, routeId };
}

function WorkspaceMenu({
	archiveTask,
	paperWorkspace,
	projectsActive,
}: {
	archiveTask: boolean;
	paperWorkspace: boolean;
	projectsActive: boolean;
}) {
	const matchRoute = useMatchRoute();
	const paperNavClass = paperWorkspace
		? "rounded-[4px] px-2 font-medium"
		: undefined;
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<SidebarMenuButton
					aria-label="Projects"
					className={paperNavClass}
					isActive={projectsActive}
					render={<Link activeOptions={{ exact: true }} to="/projects" />}
				>
					<LayoutGrid className="text-workbench-action" />{" "}
					<span className="grow">Projects</span>
					{paperWorkspace ? <ProjectCount /> : null}
				</SidebarMenuButton>
			</SidebarMenuItem>
			<SidebarMenuItem>
				<SidebarMenuButton
					className={paperNavClass}
					isActive={
						archiveTask || Boolean(matchRoute({ to: "/project-archives" }))
					}
					render={<Link to="/project-archives" />}
				>
					<Archive className="text-workbench-review" /> Project Archive
				</SidebarMenuButton>
			</SidebarMenuItem>
			{paperWorkspace ? null : (
				<SidebarMenuItem>
					<SidebarMenuButton render={<Link to="/measurements" />}>
						<ChartNoAxesCombined /> Measurements
					</SidebarMenuButton>
				</SidebarMenuItem>
			)}
		</SidebarMenu>
	);
}

function ProjectCount() {
	const projects = useQuery({
		...orpc.projects.list.queryOptions(),
		meta: { errorPresentation: "inline" },
	});
	if (!projects.data) {
		return null;
	}
	return (
		<span className="ml-auto font-mono text-[12px] font-semibold">
			{projects.data.length}
		</span>
	);
}
