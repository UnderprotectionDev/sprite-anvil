// @vitest-environment jsdom

import { expect, test } from "vitest";
import { prepareLiveFileCandidate } from "./live-file-change";

const sourcePath = "/Users/example/Art/Ash Knight.aseprite";
const exportPath = "/Users/example/Art/exports/ash-knight.webp";
const sourceBytes = new Uint8Array([1, 2, 3, 4]);
const exportBytes = new Uint8Array([5, 6, 7, 8]);

function fileInfo(size: number, mtime: number) {
	return {
		isFile: true,
		size,
		mtime: new Date(mtime),
	};
}

test("pairs a stable external source snapshot with a selected PNG or WebP export", async () => {
	const paths: string[] = [];
	const result = await prepareLiveFileCandidate(sourcePath, {
		chooseExport: () => Promise.resolve(exportPath),
		readFile: (path) => {
			paths.push(path);
			return Promise.resolve(
				path === sourcePath ? sourceBytes.slice() : exportBytes.slice()
			);
		},
		stat: (path) =>
			Promise.resolve(
				path === sourcePath
					? fileInfo(sourceBytes.length, 1_790_000_000_000)
					: fileInfo(exportBytes.length, 1_790_000_001_000)
			),
	});

	expect(result.kind).toBe("ready");
	if (result.kind !== "ready") {
		return;
	}
	expect(result.sourceFile.name).toBe("Ash Knight.aseprite");
	expect(result.sourceFile.type).toBe("application/octet-stream");
	expect(new Uint8Array(await result.sourceFile.arrayBuffer())).toEqual(
		sourceBytes
	);
	expect(result.candidateFile.name).toBe("ash-knight.webp");
	expect(result.candidateFile.type).toBe("image/webp");
	expect(new Uint8Array(await result.candidateFile.arrayBuffer())).toEqual(
		exportBytes
	);
	expect(paths).toEqual([sourcePath, exportPath]);
});

test("keeps the changed source untouched when export selection is cancelled", async () => {
	let candidateRead = false;
	const result = await prepareLiveFileCandidate(sourcePath, {
		chooseExport: () => Promise.resolve(null),
		readFile: (path) => {
			if (path !== sourcePath) {
				candidateRead = true;
			}
			return Promise.resolve(sourceBytes.slice());
		},
		stat: () =>
			Promise.resolve(fileInfo(sourceBytes.length, 1_790_000_000_000)),
	});

	expect(result).toEqual({ kind: "cancelled" });
	expect(candidateRead).toBe(false);
});

test("does not pair an export if the source changes while the export is selected", async () => {
	let sourceStatCount = 0;
	let candidateRead = false;
	const result = await prepareLiveFileCandidate(sourcePath, {
		chooseExport: () => Promise.resolve(exportPath),
		readFile: (path) => {
			if (path !== sourcePath) {
				candidateRead = true;
			}
			return Promise.resolve(sourceBytes.slice());
		},
		stat: (path) => {
			if (path !== sourcePath) {
				return Promise.resolve(fileInfo(exportBytes.length, 1_790_000_001_000));
			}
			sourceStatCount += 1;
			return Promise.resolve(
				fileInfo(sourceBytes.length, sourceStatCount === 1 ? 1000 : 2000)
			);
		},
	});

	expect(result).toEqual({ kind: "source-changed" });
	expect(candidateRead).toBe(false);
});

test("rejects a selected export outside PNG and WebP", async () => {
	const result = await prepareLiveFileCandidate(sourcePath, {
		chooseExport: () => Promise.resolve("/tmp/ash-knight.aseprite"),
		readFile: () => Promise.resolve(sourceBytes.slice()),
		stat: () =>
			Promise.resolve(fileInfo(sourceBytes.length, 1_790_000_000_000)),
	});

	expect(result).toEqual({ kind: "unsupported-export" });
});
