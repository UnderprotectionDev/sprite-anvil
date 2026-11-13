import { cn } from "@sprite-anvil/ui/lib/utils";
import {
	AlertTriangleIcon,
	CheckCircle2Icon,
	InfoIcon,
	XCircleIcon,
} from "lucide-react";
import type { ReactNode, Ref } from "react";

export type StatusTone = "error" | "info" | "success" | "warning";

/**
 * One announcement policy for every status the interface shows: errors
 * interrupt (`role="alert"`, implicitly assertive); every other outcome waits
 * for the user to be idle (`role="status"`, implicitly polite). The role alone
 * carries the live-region behavior.
 */
const toneConfig = {
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
	id,
	ref,
	supportReference,
	tabIndex,
	tone,
}: {
	children: ReactNode;
	className?: string;
	id?: string;
	ref?: Ref<HTMLDivElement>;
	supportReference?: string;
	tabIndex?: number;
	tone: StatusTone;
}) {
	const { label, role, Icon } = toneConfig[tone];
	return (
		<div
			aria-atomic="true"
			className={cn("flex items-start gap-2 border p-2 text-sm", className)}
			data-tone={tone}
			id={id}
			ref={ref}
			role={role}
			tabIndex={tabIndex}
		>
			<Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
			<div className="min-w-0 space-y-1">
				<p>
					<strong data-slot="status-label">{label}</strong>
					{": "}
					<span>{children}</span>
				</p>
				{supportReference ? (
					<SupportReference value={supportReference} />
				) : null}
			</div>
		</div>
	);
}

/**
 * The result text of a write. While the outcome is uncertain it is a visible
 * Warning (it never says the write failed and never invites a blind retry);
 * otherwise it stays the plain polite status.
 */
export function WriteOutcomeMessage({
	message,
	uncertain,
}: {
	message: string;
	uncertain: boolean;
}) {
	if (!message) {
		return null;
	}
	return uncertain ? (
		<StatusMessage tone="warning">{message}</StatusMessage>
	) : (
		<p role="status">{message}</p>
	);
}
