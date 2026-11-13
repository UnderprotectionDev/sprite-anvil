import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	InfoIcon,
	XCircleIcon,
} from "lucide-react";
import type { ReactNode } from "react";

export type StatusTone = "error" | "info" | "success" | "warning";

/**
 * One announcement policy for every status the interface shows: errors
 * interrupt (`role="alert"`, implicitly assertive); every other outcome waits
 * for the user to be idle (`role="status"`, implicitly polite). The role alone
 * carries the live-region behavior.
 */
const tones = {
	error: { label: "Error", role: "alert", Icon: XCircleIcon },
	warning: { label: "Warning", role: "status", Icon: AlertTriangleIcon },
	success: { label: "Success", role: "status", Icon: CheckCircle2Icon },
	info: { label: "Info", role: "status", Icon: InfoIcon },
} as const satisfies Record<
	StatusTone,
	{ Icon: unknown; label: string; role: "alert" | "status" }
>;

/** A Support Reference shown as copyable text. */
export function SupportReference({ value }: { value: string }) {
	return (
		<p className="break-all font-mono text-xs">
			Support reference: <code>{value}</code>
		</p>
	);
}

/**
 * A decision or state message. Meaning is carried by an icon shape, a visible
 * label and a live-region role, never by color alone.
 */
export function StatusMessage({
	children,
	className,
	supportReference,
	tone,
}: {
	children: ReactNode;
	className?: string;
	supportReference?: string;
	tone: StatusTone;
}) {
	const { label, role, Icon } = tones[tone];
	return (
		<div
			aria-atomic="true"
			className={cn("flex items-start gap-2 border p-2 text-sm", className)}
			data-tone={tone}
			role={role}
		>
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<div className="min-w-0 space-y-1">
				<p>
					<strong data-slot="status-label">{label}</strong>
					<span aria-hidden="true">: </span>
					<span>{children}</span>
				</p>
				{supportReference ? (
					<SupportReference value={supportReference} />
				) : null}
			</div>
		</div>
	);
}
