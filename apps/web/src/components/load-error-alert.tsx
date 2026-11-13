import { Button } from "@sprite-anvil/ui/components/button";
import { StatusMessage } from "./status-message";

/** A load failure the user can retry; the message says what could not be loaded. */
export function LoadErrorAlert({
	message,
	onRetry,
	supportReference,
}: {
	message: string;
	onRetry: () => void;
	supportReference?: string;
}) {
	return (
		<div className="space-y-2">
			<StatusMessage supportReference={supportReference} tone="error">
				{message}
			</StatusMessage>
			<Button
				className="min-h-11"
				onClick={onRetry}
				type="button"
				variant="outline"
			>
				Retry
			</Button>
		</div>
	);
}
