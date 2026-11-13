import {
	type BackgroundOperation,
	cancelOutcome,
	canRequestCancel,
	shouldShowOperationProgress,
} from "@sprite-anvil/api/background-operations";
import { Button } from "@sprite-anvil/ui/components/button";
import { Progress } from "@sprite-anvil/ui/components/progress";
import { StatusMessage } from "@/components/status-message";
import { useCancelBackgroundOperation } from "../../hooks/use-cancel-background-operation";
import {
	attemptText,
	cancelOutcomeMessages,
	kindLabels,
	statusLabels,
} from "../../lib/operation-labels";

function OperationProgress({
	operation,
	nowMs,
}: {
	nowMs: number;
	operation: BackgroundOperation;
}) {
	if (!shouldShowOperationProgress(operation, nowMs)) {
		return null;
	}
	const label = operation.progressStep ?? "Working";
	return (
		<Progress
			aria-label={`${kindLabels[operation.kind]} progress: ${label}`}
			value={operation.progressPercent}
		>
			<span className="text-muted-foreground text-xs">
				{label}
				{operation.progressPercent === null
					? ""
					: ` (${operation.progressPercent}%)`}
			</span>
		</Progress>
	);
}

function CancelControl({ operation }: { operation: BackgroundOperation }) {
	const cancel = useCancelBackgroundOperation(operation.projectId);
	if (!canRequestCancel(operation.status)) {
		return null;
	}
	return (
		<div className="space-y-1">
			<Button
				aria-label={`Cancel ${kindLabels[operation.kind]}: ${operation.scopeSummary}`}
				className="min-h-11"
				disabled={cancel.isPending}
				onClick={() =>
					cancel.mutate({
						id: operation.id,
						projectId: operation.projectId,
					})
				}
				type="button"
				variant="outline"
			>
				{cancel.isPending ? "Cancelling…" : "Cancel"}
			</Button>
			{cancel.isError ? (
				<StatusMessage tone="error">{cancel.error.message}</StatusMessage>
			) : null}
		</div>
	);
}

export function BackgroundOperationCard({
	nowMs,
	operation,
}: {
	nowMs: number;
	operation: BackgroundOperation;
}) {
	const outcome = cancelOutcome(operation);
	return (
		<li className="space-y-2 border p-4">
			<div className="flex flex-wrap items-baseline justify-between gap-2">
				<h2 className="font-medium">
					{kindLabels[operation.kind]}: {operation.scopeSummary}
				</h2>
				<p className="font-mono text-sm">{statusLabels[operation.status]}</p>
			</div>
			<p className="text-muted-foreground text-sm">
				{operation.triggerSummary} ·{" "}
				{attemptText(operation.attemptCount, operation.maxAttempts)}
			</p>
			<OperationProgress nowMs={nowMs} operation={operation} />
			{outcome ? (
				<p className="text-sm" role="status">
					{cancelOutcomeMessages[outcome]}
				</p>
			) : null}
			<CancelControl operation={operation} />
			{operation.status === "completed" && operation.resultSummary ? (
				<p className="text-sm">{operation.resultSummary}</p>
			) : null}
			{operation.status === "failed" ? (
				<StatusMessage tone="error">
					{operation.failureSummary ?? "The operation failed."}
				</StatusMessage>
			) : null}
		</li>
	);
}
