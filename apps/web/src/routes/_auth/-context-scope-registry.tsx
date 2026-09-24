import type {
	ProjectContextScopeCatalog,
	ThemeCreateInput,
	VisualWorldCreateInput,
} from "@sprite-anvil/api/context-scopes";
import type { ProjectContext } from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";

export function ScopeRegistryPanel({
	isError,
	isPending,
	project,
	queryError,
	scopeCatalog,
}: {
	isError: boolean;
	isPending: boolean;
	project: ProjectContext;
	queryError?: string;
	scopeCatalog: ProjectContextScopeCatalog;
}) {
	const queryClient = useQueryClient();
	const [visualWorldName, setVisualWorldName] = useState("");
	const [visualWorldDescription, setVisualWorldDescription] = useState("");
	const [themeVisualWorldId, setThemeVisualWorldId] = useState("");
	const [themeName, setThemeName] = useState("");
	const [themeDescription, setThemeDescription] = useState("");
	const [formError, setFormError] = useState<string | null>(null);
	const selectedVisualWorldId =
		scopeCatalog.visualWorlds.find(
			(visualWorld) => visualWorld.id === themeVisualWorldId
		)?.id ??
		scopeCatalog.visualWorlds[0]?.id ??
		"";
	const createVisualWorld = useMutation({
		mutationFn: (input: VisualWorldCreateInput) =>
			client.contextScopes.createVisualWorld(input),
		onSuccess: async () => {
			setVisualWorldName("");
			setVisualWorldDescription("");
			setFormError(null);
			await queryClient.invalidateQueries({
				queryKey: orpc.contextScopes.list.queryKey({
					input: { projectId: project.id },
				}),
			});
			toast.success("Görsel Dünya kaydedildi.");
		},
		onError: (error) => setFormError(error.message),
	});
	const createTheme = useMutation({
		mutationFn: (input: ThemeCreateInput) =>
			client.contextScopes.createTheme(input),
		onSuccess: async () => {
			setThemeName("");
			setThemeDescription("");
			setFormError(null);
			await queryClient.invalidateQueries({
				queryKey: orpc.contextScopes.list.queryKey({
					input: { projectId: project.id },
				}),
			});
			toast.success("Tema kaydedildi.");
		},
		onError: (error) => setFormError(error.message),
	});

	function submitVisualWorld(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		createVisualWorld.mutate({
			projectId: project.id,
			name: visualWorldName,
			description: visualWorldDescription,
		});
	}

	function submitTheme(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		setFormError(null);
		createTheme.mutate({
			projectId: project.id,
			visualWorldId: selectedVisualWorldId,
			name: themeName,
			description: themeDescription,
		});
	}

	return (
		<section
			aria-labelledby="scope-registry-title"
			className="scope-registry context-panel"
		>
			<div className="panel-heading">
				<div>
					<p className="panel-index">KAPSAM KAYITLARI</p>
					<h2 id="scope-registry-title">Görsel Dünyalar ve Temalar</h2>
				</div>
				<span className="scope-registry-count">
					{scopeCatalog.visualWorlds.length} dünya ·{" "}
					{scopeCatalog.themes.length} tema
				</span>
			</div>
			<p className="panel-copy">
				Kayıtları bu Projeye bağlayın. Her Tema bir Görsel Dünya altında yer
				alır; kapsamlı bir kural önerisi bu ilişki zincirini kullanır.
			</p>
			{isPending ? (
				<p className="scope-query-message" role="status">
					Kapsam kayıtları yükleniyor…
				</p>
			) : null}
			{isError ? (
				<p className="context-error" role="alert">
					Kapsam kayıtları yüklenemedi. {queryError}
				</p>
			) : null}
			<div className="scope-registry-grid">
				<form className="scope-create-form" onSubmit={submitVisualWorld}>
					<h3>Görsel Dünya ekleyin</h3>
					<label className="context-field">
						<span>Görsel Dünya adı</span>
						<input
							maxLength={120}
							onChange={(event) => setVisualWorldName(event.target.value)}
							placeholder="Örn. Yüksek yaylalar"
							required
							value={visualWorldName}
						/>
					</label>
					<label className="context-field">
						<span>Açıklama</span>
						<textarea
							maxLength={1000}
							onChange={(event) =>
								setVisualWorldDescription(event.target.value)
							}
							placeholder="Bu dünyanın ayırt edici bağlamını açıklayın."
							rows={2}
							value={visualWorldDescription}
						/>
					</label>
					<Button
						className="quiet-button"
						disabled={createVisualWorld.isPending || isError}
						type="submit"
					>
						{createVisualWorld.isPending
							? "Kaydediliyor…"
							: "Görsel Dünya ekle"}
					</Button>
				</form>
				<form className="scope-create-form" onSubmit={submitTheme}>
					<h3>Tema ekleyin</h3>
					<label className="context-field">
						<span>Görsel Dünya</span>
						<select
							onChange={(event) => setThemeVisualWorldId(event.target.value)}
							required
							value={selectedVisualWorldId}
						>
							{scopeCatalog.visualWorlds.length ? null : (
								<option value="">Önce bir Görsel Dünya ekleyin</option>
							)}
							{scopeCatalog.visualWorlds.map((visualWorld) => (
								<option key={visualWorld.id} value={visualWorld.id}>
									{visualWorld.name}
								</option>
							))}
						</select>
					</label>
					<label className="context-field">
						<span>Tema adı</span>
						<input
							maxLength={120}
							onChange={(event) => setThemeName(event.target.value)}
							placeholder="Örn. Kış pazarı"
							required
							value={themeName}
						/>
					</label>
					<label className="context-field">
						<span>Açıklama</span>
						<textarea
							maxLength={1000}
							onChange={(event) => setThemeDescription(event.target.value)}
							placeholder="Bu temanın ayırt edici bağlamını açıklayın."
							rows={2}
							value={themeDescription}
						/>
					</label>
					<Button
						className="quiet-button"
						disabled={
							createTheme.isPending || isError || !selectedVisualWorldId
						}
						type="submit"
					>
						{createTheme.isPending ? "Kaydediliyor…" : "Tema ekle"}
					</Button>
				</form>
			</div>
			{formError ? (
				<p className="context-error" role="alert">
					{formError}
				</p>
			) : null}
			<div className="scope-record-list">
				{scopeCatalog.visualWorlds.length ? (
					<ul>
						{scopeCatalog.visualWorlds.map((visualWorld) => (
							<li key={visualWorld.id}>
								<strong>{visualWorld.name}</strong>
								{visualWorld.description ? (
									<p>{visualWorld.description}</p>
								) : null}
								{scopeCatalog.themes.some(
									(theme) => theme.visualWorldId === visualWorld.id
								) ? (
									<ul>
										{scopeCatalog.themes
											.filter((theme) => theme.visualWorldId === visualWorld.id)
											.map((theme) => (
												<li key={theme.id}>
													<strong>{theme.name}</strong>
													{theme.description ? (
														<p>{theme.description}</p>
													) : null}
												</li>
											))}
									</ul>
								) : null}
							</li>
						))}
					</ul>
				) : (
					<p className="field-hint">
						Henüz Görsel Dünya yok. Yeni kayıt ekleyerek başlayın.
					</p>
				)}
			</div>
		</section>
	);
}
