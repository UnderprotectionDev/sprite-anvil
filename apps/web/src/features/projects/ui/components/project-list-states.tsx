import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { DialogTrigger } from "@sprite-anvil/ui/components/dialog";
import type { createDialogHandle } from "@sprite-anvil/ui/lib/dialog-handle";
import { Link } from "@tanstack/react-router";
import {
	BookOpen,
	CircleAlert,
	Copy,
	Package,
	Plus,
	Wrench,
} from "lucide-react";
import { useState } from "react";

const inactiveAreas = [
	{ label: "Library", image: "/account-art-1.png", Icon: BookOpen },
	{ label: "Production", image: "/account-art-3.png", Icon: Wrench },
	{ label: "Delivery", image: "/account-sign-in-art.png", Icon: Package },
] as const;
const skeletonSlices = ["before", "after-one", "after-two"] as const;
const progressBlocks = [
	"a",
	"b",
	"c",
	"d",
	"e",
	"f",
	"g",
	"h",
	"i",
	"j",
	"k",
	"l",
] as const;

export function EmptyProjects({
	handle,
}: {
	handle: ReturnType<typeof createDialogHandle>;
}) {
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row">
			<section className="bg-workbench-background ring-workbench-border-strong flex min-h-[460px] min-w-0 flex-1 flex-col rounded-[4px] p-2 ring-1 ring-inset lg:min-h-0">
				<div className="bg-workbench-scene relative min-h-48 grow overflow-hidden rounded-[2px]">
					<img
						alt="Pixel art workshop"
						className="absolute inset-0 size-full object-cover object-[50%_40%] [image-rendering:pixelated]"
						height={1024}
						src="/account-art-2.png"
						width={1024}
					/>
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-4"
					>
						<span className="border-workbench-text/75 absolute top-0 left-0 size-3.5 border-t-[1.5px] border-l-[1.5px]" />
						<span className="border-workbench-text/75 absolute top-0 right-0 size-3.5 border-t-[1.5px] border-r-[1.5px]" />
						<span className="border-workbench-text/75 absolute bottom-0 left-0 size-3.5 border-b-[1.5px] border-l-[1.5px]" />
						<span className="border-workbench-text/75 absolute right-0 bottom-0 size-3.5 border-r-[1.5px] border-b-[1.5px]" />
					</div>
				</div>
				<div className="flex flex-col gap-4 px-4 py-5">
					<div className="flex items-center gap-3">
						<p className="text-workbench-action font-mono text-[12px] font-semibold tracking-[0.12em] uppercase">
							The workshop is lit
						</p>
						<div className="bg-workbench-border-strong h-px grow" />
					</div>
					<h2 className="font-heading text-[clamp(32px,4vw,56px)] leading-none font-extrabold tracking-tight">
						No projects yet
					</h2>
					<p className="text-workbench-muted-text text-base leading-6">
						Start one with New project, or load an earlier one from Project
						Archive.
					</p>
					<div className="flex flex-wrap gap-2">
						<DialogTrigger
							handle={handle}
							render={
								<Button
									aria-label="Create first project"
									className="h-10 rounded-[4px] pr-4 pl-3.5 font-bold"
								/>
							}
						>
							<Plus className="size-4" /> New project
						</DialogTrigger>
						<Link
							className={`${buttonVariants({ variant: "outline" })} h-10 rounded-[4px] px-4`}
							to="/project-archives"
						>
							Project Archive
						</Link>
					</div>
				</div>
			</section>
			{inactiveAreas.map(({ label, image, Icon }) => (
				<div
					className="border-workbench-border-strong bg-workbench-scene relative hidden w-[clamp(80px,10vw,168px)] shrink-0 overflow-hidden rounded-[4px] border border-dashed lg:block 2xl:w-[168px]"
					key={label}
				>
					<img
						alt=""
						className="absolute inset-0 size-full object-cover [image-rendering:pixelated]"
						height={720}
						src={image}
						width={168}
					/>
					<div className="bg-workbench-scene/62 absolute inset-0" />
					<div className="absolute inset-x-3 top-3 flex items-center gap-2">
						<Icon className="text-workbench-muted-text size-5" />
						<span className="bg-workbench-text/40 h-px grow" />
					</div>
					<div className="absolute bottom-6 left-6 flex rotate-180 gap-2 [writing-mode:vertical-rl]">
						<span className="font-heading text-[26px] font-extrabold">
							{label}
						</span>
						<span className="text-workbench-muted-text text-[13px]">
							Opens with your first project
						</span>
					</div>
				</div>
			))}
		</div>
	);
}

export function LoadingProjects() {
	return (
		<div
			aria-busy="true"
			aria-label="Loading project cards"
			className="flex min-h-0 flex-1 gap-3"
			role="group"
		>
			{[skeletonSlices[0], "active", skeletonSlices[1], skeletonSlices[2]].map(
				(key) =>
					key === "active" ? (
						<div
							className="bg-workbench-strip ring-workbench-border-strong flex min-w-0 flex-1 flex-col rounded-[4px] p-2 ring-1 ring-inset"
							key={key}
						>
							<div className="bg-workbench-preview flex min-h-32 grow items-center justify-center rounded-[2px]">
								<div aria-hidden="true" className="flex gap-[3px]">
									{progressBlocks.map((id, index) => (
										<span
											className={
												index >= 4 && index < 8
													? "bg-workbench-selection h-4 w-2 animate-pulse rounded-[1px] motion-reduce:animate-none"
													: "bg-workbench-control h-4 w-2 rounded-[1px]"
											}
											key={id}
										/>
									))}
								</div>
							</div>
							<div aria-hidden="true" className="space-y-4 px-4 py-5">
								<div className="bg-workbench-panel h-[52px] w-[min(380px,80%)] rounded-[4px]" />
								<div className="flex gap-2">
									<div className="bg-workbench-panel h-10 w-[148px] rounded-[4px]" />
									<div className="bg-workbench-panel h-10 w-[84px] rounded-[4px]" />
								</div>
							</div>
						</div>
					) : (
						<div
							aria-hidden="true"
							className="bg-workbench-strip ring-workbench-border-strong relative hidden w-[clamp(80px,10vw,168px)] shrink-0 rounded-[4px] ring-1 ring-inset lg:block 2xl:w-[168px]"
							key={key}
						>
							<div className="bg-workbench-panel absolute bottom-7 left-6 h-[220px] w-7 rounded-[4px]" />
						</div>
					)
			)}
		</div>
	);
}

export function ProjectLoadFailure({
	onRetry,
	supportReference,
}: {
	onRetry: () => void;
	supportReference?: string;
}) {
	const [copyStatus, setCopyStatus] = useState("");
	return (
		<div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto pb-12">
			<section
				className="bg-workbench-danger-wash ring-workbench-danger w-full max-w-[560px] overflow-hidden rounded-[4px] ring-1 ring-inset"
				role="alert"
			>
				<div className="flex flex-col gap-4 px-7 pt-7 pb-6">
					<div className="flex items-center gap-3">
						<CircleAlert className="text-workbench-danger size-5" />
						<p className="text-workbench-danger-soft font-mono text-[12px] font-semibold tracking-[0.12em] uppercase">
							Could not load
						</p>
						<span className="bg-workbench-danger/35 h-px grow" />
					</div>
					<h2 className="font-heading text-[32px] leading-[38px] font-extrabold tracking-tight">
						Your projects didn't load
					</h2>
					<p className="text-workbench-muted-text text-[15px] leading-[22px]">
						Something went wrong on our side. Nothing was changed, and your
						projects are safe. Try again, or open the Project Archive to restore
						from a file.
					</p>
					<div className="flex flex-wrap gap-2 pt-1">
						<Button
							className="h-10 rounded-[4px] px-4"
							onClick={onRetry}
							type="button"
						>
							Try again
						</Button>
						<Link
							className={`${buttonVariants({ variant: "outline" })} h-10 rounded-[4px] px-4`}
							to="/project-archives"
						>
							Open Project Archive
						</Link>
					</div>
				</div>
				{supportReference ? (
					<div className="border-workbench-danger/35 flex flex-col gap-2.5 border-t px-7 pt-5 pb-6">
						<p className="text-workbench-faint-text font-mono text-[12px] font-semibold tracking-[0.12em] uppercase">
							Support reference
						</p>
						<div className="border-pixel-edge bg-workbench-preview flex items-center rounded-[4px] border">
							<code className="min-w-0 grow px-3 py-2 text-[14px] break-all">
								{supportReference}
							</code>
							<Button
								className="h-10 rounded-none"
								onClick={() => {
									void navigator.clipboard
										.writeText(supportReference)
										.then(() => setCopyStatus("Copied"))
										.catch(() =>
											setCopyStatus("Copy unavailable; select the reference.")
										);
								}}
								type="button"
								variant="ghost"
							>
								<Copy className="size-4" /> Copy
							</Button>
						</div>
						<p className="text-[13px]" role="status">
							{copyStatus}
						</p>
					</div>
				) : null}
			</section>
		</div>
	);
}
