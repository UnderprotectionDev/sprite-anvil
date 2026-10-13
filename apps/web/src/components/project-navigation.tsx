import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";

const projectLinks = [
	{ to: "/projects/$projectId/assets", label: "Varlık kayıtları" },
	{ to: "/projects/$projectId/collections", label: "Koleksiyonlar" },
	{ to: "/projects/$projectId/asset-families", label: "Varlık Aileleri" },
	{ to: "/projects/$projectId/import-inbox", label: "İçe aktarma" },
	{
		to: "/projects/$projectId/profile-contracts",
		label: "Özel profil sözleşmeleri",
	},
	{ to: "/projects/$projectId/access", label: "İzinler" },
] as const;
const linkClass =
	"inline-flex min-h-11 items-center rounded-md px-3 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground";
const activeProps = {
	className: "bg-accent text-accent-foreground",
	"aria-current": "page",
} as const;

export function ProjectNavigation({ projectId }: { projectId: string }) {
	const projectQuery = useQuery({
		...orpc.projects.get.queryOptions({ input: { projectId } }),
		meta: { errorPresentation: "inline" },
	});
	return (
		<div className="border-b bg-card">
			<div className="mx-auto max-w-6xl space-y-2 px-4 py-3 sm:px-6">
				<div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
					<span className="min-w-0 break-words font-semibold">
						{projectQuery.data?.name ?? "Oyun projesi"}
					</span>
					<Link
						className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
						to="/projects"
					>
						Proje değiştir
					</Link>
					{projectQuery.isPending ? (
						<span role="status">Proje yükleniyor…</span>
					) : null}
					{projectQuery.isError ? (
						<span className="text-sm" role="alert">
							Proje bilgisi yüklenemedi. Projelerden yeniden açın.
						</span>
					) : null}
				</div>
				<nav aria-label="Proje gezinmesi" className="flex flex-wrap gap-1">
					{projectLinks.slice(0, 4).map(({ to, label }) => (
						<Link
							activeProps={activeProps}
							className={linkClass}
							key={to}
							params={{ projectId }}
							to={to}
						>
							{label}
						</Link>
					))}
					<Link
						activeProps={activeProps}
						className={linkClass}
						search={{ projectId }}
						to="/context-proposals"
					>
						Proje Bağlamı
					</Link>
					{projectLinks.slice(4).map(({ to, label }) => (
						<Link
							activeProps={activeProps}
							className={linkClass}
							key={to}
							params={{ projectId }}
							to={to}
						>
							{label}
						</Link>
					))}
				</nav>
			</div>
		</div>
	);
}
