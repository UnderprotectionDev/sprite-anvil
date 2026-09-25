import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type {
	ProjectContext,
	ProjectContextCreateInput,
} from "@sprite-anvil/api/project-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import { ContextWorkspace } from "../components/context-proposal-components";
import { ProjectSetupForm } from "../forms/project-setup-form";

import "../components/context-proposals.css";

export function ContextProposalsView() {
	const queryClient = useQueryClient();
	const projectsQueryOptions = orpc.projectContexts.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
	});
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const selectedProject =
		projectsQuery.data?.find((project) => project.id === selectedProjectId) ??
		projectsQuery.data?.[0];
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
			setSelectedProjectId(project.id);
			setProjectFormOpen(false);
			await queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
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
				setSelectedProjectId(matchingProject.id);
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
		setSelectedProjectId(project.id);
	}

	let content: ReactNode;
	if (projectsQuery.isPending && !projectFormOpen) {
		content = (
			<div className="context-message" role="status">
				Projeler yükleniyor…
			</div>
		);
	} else if (projectsQuery.isError && !projectFormOpen) {
		content = null;
	} else if (!selectedProject || projectFormOpen) {
		content = (
			<ProjectSetupForm
				isCheckingOutcome={isCheckingProjectOutcome}
				isOutcomeUncertain={projectCreateOutcomeUncertain}
				isPending={createProject.isPending}
				onCancel={
					selectedProject && !projectCreateOutcomeUncertain
						? dismissProjectForm
						: undefined
				}
				onCheckOutcome={() => void checkProjectCreateStatus()}
				onSubmit={createProjectFromForm}
			/>
		);
	} else {
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
				onSelectProject={selectProject}
				project={selectedProject}
				projects={projectsQuery.data ?? []}
				proposals={proposalsQuery.data ?? []}
				scopeCatalog={scopeQuery.data ?? EMPTY_SCOPE_CATALOG}
			/>
		);
	}

	return (
		<main className="context-page">
			<div className="context-shell">
				<header className="context-heading">
					<div>
						<p className="context-kicker">SPRITE ANVIL / CONTEXT WORKBENCH</p>
						<h1>Proje Bağlamı</h1>
						<p className="context-intro">
							Kararları ve gözlenen değişiklikleri, dayanağı görünen kural
							önerilerine dönüştürün.
						</p>
					</div>
					<div
						aria-label="Öneri yetkisi"
						className="context-stamp"
						role="group"
					>
						<span aria-hidden="true" className="stamp-dot" />
						<div>
							<span className="stamp-label">ÖNERİ KAYNAĞI</span>
							<strong>Yapılandırılmış kontrol</strong>
						</div>
						<span className="stamp-version">v1.0</span>
					</div>
				</header>
				{content}
			</div>
		</main>
	);
}

const EMPTY_SCOPE_CATALOG: ProjectContextScopeCatalog = {
	visualWorlds: [],
	themes: [],
};
