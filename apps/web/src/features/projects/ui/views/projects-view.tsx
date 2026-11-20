import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	createDialogHandle,
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@sprite-anvil/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { StatusMessage } from "@/components/status-message";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import {
	CreateProjectForm,
	useCreateProjectForm,
} from "../forms/create-project-form";

export function ProjectsView() {
	const queryClient = useQueryClient();
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
	});
	const createProjectForm = useCreateProjectForm(handleCreateProject);
	const dialogHandleRef = useRef<ReturnType<typeof createDialogHandle>>(null);
	dialogHandleRef.current ??= createDialogHandle();
	const dialogHandle = dialogHandleRef.current;
	const projectIdsBeforeCreate = useRef<Set<string>>(new Set());
	const createProject = useMutation(
		orpc.projects.create.mutationOptions({
			onSuccess: async (project) => {
				queryClient.setQueryData(
					projectsQueryOptions.queryKey,
					(current: typeof projectsQuery.data) => {
						if (current?.some((item) => item.id === project.id)) {
							return current;
						}
						return [...(current ?? []), project];
					}
				);
				createProjectForm.reset();
				dialogHandle.close();
				await queryClient.invalidateQueries({
					queryKey: projectsQueryOptions.queryKey,
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.projectContexts.list.queryKey(),
				});
			},
		})
	);

	const verifyProject = useMutation({
		...mutationMeta,
		mutationFn: async () => {
			const result = await projectsQuery.refetch();
			if (result.isError) {
				throw result.error;
			}
			return Boolean(
				result.data?.some(
					(project) =>
						project.name === createProject.variables?.name &&
						!projectIdsBeforeCreate.current.has(project.id)
				)
			);
		},
		onSuccess: (found) => {
			createProject.reset();
			if (found) {
				createProjectForm.reset();
				dialogHandle.close();
			}
		},
	});
	const writeOutcomeUncertain =
		createProject.isError && isWriteOutcomeUncertain(createProject.error);
	const editorLocked =
		createProject.isPending || writeOutcomeUncertain || verifyProject.isPending;
	const saved = createProject.isSuccess || verifyProject.data === true;

	function handleCreateProject(input: ProjectContextCreateInput) {
		if (editorLocked) {
			return;
		}
		verifyProject.reset();
		projectIdsBeforeCreate.current = new Set(
			projectsQuery.data?.map((project) => project.id) ?? []
		);
		createProject.mutate(input);
	}

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
			<header className="mb-10 flex flex-wrap items-end justify-between gap-6">
				<div className="max-w-3xl space-y-3">
					<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
						Workspace
					</p>
					<h1 className="text-4xl font-semibold sm:text-5xl">Game projects</h1>
					<p className="text-muted-foreground text-base leading-relaxed">
						Continue a project or create a workspace for your new game.
					</p>
				</div>
				<DialogTrigger
					handle={dialogHandle}
					render={<Button className="min-h-11 text-sm" type="button" />}
				>
					New game project
				</DialogTrigger>
			</header>
			<div className="max-w-5xl">
				<section aria-labelledby="projects-heading" className="space-y-5">
					<div className="space-y-1">
						<h2 className="text-2xl font-semibold" id="projects-heading">
							Your projects
						</h2>
						<p className="text-muted-foreground text-sm">
							Open your project to access its assets, collections, and
							permissions.
						</p>
					</div>
					<ProjectsList
						createHandle={dialogHandle}
						isError={projectsQuery.isError || projectsQuery.isRefetchError}
						isPending={projectsQuery.isPending}
						onRetry={() => void projectsQuery.refetch()}
						projects={projectsQuery.data ?? []}
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
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
					showCloseButton={!editorLocked}
				>
					<DialogHeader className="mb-2 gap-2">
						<DialogTitle className="text-2xl">New game project</DialogTitle>
						<DialogDescription className="text-sm">
							A name and general art direction are enough to get started. The
							project is saved privately to your account.
						</DialogDescription>
					</DialogHeader>
					<CreateProjectForm
						form={createProjectForm}
						isSaving={createProject.isPending}
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
					{verifyProject.data === false ? (
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

function ProjectsList({
	isError,
	isPending,
	createHandle,
	onRetry,
	projects,
}: {
	isError: boolean;
	isPending: boolean;
	createHandle: ReturnType<typeof createDialogHandle>;
	onRetry: () => void;
	projects: { id: string; name: string }[];
}) {
	if (isPending) {
		return <p aria-live="polite">Loading projects…</p>;
	}
	if (isError && projects.length === 0) {
		return (
			<div className="space-y-3 rounded-lg border p-5">
				<StatusMessage tone="error">
					Could not load projects. Check your connection and try again.
				</StatusMessage>
				<Button onClick={onRetry} type="button" variant="outline">
					Try again
				</Button>
			</div>
		);
	}
	if (projects.length === 0) {
		return (
			<div className="bg-card space-y-4 rounded-xl border border-dashed p-8">
				<p className="text-muted-foreground">
					You have no game projects yet. Create your first project to get
					started.
				</p>
				<DialogTrigger
					handle={createHandle}
					render={
						<Button
							className="min-h-11 text-sm"
							type="button"
							variant="outline"
						/>
					}
				>
					Create first project
				</DialogTrigger>
			</div>
		);
	}
	return (
		<div className="space-y-4">
			{isError ? (
				<div className="space-y-3 rounded-lg border p-5">
					<StatusMessage tone="error">
						Could not refresh the project list. Visible records show the last
						known state.
					</StatusMessage>
					<Button onClick={onRetry} type="button" variant="outline">
						Try again
					</Button>
				</div>
			) : null}
			<ul className="grid gap-4">
				{projects.map((project) => (
					<li
						className="bg-card min-w-0 rounded-xl border p-5 shadow-sm"
						key={project.id}
					>
						<div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
							<div className="min-w-0">
								<p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
									Game project
								</p>
								<h3 className="mt-1 text-xl font-semibold break-words">
									{project.name}
								</h3>
							</div>
							<Link
								aria-label={`${project.name} open Asset Records`}
								className={`${buttonVariants({ variant: "default" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/assets"
							>
								Open Asset Records
							</Link>
						</div>
						<div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
							<Link
								aria-label={`${project.name} open Project Context`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								search={{ projectId: project.id }}
								to="/context-proposals"
							>
								Project Context
							</Link>
							<Link
								aria-label={`${project.name} open Asset Families`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/asset-families"
							>
								Asset Families
							</Link>
							<Link
								aria-label={`${project.name} open Scene QA`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/scene-qa"
							>
								Scene QA
							</Link>
							<Link
								aria-label={`${project.name} manage Collections`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/collections"
							>
								Collections
							</Link>
							<Link
								aria-label={`${project.name} manage permissions`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/access"
							>
								Manage permissions
							</Link>
							<Link
								aria-label={`${project.name} manage Specialized Profile Contracts`}
								className={`${buttonVariants({ variant: "outline" })} min-h-11 !text-sm`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/profile-contracts"
							>
								Specialized Profile Contracts
							</Link>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
