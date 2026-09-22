import type { Session } from "@sprite-anvil/auth";
import type { Database } from "@sprite-anvil/db";

export interface Context {
	db: Database;
	session: Session | null;
}
