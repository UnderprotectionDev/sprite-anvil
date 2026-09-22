import { createORPCClient } from "@orpc/client";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@sprite-anvil/api/routers/index";
import { Toaster } from "@sprite-anvil/ui/components/sonner";
import type { QueryClient } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
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
				<div className="grid h-svh grid-rows-[auto_1fr]">
					<Header />
					<Outlet />
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
