import { Link } from "@tanstack/react-router";
import UserMenu from "@/features/account-access/ui/components/user-menu";
import { authClient } from "@/lib/auth-client";
import { ModeToggle } from "./mode-toggle";

export default function Header() {
	const { data: session } = authClient.useSession();
	const links = [
		{ to: "/projects", label: "Projeler" },
		{ to: "/context-proposals", label: "Proje Bağlamı" },
	] as const;

	return (
		<header className="border-b bg-card/90">
			<div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 sm:px-6">
				<Link
					aria-label="Sprite Anvil"
					className="inline-flex min-h-11 items-center gap-3 font-semibold tracking-tight"
					to="/projects"
				>
					<span
						aria-hidden="true"
						className="grid size-9 place-items-center rounded-lg bg-primary font-bold font-mono text-primary-foreground"
					>
						S
					</span>
					Sprite Anvil
				</Link>
				{session ? (
					<nav
						aria-label="Ana gezinme"
						className="order-3 flex w-full items-center gap-1 text-sm sm:order-none sm:ml-6 sm:w-auto"
					>
						{links.map(({ to, label }) => (
							<Link
								activeProps={{ className: "bg-accent text-accent-foreground" }}
								className="inline-flex min-h-11 items-center rounded-md px-3 font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground"
								key={to}
								to={to}
							>
								{label}
							</Link>
						))}
					</nav>
				) : null}
				<div className="ml-auto flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
		</header>
	);
}
