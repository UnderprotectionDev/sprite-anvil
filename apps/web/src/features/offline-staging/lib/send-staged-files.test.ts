import { expect, test } from "vitest";
import type { StagedFileRow } from "./offline-staging-store";
import { sendStagedFiles } from "./send-staged-files";

function stagedFile(id: string): StagedFileRow {
	return {
		id,
		projectId: "project-1",
		name: `${id}.png`,
		type: "image/png",
		size: 3,
		stagedAt: 1,
		data: new Blob(["abc"], { type: "image/png" }),
	};
}

function createFakes(files: StagedFileRow[]) {
	const remaining = new Map(files.map((file) => [file.id, file]));
	return {
		remaining,
		store: {
			listStagedFiles: () => Promise.resolve([...remaining.values()]),
			removeStagedFile: (id: string) => {
				remaining.delete(id);
				return Promise.resolve();
			},
		},
	};
}

test("each staged file enters the Import Inbox once, keyed by its staged id, then leaves the stage", async () => {
	const { remaining, store } = createFakes([stagedFile("a"), stagedFile("b")]);
	const uploads: { key: string; name: string }[] = [];

	const result = await sendStagedFiles({
		projectId: "project-1",
		store,
		upload: (file, idempotencyKey) => {
			uploads.push({ key: idempotencyKey, name: file.name });
			return Promise.resolve({ ok: true });
		},
	});

	expect(uploads).toEqual([
		{ key: "a", name: "a.png" },
		{ key: "b", name: "b.png" },
	]);
	expect(result).toEqual({ sent: ["a", "b"], failed: [] });
	expect(remaining.size).toBe(0);
});

test("a file whose upload fails stays staged for a retry with the same key", async () => {
	const { remaining, store } = createFakes([stagedFile("a"), stagedFile("b")]);

	const result = await sendStagedFiles({
		projectId: "project-1",
		store,
		upload: (file) =>
			Promise.resolve(
				file.name === "a.png"
					? { ok: false, message: "Network unreachable" }
					: { ok: true }
			),
	});

	expect(result).toEqual({
		sent: ["b"],
		failed: [{ id: "a", message: "Network unreachable" }],
	});
	expect([...remaining.keys()]).toEqual(["a"]);
});

test("an upload that throws is reported as failed and the file is kept", async () => {
	const { remaining, store } = createFakes([stagedFile("a")]);

	const result = await sendStagedFiles({
		projectId: "project-1",
		store,
		upload: () => Promise.reject(new TypeError("Failed to fetch")),
	});

	expect(result.failed).toEqual([{ id: "a", message: "Failed to fetch" }]);
	expect(remaining.size).toBe(1);
});
