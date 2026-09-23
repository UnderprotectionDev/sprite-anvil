import type {
	ProjectContext,
	ProjectContextCreateInput,
} from "@sprite-anvil/api/project-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";
import {
	ContextWorkspace,
	ProjectSetupForm,
} from "./-context-proposal-components";

import "./context-proposals.css";

export const Route = createFileRoute("/_auth/context-proposals")({
	component: ContextProposalsPage,
});

function ContextProposalsPage() {
	const queryClient = useQueryClient();
	const projectsQuery = useQuery(orpc.projectContexts.list.queryOptions());
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const selectedProject =
		projectsQuery.data?.find((project) => project.id === selectedProjectId) ??
		projectsQuery.data?.[0];
	const projectId = selectedProject?.id;
	const proposalsQuery = useQuery({
		...orpc.contextProposals.list.queryOptions({
			input: { projectId: projectId ?? "00000000-0000-4000-8000-000000000000" },
		}),
		enabled: Boolean(projectId),
	});
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [projectError, setProjectError] = useState<string | null>(null);

	const createProject = useMutation({
		mutationFn: (input: ProjectContextCreateInput) =>
			client.projectContexts.create(input),
		onSuccess: async (project) => {
			setSelectedProjectId(project.id);
			setProjectError(null);
			setProjectFormOpen(false);
			await queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
			});
			toast.success("Proje oluşturuldu.");
		},
		onError: (error) => setProjectError(error.message),
	});

	function createProjectFromForm(input: ProjectContextCreateInput) {
		setProjectError(null);
		createProject.mutate(input);
	}

	function dismissProjectForm() {
		setProjectError(null);
		setProjectFormOpen(false);
	}

	function selectProject(project: ProjectContext) {
		setSelectedProjectId(project.id);
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
			<div className="context-message context-error" role="alert">
				Proje Bağlamı yüklenemedi. {projectsQuery.error.message}
			</div>
		);
	} else if (!selectedProject || projectFormOpen) {
		content = (
			<ProjectSetupForm
				error={projectError}
				isPending={createProject.isPending}
				onCancel={selectedProject ? dismissProjectForm : undefined}
				onSubmit={createProjectFromForm}
			/>
		);
	} else {
		content = (
			<ContextWorkspace
				isProposalsError={proposalsQuery.isError}
				isProposalsPending={proposalsQuery.isPending}
				onNewProject={() => {
					setProjectError(null);
					setProjectFormOpen(true);
				}}
				onRefreshProposals={() => proposalsQuery.refetch()}
				onSelectProject={selectProject}
				project={selectedProject}
				projects={projectsQuery.data}
				proposals={proposalsQuery.data ?? []}
				proposalsError={
					proposalsQuery.isError ? proposalsQuery.error.message : undefined
				}
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
