import type { StoredMeasurementDefinition } from "./measurement-definition-storage";
import type { Pseudonymize } from "./measurement-pseudonymize";

/** The part of a Measurement Definition that decides which events belong to it. */
type ScopedDefinition = Pick<
	StoredMeasurementDefinition,
	"ownerUserId" | "scope"
>;

/** The pseudonymous identity of one event; real user and project ids never reach scope matching. */
interface ScopedEvent {
	projectPseudonym: string;
	surface: ScopedDefinition["scope"]["surfaces"][number];
	userPseudonym: string;
}

export type ScopeViolation = "project" | "surface" | "user";

/**
 * The one rule for scope membership (surface, user, project), shared by event
 * recording and measure computation so a stored event is in scope exactly when
 * it would have been accepted. Returns the first violated dimension, or null.
 */
export function createScopeCheck(
	definition: ScopedDefinition,
	pseudonymize: Pseudonymize
): (event: ScopedEvent) => ScopeViolation | null {
	const { projects, surfaces, users } = definition.scope;
	const listedProjects =
		projects.kind === "listed_projects"
			? new Set(projects.projectIds.map((id) => pseudonymize("project", id)))
			: null;
	const ownerPseudonym =
		users === "owner_only"
			? pseudonymize("user", definition.ownerUserId)
			: null;
	return (event) => {
		if (!surfaces.includes(event.surface)) {
			return "surface";
		}
		if (ownerPseudonym && event.userPseudonym !== ownerPseudonym) {
			return "user";
		}
		if (listedProjects && !listedProjects.has(event.projectPseudonym)) {
			return "project";
		}
		return null;
	};
}
