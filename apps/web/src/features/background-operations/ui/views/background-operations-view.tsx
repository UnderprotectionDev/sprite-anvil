import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "@/components/status-message";
import { useBackgroundOperations } from "../../hooks/use-background-operations";
import { BackgroundOperationCard } from "../components/background-operation-card";

export function BackgroundOperationsView({ projectId }: { projectId: string }) {
	const { nowMs, operations, query } = useBackgroundOperations(projectId);

	return (
		<main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
			<header className="space-y-2">
				<h1 className="font-semibold text-2xl">Background operations</h1>
				<p className="text-muted-foreground text-sm">
					Archive, restore, export, verification and deletion runs that take
					longer than a request. The record here is authoritative and stays
					current if you disconnect and come back.
				</p>
			</header>
			{query.isPending ? (
				<p aria-live="polite" role="status">
					Loading background operations…
				</p>
			) : null}
			{query.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Background operations could not be loaded.
					</StatusMessage>
					<Button
						className="min-h-11"
						onClick={() => void query.refetch()}
						type="button"
						variant="outline"
					>
						Retry
					</Button>
				</div>
			) : null}
			{query.isSuccess && operations.length === 0 ? (
				<p className="text-muted-foreground">
					No background operations have run in this project.
				</p>
			) : null}
			<ul aria-label="Background operations" className="space-y-3">
				{operations.map((operation) => (
					<BackgroundOperationCard
						key={operation.id}
						nowMs={nowMs}
						operation={operation}
					/>
				))}
			</ul>
		</main>
	);
}
