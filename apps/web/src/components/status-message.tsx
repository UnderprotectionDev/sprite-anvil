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
 * One announcement policy for every status the interface shows:
 * errors interrupt (assertive, `role="alert"`); every other outcome waits for
 * the user to be idle (polite, `role="status"`).
 */
const tones = {
	error: { label: "Error", politeness: "assertive", Icon: XCircleIcon },
	warning: { label: "Warning", politeness: "polite", Icon: AlertTriangleIcon },
	success: { label: "Success", politeness: "polite", Icon: CheckCircle2Icon },
	info: { label: "Note", politeness: "polite", Icon: InfoIcon },
} as const satisfies Record<
	StatusTone,
	{ Icon: unknown; label: string; politeness: "assertive" | "polite" }
>;

export function getStatusPoliteness(tone: StatusTone) {
	return tones[tone].politeness;
}

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
	const { label, politeness, Icon } = tones[tone];
	return (
		<div
			aria-atomic="true"
			aria-live={politeness}
			className={cn("flex items-start gap-2 border p-2 text-sm", className)}
			data-tone={tone}
			role={tone === "error" ? "alert" : "status"}
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
