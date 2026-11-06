import { createHash } from "node:crypto";
import type {
	OfflineConflictEntry,
	OfflineConflictStore,
} from "@sprite-anvil/api/offline-conflict";
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

/** One-colour PNG of the given size. */
export async function solidPng(width: number, height: number, hex: string) {
	const data = Buffer.from(
		Array.from({ length: width * height }, () => rgba(hex)).flat()
	);
	return new Uint8Array(
		await sharp(data, { raw: { width, height, channels: 4 } })
			.png()
			.toBuffer()
	);
}

/** 6x2 sheet: three 2x2 cells (red, green, blue) side by side. */
export async function createSheetPng() {
	const colours = [red, green, blue];
	const data: number[] = [];
	for (let y = 0; y < 2; y += 1) {
		for (let x = 0; x < 6; x += 1) {
			data.push(...rgba(colours[Math.floor(x / 2)] ?? red));
		}
	}
	return new Uint8Array(
		await sharp(Buffer.from(data), {
			raw: { width: 6, height: 2, channels: 4 },
		})
			.png()
			.toBuffer()
	);
}

/** Slicing that cuts the createSheetPng sheet into its three cells. */
export const sheetSlicing = {
	cellWidth: 2,
	cellHeight: 2,
	columns: 3,
	rows: 1,
	offsetX: 0,
	offsetY: 0,
	gapX: 0,
	gapY: 0,
	readingOrder: "rows-left-to-right",
};

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
				if (update.structure) {
					draft.structure = update.structure;
				}
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

	const conflicts = new Map<string, OfflineConflictEntry>();
	const offlineConflictStore: OfflineConflictStore = {
		createRecord(user, input) {
			const existing = [...conflicts.values()].find(
				({ record }) =>
					record.ownerUserId === user &&
					record.projectId === input.projectId &&
					record.draftId === input.draftId &&
					record.baseRevision === input.baseRevision &&
					record.cloudRevision === input.cloudRevision &&
					record.localDigest === input.localDigest
			);
			if (existing) {
				return Promise.resolve({ kind: "existing", entry: existing });
			}
			const entry: OfflineConflictEntry = {
				record: { ...input, ownerUserId: user, createdAt: new Date() },
				resolution: null,
			};
			conflicts.set(input.id, entry);
			return Promise.resolve({ kind: "created", entry });
		},
		getEntry(user, project, id) {
			const entry = conflicts.get(id);
			return Promise.resolve(
				entry &&
					entry.record.ownerUserId === user &&
					entry.record.projectId === project
					? entry
					: null
			);
		},
		listEntries: (user, project) =>
			Promise.resolve(
				[...conflicts.values()].filter(
					({ record }) =>
						record.ownerUserId === user && record.projectId === project
				)
			),
		createResolution(user, input) {
			const entry = conflicts.get(input.conflictId);
			if (
				!entry ||
				entry.record.ownerUserId !== user ||
				entry.record.projectId !== input.projectId
			) {
				return Promise.resolve(null);
			}
			if (entry.resolution) {
				return Promise.resolve({
					kind: "existing",
					resolution: entry.resolution,
				});
			}
			entry.resolution = {
				id: input.id,
				conflictId: input.conflictId,
				choice: input.choice,
				idempotencyKey: input.idempotencyKey,
				resultAssetVersionId: input.resultAssetVersionId,
				resolvedByUserId: user,
				resolvedAt: new Date(),
			};
			return Promise.resolve({
				kind: "created",
				resolution: entry.resolution,
			});
		},
	};

	const faults = {
		/** 1-based call number of createCandidateVersion that throws. */
		failCandidateOnCall: null as number | null,
		failPut: false,
	};
	const candidatesByKey = new Map<
		string,
		{ id: string; unitVersion?: { id: string; unitKey: string } }
	>();
	const unitVersions = new Map<string, string>();
	const compositesByKey = new Map<
		string,
		{ id: string; unitVersionIds: string[] }
	>();
	const storage = {
		put: async (key: string, body: ReadableStream<Uint8Array>) => {
			if (faults.failPut) {
				throw new Error("storage unavailable");
			}
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
		offlineConflictStore,
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
				if (faults.failCandidateOnCall === calls.candidates.length) {
					return Promise.reject(new Error("database unavailable"));
				}
				const existing = candidatesByKey.get(input.idempotencyKey);
				if (existing) {
					return Promise.resolve({
						kind: "existing",
						version: { id: existing.id },
						unitVersion: existing.unitVersion,
					} as never);
				}
				const unitKey = input.unitCorrection?.unitKey;
				const unitVersion = unitKey
					? { id: `unit-${input.id}`, unitKey }
					: undefined;
				candidatesByKey.set(input.idempotencyKey, {
					id: input.id,
					unitVersion,
				});
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
		conflicts,
		faults,
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
		commit: (draftId: string, revision?: number) =>
			json(`${base}/${draftId}/commit`, {
				expectedRevision: revision ?? drafts.get(draftId)?.revision ?? 0,
			}),
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
		conflictBase: `${base.replace("/drafts", "/offline-conflicts")}`,
		preview: async (draftId: string) =>
			new Uint8Array(
				await (await app.request(`${base}/${draftId}/preview`)).arrayBuffer()
			),
	};
}
