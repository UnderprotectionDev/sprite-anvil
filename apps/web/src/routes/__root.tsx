import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { Button } from "@sprite-anvil/ui/components/button";
import { Toaster } from "@sprite-anvil/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	type ErrorComponentProps,
	HeadContent,
	Link,
	Outlet,
} from "@tanstack/react-router";
import { TanStackRouterDevtools } from "@tanstack/react-router-devtools";
import { useState } from "react";

import Header from "@/components/header";
import { ThemeProvider } from "@/components/theme-provider";
import { link, type orpc } from "@/utils/orpc";

import "../index.css";

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
				<div className="flex min-h-svh min-w-0 flex-col">
					<Header />
					<a className="skip-link" href="#workspace-content">
						İçeriğe geç
					</a>
					<div className="min-w-0 flex-1" id="workspace-content" tabIndex={-1}>
						<Outlet />
					</div>
				</div>
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
			<h1 className="font-semibold text-3xl">Sayfa bulunamadı</h1>
			<p>
				Bu bağlantı mevcut bir çalışma alanına gitmiyor. Oyun projenizi açarak
				devam edin.
			</p>
			<Link
				className="inline-flex min-h-11 items-center underline"
				to="/projects"
			>
				Oyun projelerine dön
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
			<h1 className="font-semibold text-3xl">Ekran açılamadı</h1>
			<p role="alert">
				Bu ekran gösterilirken bir sorun oluştu. Yeniden deneyin veya projenize
				listeden dönün.
			</p>
			<div className="flex flex-wrap items-center gap-4">
				<Button onClick={() => void retryScreen()} type="button">
					Yeniden dene
				</Button>
				<Link
					className="inline-flex min-h-11 items-center underline"
					to="/projects"
				>
					Oyun projelerine dön
				</Link>
			</div>
		</main>
	);
}
