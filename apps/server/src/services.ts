import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { desktopOrigins, ENV } from "./env.server";
import { createProjectAccessStore } from "./features/projects/server/project-access-store";
import { createProjectContextStore } from "./project-context-store";

export const db = createDb(ENV);
export const projectContextStore = createProjectContextStore(db);
export const projectAccess = createProjectAccessStore(db, projectContextStore);
export const auth = createAuth(ENV, db, desktopOrigins);
