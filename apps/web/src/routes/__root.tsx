import { Button } from "@sprite-anvil/ui/components/button";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@sprite-anvil/ui/components/sidebar";
import { Toaster } from "@sprite-anvil/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import {
	QueryClientProvider,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	useMatches,
	useRouter,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { Archive, ChevronRight, House } from "lucide-react";
import { useEffect } from "react";
import Header from "@/components/header";
import { OpenRecordTabs } from "@/components/open-record-tabs";
import { ThemeProvider } from "@/components/theme-provider";
import { WorkspaceSearch } from "@/components/workspace-search";
import { authClient } from "@/lib/auth-client";
import { orpc } from "@/utils/orpc";
import { resetSessionQueryClient } from "@/utils/query-client";

import "../index.css";
import { StatusMessage } from "@/components/status-message";

export interface RouterAppContext {
	orpc: typeof orpc;
	queryClient: QueryClient;
}

export const Route = createRootRouteWithContext<RouterAppContext>()({
	component: RootComponent,
	notFoundComponent: MissingPage,
	errorComponent: WorkspaceError,
	head: () => ({
		meta: [
			{
				title: "sprite-anvil",
			},
			{
				name: "description",
				content: "sprite-anvil is a web application",
			},
		],
		links: [
			{
				rel: "icon",
				href: "/favicon.ico",
			},
		],
	}),
});

function useAuthRouteContext() {
	return useMatches({
		select: (matches) =>
			matches.find((match) => match.routeId === "/_auth")?.context,
	});
}

function useWorkspaceTitle() {
	return useMatches({
		select: (matches) => {
			const archiveTask = matches.find(
				(match) =>
					match.routeId === "/_auth/projects_/$projectId/project-archives"
			)?.search.task;
			if (archiveTask) {
				return archiveTask === "create" ? "Create archive" : "Restore";
			}
			if (
				matches.some((match) => match.routeId === "/_auth/account-settings")
			) {
				return "Account settings";
			}
			if (
				matches.some(
					(match) => match.routeId === "/_auth/projects_/$projectId/details"
				)
			) {
				return "Details";
			}
			if (matches.some((match) => match.routeId === "/_auth/projects")) {
				return "Projects";
			}
			if (
				matches.some((match) => match.routeId === "/_auth/project-archives")
			) {
				return "Project Archive";
			}
		},
	});
}

function RootComponent() {
	const { session, client, routeUserId, routeSessionId, sessionChanged } =
		useWorkspaceSession();
	const isLogin = useMatches({
		select: (matches) => matches.some((match) => match.routeId === "/login"),
	});
	const workspaceTitle = useWorkspaceTitle();
	const isWorkspace = Boolean(workspaceTitle);

	return (
		<QueryClientProvider client={client}>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<SidebarProvider
					className={isWorkspace ? "h-svh min-h-0 overflow-hidden" : undefined}
					style={
						{
							"--sidebar-width": isWorkspace ? "256px" : "308px",
						} as React.CSSProperties
					}
				>
					<a className="skip-link" href="#workspace-content">
						Skip to content
					</a>
					{sessionChanged ? null : <Header />}
					<SidebarInset
						className={
							isWorkspace ? "min-h-0 min-w-0 overflow-hidden" : undefined
						}
					>
						{session && !sessionChanged && routeUserId === session.user.id ? (
							<OpenRecordTabs key={routeSessionId} userId={session.user.id} />
						) : null}
						<RootHeader
							isLogin={isLogin}
							signedIn={Boolean(session)}
							workspaceTitle={workspaceTitle}
						/>
						<div
							className={
								isWorkspace
									? "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
									: "min-w-0 flex-1"
							}
							id="workspace-content"
							tabIndex={-1}
						>
							{sessionChanged ? null : <Outlet key={routeSessionId} />}
						</div>
					</SidebarInset>
				</SidebarProvider>
				<Toaster richColors />
			</ThemeProvider>
			{import.meta.env.DEV && import.meta.env.MODE !== "e2e" ? (
				<>
					<TanStackRouterDevtools position="bottom-left" />
					<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
				</>
			) : null}
		</QueryClientProvider>
	);
}

function useWorkspaceSession() {
	const { data: session, error, isPending } = authClient.useSession();
	const router = useRouter();
	const authContext = useAuthRouteContext();
	const publicClient = useQueryClient();
	const client = authContext?.queryClient ?? publicClient;
	const routeUserId = authContext?.session?.user.id;
	const routeSessionId = authContext?.session?.session.id;
	const sessionChanged =
		Boolean(routeUserId) &&
		!(isPending || error) &&
		(session?.user.id !== routeUserId ||
			session?.session.id !== routeSessionId);

	// Better Auth refreshes its session in response to sign-out in other tabs.
	useEffect(() => {
		if (sessionChanged) {
			resetSessionQueryClient();
			void router.invalidate();
		}
	}, [router, sessionChanged]);

	return { session, client, routeUserId, routeSessionId, sessionChanged };
}

function RootHeader({
	signedIn,
	isLogin,
	workspaceTitle,
}: {
	signedIn: boolean;
	isLogin: boolean;
	workspaceTitle?: string;
}) {
	return (
		<>
			{signedIn ? (
				<div className="bg-workbench-sidebar border-workbench-divider flex h-[52px] shrink-0 items-center gap-3 border-b px-4">
					<SidebarTrigger />
					{workspaceTitle ? (
						<>
							<span className="bg-workbench-divider h-4 w-px" />
							<span className="text-[14px] leading-5 font-semibold">
								<WorkspaceBreadcrumb title={workspaceTitle} />
							</span>
							<WorkspaceSearch />
						</>
					) : null}
				</div>
			) : null}
			{signedIn || isLogin ? null : (
				<header className="border-b p-4">
					<Link to="/projects">Sprite Anvil</Link>
				</header>
			)}
		</>
	);
}

function WorkspaceBreadcrumb({ title }: { title: string }) {
	if (title === "Details") {
		return <DetailsBreadcrumb />;
	}
	if (title === "Restore" || title === "Create archive") {
		return (
			<span className="flex items-center gap-2">
				<Link
					className="text-workbench-muted-text flex items-center gap-2 font-medium"
					to="/project-archives"
				>
					<Archive className="size-4" />
					Project Archive
				</Link>
				<ChevronRight className="text-workbench-muted-text size-4" />
				{title}
			</span>
		);
	}
	const Icon = title === "Project Archive" ? Archive : House;
	return (
		<span className="flex items-center gap-2">
			<Icon className="text-workbench-muted-text size-4" />
			{title}
		</span>
	);
}

function DetailsBreadcrumb() {
	const projectId = useMatches({
		select: (matches) =>
			matches.find(
				(match) => match.routeId === "/_auth/projects_/$projectId/details"
			)?.params.projectId,
	});
	const projects = useQuery(orpc.projects.list.queryOptions());
	const project = projects.data?.find((item) => item.id === projectId);
	return (
		<span className="flex items-center gap-2">
			<Link
				className="text-workbench-muted-text flex items-center gap-2 font-medium"
				to="/projects"
			>
				<House className="size-4" />
				Projects
			</Link>
			<span className="text-workbench-faint-text">›</span>
			<span className="text-workbench-muted-text">
				{project?.name ?? "Project"}
			</span>
			<span className="text-workbench-faint-text">›</span>Details
		</span>
	);
}

function MissingPage() {
	return (
		<main className="mx-auto max-w-3xl space-y-4 px-4 py-12">
			<h1 className="text-3xl font-semibold">Page not found</h1>
			<p>
				This link does not lead to an existing workspace. Open your game project
				to continue.
			</p>
			<Link
				className="inline-flex min-h-11 items-center underline"
				to="/projects"
			>
				Back to projects
			</Link>
		</main>
	);
}
function WorkspaceError({ reset }: ErrorComponentProps) {
	const authContext = useAuthRouteContext();
	const publicClient = useQueryClient();
	const queryClient = authContext?.queryClient ?? publicClient;
	async function retryScreen() {
		await queryClient.resetQueries();
		reset();
	}
	return (
		<main className="mx-auto max-w-3xl space-y-4 px-4 py-12">
			<h1 className="text-3xl font-semibold">Could not open screen</h1>
			<StatusMessage tone="error">
				Something went wrong while displaying this screen. Try again or return
				to your project from the list.
			</StatusMessage>
			<div className="flex flex-wrap items-center gap-4">
				<Button onClick={() => void retryScreen()} type="button">
					Try again
				</Button>
				<Link
					className="inline-flex min-h-11 items-center underline"
					to="/projects"
				>
					Back to projects
				</Link>
			</div>
		</main>
	);
}
