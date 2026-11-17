import { buttonVariants } from "@sprite-anvil/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({ component: HomeComponent });

function HomeComponent() {
	const { data: session } = authClient.useSession();
	return (
		<main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-12 sm:px-6">
			<header className="max-w-3xl space-y-5">
				<p className="font-mono text-primary text-sm">Sprite Anvil</p>
				<h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
					Manage your game visuals in one place.
				</h1>
				<p className="text-lg text-muted-foreground">
					Choose a game project, define visual rules, find assets, and review
					their versions.
				</p>
				{session ? (
					<Link className={`${buttonVariants()} min-h-11`} to="/projects">
						Open game projects
					</Link>
				) : (
					<Link className={`${buttonVariants()} min-h-11`} to="/login">
						Sign in to get started
					</Link>
				)}
			</header>
			<ol className="grid gap-4 sm:grid-cols-3">
				{[
					[
						"1 · Open your project",
						"Create a game project or continue an existing one.",
					],
					[
						"2 · Find your assets",
						"Search records, organize them in Collections, or import files.",
					],
					[
						"3 · Continue your work",
						"Open a record to access its versions, Generation Packages, and review evidence.",
					],
				].map(([title, description]) => (
					<li className="space-y-3 rounded-lg border bg-card p-6" key={title}>
						<h2 className="font-semibold text-lg">{title}</h2>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{description}
						</p>
					</li>
				))}
			</ol>
		</main>
	);
}
