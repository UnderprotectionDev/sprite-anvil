import type {
	ProjectContext,
	ProjectContextCreateInput,
} from "@sprite-anvil/api/project-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
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
	const projectsQueryOptions = orpc.projectContexts.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const [selectedProjectId, setSelectedProjectId] = useState("");
	const selectedProject =
		projectsQuery.data?.find((project) => project.id === selectedProjectId) ??
		projectsQuery.data?.[0];
	const projectId = selectedProject?.id;
	const proposalsQueryOptions = orpc.contextProposals.list.queryOptions({
		input: { projectId: projectId ?? "00000000-0000-4000-8000-000000000000" },
	});
	const proposalsQuery = useQuery({
		...proposalsQueryOptions,
		enabled: Boolean(projectId),
		meta: { errorPresentation: "inline" },
	});
	const [projectFormOpen, setProjectFormOpen] = useState(false);
	const [projectError, setProjectError] = useState<string | null>(null);
	const [projectCreateOutcomeUncertain, setProjectCreateOutcomeUncertain] =
		useState(false);
	const [uncertainProjectInput, setUncertainProjectInput] =
		useState<ProjectContextCreateInput | null>(null);
	const [isCheckingProjectOutcome, setIsCheckingProjectOutcome] =
		useState(false);

	const createProject = useMutation({
		meta: { errorPresentation: "inline" },
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
		onError: (error, input) => {
			if (isWriteOutcomeUncertain(error)) {
				setProjectCreateOutcomeUncertain(true);
				setUncertainProjectInput(input);
			}
			setProjectError(
				getErrorMessage(
					error,
					"Oyun projesinin sonucu doğrulanamadı. Kaydı kontrol edin."
				)
			);
		},
	});

	async function checkProjectCreateStatus() {
		setIsCheckingProjectOutcome(true);
		try {
			const result = await projectsQuery.refetch();
			if (result.isError || !result.data) {
				setProjectError(
					result.error
						? getErrorMessage(
								result.error,
								"Proje listesi yenilenemedi. Yeniden deneyin.",
								"query"
							)
						: "Proje listesi yenilenemedi. Yeniden deneyin."
				);
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
			setProjectError(null);
			if (matchingProject) {
				setSelectedProjectId(matchingProject.id);
				setProjectFormOpen(false);
				return;
			}
			setProjectError(
				"Proje listesi yenilendi; kayıt görünmüyor. Gerekirse işlemi yeniden gönderebilirsiniz."
			);
		} finally {
			setIsCheckingProjectOutcome(false);
		}
	}

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
	if (projectsQuery.isPending && !projectFormOpen) {
		content = (
			<div className="context-message" role="status">
				Projeler yükleniyor…
			</div>
		);
	} else if (projectsQuery.isError && !projectFormOpen) {
		content = (
			<div className="context-message context-error">
				<p role="alert">
					Proje Bağlamı yüklenemedi.{" "}
					{getErrorMessage(projectsQuery.error, "Yeniden deneyin.", "query")}
				</p>
				<QueryRetryButton
					disabled={projectsQuery.isFetching}
					onRetry={() => void projectsQuery.refetch()}
				/>
			</div>
		);
	} else if (!selectedProject || projectFormOpen) {
		content = (
			<>
				{projectsQuery.isError ? (
					<div className="context-message context-error">
						<p role="alert">
							Proje listesi yenilenemedi.{" "}
							{getErrorMessage(
								projectsQuery.error,
								"Yeniden deneyin.",
								"query"
							)}
						</p>
						<QueryRetryButton
							disabled={projectsQuery.isFetching}
							onRetry={() => void projectsQuery.refetch()}
						/>
					</div>
				) : null}
				<ProjectSetupForm
					error={projectError}
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
			</>
		);
	} else {
		content = (
			<ContextWorkspace
				isProposalsError={proposalsQuery.isError}
				isProposalsFetching={proposalsQuery.isFetching}
				isProposalsPending={proposalsQuery.isPending}
				onCheckProposalState={async () =>
					(await proposalsQuery.refetch()).isError
				}
				onNewProject={() => {
					setProjectError(null);
					setProjectFormOpen(true);
				}}
				onRefreshProposals={() => proposalsQuery.refetch()}
				onRetryProposals={() => void proposalsQuery.refetch()}
				onSelectProject={selectProject}
				project={selectedProject}
				projects={projectsQuery.data ?? []}
				proposals={proposalsQuery.data ?? []}
				proposalsError={
					proposalsQuery.isError
						? getErrorMessage(
								proposalsQuery.error,
								"Öneriler yüklenemedi. Yeniden deneyin.",
								"query"
							)
						: undefined
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
