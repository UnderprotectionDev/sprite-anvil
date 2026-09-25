import type {
	ProjectContextScopeCatalog,
	ThemeCreateInput,
	VisualWorldCreateInput,
} from "@sprite-anvil/api/context-scopes";
import type { ProjectContext } from "@sprite-anvil/api/project-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type SyntheticEvent, useState } from "react";
import { toast } from "sonner";
import { client, orpc } from "@/utils/orpc";
import { ThemeForm, VisualWorldForm } from "../forms/scope-forms";

export function ScopeRegistryPanel({
	isError,
	isPending,
	project,
	scopeCatalog,
}: {
	isError: boolean;
	isPending: boolean;
	project: ProjectContext;
	scopeCatalog: ProjectContextScopeCatalog;
}) {
	const queryClient = useQueryClient();
	const [visualWorldName, setVisualWorldName] = useState("");
	const [visualWorldDescription, setVisualWorldDescription] = useState("");
	const [themeVisualWorldId, setThemeVisualWorldId] = useState("");
	const [themeName, setThemeName] = useState("");
	const [themeDescription, setThemeDescription] = useState("");
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
			await queryClient.invalidateQueries({
				queryKey: orpc.contextScopes.list.queryKey({
					input: { projectId: project.id },
				}),
			});
			toast.success("Görsel Dünya kaydedildi.");
		},
	});
	const createTheme = useMutation({
		mutationFn: (input: ThemeCreateInput) =>
			client.contextScopes.createTheme(input),
		onSuccess: async () => {
			setThemeName("");
			setThemeDescription("");
			await queryClient.invalidateQueries({
				queryKey: orpc.contextScopes.list.queryKey({
					input: { projectId: project.id },
				}),
			});
			toast.success("Tema kaydedildi.");
		},
	});

	function submitVisualWorld(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
		createVisualWorld.mutate({
			projectId: project.id,
			name: visualWorldName,
			description: visualWorldDescription,
		});
	}

	function submitTheme(event: SyntheticEvent<HTMLFormElement>) {
		event.preventDefault();
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
			<div className="scope-registry-grid">
				<VisualWorldForm
					description={visualWorldDescription}
					isError={isError}
					isPending={createVisualWorld.isPending}
					name={visualWorldName}
					onDescriptionChange={setVisualWorldDescription}
					onNameChange={setVisualWorldName}
					onSubmit={submitVisualWorld}
				/>
				<ThemeForm
					description={themeDescription}
					isError={isError}
					isPending={createTheme.isPending}
					name={themeName}
					onDescriptionChange={setThemeDescription}
					onNameChange={setThemeName}
					onSubmit={submitTheme}
					onVisualWorldChange={setThemeVisualWorldId}
					selectedVisualWorldId={selectedVisualWorldId}
					visualWorlds={scopeCatalog.visualWorlds}
				/>
			</div>
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
