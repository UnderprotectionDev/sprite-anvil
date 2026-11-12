import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { emptyHistoryRecords } from "@sprite-anvil/api/project-archive-history";
import type { ProjectArchiveSourceReader } from "@sprite-anvil/api/project-archive-store";
import type { ProjectArchiveSource } from "@sprite-anvil/api/project-archives";
import { appRouter } from "@sprite-anvil/api/routers/index";
import type { Database } from "@sprite-anvil/db";
import type { ProjectArchiveStorage } from "../project-archive-storage";
import { createProjectArchiveStore } from "../project-archive-store";
import { createMemoryProjectArchiveStorage } from "./memory-project-archive-storage";

export const userId = "user-1";
export const projectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01";
export const otherProjectId = "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a02";
export const ids = {
	contextRevision: "11111111-1111-4111-8111-111111111101",
	family: "22222222-2222-4222-8222-222222222201",
	record: "33333333-3333-4333-8333-333333333301",
	reference: "44444444-4444-4444-8444-444444444401",
	subject: "55555555-5555-4555-8555-555555555501",
	unit: "66666666-6666-4666-8666-666666666601",
	version1: "77777777-7777-4777-8777-777777777701",
	version2: "77777777-7777-4777-8777-777777777702",
	workingA: "88888888-8888-4888-8888-888888888801",
	workingB: "88888888-8888-4888-8888-888888888802",
	world: "99999999-9999-4999-8999-999999999901",
};
export const digest = (character: string) => character.repeat(64);

export function foundationSource(): ProjectArchiveSource {
	return {
		files: [
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version1,
				byteSize: 120,
				contentType: "image/png",
				fileName: "hero-v1.png",
				kind: "asset_version_file",
				objectKey: "projects/p/versions/v1",
				sha256: digest("a"),
				sourceId: ids.version1,
			},
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				byteSize: 130,
				contentType: "image/png",
				fileName: "hero-v2.png",
				kind: "asset_version_file",
				objectKey: "projects/p/versions/v2",
				sha256: digest("b"),
				sourceId: ids.version2,
			},
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				byteSize: 9_000_000,
				contentType: null,
				fileName: "hero.aseprite",
				kind: "working_file",
				objectKey: "projects/p/snapshots/a",
				sha256: digest("c"),
				sourceId: ids.workingA,
			},
			{
				assetRecordId: ids.record,
				assetVersionId: ids.version2,
				byteSize: 8_000_000,
				contentType: null,
				fileName: "hero-alt.aseprite",
				kind: "working_file",
				objectKey: "projects/p/snapshots/b",
				sha256: digest("d"),
				sourceId: ids.workingB,
			},
		],
		history: emptyHistoryRecords(),
		records: {
			assetFamilies: [
				{
					createdAt: "2026-11-01T10:00:00.000Z",
					id: ids.family,
					name: "Hero",
					subjectIdentityId: ids.subject,
					useContext: "player",
					visualWorldId: ids.world,
				},
			],
			assetRecords: [
				{
					assetCategory: null,
					assetFamilyId: ids.family,
					availability: "active",
					createdAt: "2026-11-01T10:00:00.000Z",
					id: ids.record,
					identityCriteria: ["independent_lifecycle"],
					measurements: {
						atlasDimensions: { confirmed: null, proposal: null },
						cellDimensions: { confirmed: null, proposal: null },
						displayScale: { confirmed: null, proposal: null },
						logicalResolution: { confirmed: null, proposal: null },
						sourceImageDimensions: { confirmed: null, proposal: null },
						visibleContentBounds: { confirmed: null, proposal: null },
					},
					name: "Hero idle",
					supportLevel: "general",
					tags: ["hero"],
					themeId: null,
					visualWorldId: null,
				},
			],
			assetVersions: [
				{
					assetFamilyId: ids.family,
					assetRecordId: ids.record,
					byteSize: 120,
					contentDigest: digest("a"),
					contentType: "image/png",
					createdAt: "2026-11-02T10:00:00.000Z",
					id: ids.version1,
					integrityVerified: true,
					productionSource: "unknown",
					sourceImageDimensions: null,
					sourceKind: "manual_import",
					versionNumber: 1,
				},
				{
					assetFamilyId: ids.family,
					assetRecordId: ids.record,
					byteSize: 130,
					contentDigest: digest("b"),
					contentType: "image/png",
					createdAt: "2026-11-03T10:00:00.000Z",
					id: ids.version2,
					integrityVerified: true,
					productionSource: "unknown",
					sourceImageDimensions: null,
					sourceKind: "external_working_file_edit",
					versionNumber: 2,
				},
			],
			canonicalDesigns: [],
			compositeVersions: [],
			compositionMemberships: [],
			contextRevisions: [
				{
					contractVersion: "context-rule/1.0.0",
					createdAt: "2026-11-01T09:00:00.000Z",
					id: ids.contextRevision,
					revisionNumber: 1,
					rules: [],
					sourceProposalId: null,
					state: "active",
				},
			],
			referenceHistory: [],
			references: [
				{
					assetRecordId: ids.record,
					contextOverrideRationale: null,
					createdAt: "2026-11-03T11:00:00.000Z",
					customPurpose: null,
					forbiddenFeatures: [],
					id: ids.reference,
					notes: null,
					revision: 1,
					role: "style",
					targetVersionId: ids.version1,
					transferredFeatures: ["style"],
					updatedAt: "2026-11-03T11:00:00.000Z",
				},
			],
			relationships: [],
			subjectIdentities: [
				{
					createdAt: "2026-11-01T09:30:00.000Z",
					id: ids.subject,
					name: "Hero",
				},
			],
			unitVersions: [
				{
					assetRecordId: ids.record,
					assetVersionId: ids.version2,
					createdAt: "2026-11-03T10:00:00.000Z",
					id: ids.unit,
					sourceAssetVersionId: ids.version1,
					unitKey: "idle-0",
					unitType: "frame",
					versionNumber: 1,
				},
			],
		},
	};
}

export function setup(
	options: {
		hasAccess?: boolean;
		secretValues?: string[];
		source?: ProjectArchiveSource;
		verifyFile?: (file: { objectKey: string }) => Promise<boolean>;
		wrapStorage?: (storage: ProjectArchiveStorage) => ProjectArchiveStorage;
	} = {}
) {
	let tick = 0;
	const now = () => {
		tick += 1;
		return new Date(Date.UTC(2026, 10, 10, 10, 0, tick));
	};
	const sourceReader: ProjectArchiveSourceReader = {
		read: (_userId, requested) =>
			Promise.resolve(
				requested === projectId ? (options.source ?? foundationSource()) : null
			),
	};
	const storage = createMemoryProjectArchiveStorage();
	const context = {
		projectArchiveStore: createProjectArchiveStore({} as Database, {
			getProjectForUser: (_user: string, requested: string) =>
				Promise.resolve(
					(options.hasAccess ?? true) &&
						[projectId, otherProjectId].includes(requested)
						? { id: requested }
						: null
				),
			now,
			secretValues: () => options.secretValues ?? [],
			sourceReader,
			verifyFile: options.verifyFile,
			storage: options.wrapStorage ? options.wrapStorage(storage) : storage,
		}),
		session: { user: { id: userId } },
	} as unknown as Context;
	return {
		create: (input: Record<string, unknown> = {}) =>
			call(
				appRouter.projectArchives.create,
				{
					idempotencyKey: "key-1",
					projectId,
					workingFileIds: [],
					...input,
				} as never,
				{ context }
			),
		get: (archiveId: string, id = projectId) =>
			call(
				appRouter.projectArchives.get,
				{ archiveId, projectId: id },
				{ context }
			),
		list: (id = projectId) =>
			call(appRouter.projectArchives.list, { projectId: id }, { context }),
	};
}
