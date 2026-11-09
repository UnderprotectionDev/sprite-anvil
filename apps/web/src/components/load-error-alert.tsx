import { Button } from "@sprite-anvil/ui/components/button";

/** A load failure the user can retry; the message says what could not be loaded. */
export function LoadErrorAlert({
	message,
	onRetry,
}: {
	message: string;
	onRetry: () => void;
}) {
	return (
		<div className="space-y-2" role="alert">
			<p>{message}</p>
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
