import type { ProjectArchive } from "@sprite-anvil/api/project-archives";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
	Archive,
	Check,
	ChevronLeft,
	ChevronRight,
	Download,
	Minus,
	Plus,
	RotateCcw,
	Upload,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProjectCover } from "@/components/project-cover";
import { StatusMessage } from "@/components/status-message";
import { orpc } from "@/utils/orpc";
import { useAccountArchives } from "../../hooks/use-account-archives";
import type { AccountArchive } from "../../lib/archive-summary";
import {
	archiveBytes,
	archiveSectionCount,
	archiveStats,
} from "../../lib/archive-summary";
import { downloadProjectArchive } from "../../lib/download-project-archive";

export function AccountProjectArchivesView() {
	const {
		projects,
		catalogs: archives,
		sources: items,
		loading: pending,
		failed,
	} = useAccountArchives();
	const [selected, setSelected] = useState<string>();
	const active = items.find((item) => item.id === selected) ?? items[0];
	const activeIndex = items.findIndex((item) => item.id === active?.id);

	const [task, setTask] = useState<"create" | "upload">();
	return (
		<main className="bg-workbench-sidebar flex h-full min-h-0 flex-col gap-5 overflow-hidden px-4 py-7 sm:px-8">
			<header className="flex shrink-0 flex-wrap items-center gap-3">
				<h1 className="font-heading text-[30px] font-bold">Project Archive</h1>
				<div className="grow" />
				{items.length > 4 ? (
					<div className="flex gap-1">
						<Button
							aria-label="Previous archive"
							disabled={activeIndex <= 0}
							onClick={() => setSelected(items[activeIndex - 1]?.id)}
							size="icon"
							variant="outline"
						>
							<ChevronLeft />
						</Button>
						<Button
							aria-label="Next archive"
							disabled={activeIndex >= items.length - 1}
							onClick={() => setSelected(items[activeIndex + 1]?.id)}
							size="icon"
							variant="outline"
						>
							<ChevronRight />
						</Button>
					</div>
				) : null}
				<Button
					disabled={!projects.data?.length}
					onClick={() => setTask("upload")}
					type="button"
					variant="outline"
				>
					<Upload /> Upload archive file
				</Button>
				<Button
					disabled={!projects.data?.length}
					onClick={() => setTask("create")}
					type="button"
				>
					<Plus /> Create archive
				</Button>
			</header>
			{task ? (
				<section className="rounded-card border-workbench-divider bg-workbench-strip grid gap-3 border p-5">
					<h2 className="font-heading text-heading-compact">
						Choose a project to{" "}
						{task === "create" ? "archive" : "restore from a file"}
					</h2>
					<div className="flex flex-wrap gap-2">
						{projects.data?.map((project) => (
							<Link
								className={buttonVariants({ variant: "outline" })}
								key={project.id}
								params={{ projectId: project.id }}
								search={{ task: task === "create" ? "create" : "upload" }}
								to="/projects/$projectId/project-archives"
							>
								{project.name}
							</Link>
						))}
					</div>
					<Button
						className="justify-self-start"
						onClick={() => setTask(undefined)}
						type="button"
						variant="ghost"
					>
						Cancel
					</Button>
				</section>
			) : null}
			{pending ? <p role="status">Loading Project Archives…</p> : null}
			{failed ? (
				<div className="flex flex-wrap items-center gap-3">
					<StatusMessage tone="error">
						Could not load all Project Archives.
					</StatusMessage>
					<Button
						onClick={() => {
							void projects.refetch();
							for (const query of archives) {
								if (query.isError) {
									void query.refetch();
								}
							}
						}}
						type="button"
						variant="outline"
					>
						Try again
					</Button>
				</div>
			) : null}
			{!(pending || failed) && items.length === 0 ? (
				<section className="rounded-card border-workbench-border-strong bg-workbench-strip flex min-h-96 flex-col items-center justify-center gap-3 border border-dashed p-8">
					<Archive className="text-workbench-review size-12" />
					<h2 className="font-heading text-heading">No archives yet</h2>
					<p className="text-workbench-muted-text">
						Create an archive or upload a previously downloaded file.
					</p>
				</section>
			) : null}
			{active ? (
				<ArchiveGallery active={active} items={items} onSelect={setSelected} />
			) : null}
		</main>
	);
}

function ArchiveGallery({
	active,
	items,
	onSelect,
}: {
	active: AccountArchive;
	items: AccountArchive[];
	onSelect: (id: string) => void;
}) {
	const selectedCard = useRef<HTMLLIElement>(null);
	useEffect(() => {
		if (!active.id) {
			return;
		}
		selectedCard.current?.scrollIntoView?.({
			block: "nearest",
			inline: "center",
		});
	}, [active.id]);
	const details = useQuery(
		orpc.projectArchives.get.queryOptions({
			input: { projectId: active.projectId, archiveId: active.id },
		})
	);
	const size = archiveBytes(details.data) ?? 0;
	const stats = archiveStats(details.data?.manifest.contents ?? []);
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			<ul className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-x-auto lg:overflow-y-hidden">
				{items.map((item) =>
					item.id === active.id ? (
						<ActiveArchiveCard
							cardRef={selectedCard}
							details={details.data}
							error={details.isError}
							item={item}
							key={item.id}
						/>
					) : (
						<li
							className="bg-workbench-scene relative min-h-24 shrink-0 overflow-hidden rounded-[4px] lg:min-h-0 lg:w-[clamp(100px,12vw,168px)]"
							key={item.id}
						>
							<Button
								aria-label={`${item.projectName} archive ${new Date(item.createdAt).toLocaleString()}`}
								className="relative isolate h-full min-h-24 w-full lg:min-h-0"
								onClick={() => onSelect(item.id)}
								type="button"
								variant="ghost"
							>
								<ProjectCover
									className="absolute inset-0"
									project={archiveCover(item)}
								/>
								<span className="bg-workbench-scene/40 absolute inset-0" />
								<span className="font-heading absolute bottom-6 left-6 text-left text-[28px] leading-8 font-bold lg:rotate-180 lg:[writing-mode:vertical-rl]">
									{item.projectName}
								</span>
								<span className="text-workbench-muted-text absolute bottom-6 left-16 font-mono text-[12px] lg:rotate-180 lg:[writing-mode:vertical-rl]">
									{new Date(item.createdAt).toLocaleDateString()}
								</span>
							</Button>
						</li>
					)
				)}
			</ul>
			<section
				aria-label="Inside this archive"
				className="border-workbench-divider bg-workbench-background flex shrink-0 flex-wrap overflow-hidden rounded-[4px] border lg:grid lg:grid-cols-[minmax(240px,300px)_repeat(5,minmax(0,1fr))]"
			>
				<div className="flex min-w-[220px] grow flex-col gap-1 p-3 pl-5">
					<p className="text-workbench-faint-text font-mono text-[12px] tracking-widest uppercase">
						Inside this archive
					</p>
					<h2 className="font-heading text-[22px] leading-6 font-bold">
						{active.projectName}
					</h2>
					<p className="text-workbench-muted-text font-mono text-[12px]">
						{details.data ? `${(size / 1024 / 1024).toFixed(1)} MB` : "—"} ·
						independent of your projects
					</p>
				</div>
				{stats.map((stat) => (
					<div
						className="border-workbench-divider flex min-w-0 grow items-center gap-2 border-l px-3 py-3"
						key={stat.label}
					>
						<img
							alt=""
							className="size-9 shrink-0"
							height={36}
							src={`/paper-account/${stat.icon}.svg`}
							width={36}
						/>
						<span>
							<span className="block font-mono text-[22px]">
								{details.data ? stat.count : "—"}
							</span>
							<span className="text-workbench-muted-text text-[13px] whitespace-nowrap">
								{stat.label}
							</span>
						</span>
					</div>
				))}
			</section>
		</div>
	);
}

function archiveCover(item: AccountArchive) {
	return {
		id: item.projectId,
		name: item.projectName,
		previewAssetVersionId: item.previewAssetVersionId,
		hasPreview: item.hasPreview,
	};
}
function ActiveArchiveCard({
	item,
	details,
	error,
	cardRef,
}: {
	item: AccountArchive;
	details: ProjectArchive | undefined;
	error: boolean;
	cardRef: React.RefObject<HTMLLIElement | null>;
}) {
	const download = useMutation({
		mutationFn: () => downloadProjectArchive(item.projectId, item.id),
		meta: { errorPresentation: "inline" },
	});
	const files = details?.manifest.files ?? [];
	const size = archiveBytes(details) ?? 0;

	const working = files.some(
		(file) => file.kind === "working_file" && file.presence === "included"
	);
	const runtimeExcluded = files.some(
		(file) =>
			file.kind === "runtime_evidence_file" && file.presence === "excluded"
	);
	return (
		<li
			className="bg-workbench-background ring-workbench-selection/55 flex min-h-[420px] min-w-0 flex-1 flex-col gap-0 rounded-[4px] p-2 ring-1 ring-inset lg:min-h-0 lg:min-w-[min(624px,70vw)]"
			key={item.id}
			ref={cardRef}
		>
			<ProjectCover
				className="min-h-36 flex-1 rounded-[2px]"
				framed
				project={archiveCover(item)}
			/>
			<div className="flex shrink-0 flex-col gap-4 px-4 pt-6 pb-4">
				<div>
					<h2 className="font-heading text-[clamp(28px,4vw,52px)] leading-none font-extrabold tracking-tight">
						{item.projectName}
					</h2>
					<p className="text-workbench-muted-text mt-3 font-mono text-[14px]">
						{new Date(item.createdAt).toLocaleString()}
						{details
							? ` · ${archiveSectionCount(details.manifest.contents, ["assetRecords"])} assets`
							: ""}
					</p>
				</div>
				<div className="flex flex-wrap items-end gap-6">
					<div className="flex grow flex-col gap-2">
						{details ? (
							<>
								<p className="text-workbench-muted-text flex items-center gap-2 text-[14px]">
									{working ? (
										<Check className="text-workbench-success size-4" />
									) : (
										<Minus className="text-workbench-muted-text size-4" />
									)}
									{working
										? "Working files included"
										: "Working files not included"}
								</p>
								<p className="text-workbench-muted-text flex items-center gap-2 text-[14px]">
									<Minus className="text-workbench-warning size-4" />
									{runtimeExcluded
										? "Large runtime evidence left out"
										: "No excluded runtime evidence"}
								</p>
							</>
						) : null}
						<div className="mt-2 flex flex-wrap gap-2">
							<Link
								className={buttonVariants({ variant: "default" })}
								params={{ projectId: item.projectId }}
								search={{ task: "restore", archiveId: item.id }}
								to="/projects/$projectId/project-archives"
							>
								<RotateCcw /> Restore
							</Link>
							<Button
								disabled={!details || download.isPending}
								onClick={() => download.mutate()}
								type="button"
								variant="outline"
							>
								<Download /> Download
							</Button>
						</div>
					</div>
					<div className="w-[212px]">
						<p className="text-workbench-faint-text mb-2 font-mono text-[12px] tracking-widest uppercase">
							Included files
						</p>
						<p className="border-pixel-edge bg-workbench-preview rounded-[4px] border px-4 py-3 text-right font-mono text-[42px] leading-[42px]">
							{details
								? (size / 1024 / 1024).toFixed(size < 1024 * 1024 ? 2 : 1)
								: "—"}
							<span className="text-workbench-muted-text ml-2 text-[16px]">
								MB
							</span>
						</p>
					</div>
				</div>
				{error ? <p role="alert">Could not load archive details.</p> : null}
				{download.isError ? (
					<p role="alert">Could not download archive.</p>
				) : null}
			</div>
		</li>
	);
}
