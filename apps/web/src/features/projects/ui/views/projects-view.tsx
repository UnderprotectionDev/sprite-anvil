import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sprite-anvil/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { orpc } from "@/utils/orpc";
import type { CreateProjectFormValues } from "../../schemas";
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
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [verificationMessage, setVerificationMessage] = useState<string | null>(
		null
	);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingProjectState, setIsCheckingProjectState] = useState(false);
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
				setIsCreateOpen(false);
				setStatusMessage("Game project saved.");
				await queryClient.invalidateQueries({
					queryKey: projectsQueryOptions.queryKey,
				});
				await queryClient.invalidateQueries({
					queryKey: orpc.projectContexts.list.queryKey(),
				});
			},
			onError: (error) => {
				if (isWriteOutcomeUncertain(error)) {
					setWriteOutcomeUncertain(true);
				}
			},
		})
	);

	async function refreshProjects() {
		setIsCheckingProjectState(true);
		try {
			const result = await projectsQuery.refetch();
			if (result.isError) {
				return;
			}

			if (writeOutcomeUncertain) {
				setWriteOutcomeUncertain(false);
				const savedProject = result.data?.find(
					(project) =>
						project.name === createProjectForm.state.values.name.trim() &&
						!projectIdsBeforeCreate.current.has(project.id)
				);
				if (savedProject) {
					createProjectForm.reset();
					setIsCreateOpen(false);
					setStatusMessage("Game project saved.");
				} else {
					setVerificationMessage(
						"Project list refreshed; the record is not visible. Check the status before resubmitting."
					);
				}
			}
		} finally {
			setIsCheckingProjectState(false);
		}
	}

	function handleCreateProject(input: CreateProjectFormValues) {
		if (writeOutcomeUncertain || createProject.isPending) {
			return;
		}
		setStatusMessage(null);
		setVerificationMessage(null);
		projectIdsBeforeCreate.current = new Set(
			projectsQuery.data?.map((project) => project.id) ?? []
		);
		createProject.mutate(input);
	}

	return (
		<main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
			<header className="mb-10 flex flex-wrap items-end justify-between gap-6">
				<div className="max-w-3xl space-y-3">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Workspace
					</p>
					<h1 className="font-semibold text-4xl sm:text-5xl">Game projects</h1>
					<p className="text-base text-muted-foreground leading-relaxed">
						Continue a project or create a workspace for your new game.
					</p>
				</div>
				<Button
					className="min-h-11 text-sm"
					onClick={() => setIsCreateOpen(true)}
					type="button"
				>
					New game project
				</Button>
			</header>
			<div className="max-w-5xl">
				<section aria-labelledby="projects-heading" className="space-y-5">
					<div className="space-y-1">
						<h2 className="font-semibold text-2xl" id="projects-heading">
							Your projects
						</h2>
						<p className="text-muted-foreground text-sm">
							Open your project to access its assets, collections, and
							permissions.
						</p>
					</div>
					<ProjectsList
						isError={projectsQuery.isError || projectsQuery.isRefetchError}
						isPending={projectsQuery.isPending}
						onCreate={() => setIsCreateOpen(true)}
						onRetry={() => void projectsQuery.refetch()}
						projects={projectsQuery.data ?? []}
					/>
				</section>
				{statusMessage ? (
					<p aria-live="polite" className="mt-5 text-sm" role="status">
						{statusMessage}
					</p>
				) : null}
			</div>
			<Dialog
				onOpenChange={(open) => {
					if (!(createProject.isPending || writeOutcomeUncertain)) {
						setIsCreateOpen(open);
					}
				}}
				open={isCreateOpen}
			>
				<DialogContent
					className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 sm:max-w-lg"
					showCloseButton={!(createProject.isPending || writeOutcomeUncertain)}
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
							disabled={isCheckingProjectState}
							onClick={() => void refreshProjects()}
							type="button"
							variant="outline"
						>
							{isCheckingProjectState ? "Checking status…" : "Check status"}
						</Button>
					) : null}
					{verificationMessage ? (
						<p
							aria-live="polite"
							className="text-muted-foreground text-sm"
							role="status"
						>
							{verificationMessage}
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
	onCreate,
	onRetry,
	projects,
}: {
	isError: boolean;
	isPending: boolean;
	onCreate: () => void;
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
			<div className="space-y-4 rounded-xl border border-dashed bg-card p-8">
				<p className="text-muted-foreground">
					You have no game projects yet. Create your first project to get
					started.
				</p>
				<Button
					className="min-h-11 text-sm"
					onClick={onCreate}
					type="button"
					variant="outline"
				>
					Create first project
				</Button>
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
						className="min-w-0 rounded-xl border bg-card p-5 shadow-sm"
						key={project.id}
					>
						<div className="flex min-w-0 flex-wrap items-center justify-between gap-4">
							<div className="min-w-0">
								<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
									Game project
								</p>
								<h3 className="mt-1 break-words font-semibold text-xl">
									{project.name}
								</h3>
							</div>
							<Link
								aria-label={`${project.name} open Asset Records`}
								className={`${buttonVariants({ variant: "default" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/assets"
							>
								Open Asset Records
							</Link>
						</div>
						<div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
							<Link
								aria-label={`${project.name} open Project Context`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								search={{ projectId: project.id }}
								to="/context-proposals"
							>
								Project Context
							</Link>
							<Link
								aria-label={`${project.name} open Asset Families`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/asset-families"
							>
								Asset Families
							</Link>
							<Link
								aria-label={`${project.name} open Scene QA`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/scene-qa"
							>
								Scene QA
							</Link>
							<Link
								aria-label={`${project.name} manage Collections`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/collections"
							>
								Collections
							</Link>
							<Link
								aria-label={`${project.name} manage permissions`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/access"
							>
								Manage permissions
							</Link>
							<Link
								aria-label={`${project.name} manage Specialized Profile Contracts`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
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
