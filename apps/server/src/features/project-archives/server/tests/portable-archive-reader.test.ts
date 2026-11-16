import { expect, test } from "bun:test";
import { strToU8, Zip, ZipPassThrough, zipSync } from "fflate";
import { readPortableArchive } from "../portable-archive-reader";
import { portableArchiveFixture } from "./portable-archive-fixture";

test("reads an exact streaming ZIP even when file bytes contain a descriptor signature", async () => {
	const { archive, bytes, zipBytes, range } = await portableArchiveFixture();
	const result = await readPortableArchive({
		maxManifestBytes: 1_000_000,
		byteSize: zipBytes.length,
		range,
	});
	expect(result.archive).toEqual(archive);
	expect(result.files).toHaveLength(1);
	const [file] = result.files;
	if (!file) {
		throw new Error("Missing file");
	}
	const stream = await result.openFile(file);
	expect(new Uint8Array(await new Response(stream).arrayBuffer())).toEqual(
		bytes
	);
});

test("rejects missing, unexpected and duplicate paths before exposing files", async () => {
	const { archive } = await portableArchiveFixture();
	for (const names of [[], ["../escape"], ["archive.json"]]) {
		const chunks: Uint8Array[] = [];
		const zip = new Zip((error, chunk) => {
			if (error) {
				throw error;
			}
			chunks.push(chunk);
		});
		for (const [name, data] of [
			["archive.json", strToU8(JSON.stringify(archive))],
			...names.map((extraName) => [extraName, new Uint8Array([1])] as const),
		] as const) {
			const entry = new ZipPassThrough(name);
			zip.add(entry);
			entry.push(data, true);
		}
		zip.end();
		const bytes = new Uint8Array(
			chunks.reduce((sum, part) => sum + part.length, 0)
		);
		let offset = 0;
		for (const chunk of chunks) {
			bytes.set(chunk, offset);
			offset += chunk.length;
		}
		// biome-ignore lint/performance/noAwaitInLoops: Exercise independent invalid archives sequentially.
		await expect(
			readPortableArchive({
				maxManifestBytes: 1_000_000,
				byteSize: bytes.length,
				range: (start, length) =>
					Promise.resolve(
						new Response(bytes.slice(start, start + length)).body
					),
			})
		).rejects.toThrow();
	}
});

test("fails the streamed file when the ZIP bytes are corrupted", async () => {
	const { zipBytes, range } = await portableArchiveFixture();
	const result = await readPortableArchive({
		maxManifestBytes: 1_000_000,
		byteSize: zipBytes.length,
		range,
	});
	const [file] = result.files;
	if (!file) {
		throw new Error("Missing file");
	}
	zipBytes[file.entry.dataOffset] = 99;
	await expect(
		new Response(await result.openFile(file)).arrayBuffer()
	).rejects.toThrow();
});

test("rejects duplicate archive sections even when their digests agree", async () => {
	const { archive, bytes } = await portableArchiveFixture();
	const [section] = archive.sections;
	if (!section) {
		throw new Error("Missing section");
	}
	archive.sections.push(structuredClone(section));
	const [file] = archive.manifest.files.filter(
		(item) => item.presence === "included"
	);
	if (!file) {
		throw new Error("Missing file");
	}
	const chunks: Uint8Array[] = [];
	const zip = new Zip((error, chunk) => {
		if (error) {
			throw error;
		}
		chunks.push(chunk);
	});
	for (const [name, data] of [
		["archive.json", strToU8(JSON.stringify(archive))],
		[`files/${file.kind}/${Buffer.from(file.sourceId).toString("hex")}`, bytes],
	] as const) {
		const entry = new ZipPassThrough(name);
		zip.add(entry);
		entry.push(data, true);
	}
	zip.end();
	const zipBytes = new Uint8Array(
		chunks.reduce((sum, part) => sum + part.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		zipBytes.set(chunk, offset);
		offset += chunk.length;
	}
	await expect(
		readPortableArchive({
			maxManifestBytes: 1_000_000,
			byteSize: zipBytes.length,
			range: (start, length) =>
				Promise.resolve(
					new Response(zipBytes.slice(start, start + length)).body
				),
		})
	).rejects.toThrow();
});

test("reads a deflated portable archive with exact size, CRC and SHA verification", async () => {
	const { archive, bytes } = await portableArchiveFixture();
	const [file] = archive.manifest.files.filter(
		(item) => item.presence === "included"
	);
	if (!file) {
		throw new Error("Missing file");
	}
	const zip = zipSync({
		"archive.json": strToU8(JSON.stringify(archive)),
		[`files/${file.kind}/${Buffer.from(file.sourceId).toString("hex")}`]: bytes,
	});
	const result = await readPortableArchive({
		maxManifestBytes: 1_000_000,
		byteSize: zip.length,
		range: (start, length) =>
			Promise.resolve(new Response(zip.slice(start, start + length)).body),
	});
	const [entry] = result.files;
	if (!entry) {
		throw new Error("Missing file entry");
	}
	expect(
		new Uint8Array(
			await new Response(await result.openFile(entry)).arrayBuffer()
		)
	).toEqual(bytes);
});

test("rejects a manifest above the configured limit before reading its bytes", async () => {
	const { zipBytes, range } = await portableArchiveFixture();
	const header = new DataView(
		zipBytes.buffer,
		zipBytes.byteOffset,
		zipBytes.byteLength
	);
	const manifestOffset =
		30 + header.getUint16(26, true) + header.getUint16(28, true);
	const requestedOffsets: number[] = [];
	await expect(
		readPortableArchive({
			byteSize: zipBytes.length,
			range: (offset, length) => {
				requestedOffsets.push(offset);
				return range(offset, length);
			},
			maxManifestBytes: 1,
		})
	).rejects.toThrow("manifest exceeds");
	expect(requestedOffsets).not.toContain(manifestOffset);
});
