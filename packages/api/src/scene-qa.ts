import { z } from "zod";
import {
	specializedProfileContractSchema,
	specializedProfileIdSchema,
} from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const coordinate = z.number().int().min(-8192).max(8192);
const point = z.object({ x: coordinate, y: coordinate }).strict();
const frame = z
	.object({
		x: z.number().int().nonnegative().max(8192),
		y: z.number().int().nonnegative().max(8192),
		width: z.number().int().min(1).max(4096),
		height: z.number().int().min(1).max(4096),
		durationMs: z.number().int().min(16).max(10_000),
	})
	.strict();
export const sceneQaRoles = [
	"tile",
	"background",
	"character",
	"object",
	"shadow",
	"effect",
] as const;
export const sceneQaRoleProfiles = {
	tile: "tileset_terrain_texture",
	background: "background_parallax",
	character: "character_creature_animation",
	object: "object_weapon_equipment_states",
	shadow: "visual_effect_projectile_shadow_mark",
	effect: "visual_effect_projectile_shadow_mark",
} as const;
export const sceneQaPlacementSchema = z
	.object({
		id,
		role: z.enum(sceneQaRoles),
		assetVersionId: id,
		contractRevisionId: id,
		usageTestId: id,
		x: coordinate,
		y: coordinate,
		layer: z.number().int().min(-100).max(100),
		scale: z.number().int().min(1).max(8),
		pivot: point,
		groundPoint: point,
		sortPoint: point,
		origin: point,
		areas: z
			.array(
				z
					.object({
						kind: z.enum(["hitbox", "hurtbox", "collision"]),
						x: coordinate,
						y: coordinate,
						width: z.number().int().min(1).max(4096),
						height: z.number().int().min(1).max(4096),
					})
					.strict()
			)
			.max(16),
		clips: z
			.object({
				idle: z.array(frame).min(1).max(64),
				walk: z.array(frame).max(64),
				attack: z.array(frame).max(64),
			})
			.strict(),
	})
	.strict();
export const sceneQaSetupSchema = z
	.object({
		width: z.number().int().min(64).max(1920),
		height: z.number().int().min(64).max(1080),
		durationMs: z.number().int().min(3000).max(30_000),
		camera: z.enum(["fixed", "follow", "pan"]),
		contrast: z.enum(["light", "dark"]),
		ySort: z.boolean(),
		showOverlays: z.boolean(),
		movement: point,
		hitAtMs: z.number().int().positive(),
		placements: z.array(sceneQaPlacementSchema).min(1).max(24),
	})
	.strict()
	.superRefine((setup, ctx) => {
		if (
			new Set(setup.placements.map((p) => p.id)).size !==
			setup.placements.length
		) {
			ctx.addIssue({
				code: "custom",
				message: "Placement identities must be unique.",
			});
		}
		if (setup.placements.filter((p) => p.role === "character").length > 1) {
			ctx.addIssue({
				code: "custom",
				message: "The lightweight scene supports one moving character.",
			});
		}
		if (
			setup.hitAtMs < setup.durationMs * 0.6 ||
			setup.hitAtMs >= setup.durationMs * 0.85
		) {
			ctx.addIssue({
				code: "custom",
				message:
					"The hit event must fall inside the attack interval (60–85% of playback).",
			});
		}
		for (const p of setup.placements) {
			if (
				p.role === "character" &&
				!(p.clips.walk.length && p.clips.attack.length)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Character placements require idle, walk and attack frames.",
				});
			}
		}
		if (
			setup.placements.some((p) => p.role === "effect") &&
			!setup.placements.some((p) => p.role === "character")
		) {
			ctx.addIssue({
				code: "custom",
				message: "An event effect requires a character owner.",
			});
		}
	});
export const sceneQaListInputSchema = z.object({ projectId: id }).strict();
export const sceneQaInputSchema = sceneQaListInputSchema
	.extend({
		id: z.uuid(),
		name: z.string().trim().min(1).max(120),
		setup: sceneQaSetupSchema,
		playbackMs: z.number().int().positive().max(30_000),
		observations: z
			.object({
				scale: z.string().trim().min(1).max(2000),
				layering: z.string().trim().min(1).max(2000),
				transitions: z.string().trim().min(1).max(2000),
				events: z.string().trim().min(1).max(2000),
				camera: z.string().trim().min(1).max(2000),
				readability: z.string().trim().min(1).max(2000),
			})
			.strict(),
	})
	.strict()
	.refine(
		(input) => input.playbackMs === input.setup.durationMs,
		"Play the complete configured scene before saving usage evidence."
	);
export const sceneQaVersionPinSchema = z
	.object({
		assetVersionId: id,
		assetRecordId: id,
		assetFamilyId: id,
		assetRecordName: z.string(),
		versionNumber: z.number().int().positive(),
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		width: z.number().int().positive(),
		height: z.number().int().positive(),
	})
	.strict();
export const sceneQaProfilePinSchema = z
	.object({
		contractRevisionId: id,
		profileId: specializedProfileIdSchema,
		contractSnapshot: specializedProfileContractSchema,
	})
	.strict();
export const sceneQaRecordSchema = sceneQaInputSchema
	.safeExtend({
		versionPins: z.array(sceneQaVersionPinSchema).min(1).max(24),
		profilePins: z.array(sceneQaProfilePinSchema).min(1).max(6),
		createdAt: z.iso.datetime(),
		createdByUserId: id,
	})
	.superRefine((record, ctx) => {
		for (const p of record.setup.placements) {
			const pin = record.versionPins.find(
				(v) => v.assetVersionId === p.assetVersionId
			);
			const profile = record.profilePins.find(
				(v) =>
					v.contractRevisionId === p.contractRevisionId &&
					v.profileId === sceneQaRoleProfiles[p.role]
			);
			if (
				!(
					pin &&
					profile?.contractSnapshot.usageTests.some(
						(t) => t.id === p.usageTestId
					)
				)
			) {
				ctx.addIssue({
					code: "custom",
					message:
						"Every placement must pin its exact version, matching profile and usage test.",
				});
			}
			if (
				pin &&
				Object.values(p.clips)
					.flat()
					.some((f) => f.x + f.width > pin.width || f.y + f.height > pin.height)
			) {
				ctx.addIssue({
					code: "custom",
					message: "Animation frames must fit the exact source image.",
				});
			}
		}
	});
export type SceneQaSetup = z.infer<typeof sceneQaSetupSchema>;
export type SceneQaPlacement = z.infer<typeof sceneQaPlacementSchema>;
export type SceneQaInput = z.infer<typeof sceneQaInputSchema>;
export type SceneQaRecord = z.infer<typeof sceneQaRecordSchema>;
export interface SceneQaStore {
	append: (
		userId: string,
		record: SceneQaRecord
	) => Promise<SceneQaRecord | null>;
	list: (userId: string, projectId: string) => Promise<SceneQaRecord[] | null>;
}
