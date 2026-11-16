import { sha256Hex } from "@sprite-anvil/api/export-bundle-verification";
import { strToU8, Zip, ZipPassThrough } from "fflate";
import { foundationSource, setup } from "./project-archive-fixtures";

export async function portableArchiveFixture() {
	const bytes = new Uint8Array([1, 2, 0x50, 0x4b, 0x07, 0x08, 3, 4]);
	const source = foundationSource();
	const sha256 = await sha256Hex(bytes);
	source.records.managedSnapshots = [];
	source.records.assetVersions = source.records.assetVersions
		.slice(0, 1)
		.map((v) => ({ ...v, byteSize: bytes.length, contentDigest: sha256 }));
	source.records.unitVersions = [];
	source.files = source.files
		.slice(0, 1)
		.map((f) => ({ ...f, byteSize: bytes.length, sha256 }));
	const { archive } = await setup({ source }).create();
	const chunks: Uint8Array[] = [];
	const zip = new Zip((error, chunk) => {
		if (error) {
			throw error;
		}
		chunks.push(chunk);
	});
	for (const [name, content] of [
		["archive.json", strToU8(JSON.stringify(archive))],
		[
			`files/${source.files[0]?.kind}/${Buffer.from(source.files[0]?.sourceId ?? "").toString("hex")}`,
			bytes,
		],
	] as const) {
		const entry = new ZipPassThrough(name);
		zip.add(entry);
		entry.push(content, true);
	}
	zip.end();
	const zipBytes = new Uint8Array(
		chunks.reduce((size, chunk) => size + chunk.length, 0)
	);
	let offset = 0;
	for (const chunk of chunks) {
		zipBytes.set(chunk, offset);
		offset += chunk.length;
	}
	const range = (start: number, length: number) =>
		Promise.resolve(new Response(zipBytes.slice(start, start + length)).body);
	return { archive, bytes, zipBytes, range };
}
