import { createHash } from "node:crypto";
import {
	projectArchiveSchema,
	verifyProjectArchive,
} from "@sprite-anvil/api/project-archives";
import { hash as bunHash } from "bun";
import { Inflate } from "fflate";

export class PortableArchiveFormatError extends Error {}

interface Entry {
	compressedSize: number;
	compression: number;
	crc: number;
	dataOffset: number;
	localOffset: number;
	name: string;
	size: number;
}
interface RangeSource {
	byteSize: number;
	maxManifestBytes: number;
	range: (
		offset: number,
		length: number
	) => Promise<ReadableStream<Uint8Array> | null>;
}
const utf8 = new TextDecoder("utf-8", { fatal: true });
function decodeName(bytes: Uint8Array): string {
	try {
		return utf8.decode(bytes);
	} catch (error) {
		throw new PortableArchiveFormatError("Invalid ZIP filename encoding", {
			cause: error,
		});
	}
}
const u16 = (b: Uint8Array, offset: number) =>
	new DataView(b.buffer, b.byteOffset, b.byteLength).getUint16(offset, true);
const u32 = (b: Uint8Array, offset: number) =>
	new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(offset, true);

async function exact(source: RangeSource, start: number, length: number) {
	if (
		!(Number.isSafeInteger(start) && Number.isSafeInteger(length)) ||
		start < 0 ||
		length < 0 ||
		start + length > source.byteSize
	) {
		throw new PortableArchiveFormatError("Invalid ZIP range");
	}
	const body = await source.range(start, length);
	if (!body) {
		throw new Error("ZIP is unavailable");
	}
	const bytes = new Uint8Array(await new Response(body).arrayBuffer());
	if (bytes.length !== length) {
		throw new PortableArchiveFormatError("Truncated ZIP");
	}
	return bytes;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: ZIP directory field and range checks are kept together.
async function readDirectory(source: RangeSource): Promise<Entry[]> {
	if (
		!Number.isSafeInteger(source.byteSize) ||
		source.byteSize < 22 ||
		source.byteSize > 2 * 0xff_ff_ff_ff + 65_557
	) {
		throw new PortableArchiveFormatError("Unsupported ZIP size");
	}
	const tailSize = Math.min(source.byteSize, 65_557);
	const tailStart = source.byteSize - tailSize;
	const tail = await exact(source, tailStart, tailSize);
	let end = tail.length - 22;
	while (
		end >= 0 &&
		(u32(tail, end) !== 0x06_05_4b_50 ||
			end + 22 + u16(tail, end + 20) !== tail.length)
	) {
		end -= 1;
	}
	if (end < 0) {
		throw new PortableArchiveFormatError("Missing ZIP directory");
	}
	const count = u16(tail, end + 10);
	const directorySize = u32(tail, end + 12);
	const directoryOffset = u32(tail, end + 16);
	if (
		u16(tail, end + 4) ||
		u16(tail, end + 6) ||
		count !== u16(tail, end + 8) ||
		count === 0xff_ff ||
		directoryOffset === 0xff_ff_ff_ff ||
		directorySize === 0xff_ff_ff_ff ||
		directoryOffset + directorySize !== tailStart + end
	) {
		throw new PortableArchiveFormatError("Unsupported ZIP directory");
	}
	const entries: Entry[] = [];
	const seen = new Set<string>();
	let cursor = directoryOffset;
	for (let index = 0; index < count; index += 1) {
		// biome-ignore lint/performance/noAwaitInLoops: Directory records are read in bounded order.
		const header = await exact(source, cursor, 46);
		if (u32(header, 0) !== 0x02_01_4b_50) {
			throw new PortableArchiveFormatError("Invalid ZIP directory entry");
		}
		const flags = u16(header, 8);
		const compression = u16(header, 10);
		const compressedSize = u32(header, 20);
		const size = u32(header, 24);
		const nameLength = u16(header, 28);
		const extraLength = u16(header, 30);
		const commentLength = u16(header, 32);
		const localOffset = u32(header, 42);
		if (
			// biome-ignore lint/suspicious/noBitwiseOperators: ZIP general-purpose flag bit 0 indicates encryption.
			flags & 1 ||
			![0, 8].includes(compression) ||
			compressedSize === 0xff_ff_ff_ff ||
			size === 0xff_ff_ff_ff ||
			localOffset === 0xff_ff_ff_ff ||
			u16(header, 34) !== 0
		) {
			throw new PortableArchiveFormatError("Unsupported ZIP entry");
		}
		const step = 46 + nameLength + extraLength + commentLength;
		if (cursor + step > directoryOffset + directorySize) {
			throw new PortableArchiveFormatError("Invalid ZIP directory length");
		}
		const name = decodeName(await exact(source, cursor + 46, nameLength));
		if (seen.has(name)) {
			throw new PortableArchiveFormatError("Duplicate ZIP path");
		}
		seen.add(name);
		const local = await exact(source, localOffset, 30);
		if (
			u32(local, 0) !== 0x04_03_4b_50 ||
			u16(local, 6) !== flags ||
			u16(local, 8) !== compression
		) {
			throw new PortableArchiveFormatError("Invalid local ZIP header");
		}
		const localNameLength = u16(local, 26);
		const localExtraLength = u16(local, 28);
		const localName = decodeName(
			await exact(source, localOffset + 30, localNameLength)
		);
		const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
		if (name !== localName || dataOffset + compressedSize > directoryOffset) {
			throw new PortableArchiveFormatError("Invalid ZIP entry range");
		}
		entries.push({
			name,
			compression,
			size,
			compressedSize,
			crc: u32(header, 16),
			localOffset,
			dataOffset,
		});
		cursor += step;
	}
	if (cursor !== directoryOffset + directorySize) {
		throw new PortableArchiveFormatError("Invalid ZIP directory length");
	}
	const ordered = [...entries].sort((a, b) => a.localOffset - b.localOffset);
	for (let index = 1; index < ordered.length; index += 1) {
		const previous = ordered[index - 1];
		const current = ordered[index];
		if (
			previous &&
			current &&
			previous.dataOffset + previous.compressedSize > current.localOffset
		) {
			throw new PortableArchiveFormatError("Overlapping ZIP entries");
		}
	}
	return entries;
}

// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: Stream accounting checks every boundary before yielding.
async function* entryChunks(
	source: RangeSource,
	entry: Entry,
	expectedSha?: string
) {
	const body = await source.range(entry.dataOffset, entry.compressedSize);
	if (!body) {
		throw new Error("ZIP entry unavailable");
	}
	const reader = body.getReader();
	const hash = createHash("sha256");
	let crc = 0;
	let size = 0;
	let compressed = 0;
	const pending: Uint8Array[] = [];
	const inflate =
		entry.compression === 8
			? new Inflate((chunk) => pending.push(chunk))
			: null;
	const inflateChunk = (chunk: Uint8Array, final: boolean) => {
		try {
			inflate?.push(chunk, final);
		} catch (error) {
			throw new PortableArchiveFormatError("Invalid compressed ZIP entry", {
				cause: error,
			});
		}
	};
	try {
		while (true) {
			// biome-ignore lint/performance/noAwaitInLoops: Read the entry in order and yield under backpressure.
			const result = await reader.read();
			if (result.done) {
				break;
			}
			compressed += result.value.length;
			if (compressed > entry.compressedSize) {
				throw new PortableArchiveFormatError(
					"ZIP entry exceeds compressed length"
				);
			}
			for (let offset = 0; offset < result.value.length; offset += 1024) {
				const input = result.value.subarray(offset, offset + 1024);
				if (inflate) {
					inflateChunk(input, false);
				} else {
					pending.push(input);
				}
				for (const chunk of pending.splice(0)) {
					size += chunk.length;
					if (size > entry.size) {
						throw new PortableArchiveFormatError(
							"ZIP entry exceeds declared length"
						);
					}
					hash.update(chunk);
					crc = bunHash.crc32(chunk, crc);
					yield chunk;
				}
			}
		}
		if (inflate) {
			inflateChunk(new Uint8Array(), true);
		}
		for (const chunk of pending.splice(0)) {
			size += chunk.length;
			if (size > entry.size) {
				throw new PortableArchiveFormatError(
					"ZIP entry exceeds declared length"
				);
			}
			hash.update(chunk);
			crc = bunHash.crc32(chunk, crc);
			yield chunk;
		}
		if (
			compressed !== entry.compressedSize ||
			size !== entry.size ||
			crc !== entry.crc ||
			(expectedSha && hash.digest("hex") !== expectedSha)
		) {
			throw new PortableArchiveFormatError(
				"ZIP entry failed integrity verification"
			);
		}
	} finally {
		try {
			await reader.cancel();
		} finally {
			reader.releaseLock();
		}
	}
}

function asStream(generator: AsyncGenerator<Uint8Array>) {
	return new ReadableStream<Uint8Array>(
		{
			async pull(controller) {
				try {
					const next = await generator.next();
					if (next.done) {
						controller.close();
					} else {
						controller.enqueue(next.value);
					}
				} catch (error) {
					controller.error(error);
				}
			},
			async cancel() {
				await generator.return(undefined);
			},
		},
		{ highWaterMark: 0 }
	);
}

export async function readPortableArchive(source: RangeSource) {
	if (
		!Number.isSafeInteger(source.maxManifestBytes) ||
		source.maxManifestBytes <= 0
	) {
		throw new Error("Project Archive manifest limit is not configured.");
	}
	const entries = await readDirectory(source);
	const manifestEntry = entries.find((entry) => entry.name === "archive.json");
	if (!manifestEntry) {
		throw new PortableArchiveFormatError("Missing archive.json");
	}
	if (manifestEntry.size > source.maxManifestBytes) {
		throw new PortableArchiveFormatError(
			"Project Archive manifest exceeds the configured limit."
		);
	}
	const manifestBytes = new Uint8Array(
		await new Response(
			asStream(entryChunks(source, manifestEntry))
		).arrayBuffer()
	);
	let archive: ReturnType<typeof projectArchiveSchema.parse>;
	try {
		archive = projectArchiveSchema.parse(
			JSON.parse(utf8.decode(manifestBytes))
		);
	} catch (error) {
		throw new PortableArchiveFormatError("Invalid Project Archive manifest", {
			cause: error,
		});
	}
	let failures: string[];
	try {
		failures = await verifyProjectArchive(archive);
	} catch (error) {
		throw new PortableArchiveFormatError("Invalid Project Archive content", {
			cause: error,
		});
	}
	if (failures.length) {
		throw new PortableArchiveFormatError("Invalid Project Archive");
	}
	const expected = new Map(
		archive.manifest.files
			.filter((file) => file.presence === "included")
			.map((file) => [
				`files/${file.kind}/${Buffer.from(file.sourceId, "utf8").toString("hex")}`,
				file,
			])
	);
	if (
		expected.size !==
			archive.manifest.files.filter((file) => file.presence === "included")
				.length ||
		entries.length !== expected.size + 1
	) {
		throw new PortableArchiveFormatError("Invalid Project Archive files");
	}
	const files = entries
		.filter((entry) => entry.name !== "archive.json")
		.map((entry) => {
			const file = expected.get(entry.name);
			if (!file || file.byteSize !== entry.size) {
				throw new PortableArchiveFormatError("Unexpected Project Archive file");
			}
			return { entry, file };
		});
	return {
		archive,
		files,
		openFile: async (file: (typeof files)[number]) =>
			asStream(entryChunks(source, file.entry, file.file.sha256)),
	};
}
