import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@sprite-anvil/ui/components/dialog";
import { createDialogHandle } from "@sprite-anvil/ui/lib/dialog-handle";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useSearch } from "@tanstack/react-router";
import {
	ArrowRight,
	ChevronLeft,
	ChevronRight,
	LayoutGrid,
	List,
	LoaderCircle,
	Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ProjectCover } from "@/components/project-cover";
import { StatusMessage } from "@/components/status-message";
import {
	getSupportReference,
	isWriteOutcomeUncertain,
} from "@/utils/error-notification";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import type { ProjectCoverRecord } from "@/utils/project-cover";
import { projectCoverUrl } from "@/utils/project-cover";
import type { ProjectLook } from "../../lib/project-look";
import { createProjectWithLook } from "../../lib/project-look";
import { ProjectDeletionHistory } from "../components/project-deletion-panel";
import {
	EmptyProjects,
	LoadingProjects,
	ProjectLoadFailure,
} from "../components/project-list-states";
import {
	CreateProjectForm,
	useCreateProjectForm,
} from "../forms/create-project-form";

export function ProjectsView() {
	const queryClient = useQueryClient();
	const search = useSearch({ strict: false });
	const [selectedId, setSelectedId] = useState(() =>
		"selected" in search ? search.selected : undefined
	);
	const requestedLook = useRef<ProjectLook | undefined>(undefined);
	const lastCreateInput = useRef<
		(ProjectContextCreateInput & { requestId: string }) | undefined
	>(undefined);

	const [presentation, setPresentation] = useState<"grid" | "list">("grid");
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const createProjectForm = useCreateProjectForm(handleCreateProject);
	const visibleProjects = projectsQuery.data ?? [];
	const focusIndex = Math.max(
		0,
		visibleProjects.findIndex((project) => project.id === selectedId)
	);
	function moveSelection(offset: number) {
		const next = visibleProjects[focusIndex + offset];
		if (next) {
			setSelectedId(next.id);
		}
	}
	const dialogHandleRef = useRef<ReturnType<typeof createDialogHandle>>(null);
	dialogHandleRef.current ??= createDialogHandle();
	const dialogHandle = dialogHandleRef.current;

	const createOptions = orpc.projects.create.mutationOptions();
	const createProject = useMutation({
		...createOptions,
		mutationFn: (
			input: ProjectContextCreateInput & { requestId: string },
			context
		) => {
			if (requestedLook.current) {
				return createProjectWithLook(input, requestedLook.current);
			}
			if (!createOptions.mutationFn) {
				throw new Error("Project creation unavailable.");
			}
			return createOptions.mutationFn(input, context);
		},
		onSuccess: async (project) => {
			setSelectedId(project.id);
			queryClient.setQueryData(
				projectsQueryOptions.queryKey,
				(current: typeof projectsQuery.data) =>
					current?.some((item) => item.id === project.id)
						? current
						: [...(current ?? []), project]
			);
			await finishCreatedProject();
		},
	});

	const verifyProject = useMutation({
		...mutationMeta,
		mutationFn: async () => {
			const result = await projectsQuery.refetch();
			if (result.isError) {
				throw result.error;
			}
			return (
				result.data?.find(
					(project) =>
						project.id === lastCreateInput.current?.requestId &&
						project.name === lastCreateInput.current?.name &&
						(!requestedLook.current || project.hasPreview)
				) ?? null
			);
		},
		onSuccess: async (found) => {
			createProject.reset();
			if (found) {
				setSelectedId(found.id);
				await finishCreatedProject();
			}
		},
	});
	const writeOutcomeUncertain =
		createProject.isError && isWriteOutcomeUncertain(createProject.error);
	const editorLocked =
		createProject.isPending || writeOutcomeUncertain || verifyProject.isPending;
	const saved = createProject.isSuccess || Boolean(verifyProject.data);

	async function finishCreatedProject() {
		createProjectForm.reset();
		dialogHandle.close();
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: projectsQueryOptions.queryKey,
			}),
			queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
			}),
		]);
	}

	function handleCreateProject(
		input: ProjectContextCreateInput,
		look: ProjectLook | null
	) {
		if (editorLocked) {
			return;
		}
		verifyProject.reset();
		const fallback = visibleProjects[focusIndex];
		const selected =
			look ??
			(fallback && projectCoverUrl(fallback)
				? { project: fallback }
				: undefined);
		requestedLook.current =
			selected && ("file" in selected || projectCoverUrl(selected.project))
				? selected
				: undefined;
		const request = { ...input, requestId: crypto.randomUUID() };
		lastCreateInput.current = request;
		createProject.mutate(request);
	}

	return (
		<main className="bg-workbench-sidebar flex h-full min-h-0 w-full flex-col overflow-hidden px-4 pt-7 pb-8 sm:px-8">
			<ProjectsToolbar
				count={projectsQuery.data?.length}
				createHandle={dialogHandle}
				focusIndex={focusIndex}
				isPending={projectsQuery.isPending}
				onMoveSelection={moveSelection}
				onPresentationChange={setPresentation}
				presentation={presentation}
			/>
			<div className="flex min-h-0 flex-1 flex-col">
				<section
					aria-label="Your projects"
					className="flex min-h-0 flex-1 flex-col"
				>
					<ProjectsList
						createHandle={dialogHandle}
						isError={projectsQuery.isError || projectsQuery.isRefetchError}
						isPending={projectsQuery.isPending}
						onRetry={() => void projectsQuery.refetch()}
						onSelect={setSelectedId}
						presentation={presentation}
						projects={projectsQuery.data ?? []}
						selectedId={selectedId}
						supportReference={getSupportReference(projectsQuery.error)}
					/>
				</section>
				{saved ? (
					<p aria-live="polite" className="mt-5 text-sm" role="status">
						Game project saved.
					</p>
				) : null}
			</div>
			<Dialog
				handle={dialogHandle}
				onOpenChange={(_open, details) => {
					if (editorLocked && details.reason !== "imperative-action") {
						details.cancel();
					}
				}}
			>
				<DialogContent
					className="bg-workbench-background flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-x-hidden overflow-y-auto rounded-[6px] p-0 sm:max-w-[min(1120px,calc(100vw_-_2rem))]"
					showCloseButton={!editorLocked}
				>
					<DialogHeader className="justify-center px-8 pt-6 pb-2">
						<DialogTitle className="font-heading flex items-center gap-[14px] text-[24px] leading-[30px] tracking-tight">
							<Plus className="text-workbench-action size-6" /> New project
						</DialogTitle>
						<DialogDescription className="sr-only">
							A project name is enough to get started. Art direction is
							optional. The project is saved privately to your account.
						</DialogDescription>
					</DialogHeader>
					<CreateProjectForm
						defaultLookId={visibleProjects[focusIndex]?.id}
						form={createProjectForm}
						isSaving={createProject.isPending}
						projects={projectsQuery.data ?? []}
						writeOutcomeUncertain={writeOutcomeUncertain}
					/>
					{writeOutcomeUncertain ? (
						<Button
							disabled={verifyProject.isPending}
							onClick={() => verifyProject.mutate()}
							type="button"
							variant="outline"
						>
							{verifyProject.isPending ? "Checking status…" : "Check status"}
						</Button>
					) : null}
					{verifyProject.data === null ? (
						<p
							aria-live="polite"
							className="text-muted-foreground text-sm"
							role="status"
						>
							Project list refreshed; the record is not visible. Check the
							status before resubmitting.
						</p>
					) : null}
				</DialogContent>
			</Dialog>
		</main>
	);
}

function ProjectsToolbar({
	count,
	isPending,
	presentation,
	onPresentationChange,
	focusIndex,
	onMoveSelection,
	createHandle,
}: {
	count?: number;
	isPending: boolean;
	presentation: "grid" | "list";
	onPresentationChange: (value: "grid" | "list") => void;
	focusIndex: number;
	onMoveSelection: (offset: number) => void;
	createHandle: ReturnType<typeof createDialogHandle>;
}) {
	return (
		<header className="mb-5 flex shrink-0 flex-wrap items-center gap-3">
			<h1 className="font-heading text-[30px] leading-9 font-bold">Projects</h1>
			{isPending ? (
				<span
					className="border-pixel-edge bg-workbench-preview text-workbench-muted-text flex h-8 items-center gap-2 rounded-[4px] border px-2 text-[13px]"
					role="status"
				>
					<LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
					Loading projects
				</span>
			) : null}
			{count === undefined ? null : (
				<span className="border-pixel-edge bg-workbench-preview flex h-8 min-w-[26px] items-center justify-center rounded-[4px] border px-2.5 font-mono text-[18px] font-medium tracking-[0.04em]">
					{count}
				</span>
			)}
			<div className="grow" />
			{presentation === "grid" && (count ?? 0) > 4 ? (
				<div className="flex gap-1">
					<Button
						aria-label="Previous project"
						className="size-10 rounded-[4px]"
						disabled={focusIndex === 0}
						onClick={() => onMoveSelection(-1)}
						size="icon"
						type="button"
						variant="outline"
					>
						<ChevronLeft />
					</Button>
					<Button
						aria-label="Next project"
						className="size-10 rounded-[4px]"
						disabled={focusIndex >= (count ?? 0) - 1}
						onClick={() => onMoveSelection(1)}
						size="icon"
						type="button"
						variant="outline"
					>
						<ChevronRight />
					</Button>
				</div>
			) : null}
			<div
				aria-label="Project presentation"
				className="border-pixel-edge bg-workbench-preview flex gap-0.5 rounded-[4px] border p-[3px]"
				role="group"
			>
				<Button
					aria-label="Grid view"
					aria-pressed={presentation === "grid"}
					className={
						presentation === "grid"
							? "bevel-nav bg-workbench-nav text-workbench-nav-ink hover:bg-workbench-nav hover:text-workbench-nav-ink h-8 w-10 rounded-[3px]"
							: "text-workbench-muted-text h-8 w-10 rounded-[3px]"
					}
					onClick={() => onPresentationChange("grid")}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<LayoutGrid className="size-4" />
				</Button>
				<Button
					aria-label="List view"
					aria-pressed={presentation === "list"}
					className={
						presentation === "list"
							? "bevel-nav bg-workbench-nav text-workbench-nav-ink hover:bg-workbench-nav hover:text-workbench-nav-ink h-8 w-10 rounded-[3px]"
							: "text-workbench-muted-text h-8 w-10 rounded-[3px]"
					}
					onClick={() => onPresentationChange("list")}
					size="icon-sm"
					type="button"
					variant="ghost"
				>
					<List className="size-4" />
				</Button>
			</div>
			<ProjectDeletionHistory />
			<DialogTrigger
				handle={createHandle}
				render={
					<Button
						className="h-10 rounded-[4px] pr-4 pl-3.5 font-bold"
						type="button"
					/>
				}
			>
				<Plus className="size-4" /> New project
			</DialogTrigger>
		</header>
	);
}

function ProjectsList({
	isError,
	isPending,
	supportReference,
	createHandle,
	onRetry,
	presentation,
	selectedId,
	onSelect,
	projects,
}: {
	isError: boolean;
	isPending: boolean;
	supportReference?: string;
	createHandle: ReturnType<typeof createDialogHandle>;
	onRetry: () => void;
	presentation: "grid" | "list";
	selectedId: string | undefined;
	onSelect: (id: string) => void;
	projects: {
		id: string;
		name: string;
		generalArtDirection?: string;
		previewAssetVersionId?: string | null;
		hasPreview?: boolean;
	}[];
}) {
	const focusAfterSelection = useRef(false);
	const selectedTitle = useRef<HTMLHeadingElement>(null);
	const activeId = projects.some((project) => project.id === selectedId)
		? selectedId
		: projects[0]?.id;
	useEffect(() => {
		if (projects.length > 4 && activeId) {
			selectedTitle.current?.closest("li")?.scrollIntoView?.({
				block: "nearest",
				inline: presentation === "grid" ? "center" : "nearest",
			});
		}
		if (focusAfterSelection.current && activeId) {
			selectedTitle.current?.focus();
			focusAfterSelection.current = false;
		}
	}, [activeId, projects.length, presentation]);
	if (isPending) {
		return <LoadingProjects />;
	}
	if (isError && projects.length === 0) {
		return (
			<ProjectLoadFailure
				onRetry={onRetry}
				supportReference={supportReference}
			/>
		);
	}
	if (projects.length === 0) {
		return <EmptyProjects handle={createHandle} />;
	}
	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3">
			{isError ? (
				<div className="rounded-tag shrink-0 border p-3">
					<StatusMessage tone="error">
						Could not refresh the project list. Visible records show the last
						known state.
					</StatusMessage>
					<Button onClick={onRetry} type="button" variant="outline">
						Try again
					</Button>
				</div>
			) : null}
			<ul
				className={
					presentation === "grid"
						? "flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-y-auto lg:flex-row lg:overflow-x-auto lg:overflow-y-hidden"
						: "flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto"
				}
			>
				{projects.map((project) =>
					activeId === project.id ? (
						<SelectedProjectCard
							crowded={projects.length > 4}
							key={project.id}
							presentation={presentation}
							project={project}
							selectedTitle={selectedTitle}
						/>
					) : (
						<CollapsedProjectCard
							crowded={projects.length > 4}
							key={project.id}
							onSelect={() => {
								focusAfterSelection.current = true;
								onSelect(project.id);
							}}
							presentation={presentation}
							project={project}
						/>
					)
				)}
			</ul>
			{presentation === "grid" && projects.length > 4 ? (
				<div
					aria-label="Project thumbnails"
					className="hidden shrink-0 gap-3 overflow-x-auto px-2 py-1 lg:flex"
					role="group"
				>
					{projects.map((project) => (
						<Button
							aria-label={`Focus ${project.name}`}
							aria-pressed={project.id === activeId}
							className="flex h-auto w-[128px] shrink-0 flex-col items-stretch gap-1 p-0 text-left whitespace-normal"
							key={project.id}
							onClick={() => onSelect(project.id)}
							type="button"
							variant="ghost"
						>
							<ProjectCover
								className={
									project.id === activeId
										? "ring-workbench-selection h-[60px] w-full ring-2"
										: "h-[60px] w-full"
								}
								project={project}
							/>
							<span className="truncate text-[12px] font-normal">
								{project.name}
							</span>
						</Button>
					))}
				</div>
			) : null}
		</div>
	);
}

interface ProjectCardRecord extends ProjectCoverRecord {
	generalArtDirection?: string;
}
function SelectedProjectCard({
	project,
	crowded,
	presentation,
	selectedTitle,
}: {
	project: ProjectCardRecord;
	crowded: boolean;
	presentation: "grid" | "list";
	selectedTitle: React.RefObject<HTMLHeadingElement | null>;
}) {
	return (
		<li
			className={
				presentation === "grid"
					? `bg-workbench-strip ring-workbench-selection flex min-h-80 min-w-0 flex-1 flex-col rounded-[4px] p-2 ring-2 ring-inset lg:min-h-0 ${crowded ? "lg:min-w-[min(592px,70vw)]" : "lg:min-w-[240px] xl:min-w-[360px]"}`
					: "rounded-tag bg-workbench-strip ring-workbench-selection flex min-w-0 shrink-0 flex-col gap-4 p-2 ring-2 ring-inset lg:h-[320px] lg:flex-row lg:gap-6"
			}
			key={project.id}
		>
			<ProjectCover
				className={
					presentation === "grid"
						? "min-h-48 flex-1"
						: "h-48 shrink-0 lg:h-full lg:w-[46%]"
				}
				framed
				project={project}
			/>
			<div
				className={
					presentation === "grid"
						? "flex shrink-0 flex-col gap-[18px] px-4 pt-6 pb-4"
						: "flex min-w-0 flex-1 flex-col justify-center gap-5 p-4"
				}
			>
				<h3
					className="font-heading text-[clamp(28px,4vw,52px)] leading-none font-extrabold tracking-tight break-words"
					ref={selectedTitle}
					tabIndex={-1}
				>
					{project.name}
				</h3>
				{presentation === "list" && project.generalArtDirection ? (
					<p className="text-workbench-muted-text text-base leading-6">
						{project.generalArtDirection}
					</p>
				) : null}
				<div className="flex flex-wrap gap-2">
					<Link
						aria-label={`${project.name} open project`}
						className={`${buttonVariants({ variant: "default", size: "default" })} !h-10 !rounded-[4px]`}
						params={{ projectId: project.id }}
						to="/projects/$projectId/assets"
					>
						Open project <ArrowRight className="size-4" />
					</Link>
					<Link
						className={`${buttonVariants({ variant: "outline" })} !h-10 !rounded-[4px]`}
						params={{ projectId: project.id }}
						to="/projects/$projectId/details"
					>
						Details
					</Link>
				</div>
			</div>
		</li>
	);
}
function CollapsedProjectCard({
	project,
	crowded,
	presentation,
	onSelect,
}: {
	project: ProjectCardRecord;
	crowded: boolean;
	presentation: "grid" | "list";
	onSelect: () => void;
}) {
	return (
		<li
			className={
				presentation === "grid"
					? `border-workbench-border-strong bg-workbench-scene relative min-h-24 shrink-0 overflow-hidden rounded-[4px] border lg:min-h-0 ${crowded ? "lg:w-[120px]" : "lg:w-[clamp(68px,8vw,168px)] xl:w-[168px]"}`
					: "rounded-tag bg-workbench-background shrink-0"
			}
			key={project.id}
		>
			<Button
				aria-label={project.name}
				aria-pressed={false}
				className={
					presentation === "grid"
						? "group rounded-tag relative isolate h-full min-h-24 w-full overflow-hidden p-0 lg:min-h-0"
						: "group relative flex h-20 w-full justify-start gap-5 px-4"
				}
				onClick={onSelect}
				type="button"
				variant="ghost"
			>
				<span
					aria-hidden="true"
					className="group-focus-visible:ring-workbench-focus pointer-events-none absolute inset-0 z-30 rounded-[4px] group-focus-visible:ring-2 group-focus-visible:ring-inset"
				/>
				<ProjectCover
					className={
						presentation === "grid"
							? "absolute inset-0 z-0"
							: "h-14 w-28 shrink-0"
					}
					project={project}
				/>
				{presentation === "grid" ? (
					<span
						aria-hidden="true"
						className="bg-workbench-scene/40 absolute inset-0 z-10"
					/>
				) : null}
				<span
					className={
						presentation === "grid"
							? "font-heading absolute bottom-5 left-5 z-20 text-left text-[26px] leading-8 font-extrabold whitespace-normal lg:max-h-[calc(100%-2rem)] lg:rotate-180 lg:[writing-mode:vertical-rl]"
							: "font-heading grow text-left text-[22px] font-extrabold whitespace-normal"
					}
				>
					{project.name}
				</span>
				{presentation === "list" ? (
					<ChevronRight className="text-workbench-faint-text" />
				) : null}
			</Button>
		</li>
	);
}
