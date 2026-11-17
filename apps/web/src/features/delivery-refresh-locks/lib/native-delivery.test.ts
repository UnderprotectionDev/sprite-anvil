import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { expect, test } from "vitest";
import {
	applyNativeDelivery,
	type NativeDeliveryFileSystem,
} from "./native-delivery";

const bytes = (text: string) => new TextEncoder().encode(text);
function fileSystem(initial: Record<string, string> = {}) {
	const files = new Map<string, Uint8Array>(
		Object.entries(initial).map(([path, text]) => [path, bytes(text)])
	);
	const fs: NativeDeliveryFileSystem = {
		info: (path) => {
			if (files.has(path)) {
				return Promise.resolve({ isDirectory: false, isSymlink: false });
			}
			return Promise.resolve(
				path === "/chosen" ? { isDirectory: true, isSymlink: false } : null
			);
		},
		mkdir: async () => undefined,
		read: (path) => {
			const value = files.get(path);
			if (!value) {
				return Promise.reject(new Error("Missing file"));
			}
			return Promise.resolve(value);
		},
		remove: (path) => {
			files.delete(path);
			return Promise.resolve();
		},
		write: (path, value, createNew) => {
			if (createNew && files.has(path)) {
				return Promise.reject(new Error("Already exists"));
			}
			files.set(path, value);
			return Promise.resolve();
		},
	};
	return { files, fs };
}

test("writes verified bundle bytes and reads back digests without touching unrelated files", async () => {
	const { files, fs } = fileSystem({ "/chosen/local.txt": "keep" });
	const sha256 = await sha256Hex(bytes("asset"));
	const result = await applyNativeDelivery({
		root: "/chosen",
		fs,
		files: [{ path: "asset.png", sha256, bytes: bytes("asset") }],
	});
	expect(result).toEqual([{ path: "asset.png", sha256 }]);
	expect(files.get("/chosen/local.txt")).toEqual(bytes("keep"));
});

test("preflights all collisions before changing any destination file", async () => {
	const { files, fs } = fileSystem({ "/chosen/existing.txt": "local" });
	const sha256 = await sha256Hex(bytes("new"));
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [
				{ path: "new.txt", sha256, bytes: bytes("new") },
				{ path: "existing.txt", sha256, bytes: bytes("new") },
			],
		})
	).rejects.toThrow("changed");
	expect(files.has("/chosen/new.txt")).toBe(false);
	expect(files.get("/chosen/existing.txt")).toEqual(bytes("local"));
});

test("rejects changed observations and traversal before writing", async () => {
	const { files, fs } = fileSystem({ "/chosen/owned.txt": "edited" });
	const sha256 = await sha256Hex(bytes("new"));
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [{ path: "owned.txt", sha256, bytes: bytes("new") }],
			observed: [{ path: "owned.txt", sha256: await sha256Hex(bytes("old")) }],
		})
	).rejects.toThrow("changed");
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [{ path: "../escape", sha256, bytes: bytes("new") }],
		})
	).rejects.toThrow();
	expect(files.get("/chosen/owned.txt")).toEqual(bytes("edited"));
});

test("rolls back earlier writes when a later write fails, and safely replays identical output", async () => {
	const { files, fs } = fileSystem();
	const sha256 = await sha256Hex(bytes("new"));
	const originalWrite = fs.write;
	fs.write = (path, value, createNew) =>
		path.endsWith("second.txt")
			? Promise.reject(new Error("Disk full"))
			: originalWrite(path, value, createNew);
	const entries = ["first.txt", "second.txt"].map((path) => ({
		path,
		sha256,
		bytes: bytes("new"),
	}));
	await expect(
		applyNativeDelivery({ root: "/chosen", fs, files: entries })
	).rejects.toThrow("Disk full");
	expect(files.size).toBe(0);
	fs.write = originalWrite;
	await applyNativeDelivery({ root: "/chosen", fs, files: entries });
	await expect(
		applyNativeDelivery({ root: "/chosen", fs, files: entries })
	).resolves.toHaveLength(2);
});

test("refuses symlink components and invalid bundle bytes", async () => {
	const { files, fs } = fileSystem();
	const originalInfo = fs.info;
	fs.info = (path) =>
		path === "/chosen/link"
			? Promise.resolve({ isDirectory: true, isSymlink: true })
			: originalInfo(path);
	const sha256 = await sha256Hex(bytes("new"));
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [{ path: "link/escape.txt", sha256, bytes: bytes("new") }],
		})
	).rejects.toThrow("Unsafe");
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [{ path: "bad.txt", sha256, bytes: bytes("wrong") }],
		})
	).rejects.toThrow("integrity");
	expect(files.size).toBe(0);
});

test("reports incomplete recovery when a failed native write has left partial bytes", async () => {
	const { files, fs } = fileSystem();
	fs.write = (path) => {
		files.set(path, bytes("partial"));
		return Promise.reject(new Error("Disk full"));
	};
	await expect(
		applyNativeDelivery({
			root: "/chosen",
			fs,
			files: [
				{
					path: "asset.png",
					sha256: await sha256Hex(bytes("complete")),
					bytes: bytes("complete"),
				},
			],
		})
	).rejects.toThrow("recovery is incomplete");
	expect(files.get("/chosen/asset.png")).toEqual(bytes("partial"));
});
