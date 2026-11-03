import { createHash } from "node:crypto";
import type {
	PixelDraftRecord,
	PixelDraftUpdateResult,
	PixelEditorStore,
} from "@sprite-anvil/api/pixel-editor";
import { Hono } from "hono";
import sharp from "sharp";
import {
	mountPixelEditorRoutes,
	type PixelEditorRouteDependencies,
	type PixelEditorSession,
} from "../pixel-editor-routes";

export const projectId = "pixel-editor-project";
export const otherProjectId = "pixel-editor-other-project";
export const userId = "pixel-editor-user";
export const otherUserId = "pixel-editor-other-user";
export const assetRecordId = "b17f5ff0-a50d-438f-8bf2-a0152b42c3e9";
export const sourceVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c301";
export const unknownVersionId = "b17f5ff0-a50d-438f-8bf2-a0152b42c3ff";
export const red = "#ff0000ff";
export const blue = "#0000ffff";
export const green = "#00ff00ff";
export const clear = "#00000000";

export function rgba(hex: string) {
	return [1, 3, 5, 7].map((offset) =>
		Number.parseInt(hex.slice(offset, offset + 2), 16)
	);
}

/** 4x4 source: left half red, right half blue, bottom-right pixel transparent. */
export async function createSourcePng() {
	const data = new Uint8Array(4 * 4 * 4);
	for (let y = 0; y < 4; y += 1) {
		for (let x = 0; x < 4; x += 1) {
			const hex = x < 2 ? red : blue;
			data.set(rgba(hex), (y * 4 + x) * 4);
		}
	}
	data.set(rgba(clear), (3 * 4 + 3) * 4);
	return await sharp(data, { raw: { width: 4, height: 4, channels: 4 } })
		.png()
		.toBuffer();
}

export async function readPixels(png: Uint8Array) {
	const { data, info } = await sharp(png)
		.ensureAlpha()
		.raw()
		.toBuffer({ resolveWithObject: true });
	const pixel = (x: number, y: number) => {
		const offset = (y * info.width + x) * 4;
		return `#${[0, 1, 2, 3]
			.map((i) => (data[offset + i] ?? 0).toString(16).padStart(2, "0"))
			.join("")}`;
	};
	return { width: info.width, height: info.height, pixel };
}

export interface HarnessOptions {
	/** Source sheet PNG; defaults to the 4x4 two-colour image. */
	sourcePng?: Uint8Array;
	/** Other Asset Versions of the project, by id, usable for frame add/replace. */
	versions?: Record<string, Uint8Array>;
}

export async function createHarness(
	session: PixelEditorSession | null = { user: { id: userId } },
	options: HarnessOptions = {}
) {
	const sourcePng = Buffer.from(options.sourcePng ?? (await createSourcePng()));
	const objects = new Map<string, Uint8Array>();
	const sourceKey = `projects/${projectId}/asset-records/${assetRecordId}/versions/${sourceVersionId}`;
	objects.set(sourceKey, new Uint8Array(sourcePng));
	const digest = createHash("sha256").update(sourcePng).digest("hex");
	const extraFiles = new Map<
		string,
		{ digest: string; key: string; length: number }
	>();
	for (const [id, bytes] of Object.entries(options.versions ?? {})) {
		const key = `projects/${projectId}/asset-records/${assetRecordId}/versions/${id}`;
		objects.set(key, new Uint8Array(bytes));
		extraFiles.set(id, {
			key,
			length: bytes.byteLength,
			digest: createHash("sha256").update(bytes).digest("hex"),
		});
	}
	const calls = {
		candidates: [] as Record<string, unknown>[],
		composites: [] as Record<string, unknown>[],
		deletes: 0,
	};
	const drafts = new Map<string, PixelDraftRecord>();
	let nextRevisionClock = 0;

	function touch(draft: PixelDraftRecord) {
		nextRevisionClock += 1;
		draft.updatedAt = new Date(Date.UTC(2026, 10, 1, 0, 0, nextRevisionClock));
	}
	function visible(user: string, project: string, draftId: string) {
		const draft = drafts.get(draftId);
		return draft && draft.ownerUserId === user && draft.projectId === project
			? draft
			: null;
	}
	const pixelEditorStore: PixelEditorStore = {
		createDraft(requestedUser, input) {
			const existing = [...drafts.values()].find(
				(candidate) =>
					candidate.ownerUserId === requestedUser &&
					candidate.projectId === input.projectId &&
					candidate.sourceAssetVersionId === input.sourceAssetVersionId &&
					candidate.status === "open"
			);
			if (existing) {
				return Promise.resolve({ kind: "existing", draft: existing });
			}
			const draft: PixelDraftRecord = {
				...input,
				ownerUserId: requestedUser,
				status: "open",
				operations: [],
				appliedOperationCount: 0,
				revision: 0,
				committedAssetVersionId: null,
				structure: null,
				updatedAt: new Date(),
			};
			drafts.set(draft.id, draft);
			return Promise.resolve({ kind: "created", draft });
		},
		getDraft: (user, project, id) =>
			Promise.resolve(visible(user, project, id)),
		updateOperations(user, project, id, update) {
			const draft = visible(user, project, id);
			if (!draft) {
				return Promise.resolve(null);
			}
			let result: PixelDraftUpdateResult;
			if (draft.status !== "open") {
				result = { kind: "not-open" };
			} else if (draft.revision === update.expectedRevision) {
				draft.operations = update.operations;
				draft.appliedOperationCount = update.appliedOperationCount;
				draft.revision += 1;
				touch(draft);
				result = { kind: "updated", draft };
			} else {
				result = { kind: "conflict" };
			}
			return Promise.resolve(result);
		},
		updateStructure(user, project, id, update) {
			const draft = visible(user, project, id);
			if (!draft) {
				return Promise.resolve(null);
			}
			if (draft.status !== "open") {
				return Promise.resolve({ kind: "not-open" });
			}
			if (
				update.expectedRevision !== null &&
				draft.revision !== update.expectedRevision
			) {
				return Promise.resolve({ kind: "conflict" });
			}
			draft.structure = update.structure;
			draft.revision += 1;
			touch(draft);
			return Promise.resolve({ kind: "updated", draft });
		},
		markCommitted(user, project, id, assetVersionId) {
			const draft = visible(user, project, id);
			if (!draft) {
				return Promise.resolve(null);
			}
			if (draft.status !== "open") {
				return Promise.resolve({ kind: "not-open" });
			}
			draft.status = "committed";
			draft.committedAssetVersionId = assetVersionId;
			draft.revision += 1;
			touch(draft);
			return Promise.resolve({ kind: "updated", draft });
		},
		discardDraft(user, project, id) {
			const draft = visible(user, project, id);
			if (!draft) {
				return Promise.resolve(null);
			}
			if (draft.status !== "open") {
				return Promise.resolve({ kind: "not-open" });
			}
			draft.status = "discarded";
			draft.revision += 1;
			touch(draft);
			return Promise.resolve({ kind: "updated", draft });
		},
	};

	const candidatesByKey = new Map<string, { id: string }>();
	const unitVersions = new Map<string, string>();
	const compositesByKey = new Map<
		string,
		{ id: string; unitVersionIds: string[] }
	>();
	const storage = {
		put: async (key: string, body: ReadableStream<Uint8Array>) => {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		get(key: string) {
			const object = objects.get(key);
			return Promise.resolve(
				object
					? {
							body: new Response(object.slice())
								.body as ReadableStream<Uint8Array>,
							contentLength: object.byteLength,
							contentType: "image/png" as const,
						}
					: null
			);
		},
		delete(key: string) {
			calls.deletes += 1;
			objects.delete(key);
			return Promise.resolve();
		},
	};
	let idCount = 0;
	const dependencies: PixelEditorRouteDependencies = {
		pixelEditorStore,
		assetVersionStore: {
			getFileRecord(requestedUser, requestedProject, versionId) {
				const extra = extraFiles.get(versionId);
				if (
					requestedUser === userId &&
					requestedProject === projectId &&
					extra
				) {
					return Promise.resolve({
						id: versionId,
						assetFamilyId: "pixel-editor-family",
						assetRecordId,
						projectId,
						objectKey: extra.key,
						contentType: "image/png",
						contentLength: extra.length,
						contentDigest: extra.digest,
						fileName: "other.png",
						idempotencyKey: versionId,
						integrityVerified: true,
					});
				}
				if (
					requestedUser !== userId ||
					requestedProject !== projectId ||
					versionId !== sourceVersionId
				) {
					return Promise.resolve(null);
				}
				return Promise.resolve({
					id: sourceVersionId,
					assetFamilyId: "pixel-editor-family",
					assetRecordId,
					projectId,
					objectKey: sourceKey,
					contentType: "image/png",
					contentLength: sourcePng.byteLength,
					contentDigest: digest,
					fileName: "source.png",
					idempotencyKey: "source",
					integrityVerified: true,
				});
			},
			createCandidateVersion(_user, input) {
				calls.candidates.push(input as unknown as Record<string, unknown>);
				const existing = candidatesByKey.get(input.idempotencyKey);
				if (existing) {
					return Promise.resolve({
						kind: "existing",
						version: existing,
					} as never);
				}
				candidatesByKey.set(input.idempotencyKey, { id: input.id });
				const unitKey = input.unitCorrection?.unitKey;
				const unitVersion = unitKey
					? { id: `unit-${input.id}`, unitKey }
					: undefined;
				if (unitVersion) {
					unitVersions.set(unitVersion.id, input.id);
				}
				return Promise.resolve({
					kind: "created",
					version: { id: input.id },
					unitVersion,
				} as never);
			},
			createCompositeVersion(_user, input) {
				calls.composites.push(input as unknown as Record<string, unknown>);
				const unknown = input.unitVersionIds.some(
					(id) => !unitVersions.has(id)
				);
				if (unknown || input.projectId !== projectId) {
					return Promise.resolve({ kind: "invalid-unit-versions" } as const);
				}
				const existing = compositesByKey.get(input.idempotencyKey);
				if (existing) {
					return Promise.resolve({
						kind: "existing",
						compositeVersion: existing,
					} as never);
				}
				const compositeVersion = {
					id: `composite-${compositesByKey.size + 1}`,
					unitVersionIds: input.unitVersionIds,
				};
				compositesByKey.set(input.idempotencyKey, compositeVersion);
				return Promise.resolve({ kind: "created", compositeVersion } as never);
			},
		},
		createId() {
			idCount += 1;
			return `b17f5ff0-a50d-438f-8bf2-a0152b42c4${String(idCount).padStart(2, "0")}`;
		},
		createStorage: () => storage,
		getProjectForUser: (requestedUser, requestedProject) =>
			Promise.resolve(
				requestedUser === userId && requestedProject === projectId
					? { id: projectId }
					: null
			),
		getSession: () => Promise.resolve(session),
	};
	const app = new Hono();
	mountPixelEditorRoutes(app, dependencies);

	const base = `/api/projects/${projectId}/pixel-editor/drafts`;
	const json = (path: string, body: unknown, project = projectId) =>
		app.request(path.replace(projectId, project), {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});
	return {
		app,
		calls,
		drafts,
		objects,
		sourceKey,
		sourcePng,
		base,
		open: (id = sourceVersionId, project = projectId) =>
			json(base, { sourceAssetVersionId: id }, project),
		apply: (draftId: string, revision: number, operation: unknown) =>
			json(`${base}/${draftId}/operations`, {
				expectedRevision: revision,
				operation,
			}),
		undo: (draftId: string, revision: number) =>
			json(`${base}/${draftId}/undo`, { expectedRevision: revision }),
		redo: (draftId: string, revision: number) =>
			json(`${base}/${draftId}/redo`, { expectedRevision: revision }),
		commit: (draftId: string) => json(`${base}/${draftId}/commit`, {}),
		slicingPreview: (draftId: string, slicing: unknown) =>
			json(`${base}/${draftId}/slicing-preview`, { slicing }),
		slice: (draftId: string, revision: number, slicing: unknown) =>
			json(`${base}/${draftId}/structure/slicing`, {
				expectedRevision: revision,
				slicing,
			}),
		frameOp: (draftId: string, revision: number, operation: unknown) =>
			json(`${base}/${draftId}/structure/operations`, {
				expectedRevision: revision,
				operation,
			}),
		commitStructure: (draftId: string, revision: number) =>
			json(`${base}/${draftId}/structure/commit`, {
				expectedRevision: revision,
			}),
		readStructure: (draftId: string) =>
			app.request(`${base}/${draftId}/structure`),
		framePreview: async (draftId: string, frameKey: string) =>
			new Uint8Array(
				await (
					await app.request(
						`${base}/${draftId}/structure/frames/${frameKey}/preview`
					)
				).arrayBuffer()
			),
		read: (draftId: string) => app.request(`${base}/${draftId}`),
		preview: async (draftId: string) =>
			new Uint8Array(
				await (await app.request(`${base}/${draftId}/preview`)).arrayBuffer()
			),
	};
}
