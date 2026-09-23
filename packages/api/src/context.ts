import type { Session } from "@sprite-anvil/auth";
import type { ProjectAccessStore } from "./project-access-store";

export interface Context {
	projectAccess: ProjectAccessStore;
	session: Session | null;
}
