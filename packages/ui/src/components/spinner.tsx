import type { DelayedVisibilityOptions } from "@sprite-anvil/ui/hooks/use-delayed-visibility";
import { useDelayedVisibility } from "@sprite-anvil/ui/hooks/use-delayed-visibility";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { LoaderCircleIcon } from "lucide-react";

// Paper · 02 Display + feedback · Spinner. Indeterminate wait: Lucide loader-circle
// in the current text colour at 16, 20 or 24px.

function Spinner({ className, ...props }: React.ComponentProps<"svg">) {
	return (
		<LoaderCircleIcon
			aria-label="Loading"
			className={cn("size-4 animate-spin", className)}
			data-slot="spinner"
			role="status"
			{...props}
		/>
	);
}

// Paper · 06 Extra primitives · Delayed loading. The spinner appears only after
// 200 ms of `loading` and, once shown, stays at least 400 ms.
function DelayedSpinner({
	loading,
	delay,
	minDuration,
	...props
}: React.ComponentProps<typeof Spinner> &
	DelayedVisibilityOptions & { loading: boolean }) {
	const visible = useDelayedVisibility(loading, { delay, minDuration });
	return visible ? <Spinner {...props} /> : null;
}

export { DelayedSpinner, Spinner };
