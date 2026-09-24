import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";

import {
	isWriteOutcomeUncertain,
	QueryRetryButton,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";
import { CreateProjectForm } from "../forms/create-project-form";

export function ProjectsView() {
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
		meta: { errorPresentation: "inline" },
	});
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingProjectState, setIsCheckingProjectState] = useState(false);

	async function refreshProjects() {
		setIsCheckingProjectState(true);
		try {
			const result = await projectsQuery.refetch();
			if (result.isError) {
				if (writeOutcomeUncertain) {
					setErrorMessage(
						"Proje işleminin durumu doğrulanamadı. Yeniden göndermeden önce proje listesini yenileyin."
					);
				}
				return;
			}

			if (writeOutcomeUncertain) {
				setWriteOutcomeUncertain(false);
				setErrorMessage(null);
				setStatusMessage(
					"Proje listesi yenilendi. Kaydı yeniden göndermeden önce mevcut durumu kontrol edin."
				);
			}
		} finally {
			setIsCheckingProjectState(false);
		}
	}

	async function handleCreateProject(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain) {
			return;
		}
		const trimmedName = name.trim();
		const trimmedArtDirection = generalArtDirection.trim();
		if (trimmedName.length === 0 || trimmedArtDirection.length === 0) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			await client.projects.create({
				name: trimmedName,
				generalArtDirection: trimmedArtDirection,
			});
			setName("");
			setGeneralArtDirection("");
			setStatusMessage("Oyun projesi kaydedildi.");
			await projectsQuery.refetch();
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
			setErrorMessage(
				getErrorMessage(
					error,
					"Oyun projesinin sonucu doğrulanamadı. Kaydı kontrol edin."
				)
			);
		} finally {
			setIsSaving(false);
		}
	}

	return (
		<main className="mx-auto w-full max-w-3xl space-y-8 overflow-y-auto px-4 py-8">
			<header className="space-y-2">
				<p className="text-muted-foreground text-sm">Sprite Anvil</p>
				<h1 className="font-bold text-3xl">Oyun projeleri</h1>
				<p className="text-muted-foreground">
					Her proje için dış araçların hangi amaçla ve hangi erişim kapsamıyla
					çalışabileceğini ayrı yönetin.
				</p>
			</header>

			<section
				aria-labelledby="create-project-heading"
				className="space-y-4 rounded-lg border p-5"
			>
				<div>
					<h2 className="font-semibold text-xl" id="create-project-heading">
						Yeni oyun projesi
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						Proje kaydı sizin hesabınızda özel olarak saklanır.
					</p>
				</div>
				<CreateProjectForm
					generalArtDirection={generalArtDirection}
					isSaving={isSaving}
					name={name}
					onGeneralArtDirectionChange={setGeneralArtDirection}
					onNameChange={setName}
					onSubmit={handleCreateProject}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>
				{errorMessage ? <p role="alert">{errorMessage}</p> : null}
				{writeOutcomeUncertain ? (
					<Button
						disabled={isCheckingProjectState}
						onClick={() => void refreshProjects()}
						type="button"
						variant="outline"
					>
						{isCheckingProjectState
							? "Durum kontrol ediliyor…"
							: "Durumu kontrol et"}
					</Button>
				) : null}
				{statusMessage ? (
					<p aria-live="polite" role="status">
						{statusMessage}
					</p>
				) : null}
			</section>

			<section aria-labelledby="projects-heading" className="space-y-4">
				<div>
					<h2 className="font-semibold text-xl" id="projects-heading">
						Projeleriniz
					</h2>
					<p className="mt-1 text-muted-foreground text-sm">
						İzin kayıtları proje adını, amacını, kapsamını ve geri alma durumunu
						korur.
					</p>
				</div>

				<ProjectsList
					errorMessage={
						projectsQuery.isError
							? getErrorMessage(
									projectsQuery.error,
									"Projeler yüklenemedi. Yeniden deneyin.",
									"query"
								)
							: null
					}
					isFetching={projectsQuery.isFetching || isCheckingProjectState}
					isPending={projectsQuery.isPending}
					onRetry={() => void refreshProjects()}
					projects={projectsQuery.data ?? []}
				/>
			</section>
		</main>
	);
}

function ProjectsList({
	errorMessage,
	isFetching,
	isPending,
	onRetry,
	projects,
}: {
	errorMessage: string | null;
	isFetching: boolean;
	isPending: boolean;
	onRetry: () => void;
	projects: { id: string; name: string }[];
}) {
	if (isPending) {
		return <p aria-live="polite">Projeler yükleniyor…</p>;
	}
	if (errorMessage) {
		return (
			<div className="space-y-2">
				<p role="alert">Projeler yüklenemedi: {errorMessage}</p>
				<QueryRetryButton disabled={isFetching} onRetry={onRetry} />
			</div>
		);
	}
	if (projects.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-5 text-muted-foreground">
				Henüz bir oyun projeniz yok. İzinleri yönetmek için önce bir proje
				oluşturun.
			</p>
		);
	}
	return (
		<ul className="space-y-3">
			{projects.map((project) => (
				<li
					className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center"
					key={project.id}
				>
					<div>
						<h3 className="font-medium">{project.name}</h3>
						<p className="text-muted-foreground text-sm">Oyun projesi</p>
					</div>
					<Link
						aria-label={`${project.name} izinlerini yönet`}
						className={buttonVariants({ variant: "outline" })}
						params={{ projectId: project.id }}
						to="/projects/$projectId/access"
					>
						İzinleri yönet
					</Link>
				</li>
			))}
		</ul>
	);
}
