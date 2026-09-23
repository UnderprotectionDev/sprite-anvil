import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { ProjectAccessStore } from "./project-access-store";
import type { ProjectContextStore } from "./project-context";

export interface Context {
	db: Database;
	projectAccess: ProjectAccessStore;
	projectContextStore: ProjectContextStore;
	session: Session | null;
}
