import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@sprite-anvil/ui/components/sidebar";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { StatusMessage } from "@/components/status-message";
import { orpc } from "@/utils/orpc";

const groups = [
	{
		label: "Library",
		links: [
			{ to: "/projects/$projectId/assets", label: "Asset Records" },
			{ to: "/projects/$projectId/collections", label: "Collections" },
			{ to: "/projects/$projectId/asset-families", label: "Asset Families" },
			{ to: "/projects/$projectId/scene-qa", label: "Scene QA" },
			{ to: "/projects/$projectId/import-inbox", label: "Import Inbox" },
			{ to: "/projects/$projectId/offline-staging", label: "Offline Staging" },
			{
				to: "/projects/$projectId/production-experiments",
				label: "Production Experiments",
			},
			{
				to: "/projects/$projectId/production-recipes",
				label: "Production Recipes",
			},
			{
				to: "/projects/$projectId/project-archives",
				label: "Project Archives",
			},
		],
	},
	{
		label: "Delivery",
		links: [
			{
				to: "/projects/$projectId/delivery-targets",
				label: "Delivery Targets",
			},
			{ to: "/projects/$projectId/readiness-plan", label: "Readiness Plan" },
			{ to: "/projects/$projectId/export-bundles", label: "Export Bundles" },
			{
				to: "/projects/$projectId/fulfilment-mapping",
				label: "Fulfilment Mapping",
			},
			{
				to: "/projects/$projectId/runtime-validation",
				label: "Runtime Validation",
			},
			{
				to: "/projects/$projectId/delivery-refresh",
				label: "Delivery Refresh",
			},
			{ to: "/projects/$projectId/delivery-diff", label: "Delivery Diff" },
			{
				to: "/projects/$projectId/platform-equivalence",
				label: "Platform Equivalence",
			},
			{ to: "/projects/$projectId/operations", label: "Background Operations" },
			{
				to: "/projects/$projectId/profile-contracts",
				label: "Profile Contracts",
			},
			{ to: "/projects/$projectId/access", label: "Access" },
			{
				to: "/projects/$projectId/permanent-erasure",
				label: "Permanent Erasure",
			},
		],
	},
] as const;

export function ProjectNavigation({ projectId }: { projectId: string }) {
	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	return (
		<nav aria-label="Project navigation">
			<div className="px-4 py-2 font-semibold">
				{projectQuery.data?.name ?? "Project"}
				{projectQuery.isPending ? (
					<span role="status"> Loading project…</span>
				) : null}
				{projectQuery.isError ? (
					<StatusMessage tone="error">
						Could not load project. Open it again from Projects.
					</StatusMessage>
				) : null}
			</div>
			{groups.slice(0, 1).map((group) => (
				<SidebarGroup key={group.label}>
					<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					<SidebarMenu>
						{group.links.map(({ to, label }) => (
							<SidebarMenuItem key={to}>
								<SidebarMenuButton
									render={
										<Link
											activeProps={{
												"aria-current": "page",
												className: "bg-accent text-accent-foreground",
											}}
											params={{ projectId }}
											to={to}
										/>
									}
								>
									{label}
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			))}
			<SidebarGroup>
				<SidebarGroupLabel>Context</SidebarGroupLabel>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							render={
								<Link
									activeProps={{
										"aria-current": "page",
										className: "bg-accent text-accent-foreground",
									}}
									search={{ projectId }}
									to="/context-proposals"
								/>
							}
						>
							Context Proposals
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarGroup>
			{groups.slice(1).map((group) => (
				<SidebarGroup key={group.label}>
					<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					<SidebarMenu>
						{group.links.map(({ to, label }) => (
							<SidebarMenuItem key={to}>
								<SidebarMenuButton
									render={
										<Link
											activeProps={{
												"aria-current": "page",
												className: "bg-accent text-accent-foreground",
											}}
											params={{ projectId }}
											to={to}
										/>
									}
								>
									{label}
								</SidebarMenuButton>
							</SidebarMenuItem>
						))}
					</SidebarMenu>
				</SidebarGroup>
			))}
		</nav>
	);
}
