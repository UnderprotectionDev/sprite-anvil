import type {
	ProjectContextScopeStore,
	ThemeRecord,
	VisualWorldRecord,
} from "@sprite-anvil/api/context-scopes";
import {
	projectContextScopeCatalogSchema,
	themeRecordSchema,
	visualWorldRecordSchema,
} from "@sprite-anvil/api/context-scopes";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { themes, visualWorlds } from "@sprite-anvil/db/schema/context-scopes";
import { and, asc, eq } from "drizzle-orm";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function toVisualWorldRecord(
	record: typeof visualWorlds.$inferSelect
): VisualWorldRecord {
	return visualWorldRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		name: record.name,
		description: record.description,
		createdAt: toISOString(record.createdAt),
	});
}

function toThemeRecord(record: typeof themes.$inferSelect): ThemeRecord {
	return themeRecordSchema.parse({
		id: record.id,
		projectId: record.projectId,
		visualWorldId: record.visualWorldId,
		name: record.name,
		description: record.description,
		createdAt: toISOString(record.createdAt),
	});
}

export function createProjectContextScopeStore(
	db: Database
): ProjectContextScopeStore {
	return {
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const [worldRows, themeRows] = await Promise.all([
				db
					.select()
					.from(visualWorlds)
					.where(eq(visualWorlds.projectId, projectId))
					.orderBy(asc(visualWorlds.name)),
				db
					.select()
					.from(themes)
					.where(eq(themes.projectId, projectId))
					.orderBy(asc(themes.name)),
			]);

			return projectContextScopeCatalogSchema.parse({
				visualWorlds: worldRows.map(toVisualWorldRecord),
				themes: themeRows.map(toThemeRecord),
			});
		},
		async createVisualWorld(userId, input) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}
			const [record] = await db
				.insert(visualWorlds)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					name: input.name,
					description: input.description ?? "",
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toVisualWorldRecord(record) : null;
		},
		async createTheme(userId, input) {
			const ownedProject = await getProjectForUser(db, userId, input.projectId);
			if (!ownedProject) {
				return null;
			}
			const [visualWorld] = await db
				.select({ id: visualWorlds.id })
				.from(visualWorlds)
				.where(
					and(
						eq(visualWorlds.id, input.visualWorldId),
						eq(visualWorlds.projectId, input.projectId)
					)
				)
				.limit(1);
			if (!visualWorld) {
				return null;
			}

			const [record] = await db
				.insert(themes)
				.values({
					id: crypto.randomUUID(),
					projectId: input.projectId,
					visualWorldId: input.visualWorldId,
					name: input.name,
					description: input.description ?? "",
					createdByUserId: userId,
				})
				.onConflictDoNothing()
				.returning();
			return record ? toThemeRecord(record) : null;
		},
	};
}
