import type {
	SourceMetadataFieldProposal,
	SourceMetadataMappingDiagnostic,
	SourceMetadataMappingSidecar,
} from "@sprite-anvil/api/source-metadata-mapping";
import {
	sourceMetadataFieldProposalSchema,
	sourceMetadataMappingDiagnosticSchema,
	sourceMetadataMappingSidecarSchema,
	sourceMetadataMappingSuggestionsSchema,
} from "@sprite-anvil/api/source-metadata-mapping";
import z from "zod";

type JsonRecord = Record<string, unknown>;
type SourceMetadataField = SourceMetadataFieldProposal["field"];
type SourceMetadataFormat = SourceMetadataMappingSidecar["format"];
type FrameLayout = "array" | "hash";

const wwwPrefixPattern = /^www\./;
const separatedFrameProperties = new Set([
	"duration",
	"filename",
	"ninePatch",
	"nineSlice",
	"pivot",
	"scale9",
]);

export type SourceMetadataSidecarFailure =
	| "invalid_json"
	| "unsupported_format";

export type SourceMetadataSidecarParseResult =
	| {
			ok: true;
			diagnostics: SourceMetadataMappingDiagnostic[];
			fields: SourceMetadataFieldProposal[];
			sidecar: SourceMetadataMappingSidecar;
	  }
	| { ok: false; reason: SourceMetadataSidecarFailure };

export interface SourceMetadataSidecarInput {
	entryId: string;
	fileName: string;
	sha256: string;
	text: string;
}

interface ParsedSourceMetadataDocument {
	document: JsonRecord;
	format: SourceMetadataFormat;
	frames: unknown[] | Record<string, unknown>;
	jsonLayout: FrameLayout;
	meta: JsonRecord;
	sidecar: SourceMetadataMappingSidecar;
}

interface CandidateCollection {
	diagnostics: SourceMetadataMappingDiagnostic[];
	fields: SourceMetadataFieldProposal[];
}

function emptyCandidates(): CandidateCollection {
	return { diagnostics: [], fields: [] };
}

const jsonRecordSchema = z.object({});
const nonEmptyStringSchema = z
	.string()
	.refine((value) => value.trim().length > 0);
const frameCollectionSchema = z.union([z.array(z.unknown()), jsonRecordSchema]);
const frameRectangleSchema = z.object({
	h: z.int().positive(),
	w: z.int().positive(),
	x: z.int().nonnegative(),
	y: z.int().nonnegative(),
});
const framedRecordSchema = z.object({ frame: frameRectangleSchema });
const namedRecordSchema = z.object({ name: nonEmptyStringSchema });
const sourceMetadataDocumentSchema = z.object({ meta: jsonRecordSchema });

function isRecord(value: unknown): value is JsonRecord {
	return jsonRecordSchema.safeParse(value).success;
}

function nonEmptyString(value: unknown): value is string {
	return nonEmptyStringSchema.safeParse(value).success;
}

function hasName(value: unknown): value is JsonRecord & { name: string } {
	return namedRecordSchema.safeParse(value).success;
}

function hasFrameRectangle(value: unknown): value is JsonRecord {
	return framedRecordSchema.safeParse(value).success;
}

function isSourceMetadataDocument(
	value: unknown
): value is JsonRecord & { meta: JsonRecord } {
	return sourceMetadataDocumentSchema.safeParse(value).success;
}

function sourceFormatFromApp(value: unknown): SourceMetadataFormat | null {
	if (typeof value !== "string") {
		return null;
	}
	try {
		const app = new URL(value);
		const host = app.hostname.toLowerCase().replace(wwwPrefixPattern, "");
		if (host === "aseprite.org") {
			return "aseprite";
		}
		if (
			host === "codeandweb.com" &&
			app.pathname.startsWith("/texturepacker")
		) {
			return "texture-packer";
		}
	} catch {
		return null;
	}
	return null;
}

function isFrameCollection(
	value: unknown
): value is unknown[] | Record<string, unknown> {
	return frameCollectionSchema.safeParse(value).success;
}

function frameEntries(
	frames: unknown[] | Record<string, unknown>
): [string | undefined, unknown][] {
	return Array.isArray(frames)
		? frames.map((frame): [string | undefined, unknown] => [undefined, frame])
		: Object.entries(frames);
}

function validFrameIdentity(
	value: unknown,
	layout: FrameLayout,
	key: string | undefined
): value is JsonRecord {
	if (!hasFrameRectangle(value)) {
		return false;
	}
	return layout === "array"
		? nonEmptyString(value.filename)
		: nonEmptyString(key);
}

function frameIdentity(
	value: JsonRecord,
	layout: FrameLayout,
	key: string | undefined
) {
	return layout === "array" ? String(value.filename) : String(key);
}

function parseSourceMetadataDocument(
	input: SourceMetadataSidecarInput
):
	| { ok: true; parsed: ParsedSourceMetadataDocument }
	| { ok: false; reason: SourceMetadataSidecarFailure } {
	let document: unknown;
	try {
		document = JSON.parse(input.text);
	} catch {
		return { ok: false, reason: "invalid_json" };
	}
	if (!isSourceMetadataDocument(document)) {
		return { ok: false, reason: "invalid_json" };
	}

	const format = sourceFormatFromApp(document.meta.app);
	if (!format) {
		return { ok: false, reason: "unsupported_format" };
	}
	if (
		!(
			nonEmptyString(document.meta.version) &&
			isFrameCollection(document.frames)
		)
	) {
		return { ok: false, reason: "invalid_json" };
	}

	const { frames } = document;
	const jsonLayout: FrameLayout = Array.isArray(frames) ? "array" : "hash";
	if (frameEntries(frames).length === 0) {
		return { ok: false, reason: "invalid_json" };
	}
	const sidecar = sourceMetadataMappingSidecarSchema.parse({
		entryId: input.entryId,
		fileName: input.fileName,
		format,
		jsonLayout,
		sha256: input.sha256,
		version: document.meta.version,
	});

	return {
		ok: true,
		parsed: {
			document,
			format,
			frames,
			jsonLayout,
			meta: document.meta,
			sidecar,
		},
	};
}

function createField(
	input: SourceMetadataSidecarInput,
	sidecar: SourceMetadataMappingSidecar,
	field: SourceMetadataField,
	key: string,
	sourcePath: string,
	value: unknown
): SourceMetadataFieldProposal {
	return sourceMetadataFieldProposalSchema.parse({
		field,
		key,
		sourceEntryId: input.entryId,
		sourceFileName: input.fileName,
		sourceFormat: sidecar.format,
		sourcePath,
		value,
	});
}

function createDiagnostic(
	input: SourceMetadataSidecarInput,
	sourcePath: string,
	message: string
): SourceMetadataMappingDiagnostic {
	return sourceMetadataMappingDiagnosticSchema.parse({
		message,
		severity: "warning",
		sourceEntryId: input.entryId,
		sourcePath,
	});
}

function frameDetailFields(
	input: SourceMetadataSidecarInput,
	sidecar: SourceMetadataMappingSidecar,
	frame: JsonRecord,
	key: string,
	path: string
) {
	const fields: SourceMetadataFieldProposal[] = [];
	if (Object.hasOwn(frame, "pivot")) {
		fields.push(
			createField(input, sidecar, "pivot", key, `${path}.pivot`, frame.pivot)
		);
	}
	for (const property of ["nineSlice", "ninePatch", "scale9"]) {
		if (Object.hasOwn(frame, property)) {
			fields.push(
				createField(
					input,
					sidecar,
					"nine-slice",
					key,
					`${path}.${property}`,
					frame[property]
				)
			);
		}
	}
	return fields;
}

function frameFields(
	parsed: ParsedSourceMetadataDocument,
	input: SourceMetadataSidecarInput
): SourceMetadataFieldProposal[] | null {
	const fields: SourceMetadataFieldProposal[] = [];
	for (const [index, [key, rawFrame]] of frameEntries(
		parsed.frames
	).entries()) {
		if (!validFrameIdentity(rawFrame, parsed.jsonLayout, key)) {
			return null;
		}
		const id = frameIdentity(rawFrame, parsed.jsonLayout, key);
		const path = Array.isArray(parsed.frames)
			? `frames[${index}]`
			: `frames.${key}`;
		const frameValue = Object.fromEntries(
			Object.entries(rawFrame).filter(
				([property]) => !separatedFrameProperties.has(property)
			)
		);
		fields.push(
			createField(input, parsed.sidecar, "frame", id, path, frameValue)
		);
		if (Object.hasOwn(rawFrame, "duration")) {
			fields.push(
				createField(
					input,
					parsed.sidecar,
					"duration",
					id,
					`${path}.duration`,
					rawFrame.duration
				)
			);
		}
		fields.push(
			...frameDetailFields(input, parsed.sidecar, rawFrame, id, path)
		);
	}
	return fields;
}

function tagFields(
	parsed: ParsedSourceMetadataDocument,
	input: SourceMetadataSidecarInput
): CandidateCollection {
	const tags = parsed.meta.frameTags;
	if (tags === undefined) {
		return emptyCandidates();
	}
	if (!Array.isArray(tags)) {
		return {
			diagnostics: [
				createDiagnostic(input, "meta.frameTags", "Tag list is not an array"),
			],
			fields: [],
		};
	}
	const result = emptyCandidates();
	for (const [index, tag] of tags.entries()) {
		if (!hasName(tag)) {
			result.diagnostics.push(
				createDiagnostic(
					input,
					`meta.frameTags[${index}]`,
					"Tag name is missing"
				)
			);
			continue;
		}
		result.fields.push(
			createField(
				input,
				parsed.sidecar,
				"tag",
				tag.name,
				`meta.frameTags[${index}]`,
				tag
			)
		);
	}
	return result;
}

function animationFields(
	parsed: ParsedSourceMetadataDocument,
	input: SourceMetadataSidecarInput
): CandidateCollection {
	const animations = parsed.document.animations ?? parsed.meta.animations;
	if (!isRecord(animations)) {
		return emptyCandidates();
	}
	return {
		diagnostics: [],
		fields: Object.entries(animations).map(([name, frames]) =>
			createField(input, parsed.sidecar, "tag", name, `animations.${name}`, {
				frames,
				name,
			})
		),
	};
}

function sliceKeyCandidates(
	input: SourceMetadataSidecarInput,
	sidecar: SourceMetadataMappingSidecar,
	sliceName: string,
	keyPath: string,
	keyValue: unknown
): CandidateCollection {
	const result = emptyCandidates();
	if (!isRecord(keyValue)) {
		result.diagnostics.push(
			createDiagnostic(input, keyPath, "Slice key is not an object")
		);
		return result;
	}
	if (keyValue.center !== undefined) {
		result.fields.push(
			createField(
				input,
				sidecar,
				"nine-slice",
				sliceName,
				`${keyPath}.center`,
				keyValue.center
			)
		);
	}
	if (isRecord(keyValue.pivot)) {
		result.fields.push(
			createField(input, sidecar, "pivot", sliceName, `${keyPath}.pivot`, {
				frame: keyValue.frame,
				...keyValue.pivot,
			})
		);
	}
	return result;
}

function sliceCandidates(
	input: SourceMetadataSidecarInput,
	sidecar: SourceMetadataMappingSidecar,
	slice: unknown,
	index: number
): CandidateCollection {
	const result = emptyCandidates();
	const path = `meta.slices[${index}]`;
	if (!hasName(slice)) {
		result.diagnostics.push(
			createDiagnostic(input, path, "Slice name is missing")
		);
		return result;
	}
	result.fields.push(
		createField(input, sidecar, "slice", slice.name, path, slice)
	);
	if (!Array.isArray(slice.keys)) {
		result.diagnostics.push(
			createDiagnostic(input, `${path}.keys`, "Slice keys are missing")
		);
		return result;
	}
	for (const [keyIndex, keyValue] of slice.keys.entries()) {
		const keyCandidates = sliceKeyCandidates(
			input,
			sidecar,
			slice.name,
			`${path}.keys[${keyIndex}]`,
			keyValue
		);
		result.fields.push(...keyCandidates.fields);
		result.diagnostics.push(...keyCandidates.diagnostics);
	}
	return result;
}

function sliceFields(
	parsed: ParsedSourceMetadataDocument,
	input: SourceMetadataSidecarInput
): CandidateCollection {
	const { slices } = parsed.meta;
	if (slices === undefined) {
		return emptyCandidates();
	}
	if (!Array.isArray(slices)) {
		return {
			diagnostics: [
				createDiagnostic(input, "meta.slices", "Slice list is not an array"),
			],
			fields: [],
		};
	}
	const result = emptyCandidates();
	for (const [index, slice] of slices.entries()) {
		const parsedSlice = sliceCandidates(input, parsed.sidecar, slice, index);
		result.fields.push(...parsedSlice.fields);
		result.diagnostics.push(...parsedSlice.diagnostics);
	}
	return result;
}

function paletteFields(
	parsed: ParsedSourceMetadataDocument,
	input: SourceMetadataSidecarInput
): CandidateCollection {
	const palette = parsed.document.palette ?? parsed.meta.palette;
	return palette === undefined
		? emptyCandidates()
		: {
				diagnostics: [],
				fields: [
					createField(
						input,
						parsed.sidecar,
						"palette",
						"palette",
						"palette",
						palette
					),
				],
			};
}

function stableJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(stableJson).join(",")}]`;
	}
	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

export function buildSourceMetadataConflicts(
	fields: SourceMetadataFieldProposal[]
) {
	const grouped = new Map<string, SourceMetadataFieldProposal[]>();
	for (const field of fields) {
		const key = `${field.field}\u0000${field.key}`;
		const candidates = grouped.get(key) ?? [];
		candidates.push(field);
		grouped.set(key, candidates);
	}

	return [...grouped.values()].flatMap((candidates) => {
		const distinctValues = new Set(
			candidates.map((candidate) => stableJson(candidate.value))
		);
		if (distinctValues.size < 2) {
			return [];
		}
		const [first] = candidates;
		return first ? [{ field: first.field, key: first.key, candidates }] : [];
	});
}

export function buildSourceMetadataMappingSuggestions() {
	return sourceMetadataMappingSuggestionsSchema.parse({
		assetFamilyLinks: {
			reason: "no-source-evidence",
			status: "unknown",
		},
		gameplayMetadata: {
			reason: "project-context-required",
			status: "unknown",
		},
		requiredSetLinks: {
			reason: "no-source-evidence",
			status: "unknown",
		},
	});
}

export function parseSourceMetadataSidecar(
	input: SourceMetadataSidecarInput
): SourceMetadataSidecarParseResult {
	const result = parseSourceMetadataDocument(input);
	if (!result.ok) {
		return result;
	}
	const { parsed } = result;
	const frames = frameFields(parsed, input);
	if (!frames) {
		return { ok: false, reason: "invalid_json" };
	}
	const collections = [
		{ fields: frames, diagnostics: [] },
		tagFields(parsed, input),
		animationFields(parsed, input),
		sliceFields(parsed, input),
		paletteFields(parsed, input),
	];
	return {
		ok: true,
		diagnostics: collections.flatMap((collection) => collection.diagnostics),
		fields: collections.flatMap((collection) => collection.fields),
		sidecar: parsed.sidecar,
	};
}
