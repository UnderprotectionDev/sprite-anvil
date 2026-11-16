import { Button } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { orpc } from "@/utils/orpc";

export function OperationsDock({
	projectId,
	userId,
}: {
	projectId: string;
	userId: string;
}) {
	const options = orpc.backgroundOperations.summary.queryOptions({
		input: { projectId },
	});
	const query = useQuery({
		...options,
		queryKey: [...options.queryKey, "operations-dock", userId],
		refetchInterval: 5000,
		refetchOnReconnect: "always",
		meta: { errorPresentation: "inline" },
	});
	return (
		<section
			aria-label="Operations status"
			className="space-y-1 border-t px-2 py-2 text-xs"
		>
			<Link
				className="font-medium underline-offset-4 hover:underline"
				params={{ projectId }}
				to="/projects/$projectId/operations"
			>
				Operations
			</Link>
			{!!query.isPending && <p role="status">Loading operations…</p>}
			{!!query.isError && (
				<div role="alert">
					<p>Could not load operations.</p>
					<Button
						onClick={() => void query.refetch()}
						size="sm"
						variant="outline"
					>
						Retry
					</Button>
				</div>
			)}
			{!!query.isSuccess &&
				(query.data.active === 0 && query.data.failed === 0 ? (
					<p>No active or failed operations.</p>
				) : (
					<p>
						{query.data.active} active · {query.data.failed} failed
					</p>
				))}
		</section>
	);
}
