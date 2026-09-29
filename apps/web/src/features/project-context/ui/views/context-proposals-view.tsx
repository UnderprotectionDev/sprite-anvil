import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ProjectContext,
	ProjectContextCreateInput,
} from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@sprite-anvil/ui/components/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import { ContextWorkspace } from "../components/context-proposal-components";
import { ProjectSetupForm } from "../forms/project-setup-form";

import "../components/context-proposals.css";

export function ContextProposalsView() {
	const queryClient = useQueryClient();
	const navigate = useNavigate({ from: "/context-proposals" });
	const { projectId: projectIdFromSearch } = useSearch({
		from: "/_auth/context-proposals",
	});
	const projectsQueryOptions = orpc.projectContexts.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
	});
	const hasProjectIdFromSearch = projectIdFromSearch !== undefined;
	const selectedProject = hasProjectIdFromSearch
		? projectsQuery.data?.find((project) => project.id === projectIdFromSearch)
		: projectsQuery.data?.[0];
	const projectId = selectedProject?.id;
	const scopeQueryOptions = orpc.contextScopes.list.queryOptions({
		input: { projectId: projectId ?? "00000000-0000-4000-8000-000000000000" },
	});
	const scopeQuery = useQuery({
		...scopeQueryOptions,
		enabled: Boolean(projectId),
	});
	const proposalsQueryOptions = orpc.contextProposals.list.queryOptions({
		input: { projectId: projectId ?? "00000000-0000-4000-8000-000000000000" },
	});
	const proposalsQuery = useQuery({
		...proposalsQueryOptions,
		enabled: Boolean(projectId),
	});
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [projectCreateOutcomeUncertain, setProjectCreateOutcomeUncertain] =
		useState(false);
	const [uncertainProjectInput, setUncertainProjectInput] =
		useState<ProjectContextCreateInput | null>(null);
	const [isCheckingProjectOutcome, setIsCheckingProjectOutcome] =
		useState(false);

	const createProject = useMutation({
		mutationFn: (input: ProjectContextCreateInput) =>
			client.projectContexts.create(input),
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
			void navigate({
				to: "/context-proposals",
				search: { projectId: project.id },
				replace: true,
			});
			setProjectFormOpen(false);
			await queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
			});
			await queryClient.invalidateQueries({
				queryKey: orpc.projects.list.queryKey(),
			});
			toast.success("Proje oluşturuldu.");
		},
		onError: (error, input) => {
			if (isWriteOutcomeUncertain(error)) {
				setProjectCreateOutcomeUncertain(true);
				setUncertainProjectInput(input);
			}
		},
	});

	async function checkProjectCreateStatus() {
		setIsCheckingProjectOutcome(true);
		try {
			const result = await projectsQuery.refetch();
			if (result.isError || !result.data) {
				if (!result.isError) {
					toast.error("Proje listesi yenilenemedi. Yeniden deneyin.");
				}
				return;
			}

			const matchingProject = result.data.find(
				(project) =>
					project.name === uncertainProjectInput?.name.trim() &&
					project.generalArtDirection ===
						uncertainProjectInput?.generalArtDirection.trim()
			);
			setProjectCreateOutcomeUncertain(false);
			setUncertainProjectInput(null);
			if (matchingProject) {
				void navigate({
					to: "/context-proposals",
					search: { projectId: matchingProject.id },
					replace: true,
				});
				setProjectFormOpen(false);
				return;
			}
			toast.error(
				"Proje listesi yenilendi; kayıt görünmüyor. Gerekirse işlemi yeniden gönderebilirsiniz."
			);
		} finally {
			setIsCheckingProjectOutcome(false);
		}
	}

	function createProjectFromForm(input: ProjectContextCreateInput) {
		createProject.mutate(input);
	}

	function dismissProjectForm() {
		setProjectFormOpen(false);
	}

	function selectProject(project: ProjectContext) {
		void navigate({
			to: "/context-proposals",
			search: { projectId: project.id },
			replace: true,
		});
	}

	let content: ReactNode;
	if (projectsQuery.isPending) {
		content = (
			<div className="context-message" role="status">
				Projeler yükleniyor…
			</div>
		);
	} else if (projectsQuery.isError) {
		content = (
			<div className="context-message" role="alert">
				<p>Projeler yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.</p>
				<Button
					onClick={() => void projectsQuery.refetch()}
					type="button"
					variant="outline"
				>
					Yeniden dene
				</Button>
			</div>
		);
	} else if (hasProjectIdFromSearch && projectsQuery.data && !selectedProject) {
		content = (
			<div className="context-message" role="alert">
				<p>Bu proje bulunamadı veya bu projeye erişiminiz yok.</p>
				<Link className="context-back-link" to="/projects">
					Projelere dön
				</Link>
			</div>
		);
	} else if (selectedProject) {
		content = (
			<ContextWorkspace
				isProposalsError={proposalsQuery.isError}
				isProposalsPending={proposalsQuery.isPending}
				isScopeError={scopeQuery.isError}
				isScopePending={scopeQuery.isPending}
				onCheckProposalState={async () =>
					(await proposalsQuery.refetch()).isError
				}
				onNewProject={() => {
					setProjectFormOpen(true);
				}}
				onRefreshProposals={() => proposalsQuery.refetch()}
				onRetryProposals={() => void proposalsQuery.refetch()}
				onSelectProject={selectProject}
				project={selectedProject}
				projects={projectsQuery.data ?? []}
				proposals={proposalsQuery.data ?? []}
				scopeCatalog={scopeQuery.data ?? EMPTY_SCOPE_CATALOG}
			/>
		);
	} else {
		content = (
			<ProjectSetupForm
				isCheckingOutcome={isCheckingProjectOutcome}
				isOutcomeUncertain={projectCreateOutcomeUncertain}
				isPending={createProject.isPending}
				onCheckOutcome={() => void checkProjectCreateStatus()}
				onSubmit={createProjectFromForm}
			/>
		);
	}

	return (
		<main className="context-page">
			<div className="context-shell">
				<header className="context-heading">
					<div>
						<Link className="context-back-link" to="/projects">
							← Projelere dön
						</Link>
						<p className="context-kicker">PROJE BAĞLAMI</p>
						<h1>Proje Bağlamı</h1>
						<p className="context-intro">
							Kararları ve gözlenen değişiklikleri, dayanağı görünen kural
							önerilerine dönüştürün.
						</p>
					</div>
					{selectedProject ? (
						<div className="context-stamp">
							<span aria-hidden="true" className="stamp-dot" />
							<div>
								<span className="stamp-label">SEÇİLİ PROJE</span>
								<strong>{selectedProject.name}</strong>
							</div>
						</div>
					) : null}
				</header>
				{content}
				<Dialog
					onOpenChange={(open) => {
						if (!(createProject.isPending || projectCreateOutcomeUncertain)) {
							setProjectFormOpen(open);
						}
					}}
					open={projectFormOpen && Boolean(selectedProject)}
				>
					<DialogContent
						className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-0 sm:max-w-xl"
						showCloseButton={
							!(createProject.isPending || projectCreateOutcomeUncertain)
						}
					>
						<div className="context-page context-dialog-body">
							<DialogHeader className="sr-only">
								<DialogTitle>Yeni proje</DialogTitle>
								<DialogDescription>
									Proje adı ve genel sanat yaklaşımını girin.
								</DialogDescription>
							</DialogHeader>
							<ProjectSetupForm
								isCheckingOutcome={isCheckingProjectOutcome}
								isOutcomeUncertain={projectCreateOutcomeUncertain}
								isPending={createProject.isPending}
								onCancel={
									projectCreateOutcomeUncertain || createProject.isPending
										? undefined
										: dismissProjectForm
								}
								onCheckOutcome={() => void checkProjectCreateStatus()}
								onSubmit={createProjectFromForm}
							/>
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</main>
	);
}

const EMPTY_SCOPE_CATALOG: ProjectContextScopeCatalog = {
	visualWorlds: [],
	themes: [],
};
