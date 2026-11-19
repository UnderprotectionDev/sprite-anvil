import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { Button } from "@sprite-anvil/ui/components/button";
import {
	SidebarInset,
	SidebarProvider,
	SidebarTrigger,
} from "@sprite-anvil/ui/components/sidebar";
import { Toaster } from "@sprite-anvil/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import type { ErrorComponentProps } from "@tanstack/react-router";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

import Header from "@/components/header";
import { OpenRecordTabs } from "@/components/open-record-tabs";
import { ThemeProvider } from "@/components/theme-provider";
import { authClient } from "@/lib/auth-client";
import type { orpc } from "@/utils/orpc";
import { link } from "@/utils/orpc";

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

function RootComponent() {
	const { data: session } = authClient.useSession();
	const [client] = useState<AppRouterClient>(() => createORPCClient(link));
	const [_orpcUtils] = useState(() => createTanstackQueryUtils(client));

	return (
		<>
			<HeadContent />
			<ThemeProvider
				attribute="class"
				defaultTheme="dark"
				disableTransitionOnChange
				storageKey="vite-ui-theme"
			>
				<SidebarProvider
					style={{ "--sidebar-width": "308px" } as React.CSSProperties}
				>
					<a className="skip-link" href="#workspace-content">
						Skip to content
					</a>
					<Header />
					<SidebarInset>
						{session ? <OpenRecordTabs userId={session.user.id} /> : null}
						{session ? (
							<SidebarTrigger />
						) : (
							<header className="border-b p-4">
								<Link to="/projects">Sprite Anvil</Link>
							</header>
						)}
						<div
							className="min-w-0 flex-1"
							id="workspace-content"
							tabIndex={-1}
						>
							<Outlet />
						</div>
					</SidebarInset>
				</SidebarProvider>
				<Toaster richColors />
			</ThemeProvider>
			{import.meta.env.DEV ? (
				<>
					<TanStackRouterDevtools position="bottom-left" />
					<ReactQueryDevtools buttonPosition="bottom-right" position="bottom" />
				</>
			) : null}
		</>
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
	const queryClient = useQueryClient();
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
