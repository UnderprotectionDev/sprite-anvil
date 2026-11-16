import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import type {
	AssetVersion,
	AssetVersionFileRecord,
} from "@sprite-anvil/api/asset-versions";
import { createTestAssetVersionIntegrityTransform } from "@sprite-anvil/api/test-support/asset-version-integrity";
import sharp from "sharp";
import { createProjectImportInboxObjectKey } from "../../../../cloudflare";
import { createCandidateFromInbox } from "../source-metadata-mapping-candidate";

async function harness() {
	const projectId = crypto.randomUUID();
	const assetRecordId = crypto.randomUUID();
	const proposalId = crypto.randomUUID();
	const bytes = await sharp({
		create: { width: 2, height: 2, channels: 4, background: "red" },
	})
		.png()
		.toBuffer();
	const objects = new Map<string, Uint8Array>();
	const sourceKey = createProjectImportInboxObjectKey(
		projectId,
		proposalId,
		crypto.randomUUID()
	);
	objects.set(sourceKey, bytes);
	const storage = {
		get(key: string) {
			const data = objects.get(key);
			return Promise.resolve(
				data
					? {
							body: new Blob([data]).stream(),
							contentType: "application/octet-stream",
							contentLength: data.length,
						}
					: null
			);
		},
		async put(key: string, body: ReadableStream<Uint8Array>) {
			objects.set(key, new Uint8Array(await new Response(body).arrayBuffer()));
		},
		delete(key: string) {
			objects.delete(key);
			return Promise.resolve();
		},
	};
	const input = {
		createAssetVersionIntegrityTransform:
			createTestAssetVersionIntegrityTransform,
		userId: "candidate-owner",
		projectId,
		proposalId,
		target: { projectId, assetRecordId, assetFamilyId: crypto.randomUUID() },
		source: {
			objectKey: sourceKey,
			contentLength: bytes.length,
			fileName: "hero.png",
			sha256: createHash("sha256").update(bytes).digest("hex"),
		},
		contentType: "image/png" as const,
		storage,
	};
	return { input, objects, sourceKey };
}

test.each(["not_found", "conflict"] as const)(
	"candidate publication %s leaves only the original inbox file",
	async (result) => {
		const { input, objects, sourceKey } = await harness();
		expect(
			await createCandidateFromInbox({
				...input,
				versionStore: {
					createCandidateVersion() {
						return Promise.resolve(
							result === "not_found"
								? null
								: { kind: "idempotency-conflict" as const }
						);
					},
				},
			})
		).toBe(result);
		expect([...objects.keys()]).toEqual([sourceKey]);
	}
);

test("a replay keeps the published file and removes only its own upload", async () => {
	const { input, objects, sourceKey } = await harness();
	let published: AssetVersionFileRecord | undefined;
	const versionStore = {
		createCandidateVersion(_userId: string, version: AssetVersionFileRecord) {
			const kind = published ? ("existing" as const) : ("created" as const);
			published ??= version;
			return Promise.resolve({
				kind,
				version: { id: input.proposalId } as AssetVersion,
			});
		},
	};
	expect(await createCandidateFromInbox({ ...input, versionStore })).toBe(
		"created"
	);
	const firstKeys = [...objects.keys()];
	expect(firstKeys).toHaveLength(2);
	expect(await createCandidateFromInbox({ ...input, versionStore })).toBe(
		"existing"
	);
	expect([...objects.keys()]).toEqual(firstKeys);
	expect(objects.has(sourceKey)).toBe(true);
	expect(published?.id).toBe(input.proposalId);
});

test("an uncertain database outcome retains the attempted file for recovery", async () => {
	const { input, objects } = await harness();
	await expect(
		createCandidateFromInbox({
			...input,
			versionStore: {
				createCandidateVersion() {
					return Promise.reject(new Error("Outcome unknown"));
				},
			},
		})
	).rejects.toThrow("Outcome unknown");
	expect(objects.size).toBe(2);
});

test("failed integrity verification does not retain an unpublished upload", async () => {
	const { input, objects, sourceKey } = await harness();
	let calls = 0;
	await expect(
		createCandidateFromInbox({
			...input,
			source: { ...input.source, sha256: "0".repeat(64) },
			versionStore: {
				createCandidateVersion() {
					calls += 1;
					return Promise.resolve(null);
				},
			},
		})
	).rejects.toThrow();
	expect(calls).toBe(0);
	expect([...objects.keys()]).toEqual([sourceKey]);
});
