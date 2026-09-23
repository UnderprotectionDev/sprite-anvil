import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { type SyntheticEvent, useState } from "react";

import { getErrorMessage } from "@/utils/get-error-message";
import { client, orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/projects")({
	component: ProjectsRoute,
});

function ProjectsRoute() {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const [name, setName] = useState("");
	const [isSaving, setIsSaving] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	async function handleCreateProject(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		const trimmedName = name.trim();
		if (trimmedName.length === 0) {
			return;
		}
		setErrorMessage(null);
		setStatusMessage(null);
		setIsSaving(true);
		try {
			await client.projects.create({ name: trimmedName });
			setName("");
			setStatusMessage("Oyun projesi kaydedildi.");
			await projectsQuery.refetch();
		} catch (error) {
			setErrorMessage(
				getErrorMessage(error, "Oyun projesi kaydedilemedi. Yeniden deneyin.")
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
				<form
					className="flex flex-col gap-3 sm:flex-row sm:items-end"
					onSubmit={handleCreateProject}
				>
					<div className="flex-1 space-y-2">
						<Label htmlFor="project-name">Oyun projesi adı</Label>
						<Input
							autoComplete="off"
							id="project-name"
							maxLength={80}
							name="name"
							onChange={(event) => setName(event.target.value)}
							required
							value={name}
						/>
					</div>
					<Button disabled={isSaving || name.trim().length === 0} type="submit">
						{isSaving ? "Kaydediliyor…" : "Proje oluştur"}
					</Button>
				</form>
				{errorMessage ? <p role="alert">{errorMessage}</p> : null}
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
						projectsQuery.isError ? projectsQuery.error.message : null
					}
					isPending={projectsQuery.isPending}
					projects={projectsQuery.data ?? []}
				/>
			</section>
		</main>
	);
}

function ProjectsList({
	errorMessage,
	isPending,
	projects,
}: {
	errorMessage: string | null;
	isPending: boolean;
	projects: { id: string; name: string }[];
}) {
	if (isPending) {
		return <p aria-live="polite">Projeler yükleniyor…</p>;
	}
	if (errorMessage) {
		return <p role="alert">Projeler yüklenemedi: {errorMessage}</p>;
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
					<Button
						aria-label={`${project.name} izinlerini yönet`}
						render={
							<Link
								params={{ projectId: project.id }}
								to="/projects/$projectId/access"
							/>
						}
						variant="outline"
					>
						İzinleri yönet
					</Button>
				</li>
			))}
		</ul>
	);
}
