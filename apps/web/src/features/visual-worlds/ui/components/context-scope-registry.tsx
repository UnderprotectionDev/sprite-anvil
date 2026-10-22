import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type { ProjectContext } from "@sprite-anvil/api/project-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { orpc } from "@/utils/orpc";
import { useThemeForm, useVisualWorldForm } from "../../hooks/use-scope-forms";
import { resolveSelectedVisualWorldId } from "../../lib/selected-visual-world";
import type { ThemeFormValues, VisualWorldFormValues } from "../../schemas";
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
	const visualWorldForm = useVisualWorldForm(submitVisualWorld);
	const themeForm = useThemeForm(submitTheme);
	const createVisualWorld = useMutation(
		orpc.contextScopes.createVisualWorld.mutationOptions({
			onSuccess: async () => {
				visualWorldForm.reset();
				await queryClient.invalidateQueries({
					queryKey: orpc.contextScopes.list.queryKey({
						input: { projectId: project.id },
					}),
				});
				toast.success("Görsel Dünya kaydedildi.");
			},
		})
	);
	const createTheme = useMutation(
		orpc.contextScopes.createTheme.mutationOptions({
			onSuccess: async () => {
				themeForm.resetField("name");
				themeForm.resetField("description");
				await queryClient.invalidateQueries({
					queryKey: orpc.contextScopes.list.queryKey({
						input: { projectId: project.id },
					}),
				});
				toast.success("Tema kaydedildi.");
			},
		})
	);

	function submitVisualWorld(input: VisualWorldFormValues) {
		createVisualWorld.mutate({ projectId: project.id, ...input });
	}

	function submitTheme(input: ThemeFormValues) {
		createTheme.mutate({
			projectId: project.id,
			visualWorldId: resolveSelectedVisualWorldId(
				input.visualWorldId,
				scopeCatalog.visualWorlds
			),
			name: input.name,
			description: input.description,
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
					form={visualWorldForm}
					isError={isError}
					isPending={createVisualWorld.isPending}
				/>
				<ThemeForm
					form={themeForm}
					isError={isError}
					isPending={createTheme.isPending}
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
