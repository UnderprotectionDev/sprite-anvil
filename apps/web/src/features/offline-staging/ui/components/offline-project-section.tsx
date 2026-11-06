import { Link } from "@tanstack/react-router";

/** The project, from the cloud while online or the copy cached by an earlier visit. */
export function OfflineProjectSection({
	cachedAt,
	isPending,
	name,
	projectId,
}: {
	/** Set only while the shown name comes from the cached copy. */
	cachedAt: number | null;
	isPending: boolean;
	name: string | null;
	projectId: string;
}) {
	return (
		<section aria-labelledby="offline-project" className="space-y-2">
			<h2 className="font-medium text-lg" id="offline-project">
				Project
			</h2>
			{name ? (
				<p>
					{name}
					{cachedAt === null
						? null
						: ` (cached copy from ${new Date(cachedAt).toLocaleString()})`}
				</p>
			) : (
				<p>
					{isPending
						? "Loading the project…"
						: "This project is not cached yet. Open it once while online."}
				</p>
			)}
			<Link
				className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
				params={{ projectId }}
				to="/projects/$projectId/import-inbox"
			>
				Open the Import Inbox
			</Link>
		</section>
	);
}
