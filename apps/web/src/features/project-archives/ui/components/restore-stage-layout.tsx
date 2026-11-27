import { cn } from "@sprite-anvil/ui/lib/utils";
import { Check, CircleDashed, LoaderCircle, X } from "lucide-react";
import type { ReactNode } from "react";
import type { ProjectCoverRecord } from "@/components/project-cover";
import { ProjectCover } from "@/components/project-cover";

export type RestoreStageStatus =
	| "Current"
	| "Done"
	| "Waiting"
	| "Failed"
	| "Cancelled"
	| "Not run";
export type RestoreStageIndex = 0 | 1 | 2;
const labels = [
	"Select archive",
	"Integrity check",
	"Open new project",
] as const;

export function RestoreStageLayout({
	active,
	cover,
	statuses,
	children,
}: {
	active: RestoreStageIndex;
	cover: ProjectCoverRecord;
	statuses: [RestoreStageStatus, RestoreStageStatus, RestoreStageStatus];
	children: ReactNode;
}) {
	return (
		<div
			className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row lg:items-stretch"
			data-testid="restore-stages"
		>
			{labels.map((label, index) => {
				const status = statuses[index] ?? "Waiting";
				return index === active ? (
					<section
						aria-label={label}
						className={cn(
							"bg-workbench-background ring-workbench-border-strong flex min-w-0 flex-1 flex-col rounded-[4px] p-2 ring-1 ring-inset lg:min-h-[620px]",
							(status === "Failed" || status === "Cancelled") &&
								"ring-workbench-danger/70"
						)}
						key={label}
					>
						<div className="relative min-h-[190px] flex-1 overflow-hidden rounded-[2px] sm:min-h-[220px]">
							<ProjectCover
								className="absolute inset-0 [&_img]:object-[50%_30%]"
								project={cover}
							/>
							<RestoreStatus
								className="absolute top-3 left-3"
								status={status}
							/>
						</div>
						<div className="flex shrink-0 flex-col gap-3 px-4 pt-5 pb-4">
							<h2 className="font-heading text-[clamp(28px,4vw,44px)] leading-[1.1] font-extrabold tracking-tight">
								{label}
							</h2>
							{children}
						</div>
					</section>
				) : (
					<section
						aria-label={label}
						className="bg-workbench-scene relative isolate min-h-24 shrink-0 overflow-hidden rounded-[2px] lg:min-h-0 lg:w-[clamp(108px,12vw,168px)]"
						key={label}
					>
						<ProjectCover
							className={cn(
								"absolute inset-0",
								index === 0 && "[&_img]:object-[30%_50%]",
								index === 1 && "[&_img]:object-[75%_50%]",
								index === 2 && "[&_img]:object-[15%_50%]"
							)}
							project={cover}
						/>
						<div className="bg-workbench-scene/60 absolute inset-0" />
						<RestoreStatus className="absolute top-3 left-3" status={status} />
						<h2 className="font-heading absolute bottom-4 left-5 text-[22px] leading-8 font-bold lg:bottom-7 lg:left-6 lg:rotate-180 lg:text-[28px] lg:[writing-mode:vertical-rl]">
							{label}
						</h2>
					</section>
				);
			})}
		</div>
	);
}

function RestoreStatus({
	status,
	className,
}: {
	status: RestoreStageStatus;
	className?: string;
}) {
	const icons = {
		Done: Check,
		Current: LoaderCircle,
		Failed: X,
		Cancelled: X,
		Waiting: CircleDashed,
		"Not run": CircleDashed,
	};
	const colors = {
		Done: "bg-workbench-success text-workbench-on-action",
		Current: "bg-workbench-focus text-workbench-on-action",
		Failed: "bg-workbench-danger text-workbench-on-action",
		Cancelled: "bg-workbench-danger text-workbench-on-action",
		Waiting: "bg-workbench-utility-hover text-workbench-text",
		"Not run": "bg-workbench-utility-hover text-workbench-text",
	};
	const Icon = icons[status];
	const color = colors[status];
	return (
		<span
			className={cn(
				"flex h-6 items-center gap-1.5 rounded-[2px] px-2 text-[12px] font-bold",
				color,
				className
			)}
		>
			<Icon
				aria-hidden="true"
				className={cn("size-3", status === "Current" && "animate-spin")}
			/>
			{status}
		</span>
	);
}
