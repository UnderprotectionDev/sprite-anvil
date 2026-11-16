import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "@/components/status-message";

export function CollectionPageStatus({
	catalogError,
	catalogPending,
	isCheckingOutcome,
	onCheckOutcome,
	onRetry,
	projectMissing,
	projectsPending,
	statusMessage,
	writeOutcomeUncertain,
}: {
	catalogError: boolean;
	catalogPending: boolean;
	isCheckingOutcome: boolean;
	onCheckOutcome: () => void;
	onRetry: () => void;
	projectMissing: boolean;
	projectsPending: boolean;
	statusMessage: string | null;
	writeOutcomeUncertain: boolean;
}) {
	return (
		<div className="space-y-3">
			{projectMissing ? (
				<StatusMessage tone="error">Project not found.</StatusMessage>
			) : null}
			{projectsPending ? (
				<p aria-live="polite" role="status">
					Loading projects…
				</p>
			) : null}
			{catalogPending ? (
				<p aria-live="polite" role="status">
					Loading Collections…
				</p>
			) : null}
			{catalogError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">
						Could not load Collections.
					</StatusMessage>
					<Button
						className="min-h-11"
						onClick={onRetry}
						type="button"
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}
			{statusMessage ? (
				<p aria-live="polite" role="status">
					{statusMessage}
				</p>
			) : null}
			{writeOutcomeUncertain ? (
				<Button
					className="min-h-11"
					disabled={isCheckingOutcome}
					onClick={onCheckOutcome}
					type="button"
					variant="outline"
				>
					{isCheckingOutcome ? "Checking status…" : "Check status"}
				</Button>
			) : null}
		</div>
	);
}
