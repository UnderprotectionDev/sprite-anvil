import { z } from "zod";
import {
	type GameplayMetadataFrame,
	type GameplayMetadataRecord,
	type GameplayMetadataStore,
	gameplayMetadataListInputSchema,
	gameplayMetadataRecordSchema,
} from "./gameplay-metadata";
import {
	canonicalGameplayMetadataJson,
	getGameplayMetadataIntegrityErrors,
} from "./gameplay-metadata-integrity";

export const gameplayMetadataPackageInputSchema =
	gameplayMetadataListInputSchema
		.extend({
			recordId: z.uuid(),
		})
		.strict();
export const gameplayMetadataPackageReadInputSchema =
	gameplayMetadataPackageInputSchema
		.extend({
			package: z
				.json()
				.refine(
					(value) =>
						new TextEncoder().encode(JSON.stringify(value)).length <= 524_288,
					"Gameplay Metadata package exceeds 512 KiB."
				),
		})
		.strict();
const payloadSchema = z
	.object({
		format: z.literal("sprite-anvil.gameplay-metadata"),
		schemaVersion: z.literal("1.0.0"),
		record: gameplayMetadataRecordSchema,
	})
	.strict();
export const gameplayMetadataPackageSchema = payloadSchema
	.extend({
		contentDigest: z.string().regex(/^[0-9a-f]{64}$/),
	})
	.strict();
export type GameplayMetadataPackage = z.infer<
	typeof gameplayMetadataPackageSchema
>;
export type GameplayMetadataPackageTargetReader = (request: {
	userId: string;
	input: z.infer<typeof gameplayMetadataPackageInputSchema>;
	store: GameplayMetadataStore;
}) => Promise<{
	record: GameplayMetadataRecord;
	frames: GameplayMetadataFrame[];
}>;

async function digest(payload: z.infer<typeof payloadSchema>) {
	const bytes = new TextEncoder().encode(
		canonicalGameplayMetadataJson(payload)
	);
	const hash = await crypto.subtle.digest("SHA-256", bytes);
	return Array.from(new Uint8Array(hash), (value) =>
		value.toString(16).padStart(2, "0")
	).join("");
}

export async function createGameplayMetadataPackage(
	record: GameplayMetadataRecord,
	frames: GameplayMetadataFrame[]
): Promise<GameplayMetadataPackage> {
	const errors = getGameplayMetadataIntegrityErrors(record, frames);
	if (!record.review) {
		errors.push("Oyun içi bilgiler kullanıcı tarafından incelenmedi.");
	}
	if (errors.length) {
		throw new Error(`Bütünlük hatası: ${errors.join(" ")}`);
	}
	const payload = payloadSchema.parse({
		format: "sprite-anvil.gameplay-metadata",
		schemaVersion: "1.0.0",
		record,
	});
	return { ...payload, contentDigest: await digest(payload) };
}

export async function readGameplayMetadataPackage(
	value: unknown,
	expected: GameplayMetadataRecord,
	frames: GameplayMetadataFrame[]
): Promise<GameplayMetadataPackage> {
	const parsed = gameplayMetadataPackageSchema.safeParse(value);
	if (!parsed.success) {
		throw new Error(
			"Bütünlük hatası: paket biçimi, kare kimliği veya zorunlu bağlantı geçersiz."
		);
	}
	const original = await createGameplayMetadataPackage(expected, frames);
	if (
		canonicalGameplayMetadataJson(parsed.data) !==
		canonicalGameplayMetadataJson(original)
	) {
		throw new Error(
			"Bütünlük hatası: incelenmiş alan, kaynak, kare veya kesin sürüm paket yeniden okumasında değişti."
		);
	}
	return parsed.data;
}
