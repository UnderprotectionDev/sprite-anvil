import { defineRelations } from "drizzle-orm";

import * as schema from "./schema";

export const relations = {
	...defineRelations(schema),
	...schema.authRelations,
	// This relation part includes Project ownership plus Context Revision and Proposal relations.
	...schema.projectContextRelations,
	...schema.assetRecordRelations,
};
