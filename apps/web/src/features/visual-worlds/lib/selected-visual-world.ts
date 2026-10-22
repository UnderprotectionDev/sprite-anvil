import type { ProjectContextScopeCatalog } from "@sprite-anvil/api/context-scopes";

export type VisualWorlds = ProjectContextScopeCatalog["visualWorlds"];

export function resolveSelectedVisualWorldId(
	chosenId: string,
	visualWorlds: VisualWorlds
) {
	return (
		visualWorlds.find((visualWorld) => visualWorld.id === chosenId)?.id ??
		visualWorlds[0]?.id ??
		""
	);
}
