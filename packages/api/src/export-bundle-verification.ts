/**
 * Offline integrity verification of an Engine-Neutral Bundle directory.
 *
 * This file is dependency-free on purpose: it imports nothing, uses only
 * erasable TypeScript syntax and web-standard APIs, so one copy serves the
 * Workbench and ships verbatim as `verification-kit/verify.ts` in the Package
 * Verification Kit, where `bun` or a current `node` run it directly:
 *
 *   bun verification-kit/verify.ts <bundle-directory>
 *
 * Both callers run `verifyExportBundle` over the same file set, so they reach
 * one result: schema, digests, path uniqueness, record links and the kit.
 */

export const exportBundleVerifierFormat = "sprite-anvil.export-bundle";
/** The Package Verification Kit contract version this verifier belongs to. */
export const exportBundleKitContractVersion = "1.0.0";
export const exportBundleSupportedMajor = 1;
export const exportBundleKitDirectory = "verification-kit";

const manifestPath = "manifest.json";
const checksumsPath = "checksums.txt";
const kitPrefix = `${exportBundleKitDirectory}/`;
const kitReadmePath = `${kitPrefix}README.md`;
const kitChecksumsPath = `${kitPrefix}checksums.txt`;
const kitSchemaPath = `${kitPrefix}schema/manifest.schema.json`;
const kitVerifierPath = `${kitPrefix}verify.ts`;
const kitExamplePattern = /^verification-kit\/examples\/[^/]+\.json$/;
const driveLetterUrlPrefix = /^\/([A-Za-z]:)/;
const leadingSeparators = /^[\\\\/]+/;
const forbiddenExampleKeys = [
	"command",
	"exec",
	"install",
	"run",
	"script",
	"shell",
];

export interface ExportBundleVerificationFile {
	bytes: Uint8Array;
	/** Forward-slash path relative to the bundle directory. */
	path: string;
	/**
	 * Set when the bytes live elsewhere (an asset file a store only references):
	 * the recorded size and SHA-256 stand in for `bytes`.
	 */
	recorded?: { byteSize: number; sha256: string };
}

export interface ExportBundleIntegrityFailure {
	code:
		| "checksum_list_mismatch"
		| "digest_mismatch"
		| "duplicate_path"
		| "kit_digest_mismatch"
		| "kit_executable"
		| "kit_file_missing"
		| "kit_schema_mismatch"
		| "kit_unexpected_file"
		| "manifest_invalid"
		| "missing_file"
		| "readme_contradiction"
		| "record_link"
		| "schema_violation"
		| "size_mismatch"
		| "unlisted_file"
		| "unsafe_path"
		| "unsupported_major";
	message: string;
	path: string | null;
}

export type ExportBundleIntegrityResult =
	| { fileCount: number; manifestDigest: string; ok: true }
	| { failures: ExportBundleIntegrityFailure[]; ok: false };

// The manifest JSON Schema, shipped in the kit. Emitted from the Zod manifest contract in
// `export-bundle-manifest.ts`; a test keeps the two identical.
export const exportBundleManifestJsonSchema: Record<string, unknown> = {
	$schema: "https://json-schema.org/draft/2020-12/schema",
	type: "object",
	properties: {
		adapterVersion: {
			anyOf: [
				{
					type: "string",
					minLength: 1,
				},
				{
					type: "null",
				},
			],
		},
		compositeVersions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetRecordId: {
						type: "string",
						minLength: 1,
					},
					id: {
						type: "string",
						minLength: 1,
					},
					memberUnitVersionIds: {
						type: "array",
						items: {
							type: "string",
							minLength: 1,
						},
					},
					versionNumber: {
						type: "integer",
						exclusiveMinimum: 0,
						maximum: 9_007_199_254_740_991,
					},
				},
				required: [
					"assetRecordId",
					"id",
					"memberUnitVersionIds",
					"versionNumber",
				],
				additionalProperties: false,
			},
		},
		context: {
			type: "object",
			properties: {
				revisionId: {
					type: "string",
					minLength: 1,
				},
				revisionNumber: {
					type: "integer",
					minimum: 0,
					maximum: 9_007_199_254_740_991,
				},
			},
			required: ["revisionId", "revisionNumber"],
			additionalProperties: false,
		},
		contractVersion: {
			type: "string",
			pattern: "^\\d+\\.\\d+\\.\\d+$",
		},
		dataStructureVersion: {
			type: "string",
			pattern: "^\\d+\\.\\d+\\.\\d+$",
		},
		deliveryTargetRevisionId: {
			anyOf: [
				{
					type: "string",
					minLength: 1,
				},
				{
					type: "null",
				},
			],
		},
		engineNeutral: {
			type: "boolean",
			const: true,
		},
		families: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetFamilyId: {
						type: "string",
						minLength: 1,
					},
					assetFamilyName: {
						type: "string",
					},
					profileContractRevisionIds: {
						type: "array",
						items: {
							type: "string",
							minLength: 1,
						},
					},
					support: {
						type: "string",
						enum: ["general_asset_support", "specialized"],
					},
				},
				required: [
					"assetFamilyId",
					"assetFamilyName",
					"profileContractRevisionIds",
					"support",
				],
				additionalProperties: false,
			},
		},
		files: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetFamilyId: {
						type: "string",
						minLength: 1,
					},
					assetRecordId: {
						type: "string",
						minLength: 1,
					},
					assetVersionId: {
						type: "string",
						minLength: 1,
					},
					byteSize: {
						type: "integer",
						exclusiveMinimum: 0,
						maximum: 9_007_199_254_740_991,
					},
					contentType: {
						type: "string",
					},
					itemId: {
						type: "string",
						minLength: 1,
					},
					path: {
						type: "string",
						minLength: 1,
					},
					sha256: {
						type: "string",
						pattern: "^[0-9a-f]{64}$",
					},
				},
				required: [
					"assetFamilyId",
					"assetRecordId",
					"assetVersionId",
					"byteSize",
					"contentType",
					"itemId",
					"path",
					"sha256",
				],
				additionalProperties: false,
			},
		},
		format: {
			type: "string",
			const: "sprite-anvil.export-bundle",
		},
		kitFiles: {
			type: "array",
			items: {
				type: "object",
				properties: {
					path: {
						type: "string",
						minLength: 1,
					},
					sha256: {
						type: "string",
						pattern: "^[0-9a-f]{64}$",
					},
				},
				required: ["path", "sha256"],
				additionalProperties: false,
			},
		},
		productionEvidence: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetVersionId: {
						type: "string",
						minLength: 1,
					},
					evidenceDigest: {
						type: "string",
						pattern: "^[0-9a-f]{64}$",
					},
					providerGenerationRecordId: {
						anyOf: [
							{
								type: "string",
								minLength: 1,
							},
							{
								type: "null",
							},
						],
					},
				},
				required: [
					"assetVersionId",
					"evidenceDigest",
					"providerGenerationRecordId",
				],
				additionalProperties: false,
			},
		},
		profile: {
			type: "object",
			properties: {
				contentDigest: {
					type: "string",
					pattern: "^[0-9a-f]{64}$",
				},
				contractVersion: {
					type: "string",
					pattern: "^\\d+\\.\\d+\\.\\d+$",
				},
				definition: {
					type: "object",
					propertyNames: {
						type: "string",
					},
					additionalProperties: {},
				},
				profileId: {
					type: "string",
					minLength: 1,
				},
				revisionId: {
					type: "string",
					minLength: 1,
				},
				revisionNumber: {
					type: "integer",
					exclusiveMinimum: 0,
					maximum: 9_007_199_254_740_991,
				},
			},
			required: [
				"contentDigest",
				"contractVersion",
				"definition",
				"profileId",
				"revisionId",
				"revisionNumber",
			],
			additionalProperties: false,
		},
		qualityEvidence: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetFamilyId: {
						type: "string",
						minLength: 1,
					},
					assetVersionIds: {
						type: "array",
						items: {
							type: "string",
							minLength: 1,
						},
					},
					evidenceId: {
						type: "string",
						minLength: 1,
					},
					itemId: {
						type: "string",
						minLength: 1,
					},
					kind: {
						type: "string",
					},
					observedValue: {
						type: ["string", "null"],
					},
					result: {
						type: "string",
					},
					ruleClass: {
						type: ["string", "null"],
					},
					ruleId: {
						type: ["string", "null"],
					},
					versionTarget: {
						anyOf: [
							{
								type: "object",
								properties: {
									id: {
										type: "string",
										minLength: 1,
									},
									kind: {
										type: "string",
										enum: ["unit", "composite"],
									},
								},
								required: ["id", "kind"],
								additionalProperties: false,
							},
							{
								type: "null",
							},
						],
					},
				},
				required: [
					"assetFamilyId",
					"assetVersionIds",
					"evidenceId",
					"itemId",
					"kind",
					"observedValue",
					"result",
					"ruleClass",
					"ruleId",
					"versionTarget",
				],
				additionalProperties: false,
			},
		},
		requiredSets: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetFamilyId: {
						type: "string",
						minLength: 1,
					},
					items: {
						type: "array",
						items: {
							type: "object",
							properties: {
								assetRecordIds: {
									type: "array",
									items: {
										type: "string",
										minLength: 1,
									},
								},
								disposition: {
									type: "string",
								},
								id: {
									type: "string",
									minLength: 1,
								},
								kind: {
									type: "string",
								},
								name: {
									type: "string",
								},
								testId: {
									type: ["string", "null"],
								},
							},
							required: [
								"assetRecordIds",
								"disposition",
								"id",
								"kind",
								"name",
								"testId",
							],
							additionalProperties: false,
						},
					},
					revisionId: {
						type: "string",
						minLength: 1,
					},
					revisionNumber: {
						type: "integer",
						exclusiveMinimum: 0,
						maximum: 9_007_199_254_740_991,
					},
				},
				required: ["assetFamilyId", "items", "revisionId", "revisionNumber"],
				additionalProperties: false,
			},
		},
		rightsEvidence: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetRecordId: {
						type: "string",
						minLength: 1,
					},
					rightsRecordId: {
						type: "string",
						minLength: 1,
					},
					state: {
						type: "string",
					},
					versionNumber: {
						type: "integer",
						exclusiveMinimum: 0,
						maximum: 9_007_199_254_740_991,
					},
				},
				required: ["assetRecordId", "rightsRecordId", "state", "versionNumber"],
				additionalProperties: false,
			},
		},
		unitVersions: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetRecordId: {
						type: "string",
						minLength: 1,
					},
					assetVersionId: {
						type: "string",
						minLength: 1,
					},
					id: {
						type: "string",
						minLength: 1,
					},
					unitKey: {
						type: "string",
					},
					unitType: {
						type: "string",
					},
					versionNumber: {
						type: "integer",
						exclusiveMinimum: 0,
						maximum: 9_007_199_254_740_991,
					},
				},
				required: [
					"assetRecordId",
					"assetVersionId",
					"id",
					"unitKey",
					"unitType",
					"versionNumber",
				],
				additionalProperties: false,
			},
		},
		waivers: {
			type: "array",
			items: {
				type: "object",
				properties: {
					assetVersionIds: {
						type: "array",
						items: {
							type: "string",
							minLength: 1,
						},
					},
					evidenceId: {
						type: "string",
						minLength: 1,
					},
					itemId: {
						type: "string",
						minLength: 1,
					},
					observedValue: {
						type: ["string", "null"],
					},
					rationale: {
						type: "string",
					},
					ruleClass: {
						type: ["string", "null"],
					},
					ruleId: {
						type: ["string", "null"],
					},
					versionTarget: {
						anyOf: [
							{
								type: "object",
								properties: {
									id: {
										type: "string",
										minLength: 1,
									},
									kind: {
										type: "string",
										enum: ["unit", "composite"],
									},
								},
								required: ["id", "kind"],
								additionalProperties: false,
							},
							{
								type: "null",
							},
						],
					},
				},
				required: [
					"assetVersionIds",
					"evidenceId",
					"itemId",
					"observedValue",
					"rationale",
					"ruleClass",
					"ruleId",
					"versionTarget",
				],
				additionalProperties: false,
			},
		},
	},
	required: [
		"adapterVersion",
		"compositeVersions",
		"context",
		"contractVersion",
		"dataStructureVersion",
		"deliveryTargetRevisionId",
		"engineNeutral",
		"families",
		"files",
		"format",
		"kitFiles",
		"productionEvidence",
		"profile",
		"qualityEvidence",
		"requiredSets",
		"rightsEvidence",
		"unitVersions",
		"waivers",
	],
	additionalProperties: false,
};

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function describeType(value: unknown): string {
	if (value === null) {
		return "null";
	}
	return Array.isArray(value) ? "array" : typeof value;
}

function matchesType(value: unknown, type: string): boolean {
	if (type === "integer") {
		return typeof value === "number" && Number.isInteger(value);
	}
	if (type === "array") {
		return Array.isArray(value);
	}
	if (type === "object") {
		return isObject(value);
	}
	return describeType(value) === type;
}

function checkString(
	value: string,
	schema: JsonObject,
	pointer: string
): string | null {
	if (typeof schema.minLength === "number" && value.length < schema.minLength) {
		return `${pointer} is too short`;
	}
	if (
		typeof schema.pattern === "string" &&
		!new RegExp(schema.pattern).test(value)
	) {
		return `${pointer} does not match its pattern`;
	}
	return null;
}

function checkNumber(
	value: number,
	schema: JsonObject,
	pointer: string
): string | null {
	const belowMinimum =
		(typeof schema.minimum === "number" && value < schema.minimum) ||
		(typeof schema.exclusiveMinimum === "number" &&
			value <= schema.exclusiveMinimum);
	if (belowMinimum) {
		return `${pointer} is below its minimum`;
	}
	if (typeof schema.maximum === "number" && value > schema.maximum) {
		return `${pointer} is above its maximum`;
	}
	return null;
}

function checkScalar(
	value: unknown,
	schema: JsonObject,
	pointer: string
): string | null {
	if ("const" in schema && value !== schema.const) {
		return `${pointer} must be ${JSON.stringify(schema.const)}`;
	}
	if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
		return `${pointer} is not an allowed value`;
	}
	if (typeof value === "string") {
		return checkString(value, schema, pointer);
	}
	return typeof value === "number" ? checkNumber(value, schema, pointer) : null;
}

function validateObject(
	value: JsonObject,
	schema: JsonObject,
	pointer: string,
	errors: string[]
): void {
	const properties = isObject(schema.properties) ? schema.properties : {};
	const required = Array.isArray(schema.required) ? schema.required : [];
	for (const name of required) {
		if (!(typeof name === "string" && name in value)) {
			errors.push(`${pointer}/${String(name)} is required`);
		}
	}
	for (const name of Object.keys(value).sort()) {
		const member = properties[name];
		if (isObject(member)) {
			validateSchema(value[name], member, `${pointer}/${name}`, errors);
		} else if (schema.additionalProperties === false) {
			errors.push(`${pointer}/${name} is not a known field`);
		} else if (isObject(schema.additionalProperties)) {
			validateSchema(
				value[name],
				schema.additionalProperties,
				`${pointer}/${name}`,
				errors
			);
		}
	}
}

/** Validates the JSON Schema subset the manifest schema uses; appends messages. */
function validateSchema(
	value: unknown,
	schema: JsonObject,
	pointer: string,
	errors: string[]
): void {
	if (Array.isArray(schema.anyOf)) {
		const options = schema.anyOf.filter(isObject);
		const matched = options.some((option) => {
			const inner: string[] = [];
			validateSchema(value, option, pointer, inner);
			return inner.length === 0;
		});
		if (!matched) {
			errors.push(`${pointer} matches none of the allowed shapes`);
		}
		return;
	}
	if (typeof schema.type === "string" && !matchesType(value, schema.type)) {
		errors.push(
			`${pointer} must be ${schema.type}, found ${describeType(value)}`
		);
		return;
	}
	const scalarError = checkScalar(value, schema, pointer);
	if (scalarError) {
		errors.push(scalarError);
		return;
	}
	if (Array.isArray(value) && isObject(schema.items)) {
		for (const [index, item] of value.entries()) {
			validateSchema(item, schema.items, `${pointer}/${index}`, errors);
		}
	} else if (isObject(value)) {
		validateObject(value, schema, pointer, errors);
	}
}

/** Messages for every way `value` violates `schema`; empty when it conforms. */
export function validateJsonSchema(
	value: unknown,
	schema: JsonObject = exportBundleManifestJsonSchema
): string[] {
	const errors: string[] = [];
	validateSchema(value, schema, "", errors);
	return errors;
}

function compare(left: string, right: string): number {
	return Number(left > right) - Number(left < right);
}

/** JSON with sorted keys and no whitespace, so equal data compares equal. */
export function canonicalJson(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonicalJson).join(",")}]`;
	}
	if (isObject(value)) {
		return `{${Object.keys(value)
			.sort(compare)
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
			.join(",")}}`;
	}
	return JSON.stringify(value);
}

/** SHA-256 (hex) of raw bytes. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest(
		"SHA-256",
		bytes as Parameters<typeof crypto.subtle.digest>[1]
	);
	return Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, "0")
	).join("");
}

function contractMajor(version: string): number {
	return Number(version.split(".")[0]);
}

function decode(bytes: Uint8Array): string | null {
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

function parseJson(bytes: Uint8Array): unknown {
	const text = decode(bytes);
	if (text === null) {
		return undefined;
	}
	try {
		return JSON.parse(text);
	} catch {
		return undefined;
	}
}

function unsafePath(path: string): boolean {
	return (
		path === "" ||
		path.startsWith("/") ||
		path.includes("\\") ||
		path.split("/").some((part) => part === "" || part === "." || part === "..")
	);
}

type Failure = ExportBundleIntegrityFailure;
interface Manifest {
	contractVersion: string;
	files: {
		assetFamilyId: string;
		assetRecordId: string;
		assetVersionId: string;
		byteSize: number;
		itemId: string;
		path: string;
		sha256: string;
	}[];
	kitFiles: { path: string; sha256: string }[];
	[key: string]: unknown;
}

function failure(
	code: Failure["code"],
	message: string,
	path: string | null = null
): Failure {
	return { code, message, path };
}

function checkPaths(files: ExportBundleVerificationFile[]): Failure[] {
	const failures: Failure[] = [];
	const seen = new Set<string>();
	for (const file of files) {
		if (unsafePath(file.path)) {
			failures.push(
				failure(
					"unsafe_path",
					`The path ${file.path} is not allowed.`,
					file.path
				)
			);
		}
		const key = file.path.toLowerCase();
		if (seen.has(key)) {
			failures.push(
				failure(
					"duplicate_path",
					`The path ${file.path} appears more than once.`,
					file.path
				)
			);
		}
		seen.add(key);
	}
	return failures;
}

function listedFileFailure(
	entry: Manifest["files"][number],
	file: ExportBundleVerificationFile | undefined,
	digest: string | null
): Failure | null {
	if (!file) {
		return failure(
			"missing_file",
			`The file ${entry.path} is missing.`,
			entry.path
		);
	}
	if ((file.recorded?.byteSize ?? file.bytes.length) !== entry.byteSize) {
		return failure(
			"size_mismatch",
			`The file ${entry.path} does not have the size the manifest records.`,
			entry.path
		);
	}
	return digest === entry.sha256
		? null
		: failure(
				"digest_mismatch",
				`The file ${entry.path} does not match its recorded digest.`,
				entry.path
			);
}

async function checkListedFiles(
	manifest: Manifest,
	byPath: Map<string, ExportBundleVerificationFile>
): Promise<Failure[]> {
	const failures: Failure[] = [];
	const listed = new Set<string>();
	const digests = await Promise.all(
		manifest.files.map((entry) => {
			const file = byPath.get(entry.path);
			if (!file) {
				return null;
			}
			return file.recorded ? file.recorded.sha256 : sha256Hex(file.bytes);
		})
	);
	for (const [index, entry] of manifest.files.entries()) {
		const key = entry.path.toLowerCase();
		if (listed.has(key)) {
			failures.push(
				failure(
					"duplicate_path",
					`The manifest lists ${entry.path} more than once.`,
					entry.path
				)
			);
		}
		listed.add(key);
		const problem = listedFileFailure(
			entry,
			byPath.get(entry.path),
			digests[index] ?? null
		);
		if (problem) {
			failures.push(problem);
		}
	}
	for (const path of [...byPath.keys()].sort(compare)) {
		const own = path === manifestPath || path === checksumsPath;
		if (
			!(own || path.startsWith(kitPrefix) || listed.has(path.toLowerCase()))
		) {
			failures.push(
				failure(
					"unlisted_file",
					`The bundle holds ${path}, which the manifest does not list.`,
					path
				)
			);
		}
	}
	return failures;
}

async function checkChecksumList(
	manifest: Manifest,
	manifestBytes: Uint8Array,
	checksumBytes: Uint8Array
): Promise<Failure[]> {
	const lines = [
		...manifest.files.map((file) => ({ path: file.path, sha256: file.sha256 })),
		{ path: manifestPath, sha256: await sha256Hex(manifestBytes) },
	]
		.sort((left, right) => compare(left.path, right.path))
		.map((file) => `${file.sha256}  ${file.path}\n`)
		.join("");
	return decode(checksumBytes) === lines
		? []
		: [
				failure(
					"checksum_list_mismatch",
					"The checksum list does not match the manifest and its files.",
					checksumsPath
				),
			];
}

function ids<T>(items: T[], pick: (item: T) => string): Set<string> {
	return new Set(items.map(pick));
}

function checkSetsMatch(
	left: Set<string>,
	right: Set<string>,
	describe: (id: string) => string
): Failure[] {
	return [
		...[...left].filter((id) => !right.has(id)),
		...[...right].filter((id) => !left.has(id)),
	]
		.sort(compare)
		.map((id) => failure("record_link", describe(id)));
}

function checkRecordLinks(manifest: JsonObject & Manifest): Failure[] {
	const list = <T>(key: string) => (manifest[key] as T[]) ?? [];
	const families = list<{ assetFamilyId: string }>("families");
	const requiredSets = list<{
		assetFamilyId: string;
		items: { id: string }[];
	}>("requiredSets");
	const evidence = list<{ assetVersionId: string }>("productionEvidence");
	const quality = list<{
		assetFamilyId: string;
		evidenceId: string;
		itemId: string;
		result: string;
	}>("qualityEvidence");
	const waivers = list<{ evidenceId: string }>("waivers");
	const rights = list<{ assetRecordId: string }>("rightsEvidence");
	const composites = list<{ id: string; memberUnitVersionIds: string[] }>(
		"compositeVersions"
	);
	const unitIds = ids(list<{ id: string }>("unitVersions"), (unit) => unit.id);
	const itemsByFamily = new Map(
		requiredSets.map((set) => [
			set.assetFamilyId,
			new Set(set.items.map((item) => item.id)),
		])
	);
	const failures = [
		...checkSetsMatch(
			ids(families, (family) => family.assetFamilyId),
			ids(requiredSets, (set) => set.assetFamilyId),
			(id) =>
				`Family ${id} is not in both the family list and the Required Sets.`
		),
		...checkSetsMatch(
			ids(manifest.files, (file) => file.assetVersionId),
			ids(evidence, (entry) => entry.assetVersionId),
			(id) =>
				`Asset Version ${id} is not in both the files and the production evidence.`
		),
	];
	for (const file of manifest.files) {
		if (!itemsByFamily.get(file.assetFamilyId)?.has(file.itemId)) {
			failures.push(
				failure(
					"record_link",
					`The file ${file.path} points at an item that is not in its family's Required Set.`,
					file.path
				)
			);
		}
	}
	const recordIds = ids(manifest.files, (file) => file.assetRecordId);
	for (const entry of rights) {
		if (!recordIds.has(entry.assetRecordId)) {
			failures.push(
				failure(
					"record_link",
					`Rights evidence points at Asset Record ${entry.assetRecordId}, which has no file.`
				)
			);
		}
	}
	for (const entry of quality) {
		if (!itemsByFamily.get(entry.assetFamilyId)?.has(entry.itemId)) {
			failures.push(
				failure(
					"record_link",
					`Quality evidence ${entry.evidenceId} points at an item that is not in its family's Required Set.`
				)
			);
		}
	}
	const waivedIds = ids(
		quality.filter((entry) => entry.result === "waived"),
		(entry) => entry.evidenceId
	);
	for (const waiver of waivers) {
		if (!waivedIds.has(waiver.evidenceId)) {
			failures.push(
				failure(
					"record_link",
					`Waiver ${waiver.evidenceId} has no waived quality evidence.`
				)
			);
		}
	}
	for (const composite of composites) {
		for (const member of composite.memberUnitVersionIds) {
			if (!unitIds.has(member)) {
				failures.push(
					failure(
						"record_link",
						`Composite Version ${composite.id} lists unknown Unit Version ${member}.`
					)
				);
			}
		}
	}
	return failures;
}

const versionLinePattern =
	/^(Manifest contract version|Profile contract version|Kit contract version): (\d+\.\d+\.\d+)$/gm;

function readmeVersions(readme: string): Map<string, string> {
	const found = new Map<string, string>();
	for (const match of readme.matchAll(versionLinePattern)) {
		found.set(match[1] ?? "", match[2] ?? "");
	}
	return found;
}

function checkReadme(readme: string, manifest: Manifest): Failure[] {
	const found = readmeVersions(readme);
	const profile = manifest.profile as { contractVersion: string };
	const expected: [string, string][] = [
		["Manifest contract version", manifest.contractVersion],
		["Profile contract version", profile.contractVersion],
	];
	const failures: Failure[] = [];
	for (const [label, version] of expected) {
		if (found.get(label) !== version) {
			failures.push(
				failure(
					"readme_contradiction",
					`The README must state "${label}: ${version}".`,
					kitReadmePath
				)
			);
		}
	}
	const kitVersion = found.get("Kit contract version");
	if (
		kitVersion === undefined ||
		contractMajor(kitVersion) !== contractMajor(manifest.contractVersion)
	) {
		failures.push(
			failure(
				"readme_contradiction",
				"The README must state a Kit contract version of the manifest's major version.",
				kitReadmePath
			)
		);
	}
	return failures;
}

function checkExample(path: string, bytes: Uint8Array, kitVersion: string) {
	const text = decode(bytes) ?? "";
	const parsed = parseJson(bytes);
	if (text.startsWith("#!") || !isObject(parsed)) {
		return [
			failure("kit_executable", `${path} is not a data-only mapping.`, path),
		];
	}
	const mapping = canonicalJson(parsed);
	const hasCommand = forbiddenExampleKeys.some((key) =>
		mapping.includes(`"${key}":`)
	);
	if (parsed.executable !== false || hasCommand) {
		return [
			failure(
				"kit_executable",
				`${path} must be a non-executable example mapping.`,
				path
			),
		];
	}
	if (parsed.kitContractVersion !== kitVersion) {
		return [
			failure(
				"readme_contradiction",
				`${path} states a Kit contract version that differs from the README.`,
				path
			),
		];
	}
	return [];
}

function checkKitSchema(
	manifest: Manifest,
	file: ExportBundleVerificationFile
): Failure[] {
	const schema = parseJson(file.bytes);
	const matches =
		isObject(schema) &&
		schema["x-contractVersion"] === manifest.contractVersion &&
		canonicalJson(
			Object.fromEntries(
				Object.entries(schema).filter(([key]) => !key.startsWith("x-"))
			)
		) === canonicalJson(exportBundleManifestJsonSchema);
	return matches
		? []
		: [
				failure(
					"kit_schema_mismatch",
					"The kit schema does not match the manifest contract version.",
					kitSchemaPath
				),
			];
}

function checkKitFileSet(
	byPath: Map<string, ExportBundleVerificationFile>,
	examples: string[]
): Failure[] {
	const required = [
		kitReadmePath,
		kitChecksumsPath,
		kitSchemaPath,
		kitVerifierPath,
	];
	const failures = required
		.filter((path) => !byPath.has(path))
		.map((path) =>
			failure("kit_file_missing", `The kit file ${path} is missing.`, path)
		);
	if (examples.length === 0) {
		failures.push(
			failure(
				"kit_file_missing",
				"The kit has no example mapping.",
				`${kitPrefix}examples`
			)
		);
	}
	for (const path of [...byPath.keys()].sort(compare)) {
		if (
			path.startsWith(kitPrefix) &&
			!required.includes(path) &&
			!examples.includes(path)
		) {
			failures.push(
				failure(
					"kit_unexpected_file",
					`The kit holds ${path}, which a kit does not carry.`,
					path
				)
			);
		}
	}
	return failures;
}

function checkKitReadmeAndExamples(
	manifest: Manifest,
	byPath: Map<string, ExportBundleVerificationFile>,
	examples: string[]
): Failure[] {
	const readmeFile = byPath.get(kitReadmePath);
	if (!readmeFile) {
		return [];
	}
	const readme = decode(readmeFile.bytes) ?? "";
	const kitVersion = readmeVersions(readme).get("Kit contract version") ?? "";
	const failures = checkReadme(readme, manifest);
	for (const path of examples) {
		const file = byPath.get(path);
		if (file) {
			failures.push(...checkExample(path, file.bytes, kitVersion));
		}
	}
	return failures;
}

/** Every kit file but the checksum list is pinned by the manifest: same set, same digests. */
async function checkKitPins(
	manifest: Manifest,
	byPath: Map<string, ExportBundleVerificationFile>
): Promise<Failure[]> {
	const pinned = new Map(manifest.kitFiles.map((pin) => [pin.path, pin]));
	const checked = await Promise.all(
		[...byPath.entries()]
			.filter(([path]) => path.startsWith(kitPrefix) && pinned.has(path))
			.map(async ([path, file]) => ({
				digest: await sha256Hex(file.bytes),
				path,
			}))
	);
	const failures = checked
		.filter((entry) => entry.digest !== pinned.get(entry.path)?.sha256)
		.map((entry) =>
			failure(
				"kit_digest_mismatch",
				`The kit file ${entry.path} does not match the digest the manifest pins.`,
				entry.path
			)
		);
	for (const path of [...byPath.keys()].sort(compare)) {
		const isKitContent =
			path === kitReadmePath ||
			path === kitSchemaPath ||
			path === kitVerifierPath ||
			kitExamplePattern.test(path);
		if (isKitContent && !pinned.has(path)) {
			failures.push(
				failure(
					"kit_unexpected_file",
					`The kit holds ${path}, which the manifest does not pin.`,
					path
				)
			);
		}
	}
	for (const path of [...pinned.keys()].sort(compare)) {
		if (!byPath.has(path)) {
			failures.push(
				failure("kit_file_missing", `The kit file ${path} is missing.`, path)
			);
		}
	}
	return failures;
}

async function checkKit(
	manifest: Manifest,
	byPath: Map<string, ExportBundleVerificationFile>,
	checksumBytes: Uint8Array
): Promise<Failure[]> {
	const examples = [...byPath.keys()].filter((path) =>
		kitExamplePattern.test(path)
	);
	const failures = checkKitFileSet(byPath, examples);
	const kitChecksums = byPath.get(kitChecksumsPath);
	if (kitChecksums && decode(kitChecksums.bytes) !== decode(checksumBytes)) {
		failures.push(
			failure(
				"checksum_list_mismatch",
				"The kit checksum list differs from the bundle checksum list.",
				kitChecksumsPath
			)
		);
	}
	const schemaFile = byPath.get(kitSchemaPath);
	if (schemaFile) {
		failures.push(...checkKitSchema(manifest, schemaFile));
	}
	failures.push(
		...checkKitReadmeAndExamples(manifest, byPath, examples),
		...(await checkKitPins(manifest, byPath))
	);
	return failures;
}

/**
 * Verifies a bundle directory offline: path safety and uniqueness, manifest
 * schema and contract version, every file digest and size, the checksum list,
 * record links, and the Package Verification Kit. The same failure list comes
 * back wherever it runs.
 */
export async function verifyExportBundle(
	files: ExportBundleVerificationFile[]
): Promise<ExportBundleIntegrityResult> {
	const failures = checkPaths(files);
	const byPath = new Map<string, ExportBundleVerificationFile>();
	for (const file of files) {
		if (!byPath.has(file.path)) {
			byPath.set(file.path, file);
		}
	}
	const manifestFile = byPath.get(manifestPath);
	const checksumsFile = byPath.get(checksumsPath);
	for (const [path, file] of [
		[manifestPath, manifestFile],
		[checksumsPath, checksumsFile],
	] as const) {
		if (!file) {
			failures.push(
				failure("missing_file", `The file ${path} is missing.`, path)
			);
		}
	}
	if (!(manifestFile && checksumsFile)) {
		return { failures, ok: false };
	}
	const parsed = parseJson(manifestFile.bytes);
	if (!isObject(parsed)) {
		failures.push(
			failure(
				"manifest_invalid",
				"The manifest is not valid JSON.",
				manifestPath
			)
		);
		return { failures, ok: false };
	}
	const version = parsed.contractVersion;
	if (
		typeof version !== "string" ||
		contractMajor(version) !== exportBundleSupportedMajor
	) {
		failures.push(
			failure(
				"unsupported_major",
				"The manifest contract version is not supported.",
				manifestPath
			)
		);
		return { failures, ok: false };
	}
	const schemaErrors = validateJsonSchema(parsed);
	if (schemaErrors.length > 0) {
		failures.push(
			...schemaErrors.map((message) =>
				failure("schema_violation", `The manifest ${message}.`, manifestPath)
			)
		);
		return { failures, ok: false };
	}
	const manifest = parsed as Manifest;
	failures.push(
		...(await checkListedFiles(manifest, byPath)),
		...(await checkChecksumList(
			manifest,
			manifestFile.bytes,
			checksumsFile.bytes
		)),
		...checkRecordLinks(manifest),
		...(await checkKit(manifest, byPath, checksumsFile.bytes))
	);
	if (failures.length > 0) {
		return { failures, ok: false };
	}
	return {
		fileCount: files.length,
		manifestDigest: await sha256Hex(manifestFile.bytes),
		ok: true,
	};
}

/** Reads a bundle directory's files with Node or Bun file APIs. */
async function readDirectory(
	directory: string
): Promise<ExportBundleVerificationFile[]> {
	const { readdir, readFile } = await import("node:fs/promises");
	const entries = await readdir(directory, {
		recursive: true,
		withFileTypes: true,
	});
	const files = await Promise.all(
		entries
			.filter((entry) => entry.isFile())
			.map(async (entry) => {
				const absolute = `${entry.parentPath}/${entry.name}`;
				const path = absolute
					.slice(directory.length)
					.replace(leadingSeparators, "")
					.replaceAll("\\", "/");
				return { bytes: new Uint8Array(await readFile(absolute)), path };
			})
	);
	return files.sort((left, right) => compare(left.path, right.path));
}

/** Command line entry: prints the result as JSON; exit code 0 ok, 1 not ok, 2 usage. */
export async function runExportBundleVerifier(argv: string[]): Promise<number> {
	const [directory] = argv;
	if (!directory) {
		console.error("Usage: verify.ts <bundle-directory>");
		return 2;
	}
	const result = await verifyExportBundle(await readDirectory(directory));
	console.log(JSON.stringify(result, null, 2));
	return result.ok ? 0 : 1;
}

/** A path in one comparable form: forward slashes, no drive-letter URL slash, no `.` or `..` segments. */
function normalizePath(path: string): string {
	const slashed = path
		.replaceAll("\\", "/")
		.replace(driveLetterUrlPrefix, "$1");
	const absolute = slashed.startsWith("/");
	const parts: string[] = [];
	for (const part of slashed.split("/")) {
		if (part === "..") {
			parts.pop();
		} else if (part !== "" && part !== ".") {
			parts.push(part);
		}
	}
	return `${absolute ? "/" : ""}${parts.join("/")}`;
}

/** Whether two paths name the same file after normalizing; a different directory is never the same. */
export function isSamePath(left: string, right: string): boolean {
	return normalizePath(left) === normalizePath(right);
}

const runtime = globalThis as unknown as {
	process?: { argv: string[]; exitCode?: number };
};

/** Whether this module is the script being run, resolving a symlinked prefix such as /var against /private/var. */
async function isEntryPoint(script: string): Promise<boolean> {
	const modulePath = decodeURIComponent(new URL(import.meta.url).pathname);
	if (isSamePath(modulePath, script)) {
		return true;
	}
	try {
		const { realpath } = await import("node:fs/promises");
		return isSamePath(await realpath(modulePath), await realpath(script));
	} catch {
		return false;
	}
}

const entryScript = runtime.process?.argv[1];
if (runtime.process && entryScript) {
	const host = runtime.process;
	isEntryPoint(entryScript).then(async (isEntry) => {
		if (isEntry) {
			// Set the exit code instead of exiting so a piped result is fully written.
			host.exitCode = await runExportBundleVerifier(host.argv.slice(2));
		}
	});
}
