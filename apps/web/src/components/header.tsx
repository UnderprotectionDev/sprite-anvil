import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "@sprite-anvil/ui/components/sidebar";
import { Link, useParams, useSearch } from "@tanstack/react-router";
import UserMenu from "@/features/account-access/ui/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { ModeToggle } from "./mode-toggle";
import { OperationsDock } from "./operations-dock";
import { ProjectNavigation } from "./project-navigation";
import { WorkbenchSearch } from "./workbench-search";

export default function Header() {
	const { data: session } = authClient.useSession();
	const params = useParams({ strict: false });
	const search = useSearch({ strict: false });
	const projectId =
		params.projectId ?? ("projectId" in search ? search.projectId : undefined);
	if (!session) {
		return null;
	}
	return (
		<Sidebar>
			<SidebarHeader>
				<Link className="dither-ink px-2 py-3 font-semibold" to="/projects">
					Sprite Anvil
				</Link>
				{projectId ? <WorkbenchSearch projectId={projectId} /> : null}
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton render={<Link to="/projects" />}>
							Projects
						</SidebarMenuButton>
					</SidebarMenuItem>
					<SidebarMenuItem>
						<SidebarMenuButton render={<Link to="/measurements" />}>
							Measurements
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				{projectId ? (
					<ProjectNavigation key={projectId} projectId={projectId} />
				) : (
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
			<SidebarFooter>
				{projectId ? (
					<OperationsDock projectId={projectId} userId={session.user.id} />
				) : null}
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</SidebarFooter>
		</Sidebar>
	);
}
