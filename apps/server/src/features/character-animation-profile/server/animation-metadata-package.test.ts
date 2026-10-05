import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import type { DirectionalReviewRecord } from "@sprite-anvil/api/directional-reviews";
import type {
	GameplayMetadataFrame,
	GameplayMetadataRecord,
} from "@sprite-anvil/api/gameplay-metadata";
import { getGameplayMetadataFields } from "@sprite-anvil/api/gameplay-metadata";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { readAnimationMetadataPackageTarget } from "./animation-metadata-package-target";

const projectId = "animation-metadata-project";
const assetRecordId = "animation-metadata-record";
const ownerId = "animation-metadata-owner";
const assetFamilyId = "animation-metadata-family";
const compositeVersionId = "animation-metadata-composite-v1";
const [contract] = specializedProfileContractCatalog;
const timestamp = "2026-10-05T08:00:00.000Z";

function uuid(index: number) {
	return `00000000-0000-4000-8000-${index.toString().padStart(12, "0")}`;
}

function makeAssetVersion(
	index: number
): AssetVersionCatalog["assetVersions"][number] {
	return {
		id: `animation-metadata-asset-${index}`,
		projectId,
		assetFamilyId,
		assetRecordId,
		versionNumber: index + 1,
		contentType: "image/png" as const,
		contentLength: 128 + index,
		contentDigest: (index + 1).toString(16).padStart(64, "0"),
		integrityVerified: true,
		previewUrl: `/api/projects/${projectId}/asset-versions/animation-metadata-asset-${index}/preview`,
		productionEvidence: {
			evidenceLevel: "complete",
			sourceKind: "derived",
			manualImportEvidence: null,
			managedSnapshots: [],
		},
		reviewDisposition: "candidate" as const,
		reviewEvents: [],
		createdAt: timestamp,
	};
}

function makeMetadataRecord(
	assetVersionId: string,
	frameKey: string,
	index: number
): GameplayMetadataRecord {
	const fields = getGameplayMetadataFields(contract).map(
		(definition): GameplayMetadataRecord["fields"][number] => {
			let value: GameplayMetadataRecord["fields"][number]["value"] = null;
			if (definition.id === "pivot") {
				value = { x: 12 + index, y: 24 };
			} else if (definition.id === "event_links") {
				value = [
					{
						id: `hit-${frameKey}`,
						frameKey,
						time: 70 + index,
						extension: { damage: 8 },
					},
				];
			}
			return {
				fieldId:
					definition.id as GameplayMetadataRecord["fields"][number]["fieldId"],
				value,
				unit: definition.unit,
				coordinateSystem: definition.coordinateSystem,
				source:
					value === null
						? { kind: "unknown" as const }
						: { kind: "authored" as const },
			};
		}
	);
	return {
		id: uuid(index + 1),
		projectId,
		assetRecordId,
		assetVersionId,
		frameKey,
		profileId: contract.profileId,
		contractRevisionId: "character@1",
		useContext: "walk",
		createdAt: timestamp,
		contractSnapshot: contract,
		fields,
	};
}

function makeDirectionalReview(
	assetVersions: ReturnType<typeof makeAssetVersion>[],
	framesPerDirection: number,
	index = 0
): DirectionalReviewRecord {
	const directions = ["south", "south-west", "west", "north-west"];
	return {
		id: uuid(100 + index),
		projectId,
		assetFamilyId,
		canonicalDesignId: "animation-metadata-canonical",
		contractRevisionId: "character@1",
		directions: directions.map((direction, directionIndex) => ({
			direction,
			frames: Array.from({ length: framesPerDirection }, (_, frameIndex) => {
				const assetVersion = assetVersions[directionIndex * 2 + frameIndex];
				return {
					assetVersionId: assetVersion?.id ?? "missing-asset-version",
					durationMs: 80 + frameIndex * 15 + directionIndex + index * 10_000,
					region: {
						x: frameIndex * 16 + index * 512,
						y: directionIndex * 16 + index * 512,
						width: 16,
						height: 16,
					},
				};
			}),
		})),
		observations: {
			silhouette: "Stable silhouette",
			proportions: "Stable proportions",
			equipmentSide: "Equipment stays on the same side",
			palette: "Palette is consistent",
			perspective: "Perspective is consistent",
			scale: "Scale is consistent",
			groundContact: "Ground contact is consistent",
		},
		outcome: "consistent",
		rationale: "The selected directions were reviewed together.",
		createdAt: timestamp,
		reviewedByUserId: ownerId,
		canonicalAssetVersionId: assetVersions[0]?.id ?? "missing-asset-version",
		versionPins: assetVersions.map((assetVersion) => ({
			assetVersionId: assetVersion.id,
			contentDigest: assetVersion.contentDigest ?? "0".repeat(64),
		})),
		contractSnapshot: contract,
	};
}

function makeFixture() {
	const assetVersions = Array.from({ length: 8 }, (_, index) =>
		makeAssetVersion(index)
	);
	const directions = ["south", "south-west", "west", "north-west"];
	const unitVersions = directions.flatMap((direction, directionIndex) => {
		const firstAssetVersion = assetVersions[directionIndex * 2];
		const directionUnit = {
			id: `animation-metadata-unit-direction-${directionIndex}`,
			projectId,
			assetRecordId,
			assetVersionId: firstAssetVersion?.id ?? "missing-asset-version",
			sourceAssetVersionId: firstAssetVersion?.id ?? "missing-asset-version",
			unitType: "direction" as const,
			unitKey: direction,
			versionNumber: 1,
			createdAt: timestamp,
		};
		const frameUnits = [0, 1].map((frameIndex) => {
			const assetVersion = assetVersions[directionIndex * 2 + frameIndex];
			return {
				id: `animation-metadata-unit-frame-${directionIndex}-${frameIndex}`,
				projectId,
				assetRecordId,
				assetVersionId: assetVersion?.id ?? "missing-asset-version",
				sourceAssetVersionId: assetVersion?.id ?? "missing-asset-version",
				unitType: "frame" as const,
				unitKey: `${direction}-${frameIndex}`,
				versionNumber: 1,
				createdAt: timestamp,
			};
		});
		return [directionUnit, ...frameUnits];
	});
	const compositionMemberships = unitVersions.map((unitVersion, index) => ({
		id: `animation-metadata-membership-${index}`,
		projectId,
		assetRecordId,
		compositeVersionId,
		unitVersionId: unitVersion.id,
		unitType: unitVersion.unitType,
		unitKey: unitVersion.unitKey,
		createdAt: timestamp,
	}));
	const compositeVersion = {
		id: compositeVersionId,
		projectId,
		assetRecordId,
		versionNumber: 1,
		reviewDisposition: "candidate" as const,
		reviewEvents: [],
		compositionMemberships,
		createdAt: timestamp,
	};
	const frames: GameplayMetadataFrame[] = unitVersions
		.filter((unitVersion) => unitVersion.unitType === "frame")
		.map((unitVersion) => ({
			assetVersionId: unitVersion.assetVersionId,
			frameKey: unitVersion.unitKey,
			sourcePivots: [],
		}));
	const records = frames.map((frame, index) =>
		makeMetadataRecord(frame.assetVersionId, frame.frameKey, index)
	);
	const catalog = {
		assetVersions,
		canonicalDesigns: [],
		unitVersions,
		compositeVersions: [compositeVersion],
	} satisfies AssetVersionCatalog;
	const gameplayMetadata = { frames, records };
	const directionalReviews = [makeDirectionalReview(assetVersions, 2)];
	const animationRecord = {
		id: assetRecordId,
		projectId,
		name: "Animation metadata fixture",
		assetCategory: "character_creature_animation",
		availability: "active",
	};
	const context = {
		session: { user: { id: ownerId } },
		readAnimationMetadataPackageTarget,
		assetRecordStore: {
			get: async (
				userId: string,
				requestedProject: string,
				requestedRecord: string
			) =>
				userId === ownerId &&
				requestedProject === projectId &&
				requestedRecord === assetRecordId
					? animationRecord
					: null,
		},
		assetVersionStore: {
			list: async (userId: string, requestedProject: string) =>
				userId === ownerId && requestedProject === projectId
					? structuredClone(catalog)
					: null,
		},
		gameplayMetadataStore: {
			list: async (
				userId: string,
				requestedProject: string,
				requestedRecord: string
			) =>
				userId === ownerId &&
				requestedProject === projectId &&
				requestedRecord === assetRecordId
					? structuredClone(gameplayMetadata)
					: null,
		},
		directionalReviewStore: {
			list: async (
				userId: string,
				requestedProject: string,
				requestedFamily: string
			) =>
				userId === ownerId &&
				requestedProject === projectId &&
				requestedFamily === assetFamilyId
					? structuredClone(directionalReviews)
					: null,
		},
	};
	return {
		context,
		catalog,
		gameplayMetadata,
		directionalReviews,
		assetVersions,
		unitVersions,
		frames,
		compositeVersion,
	};
}

async function invoke(operation: string, request: unknown, context: unknown) {
	const routers = appRouter as unknown as Record<
		string,
		Record<string, unknown>
	>;
	const router = routers.animationMetadataPackage;
	if (!router) {
		throw new Error("Animation Metadata Package API is unavailable");
	}
	return await call(router[operation] as never, request as never, {
		context: context as never,
	});
}

test("packages selected composition metadata with exact version pins and excludes Directional Review data", async () => {
	const { context, directionalReviews } = makeFixture();
	const packageFile = (await invoke(
		"createPackage",
		{ projectId, assetRecordId, compositeVersionId },
		{ ...context, directionalReviewStore: undefined }
	)) as {
		assetVersionPins: Array<{
			id: string;
			versionNumber: number;
			contentDigest: string;
		}>;
		compositeVersion: {
			id: string;
			compositionMemberships: Array<{ unitType: string; unitKey: string }>;
		};
		frames: GameplayMetadataFrame[];
		records: GameplayMetadataRecord[];
	};

	expect(packageFile).toMatchObject({
		format: "sprite-anvil.animation-metadata",
		schemaVersion: "1.0.0",
		compositeVersion: { id: compositeVersionId },
	});
	expect(packageFile.compositeVersion.compositionMemberships).toContainEqual(
		expect.objectContaining({ unitType: "direction", unitKey: "south" })
	);
	expect(packageFile.compositeVersion.compositionMemberships).toContainEqual(
		expect.objectContaining({ unitType: "frame", unitKey: "north-west-1" })
	);
	expect(packageFile.assetVersionPins).toContainEqual(
		expect.objectContaining({
			id: "animation-metadata-asset-7",
			versionNumber: 8,
			contentDigest: "8".padStart(64, "0"),
		})
	);
	expect(packageFile).not.toHaveProperty("directionalFrames");
	expect(packageFile.frames).toContainEqual(
		expect.objectContaining({ frameKey: "north-west-1" })
	);
	expect(packageFile.records).toHaveLength(8);
	expect(packageFile).not.toHaveProperty("directionalReview");
	expect(packageFile).not.toHaveProperty("directionalReviews");
	const reviewFrame = directionalReviews[0]?.directions[0]?.frames[0];
	if (!reviewFrame) {
		throw new Error("Directional Review fixture is missing its first frame");
	}
	expect(JSON.stringify(packageFile)).not.toContain(
		JSON.stringify(reviewFrame)
	);
});

test("rejects an Animation Metadata Package larger than 512 KiB", async () => {
	const fixture = makeFixture();
	const [baseRecord] = fixture.gameplayMetadata.records;
	if (!baseRecord) {
		throw new Error("Animation metadata fixture is missing its first record");
	}
	for (let index = 0; index < 50; index += 1) {
		const record = structuredClone(baseRecord);
		record.id = uuid(200 + index);
		record.fields = record.fields.map((field) =>
			field.fieldId === "event_links"
				? {
						...field,
						value: [
							{
								id: `hit-oversized-${index}`,
								frameKey: record.frameKey,
								time: 120,
								extension: { details: "x".repeat(12_000) },
							},
						],
					}
				: field
		);
		fixture.gameplayMetadata.records.push(record);
	}

	await expect(
		invoke(
			"createPackage",
			{ projectId, assetRecordId, compositeVersionId },
			fixture.context
		)
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		message: "Animasyon Metadata Paketi 512 KiB sınırını aşıyor.",
	});
});

test("rereads an older package after Directional Review changes and one frame is corrected in a newer composition", async () => {
	const fixture = makeFixture();
	const input = { projectId, assetRecordId, compositeVersionId };
	const originalPackage = await invoke("createPackage", input, fixture.context);
	const oldFrameUnit = fixture.unitVersions.find(
		(unitVersion) =>
			unitVersion.unitType === "frame" && unitVersion.unitKey === "south-0"
	);
	if (!oldFrameUnit) {
		throw new Error("Animation metadata fixture is missing its south-0 frame");
	}
	const correctedAssetVersion = makeAssetVersion(8);
	fixture.catalog.assetVersions.push(correctedAssetVersion as never);
	const correctedFrameUnit = {
		...oldFrameUnit,
		id: "animation-metadata-unit-frame-south-0-v2",
		assetVersionId: correctedAssetVersion.id,
		sourceAssetVersionId: oldFrameUnit.assetVersionId,
		versionNumber: oldFrameUnit.versionNumber + 1,
		createdAt: "2026-10-05T09:00:00.000Z",
	};
	fixture.catalog.unitVersions.push(correctedFrameUnit as never);
	const correctedCompositeVersionId = "animation-metadata-composite-v2";
	const correctedMemberships = fixture.compositeVersion.compositionMemberships
		.filter((membership) => membership.unitVersionId !== oldFrameUnit.id)
		.map((membership) => ({
			...membership,
			id: `animation-metadata-membership-v2-${membership.id}`,
			compositeVersionId: correctedCompositeVersionId,
		}));
	correctedMemberships.push({
		id: "animation-metadata-membership-south-0-v2",
		projectId,
		assetRecordId,
		compositeVersionId: correctedCompositeVersionId,
		unitVersionId: correctedFrameUnit.id,
		unitType: "frame",
		unitKey: correctedFrameUnit.unitKey,
		createdAt: "2026-10-05T09:00:00.000Z",
	});
	fixture.catalog.compositeVersions.push({
		...fixture.compositeVersion,
		id: correctedCompositeVersionId,
		versionNumber: 2,
		createdAt: "2026-10-05T09:00:00.000Z",
		compositionMemberships: correctedMemberships,
	} as never);
	fixture.gameplayMetadata.frames.push({
		assetVersionId: correctedAssetVersion.id,
		frameKey: oldFrameUnit.unitKey,
		sourcePivots: [],
	});
	fixture.gameplayMetadata.records.push(
		makeMetadataRecord(correctedAssetVersion.id, oldFrameUnit.unitKey, 8)
	);
	const correctedReviewVersions = [...fixture.assetVersions];
	correctedReviewVersions[0] = correctedAssetVersion;
	fixture.directionalReviews.push(
		makeDirectionalReview(correctedReviewVersions, 2, 1)
	);
	expect(fixture.directionalReviews[1]?.directions[0]?.frames[0]).toMatchObject(
		{
			durationMs: 10_080,
			region: { x: 512, y: 512, width: 16, height: 16 },
		}
	);

	expect(
		await invoke(
			"readPackage",
			{ ...input, package: originalPackage },
			fixture.context
		)
	).toEqual(originalPackage);
	expect(originalPackage).not.toHaveProperty("directionalFrames");
	const correctedPackage = (await invoke(
		"createPackage",
		{
			...input,
			compositeVersionId: correctedCompositeVersionId,
		},
		fixture.context
	)) as {
		assetVersionPins: Array<{ id: string; versionNumber: number }>;
		frames: GameplayMetadataFrame[];
		records: GameplayMetadataRecord[];
	};
	expect(correctedPackage.assetVersionPins).toContainEqual(
		expect.objectContaining({ id: correctedAssetVersion.id, versionNumber: 9 })
	);
	expect(correctedPackage.frames).toContainEqual(
		expect.objectContaining({
			assetVersionId: correctedAssetVersion.id,
			frameKey: "south-0",
		})
	);
	expect(correctedPackage.frames).not.toContainEqual(
		expect.objectContaining({
			assetVersionId: oldFrameUnit.assetVersionId,
			frameKey: "south-0",
		})
	);
	expect(correctedPackage.records).toContainEqual(
		expect.objectContaining({
			assetVersionId: correctedAssetVersion.id,
			frameKey: "south-0",
		})
	);
	expect(correctedPackage.records).not.toContainEqual(
		expect.objectContaining({
			assetVersionId: oldFrameUnit.assetVersionId,
			frameKey: "south-0",
		})
	);
	await expect(
		invoke(
			"readPackage",
			{
				...input,
				compositeVersionId: correctedCompositeVersionId,
				package: originalPackage,
			},
			fixture.context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});

test("rereads an older package after Gameplay Metadata is appended to a selected frame", async () => {
	const fixture = makeFixture();
	const input = { projectId, assetRecordId, compositeVersionId };
	const originalPackage = await invoke("createPackage", input, fixture.context);
	const originalRecord = fixture.gameplayMetadata.records.find(
		(record) => record.frameKey === "south-0"
	);
	if (!originalRecord) {
		throw new Error("Animation metadata fixture is missing its south-0 record");
	}
	fixture.gameplayMetadata.records.push(
		makeMetadataRecord(
			originalRecord.assetVersionId,
			originalRecord.frameKey,
			42
		)
	);

	await expect(
		invoke(
			"readPackage",
			{ ...input, package: originalPackage },
			fixture.context
		)
	).resolves.toEqual(originalPackage);
});

test("rejects an Animation Metadata Package with a changed content digest", async () => {
	const fixture = makeFixture();
	const input = { projectId, assetRecordId, compositeVersionId };
	const packageFile = (await invoke(
		"createPackage",
		input,
		fixture.context
	)) as { contentDigest: string; [key: string]: unknown };
	const alteredDigest = `${packageFile.contentDigest[0] === "0" ? "1" : "0"}${packageFile.contentDigest.slice(1)}`;
	await expect(
		invoke(
			"readPackage",
			{ ...input, package: { ...packageFile, contentDigest: alteredDigest } },
			fixture.context
		)
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
});
