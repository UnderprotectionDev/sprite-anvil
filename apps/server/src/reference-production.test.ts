import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import type {
	ReferenceBoardImage,
	ReferenceBoardUpdateInput,
	ReferenceBoardUploadInput,
	ReferenceProductionStore,
} from "@sprite-anvil/api/reference-production";
import { referenceBoardImageSchema } from "@sprite-anvil/api/reference-production";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { Hono } from "hono";
import sharp from "sharp";
import { mountReferenceProductionRoutes } from "./features/reference-production/server/reference-production-routes";

const userId = crypto.randomUUID();
const projectId = crypto.randomUUID();
const assetRecordId = crypto.randomUUID();

function createEntry(input: ReferenceBoardUploadInput): ReferenceBoardImage {
	const createdAt = new Date().toISOString();
	const roleSnapshot = {
		contextOverrideRationale: input.contextOverrideRationale,
		customPurpose: input.customPurpose,
		forbiddenFeatures: input.forbiddenFeatures,
		notes: input.notes,
		role: input.role,
		transferredFeatures: input.transferredFeatures,
	};
	return referenceBoardImageSchema.parse({
		...roleSnapshot,
		assetRecordId: input.assetRecordId,
		conflictFeatures: [],
		contentLength: input.contentLength,
		contentType: input.contentType,
		createdAt,
		fileName: input.fileName,
		history: [{ ...roleSnapshot, recordedAt: createdAt, revision: 1 }],
		id: input.id,
		revision: 1,
		sha256: input.contentDigest,
		sortOrder: 0,
		updatedAt: createdAt,
	});
}

class MemoryReferenceProductionStore implements ReferenceProductionStore {
	readonly images = new Map<string, ReferenceBoardImage>();
	readonly files = new Map<
		string,
		{
			contentLength: number;
			contentType: "image/png" | "image/webp";
			fileName: string;
			objectKey: string;
		}
	>();

	createImage(_userId: string, input: ReferenceBoardUploadInput) {
		const existing = this.images.get(input.id);
		if (existing) {
			return Promise.resolve({
				kind: "existing" as const,
				ok: true as const,
				value: existing,
			});
		}
		const value = createEntry(input);
		this.images.set(input.id, value);
		this.files.set(input.id, {
			contentLength: input.contentLength,
			contentType: input.contentType,
			fileName: input.fileName,
			objectKey: input.objectKey,
		});
		return Promise.resolve({
			kind: "created" as const,
			ok: true as const,
			value,
		});
	}

	getImageFile(
		requestedUserId: string,
		requestedProjectId: string,
		requestedAssetRecordId: string,
		referenceId: string
	) {
		if (
			requestedUserId !== userId ||
			requestedProjectId !== projectId ||
			requestedAssetRecordId !== assetRecordId
		) {
			return Promise.resolve(null);
		}
		return Promise.resolve(this.files.get(referenceId) ?? null);
	}

	listImages() {
		return Promise.resolve([...this.images.values()]);
	}

	updateImage(_requestedUserId: string, input: ReferenceBoardUpdateInput) {
		const existing = this.images.get(input.id);
		if (!existing) {
			return Promise.resolve({
				ok: false as const,
				reason: "not_found" as const,
			});
		}
		const recordedAt = new Date().toISOString();
		const roleSnapshot = {
			contextOverrideRationale: input.contextOverrideRationale,
			customPurpose: input.customPurpose,
			forbiddenFeatures: input.forbiddenFeatures,
			notes: input.notes,
			role: input.role,
			transferredFeatures: input.transferredFeatures,
		};
		const value = referenceBoardImageSchema.parse({
			...existing,
			...roleSnapshot,
			history: [
				...existing.history,
				{ ...roleSnapshot, recordedAt, revision: input.expectedRevision + 1 },
			],
			revision: input.expectedRevision + 1,
			updatedAt: recordedAt,
		});
		this.images.set(input.id, value);
		return Promise.resolve({ ok: true as const, value });
	}
}

function mountTestApp(store: MemoryReferenceProductionStore) {
	const objects = new Map<
		string,
		{ bytes: Uint8Array; contentType: "image/png" | "image/webp" }
	>();
	const app = new Hono();
	mountReferenceProductionRoutes(app, {
		referenceProductionStore: store,
		createId: () => "e786b516-370c-4877-b102-a51ba1aadf30",
		createStorage: () => ({
			delete: (key) => {
				objects.delete(key);
				return Promise.resolve();
			},
			get: (key) => {
				const item = objects.get(key);
				return Promise.resolve(
					item
						? {
								body: new ReadableStream<Uint8Array>({
									start(controller) {
										controller.enqueue(item.bytes.slice());
										controller.close();
									},
								}),
								contentLength: item.bytes.byteLength,
								contentType: item.contentType,
							}
						: null
				);
			},
			put: async (key, body, contentType) => {
				const storedBytes = new Uint8Array(
					await new Response(body).arrayBuffer()
				);
				objects.set(key, { bytes: storedBytes, contentType });
			},
		}),
		getProjectForUser: async (requestedUserId, requestedProjectId) =>
			requestedUserId === userId && requestedProjectId === projectId
				? { id: projectId }
				: null,
		getSession: async () => ({ user: { id: userId } }),
	});
	return { app, objects };
}

test("uploads a reference image and reads its persisted preview through the server boundary", async () => {
	const bytes = new Uint8Array(
		await sharp({
			create: {
				width: 1,
				height: 1,
				channels: 4,
				background: { r: 28, g: 26, b: 24, alpha: 1 },
			},
		})
			.png()
			.toBuffer()
	);
	const store = new MemoryReferenceProductionStore();
	const { app, objects } = mountTestApp(store);
	const id = crypto.randomUUID();
	const metadata = {
		contextOverrideRationale: null,
		customPurpose: null,
		forbiddenFeatures: [
			"identity",
			"style",
			"palette",
			"equipment",
			"composition",
			"theme",
		],
		notes: "Yalnızca yürüyüş pozu.",
		role: "pose",
		transferredFeatures: ["pose"],
	};
	const upload = await app.request(
		`/api/projects/${projectId}/assets/${assetRecordId}/references`,
		{
			method: "POST",
			headers: {
				"content-type": "image/png",
				"idempotency-key": id,
				"x-reference-board-size": String(bytes.byteLength),
				"x-reference-board-file-name": "walking-pose.png",
				"x-reference-board-metadata": Buffer.from(
					JSON.stringify(metadata)
				).toString("base64url"),
			},
			body: bytes,
		}
	);
	const created = referenceBoardImageSchema.parse(await upload.json());

	expect(upload.status).toBe(201);
	expect(created).toMatchObject({ id, notes: metadata.notes, role: "pose" });
	expect(store.images.size).toBe(1);
	expect(objects.size).toBe(1);

	const preview = await app.request(
		`/api/projects/${projectId}/assets/${assetRecordId}/references/${id}/image`
	);
	expect(preview.status).toBe(200);
	expect(new Uint8Array(await preview.arrayBuffer())).toEqual(bytes);
});

test("a prohibition overrides another Reference Role's allowance on the reference board", async () => {
	const store = new MemoryReferenceProductionStore();
	const image = referenceBoardImageSchema.parse({
		assetRecordId,
		conflictFeatures: [],
		contentLength: 1,
		contentType: "image/png",
		contextOverrideRationale: null,
		createdAt: new Date().toISOString(),
		customPurpose: null,
		fileName: "avoid-palette.png",
		forbiddenFeatures: ["palette"],
		history: [],
		id: crypto.randomUUID(),
		notes: null,
		revision: 1,
		role: "avoid",
		sha256: "a".repeat(64),
		sortOrder: 0,
		transferredFeatures: [],
		updatedAt: new Date().toISOString(),
	});
	store.images.set(image.id, image);

	const assetVersionReference = {
		assetRecordName: "Frost Warrior",
		conflictFeatures: [],
		contextOverrideRationale: null,
		customPurpose: null,
		forbiddenFeatures: [],
		id: crypto.randomUUID(),
		notes: null,
		role: "palette" as const,
		transferredFeatures: ["palette" as const],
		versionId: crypto.randomUUID(),
		versionNumber: 1,
	};
	const context = {
		assetRecordTrackingStore: {
			getTracking: async () =>
				({
					record: {},
					tracking: { references: [assetVersionReference] },
				}) as never,
		},
		referenceProductionStore: store,
		session: { user: { id: userId } },
	} as unknown as Context;
	const board = await call(
		appRouter.referenceProduction.list,
		{ assetRecordId, projectId },
		{ context }
	);

	expect(board.conflicts).toEqual([]);
	expect(board.effectiveTransferredFeatures).toEqual([]);
	expect(board.effectiveForbiddenFeatures).toEqual(["palette"]);
	expect(board.imageReferences[0]?.conflictFeatures).toEqual([]);
});
