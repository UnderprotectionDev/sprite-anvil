import type {
	ProviderGenerationRecord,
	ProviderGenerationRecordCreateInput,
	ProviderGenerationRecordCreateResult,
	ProviderGenerationRecordStore,
} from "@sprite-anvil/api/provider-generation-records";
import {
	providerGenerationParameterSnapshotSchema,
	providerGenerationParameterSnapshotSchemaVersion,
	providerGenerationRecordSchema,
} from "@sprite-anvil/api/provider-generation-records";
import { type Database, getProjectForUser } from "@sprite-anvil/db";
import { assetVersions } from "@sprite-anvil/db/schema/asset-versions";
import { providerGenerationRecords } from "@sprite-anvil/db/schema/provider-generation-records";
import { and, asc, eq } from "drizzle-orm";
import { sanitizeProviderGenerationParameters } from "./provider-generation-record";

function toISOString(value: Date | string) {
	return value instanceof Date
		? value.toISOString()
		: new Date(value).toISOString();
}

function mapDimensions(width: number | null, height: number | null) {
	return width === null || height === null ? null : { height, width };
}

function toProviderGenerationRecord(
	row: typeof providerGenerationRecords.$inferSelect
): ProviderGenerationRecord {
	return providerGenerationRecordSchema.parse({
		actualDimensions: mapDimensions(row.actualWidth, row.actualHeight),
		assetRecordId: row.assetRecordId,
		assetVersionId: row.assetVersionId,
		createdAt: toISOString(row.createdAt),
		id: row.id,
		interface: row.interface,
		model: row.model,
		modelVersion: row.modelVersion,
		palette: row.palette,
		parameterSnapshot: row.parameterSnapshot,
		projectId: row.projectId,
		provider: row.provider,
		referenceIds: row.referenceIds,
		requestedDimensions: mapDimensions(row.requestedWidth, row.requestedHeight),
		seed: row.seed,
	});
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}
	if (value && typeof value === "object") {
		return `{${Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

function createParameterSnapshot(input: ProviderGenerationRecordCreateInput) {
	return providerGenerationParameterSnapshotSchema.parse({
		parameters: sanitizeProviderGenerationParameters(input.providerParameters),
		schemaVersion: providerGenerationParameterSnapshotSchemaVersion,
	});
}

function dimensionsToColumns(
	dimensions: ProviderGenerationRecordCreateInput["requestedDimensions"]
) {
	return dimensions
		? { height: dimensions.height, width: dimensions.width }
		: { height: null, width: null };
}

function matchesInput(
	row: typeof providerGenerationRecords.$inferSelect,
	input: ProviderGenerationRecordCreateInput,
	parameterSnapshot: ReturnType<typeof createParameterSnapshot>
) {
	const existing = toProviderGenerationRecord(row);
	return (
		stableJson({
			actualDimensions: existing.actualDimensions,
			interface: existing.interface,
			model: existing.model,
			modelVersion: existing.modelVersion,
			palette: existing.palette,
			parameterSnapshot: existing.parameterSnapshot,
			provider: existing.provider,
			referenceIds: existing.referenceIds,
			requestedDimensions: existing.requestedDimensions,
			seed: existing.seed,
		}) ===
		stableJson({
			actualDimensions: input.actualDimensions,
			interface: input.interface,
			model: input.model,
			modelVersion: input.modelVersion,
			palette: input.palette,
			parameterSnapshot,
			provider: input.provider,
			referenceIds: input.referenceIds,
			requestedDimensions: input.requestedDimensions,
			seed: input.seed,
		})
	);
}

async function readExistingRecord(
	db: Database,
	input: ProviderGenerationRecordCreateInput
) {
	const [row] = await db
		.select()
		.from(providerGenerationRecords)
		.where(
			and(
				eq(providerGenerationRecords.projectId, input.projectId),
				eq(providerGenerationRecords.assetVersionId, input.assetVersionId)
			)
		)
		.limit(1);
	return row ?? null;
}

function toCreateValues(
	userId: string,
	input: ProviderGenerationRecordCreateInput,
	assetRecordId: string,
	parameterSnapshot: ReturnType<typeof createParameterSnapshot>
) {
	const requestedDimensions = dimensionsToColumns(input.requestedDimensions);
	const actualDimensions = dimensionsToColumns(input.actualDimensions);
	return {
		projectId: input.projectId,
		assetRecordId,
		assetVersionId: input.assetVersionId,
		createdByUserId: userId,
		provider: input.provider,
		interface: input.interface,
		model: input.model,
		modelVersion: input.modelVersion,
		requestedWidth: requestedDimensions.width,
		requestedHeight: requestedDimensions.height,
		actualWidth: actualDimensions.width,
		actualHeight: actualDimensions.height,
		referenceIds: input.referenceIds,
		palette: input.palette,
		seed: input.seed,
		parameterSnapshot,
	};
}

async function getConnectedProviderTarget(
	db: Database,
	userId: string,
	input: ProviderGenerationRecordCreateInput
): Promise<
	| { kind: "connected-provider"; assetRecordId: string }
	| { kind: "not-connected-provider" }
	| null
> {
	const ownedProject = await getProjectForUser(db, userId, input.projectId);
	if (!ownedProject) {
		return null;
	}

	const [assetVersion] = await db
		.select({
			assetRecordId: assetVersions.assetRecordId,
			productionSource: assetVersions.productionSource,
		})
		.from(assetVersions)
		.where(
			and(
				eq(assetVersions.projectId, input.projectId),
				eq(assetVersions.id, input.assetVersionId)
			)
		)
		.limit(1);
	if (!assetVersion) {
		return null;
	}
	if (assetVersion.productionSource !== "connected_provider") {
		return { kind: "not-connected-provider" };
	}
	return {
		kind: "connected-provider",
		assetRecordId: assetVersion.assetRecordId,
	};
}

async function createOrReadProviderGenerationRecord(
	db: Database,
	userId: string,
	input: ProviderGenerationRecordCreateInput,
	assetRecordId: string
): Promise<ProviderGenerationRecordCreateResult | null> {
	const parameterSnapshot = createParameterSnapshot(input);
	const existing = await readExistingRecord(db, input);
	if (existing) {
		return matchesInput(existing, input, parameterSnapshot)
			? { kind: "existing", record: toProviderGenerationRecord(existing) }
			: { kind: "conflict" };
	}

	try {
		const [row] = await db
			.insert(providerGenerationRecords)
			.values(toCreateValues(userId, input, assetRecordId, parameterSnapshot))
			.returning();
		return row
			? { kind: "created", record: toProviderGenerationRecord(row) }
			: null;
	} catch (error) {
		const racedRecord = await readExistingRecord(db, input);
		if (!racedRecord) {
			throw error;
		}
		return matchesInput(racedRecord, input, parameterSnapshot)
			? { kind: "existing", record: toProviderGenerationRecord(racedRecord) }
			: { kind: "conflict" };
	}
}

export function createProviderGenerationRecordStore(
	db: Database
): ProviderGenerationRecordStore {
	return {
		async create(
			userId,
			input
		): Promise<ProviderGenerationRecordCreateResult | null> {
			const target = await getConnectedProviderTarget(db, userId, input);
			if (!target) {
				return null;
			}
			if (target.kind === "not-connected-provider") {
				return target;
			}
			return createOrReadProviderGenerationRecord(
				db,
				userId,
				input,
				target.assetRecordId
			);
		},
		async list(userId, projectId) {
			const ownedProject = await getProjectForUser(db, userId, projectId);
			if (!ownedProject) {
				return null;
			}
			const rows = await db
				.select()
				.from(providerGenerationRecords)
				.where(eq(providerGenerationRecords.projectId, projectId))
				.orderBy(
					asc(providerGenerationRecords.createdAt),
					asc(providerGenerationRecords.id)
				);
			return rows.map(toProviderGenerationRecord);
		},
	};
}
