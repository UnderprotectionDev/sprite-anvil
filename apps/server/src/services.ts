import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";
import { desktopOrigins, ENV } from "./env.server";
import { createProjectContextStore } from "./project-context-store";

export const db = createDb(ENV);
export const projectContextStore = createProjectContextStore(db);
export const auth = createAuth(ENV, db, desktopOrigins);
