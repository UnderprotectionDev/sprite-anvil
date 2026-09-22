import { createAuth } from "@sprite-anvil/auth";
import { createDb } from "@sprite-anvil/db";

import { ENV, desktopOrigins } from "./env.server";

export const db = createDb(ENV);
export const auth = createAuth(ENV, db, desktopOrigins);
