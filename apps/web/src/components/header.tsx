import { Link } from "@tanstack/react-router";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
	const links = [
		{ to: "/", label: "Home" },
		{ to: "/dashboard", label: "Dashboard" },
		{ to: "/context-proposals", label: "Proje Bağlamı" },
	] as const;

	return (
		<header>
			<div className="flex flex-row items-center justify-between px-2 py-1">
				<nav
					aria-label="Ana gezinme"
					className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm sm:text-lg"
				>
					{links.map(({ to, label }) => (
						<Link key={to} to={to}>
							{label}
						</Link>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<ModeToggle />
					<UserMenu />
				</div>
			</div>
			<hr />
		</header>
	);
}
