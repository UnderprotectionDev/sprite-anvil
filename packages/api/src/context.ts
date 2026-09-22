import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";

export type Context = {
  session: Session | null;
  db: Database;
};
