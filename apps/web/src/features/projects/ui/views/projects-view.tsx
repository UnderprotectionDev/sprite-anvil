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
import { type SyntheticEvent, useRef, useState } from "react";

import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { client, orpc } from "@/utils/orpc";
import { CreateProjectForm } from "../forms/create-project-form";

export function ProjectsView() {
	const queryClient = useQueryClient();
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQuery = useQuery({
		...projectsQueryOptions,
	});
	const [name, setName] = useState("");
	const [generalArtDirection, setGeneralArtDirection] = useState("");
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [verificationMessage, setVerificationMessage] = useState<string | null>(
		null
	);
	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [writeOutcomeUncertain, setWriteOutcomeUncertain] = useState(false);
	const [isCheckingProjectState, setIsCheckingProjectState] = useState(false);
	const projectIdsBeforeCreate = useRef<Set<string>>(new Set());
	const createProject = useMutation({
		mutationFn: (input: { name: string; generalArtDirection: string }) =>
			client.projects.create(input),
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
			setName("");
			setGeneralArtDirection("");
			setIsCreateOpen(false);
			setStatusMessage("Oyun projesi kaydedildi.");
			await projectsQuery.refetch();
			await queryClient.invalidateQueries({
				queryKey: orpc.projectContexts.list.queryKey(),
			});
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
				const savedProject = result.data?.find(
					(project) =>
						project.name === name.trim() &&
						!projectIdsBeforeCreate.current.has(project.id)
				);
				if (savedProject) {
					setName("");
					setGeneralArtDirection("");
					setIsCreateOpen(false);
					setStatusMessage("Oyun projesi kaydedildi.");
				} else {
					setVerificationMessage(
						"Proje listesi yenilendi; kayıt görünmüyor. Yeniden göndermeden önce durumu kontrol edin."
					);
				}
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
		setVerificationMessage(null);
		projectIdsBeforeCreate.current = new Set(
			projectsQuery.data?.map((project) => project.id) ?? []
		);
		createProject.mutate({
			name: trimmedName,
			generalArtDirection: trimmedArtDirection,
		});
	}

	return (
		<main className="mx-auto w-full max-w-6xl overflow-y-auto px-4 py-8 sm:px-6 lg:py-12">
			<header className="mb-10 flex flex-wrap items-end justify-between gap-6">
				<div className="max-w-3xl space-y-3">
					<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
						Çalışma alanı
					</p>
					<h1 className="font-semibold text-4xl sm:text-5xl">Oyun projeleri</h1>
					<p className="text-base text-muted-foreground leading-relaxed">
						Bir projeye devam edin veya yeni oyununuz için bir çalışma alanı
						oluşturun.
					</p>
				</div>
				<Button
					className="min-h-11 text-sm"
					onClick={() => setIsCreateOpen(true)}
					type="button"
				>
					Yeni oyun projesi
				</Button>
			</header>
			<div className="max-w-5xl">
				<section aria-labelledby="projects-heading" className="space-y-5">
					<div className="space-y-1">
						<h2 className="font-semibold text-2xl" id="projects-heading">
							Projeleriniz
						</h2>
						<p className="text-muted-foreground text-sm">
							Projenizi açarak varlıklarınıza, koleksiyonlarınıza ve
							izinlerinize ulaşın.
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
						<DialogTitle className="text-2xl">Yeni oyun projesi</DialogTitle>
						<DialogDescription className="text-sm">
							Başlamak için ad ve genel sanat yaklaşımı yeterli. Proje
							hesabınıza özel kaydedilir.
						</DialogDescription>
					</DialogHeader>
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
		return <p aria-live="polite">Projeler yükleniyor…</p>;
	}
	if (isError && projects.length === 0) {
		return (
			<div className="space-y-3 rounded-lg border p-5" role="alert">
				<p>Projeler yüklenemedi. Bağlantıyı kontrol edip yeniden deneyin.</p>
				<Button onClick={onRetry} type="button" variant="outline">
					Yeniden dene
				</Button>
			</div>
		);
	}
	if (projects.length === 0) {
		return (
			<div className="space-y-4 rounded-xl border border-dashed bg-card p-8">
				<p className="text-muted-foreground">
					Henüz bir oyun projeniz yok. İlk projenizi oluşturarak başlayın.
				</p>
				<Button
					className="min-h-11 text-sm"
					onClick={onCreate}
					type="button"
					variant="outline"
				>
					İlk projeyi oluştur
				</Button>
			</div>
		);
	}
	return (
		<div className="space-y-4">
			{isError ? (
				<div className="space-y-3 rounded-lg border p-5" role="alert">
					<p>
						Proje listesi yenilenemedi. Görünen kayıtlar son bilinen durumu
						gösteriyor.
					</p>
					<Button onClick={onRetry} type="button" variant="outline">
						Yeniden dene
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
									Oyun projesi
								</p>
								<h3 className="mt-1 break-words font-semibold text-xl">
									{project.name}
								</h3>
							</div>
							<Link
								aria-label={`${project.name} varlık kayıtlarını aç`}
								className={`${buttonVariants({ variant: "default" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/assets"
							>
								Varlık kayıtlarını aç
							</Link>
						</div>
						<div className="mt-5 grid gap-2 border-t pt-4 sm:grid-cols-2 lg:grid-cols-5">
							<Link
								aria-label={`${project.name} proje bağlamını aç`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								search={{ projectId: project.id }}
								to="/context-proposals"
							>
								Proje Bağlamı
							</Link>
							<Link
								aria-label={`${project.name} varlık ailelerini aç`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/asset-families"
							>
								Varlık Aileleri
							</Link>
							<Link
								aria-label={`${project.name} koleksiyonlarını düzenle`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/collections"
							>
								Koleksiyonlar
							</Link>
							<Link
								aria-label={`${project.name} izinlerini yönet`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/access"
							>
								İzinleri yönet
							</Link>
							<Link
								aria-label={`${project.name} özel profil sözleşmelerini yönet`}
								className={`${buttonVariants({ variant: "outline" })} !text-sm min-h-11`}
								params={{ projectId: project.id }}
								to="/projects/$projectId/profile-contracts"
							>
								Özel profil sözleşmeleri
							</Link>
						</div>
					</li>
				))}
			</ul>
		</div>
	);
}
