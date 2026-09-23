import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";
import type { ProjectContextStore } from "./project-context";

export interface Context {
	db: Database;
	projectContextStore: ProjectContextStore;
	session: Session | null;
}
