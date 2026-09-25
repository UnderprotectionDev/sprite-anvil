import { Button, buttonVariants } from "@sprite-anvil/ui/components/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";

import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import { CreateProjectForm } from "../forms/create-project-form";

export function ProjectsView() {
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
	});
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingProjectState, setIsCheckingProjectState] = useState(false);
	const createProject = useMutation({
		mutationFn: (input: { name: string; generalArtDirection: string }) =>
			client.projects.create(input),
		onSuccess: async () => {
			setName("");
			setGeneralArtDirection("");
			setStatusMessage("Oyun projesi kaydedildi.");
			await projectsQuery.refetch();
		},
		onError: (error) => {
			if (isWriteOutcomeUncertain(error)) {
				setWriteOutcomeUncertain(true);
			}
		},
	});

	async function refreshProjects() {
		setIsCheckingProjectState(true);
		try {
			const result = await projectsQuery.refetch();
			if (result.isError) {
				return;
			}

			if (writeOutcomeUncertain) {
				setWriteOutcomeUncertain(false);
				setStatusMessage(
					"Proje listesi yenilendi. Kaydı yeniden göndermeden önce mevcut durumu kontrol edin."
				);
			}
		} finally {
			setIsCheckingProjectState(false);
		}
	}

	function handleCreateProject(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		if (writeOutcomeUncertain || createProject.isPending) {
			return;
		}
		const trimmedName = name.trim();
		const trimmedArtDirection = generalArtDirection.trim();
		if (trimmedName.length === 0 || trimmedArtDirection.length === 0) {
			return;
		}
		setStatusMessage(null);
		createProject.mutate({
			name: trimmedName,
			generalArtDirection: trimmedArtDirection,
		});
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
					isSaving={createProject.isPending}
					name={name}
					onGeneralArtDirectionChange={setGeneralArtDirection}
					onNameChange={setName}
					onSubmit={handleCreateProject}
					writeOutcomeUncertain={writeOutcomeUncertain}
				/>
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
					isError={projectsQuery.isError}
					isPending={projectsQuery.isPending}
					projects={projectsQuery.data ?? []}
				/>
			</section>
		</main>
	);
}

function ProjectsList({
	isError,
	isPending,
	projects,
}: {
	isError: boolean;
	isPending: boolean;
	projects: { id: string; name: string }[];
}) {
	if (isPending) {
		return <p aria-live="polite">Projeler yükleniyor…</p>;
	}
	if (isError) {
		return null;
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
					<div className="flex flex-wrap gap-2">
						<Link
							className={buttonVariants({ variant: "outline" })}
							params={{ projectId: project.id }}
							to="/projects/$projectId/asset-families"
						>
							Varlık Aileleri
						</Link>
						<Link
							aria-label={`${project.name} varlık kayıtlarını aç`}
							className={buttonVariants({ variant: "outline" })}
							params={{ projectId: project.id }}
							to="/projects/$projectId/assets"
						>
							Varlık kayıtları
						</Link>
						<Link
							aria-label={`${project.name} izinlerini yönet`}
							className={buttonVariants({ variant: "outline" })}
							params={{ projectId: project.id }}
							to="/projects/$projectId/access"
						>
							İzinleri yönet
						</Link>
					</div>
				</li>
			))}
		</ul>
	);
}
