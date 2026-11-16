import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";
import type { ProjectContext } from "@sprite-anvil/api/project-context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
	useThemeForm,
	useVisualWorldForm,
} from "@/features/visual-worlds/hooks/use-scope-forms";
import { resolveSelectedVisualWorldId } from "@/features/visual-worlds/lib/selected-visual-world";
import type {
	ThemeFormValues,
	VisualWorldFormValues,
} from "@/features/visual-worlds/schemas";
import {
	ThemeForm,
	VisualWorldForm,
} from "@/features/visual-worlds/ui/forms/scope-forms";
import { orpc } from "@/utils/orpc";

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
				toast.success("Visual World saved.");
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
				toast.success("Theme saved.");
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
					<p className="panel-index">SCOPE RECORDS</p>
					<h2 id="scope-registry-title">Visual Worlds and Themes</h2>
				</div>
				<span className="scope-registry-count">
					{scopeCatalog.visualWorlds.length} worlds ·{" "}
					{scopeCatalog.themes.length} themes
				</span>
			</div>
			<p className="panel-copy">
				Connect records to this project. Each Theme belongs to a Visual World;
				scoped rule proposals use this relationship chain.
			</p>
			{isPending ? (
				<p className="scope-query-message" role="status">
					Loading scope records…
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
						No Visual Worlds yet. Add a record to get started.
					</p>
				)}
			</div>
		</section>
	);
}
