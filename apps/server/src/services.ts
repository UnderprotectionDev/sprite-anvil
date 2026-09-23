import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";

import { desktopOrigins, ENV } from "./env.server";
import { createProjectAccessStore } from "./project-access-store";

export const db = createDb(ENV);
export const projectAccess = createProjectAccessStore(db);
export const auth = createAuth(ENV, db, desktopOrigins);
