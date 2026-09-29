import { z } from "zod";

export const specializedProfileIds = [
	"character_creature_animation",
	"object_weapon_equipment_states",
	"icon",
	"visual_effect_projectile_shadow_mark",
	"tileset_terrain_texture",
	"background_parallax",
	"ui",
	"portrait_logo_marketing",
] as const;

export const specializedProfileIdSchema = z.enum(specializedProfileIds);

export const profileContractRuleClassSchema = z.enum([
	"integrity_gate",
	"waivable_requirement",
	"quality_advisory",
	"human_review",
]);
export type ProfileContractRuleClass = z.infer<
	typeof profileContractRuleClassSchema
>;

const stableIdSchema = z
	.string()
	.min(1)
	.max(120)
	.regex(/^[a-z][a-z0-9._-]*$/);

export const profileContractMetadataFieldSchema = z
	.object({
		id: stableIdSchema,
		name: z.string().trim().min(1).max(120),
		dataType: z.enum(["string", "number", "boolean", "string_array"]),
		required: z.boolean(),
		description: z.string().trim().min(1).max(1000),
	})
	.strict();

export const profileContractRuleSchema = z
	.object({
		id: stableIdSchema,
		name: z.string().trim().min(1).max(120),
		class: profileContractRuleClassSchema,
		input: z.string().trim().min(1).max(1000),
		successCondition: z.string().trim().min(1).max(1000),
		failureCondition: z.string().trim().min(1).max(1000),
		evidenceRequirement: z.string().trim().min(1).max(1000),
		assetScope: z.string().trim().min(1).max(500),
		exportEffect: z.string().trim().min(1).max(500),
		required: z.boolean(),
		waiverEligible: z.boolean(),
	})
	.strict()
	.superRefine((rule, context) => {
		if (rule.waiverEligible !== (rule.class === "waivable_requirement")) {
			context.addIssue({
				code: "custom",
				path: ["waiverEligible"],
				message:
					"Yalnız İstisna Verilebilir Gereksinim sınıfındaki kurallar istisna alabilir.",
			});
		}
		if (rule.class === "quality_advisory" && rule.required) {
			context.addIssue({
				code: "custom",
				path: ["required"],
				message: "Kalite Uyarısı tek başına zorunlu tamamlanma kuralı olamaz.",
			});
		}
	});

export const profileContractUsageTestSchema = z
	.object({
		id: stableIdSchema,
		name: z.string().trim().min(1).max(120),
		environment: z.string().trim().min(1).max(1000),
		passCriteria: z.string().trim().min(1).max(1000),
		evidenceRequirement: z.string().trim().min(1).max(1000),
		required: z.boolean(),
	})
	.strict();

export const profileContractExportMappingSchema = z
	.object({
		id: stableIdSchema,
		sourceFieldId: stableIdSchema,
		targetFieldId: stableIdSchema,
		unit: z.string().trim().min(1).max(100).nullable(),
		coordinateSystem: z.string().trim().min(1).max(100).nullable(),
		defaultBehavior: z.string().trim().min(1).max(500),
		readbackCheck: z.string().trim().min(1).max(500),
		required: z.boolean(),
	})
	.strict();

export const specializedProfileContractSchema = z
	.object({
		profileId: specializedProfileIdSchema,
		revisionNumber: z.number().int().positive(),
		metadataFields: z.array(profileContractMetadataFieldSchema).min(1).max(100),
		rules: z.array(profileContractRuleSchema).min(4).max(200),
		usageTests: z.array(profileContractUsageTestSchema).min(1).max(100),
		exportMappings: z.array(profileContractExportMappingSchema).min(1).max(200),
	})
	.strict()
	.superRefine((contract, context) => {
		const ruleIds = contract.rules.map((rule) => rule.id);
		if (new Set(ruleIds).size !== ruleIds.length) {
			context.addIssue({
				code: "custom",
				path: ["rules"],
				message: "Özel Profil Sözleşmesi kural kimlikleri benzersiz olmalıdır.",
			});
		}
		for (const requiredClass of [
			"integrity_gate",
			"waivable_requirement",
			"quality_advisory",
			"human_review",
		] as const) {
			if (!contract.rules.some((rule) => rule.class === requiredClass)) {
				context.addIssue({
					code: "custom",
					path: ["rules"],
					message: `Sözleşmede ${requiredClass} sınıfından en az bir kural bulunmalıdır.`,
				});
			}
		}
		const usageTestIds = contract.usageTests.map((test) => test.id);
		if (new Set(usageTestIds).size !== usageTestIds.length) {
			context.addIssue({
				code: "custom",
				path: ["usageTests"],
				message: "Kullanım testi kimlikleri benzersiz olmalıdır.",
			});
		}
		const fieldIds = new Set(contract.metadataFields.map((field) => field.id));
		if (fieldIds.size !== contract.metadataFields.length) {
			context.addIssue({
				code: "custom",
				path: ["metadataFields"],
				message:
					"Özel Profil Sözleşmesi metadata kimlikleri benzersiz olmalıdır.",
			});
		}
		const mappingIds = contract.exportMappings.map((mapping) => mapping.id);
		if (new Set(mappingIds).size !== mappingIds.length) {
			context.addIssue({
				code: "custom",
				path: ["exportMappings"],
				message: "Dışa aktarım eşleme kimlikleri benzersiz olmalıdır.",
			});
		}
		for (const mapping of contract.exportMappings) {
			if (!fieldIds.has(mapping.sourceFieldId)) {
				context.addIssue({
					code: "custom",
					path: ["exportMappings"],
					message:
						"Dışa aktarım eşlemesi tanımlı metadata alanına bağlanmalıdır.",
				});
			}
		}
	});

export const profileContractRevisionRecordSchema = z
	.object({
		id: z.string().min(1).max(128),
		projectId: z.string().min(1).max(128),
		profileId: specializedProfileIdSchema,
		revisionNumber: z.number().int().positive(),
		contract: specializedProfileContractSchema,
		createdAt: z.string().datetime(),
		createdByUserId: z.string().min(1).max(128),
		isActive: z.boolean(),
		wasActivated: z.boolean(),
	})
	.strict()
	.superRefine((record, context) => {
		if (record.profileId !== record.contract.profileId) {
			context.addIssue({
				code: "custom",
				path: ["profileId"],
				message: "Sözleşme revizyonu aynı Özel Varlık Profili için olmalıdır.",
			});
		}
	});

export const profileContractsListInputSchema = z
	.object({ projectId: z.string().min(1).max(128) })
	.strict();

export const profileContractActivateInputSchema = z
	.object({
		projectId: z.string().min(1).max(128),
		profileId: specializedProfileIdSchema,
		templateRevisionNumber: z.number().int().positive(),
	})
	.strict();

const profileContractProfileSchema = z
	.object({
		profileId: specializedProfileIdSchema,
		template: specializedProfileContractSchema,
		activeRevision: profileContractRevisionRecordSchema.nullable(),
		revisions: z.array(profileContractRevisionRecordSchema),
	})
	.strict()
	.superRefine((profile, context) => {
		if (profile.profileId !== profile.template.profileId) {
			context.addIssue({
				code: "custom",
				path: ["template", "profileId"],
				message:
					"Şablon kimliği kataloğun Özel Varlık Profiliyle eşleşmelidir.",
			});
		}
		if (
			profile.revisions.some(
				(revision) => revision.profileId !== profile.profileId
			)
		) {
			context.addIssue({
				code: "custom",
				path: ["revisions"],
				message: "Sözleşme geçmişi tek Özel Varlık Profiline ait olmalıdır.",
			});
		}
	});

export const profileContractsCatalogSchema = z
	.object({
		projectId: z.string().min(1).max(128),
		profiles: z.array(profileContractProfileSchema),
	})
	.strict();

function metadataFieldDataType(
	id: string,
	numericFieldIds: Set<string>,
	listFieldIds: Set<string>
) {
	if (numericFieldIds.has(id)) {
		return "number" as const;
	}
	if (listFieldIds.has(id)) {
		return "string_array" as const;
	}
	return "string" as const;
}

export const specializedProfileContractTemplates = [
	{
		profileId: "character_creature_animation",
		revisionNumber: 1,
		metadataFields: [
			["direction_id", "Direction identity"],
			["frame_order", "Frame sequence"],
			["frame_duration_ms", "Frame duration"],
			["pivot", "Pivot and ground point"],
			["mount_points", "Mount points"],
			["collision_bounds", "Collision bounds"],
			["event_links", "Event links"],
		],
		integrity:
			"Direction and frame identities, ordering, timing, pivots, mount points, collision bounds and event links survive import-edit-export-readback; references resolve.",
		measure:
			"Declared frame count, ground-line drift and loop tolerance are within the values recorded for this version.",
		advisory:
			"Identity, silhouette, equipment side, perspective and ground contact remain review observations without automatic rejection.",
		review:
			"Compare identity, silhouette, equipment side, perspective and ground contact with the Canonical Design.",
		usageTests: [
			[
				"multi_direction_playback",
				"Synchronized multi-direction playback",
				"Play required directions at a synchronized frame position.",
			],
			[
				"scene_transition",
				"Scene transition",
				"Place the character in a representative scene and test transitions.",
			],
		],
		exportFields: [
			["frame_order", "frame.order", "count", "none"],
			["frame_duration_ms", "frame.duration", "milliseconds", "none"],
			["pivot", "frame.pivot", "pixels", "pixel-origin-top-left"],
			["mount_points", "frame.mount-points", null, "pixel-origin-top-left"],
			[
				"collision_bounds",
				"frame.collision-bounds",
				null,
				"pixel-origin-top-left",
			],
			["event_links", "frame.events", null, "none"],
		],
	},
	{
		profileId: "object_weapon_equipment_states",
		revisionNumber: 1,
		metadataFields: [
			["state_id", "State identity"],
			["direction_id", "Direction identity"],
			["natural_size", "Natural size"],
			["pivot", "Pivot"],
			["sort_point", "Ground and sorting point"],
			["use_links", "Usage links"],
		],
		integrity:
			"State and direction identities, pivots and sorting points resolve without missing or colliding state mappings.",
		measure:
			"Declared size and placement tolerances are met by this exact Asset Version.",
		advisory:
			"Family scale, perspective, material and state distinction are shown as review observations.",
		review:
			"Compare family scale, perspective, material and state distinction.",
		usageTests: [
			[
				"approved_character_scene",
				"Approved character and ground scene",
				"Place the object beside an approved character on a representative ground.",
			],
		],
		exportFields: [
			["state_id", "object.state", null, "unknown-preserved"],
			["direction_id", "object.direction", null, "unknown-preserved"],
			["natural_size", "object.natural-size", "pixels", "none"],
			["pivot", "object.pivot", "pixels", "pixel-origin-top-left"],
			["sort_point", "object.sort-point", "pixels", "pixel-origin-top-left"],
			["use_links", "object.usage-links", null, "unknown-preserved"],
		],
	},
	{
		profileId: "icon",
		revisionNumber: 1,
		metadataFields: [
			["use_variant", "Usage variant"],
			["source_size", "Source size"],
			["logical_size", "Logical size"],
			["color_space", "Color space"],
			["asset_version", "Asset Version identity"],
		],
		integrity:
			"Usage variant, source and logical size, color data and exact version identity survive roundtrip.",
		measure:
			"Declared size, color and interior-padding bounds are met by this version.",
		advisory:
			"Silhouette, readability, family scale, interior spacing and light/dark background visibility are review observations.",
		review:
			"Compare silhouette, readability, family scale and light/dark background visibility at target sizes.",
		usageTests: [
			[
				"target_size_backgrounds",
				"Target sizes and backgrounds",
				"Review the icon at target sizes on light and dark backgrounds.",
			],
		],
		exportFields: [
			["use_variant", "icon.usage", null, "unknown-preserved"],
			["source_size", "icon.source-size", "pixels", "none"],
			["logical_size", "icon.logical-size", "pixels", "none"],
			["color_space", "icon.color-space", null, "unknown-preserved"],
			["asset_version", "asset.version-id", null, "none"],
		],
	},
	{
		profileId: "visual_effect_projectile_shadow_mark",
		revisionNumber: 1,
		metadataFields: [
			["frame_sequence", "Frame sequence"],
			["frame_duration_ms", "Frame duration"],
			["origin", "Start point"],
			["layer", "Layer"],
			["event_id", "Event identity"],
			["alpha", "Transparency data"],
		],
		integrity:
			"Frame, timing, origin, event and transparency data are readable and roundtrip without broken references.",
		measure:
			"Declared duration, cell overflow and transparency limits are met for this version.",
		advisory:
			"Readability on light, dark, transparent and scene backgrounds remains visible for review.",
		review:
			"Review readability on light, dark, transparent and representative scene backgrounds.",
		usageTests: [
			[
				"owner_event_sync",
				"Owner event synchronization",
				"Play the effect with its owner and confirm event timing.",
			],
		],
		exportFields: [
			["frame_sequence", "effect.frame-order", "count", "none"],
			["frame_duration_ms", "effect.frame-duration", "milliseconds", "none"],
			["origin", "effect.origin", "pixels", "pixel-origin-top-left"],
			["layer", "effect.layer", null, "unknown-preserved"],
			["event_id", "effect.event-id", null, "unknown-preserved"],
			["alpha", "effect.alpha-data", null, "none"],
		],
	},
	{
		profileId: "tileset_terrain_texture",
		revisionNumber: 1,
		metadataFields: [
			["tile_id", "Tile identity"],
			["atlas_region", "Atlas region"],
			["neighbor_rules", "Neighbor rules"],
			["repeat_axes", "Repeat axes"],
			["terrain_id", "Terrain identity"],
		],
		integrity:
			"Tile identities, atlas regions, neighbor mappings and repeat axes are valid; edge pixels roundtrip exactly.",
		measure:
			"Declared atlas dimensions and seam tolerances are met by this version.",
		advisory:
			"Visible repetition is surfaced for review and never inferred as a deterministic seam failure.",
		review:
			"Review visible repetition in representative terrain and texture layouts.",
		usageTests: [
			[
				"terrain_adjacency_map",
				"Terrain adjacency test map",
				"Place inner and outer corners, a narrow corridor and a single-terrain fill.",
			],
		],
		exportFields: [
			["tile_id", "tile.id", null, "none"],
			["atlas_region", "tile.atlas-region", "pixels", "pixel-origin-top-left"],
			["neighbor_rules", "tile.neighbors", null, "unknown-preserved"],
			["repeat_axes", "texture.repeat-axes", null, "none"],
			["terrain_id", "terrain.id", null, "unknown-preserved"],
		],
	},
	{
		profileId: "background_parallax",
		revisionNumber: 1,
		metadataFields: [
			["layer_id", "Layer identity"],
			["layer_order", "Layer order"],
			["parallax_speed", "Relative movement"],
			["loop_mode", "Loop mode"],
			["crop_bounds", "Crop bounds"],
			["safe_area", "Safe area"],
		],
		integrity:
			"Layer identities, order, relative movement, looping and crop bounds are valid and connected.",
		measure:
			"Declared aspect ratio, safe-area and loop/seam tolerances are met.",
		advisory:
			"Contrast and player visibility on representative target ratios remain review observations.",
		review:
			"Review crop, seam, contrast and player visibility at target aspect ratios.",
		usageTests: [
			[
				"target_ratio_parallax",
				"Target ratio parallax test",
				"Play the layers together at the target aspect ratios and scroll speeds.",
			],
		],
		exportFields: [
			["layer_id", "background.layer-id", null, "none"],
			["layer_order", "background.layer-order", "index", "none"],
			["parallax_speed", "background.relative-speed", "ratio", "none"],
			["loop_mode", "background.loop-mode", null, "unknown-preserved"],
			[
				"crop_bounds",
				"background.crop-bounds",
				"pixels",
				"pixel-origin-top-left",
			],
			["safe_area", "background.safe-area", "pixels", "pixel-origin-top-left"],
		],
	},
	{
		profileId: "ui",
		revisionNumber: 1,
		metadataFields: [
			["component_id", "Component identity"],
			["state_id", "State identity"],
			["native_size", "Natural size"],
			["nine_slice_insets", "Nine-slice insets"],
			["safe_area", "Safe area"],
			["screen_link", "Screen and component link"],
		],
		integrity:
			"Component and state identities, natural sizes, nine-slice insets and safe-area geometry are valid and roundtrip.",
		measure:
			"Target sizes and text-safe-area limits are met for the selected version.",
		advisory:
			"Family style and state distinction remain visible review observations.",
		review: "Review family style and state distinction at target sizes.",
		usageTests: [
			[
				"target_size_stretch_text",
				"Target-size stretch and text test",
				"Stretch at target sizes and verify all text and safe areas.",
			],
		],
		exportFields: [
			["component_id", "ui.component-id", null, "unknown-preserved"],
			["state_id", "ui.state-id", null, "unknown-preserved"],
			["native_size", "ui.native-size", "pixels", "none"],
			["nine_slice_insets", "ui.nine-slice-insets", "pixels", "none"],
			["safe_area", "ui.safe-area", "pixels", "pixel-origin-top-left"],
			["screen_link", "ui.screen-link", null, "unknown-preserved"],
		],
	},
	{
		profileId: "portrait_logo_marketing",
		revisionNumber: 1,
		metadataFields: [
			["use_variant", "Usage purpose"],
			["visual_world_id", "Visual World"],
			["canonical_design_id", "Canonical Design"],
			["native_size", "Natural size"],
			["crop_bounds", "Crop bounds"],
			["safe_area", "Safe area"],
			["background_variant", "Background variant"],
		],
		integrity:
			"Usage purpose, Visual World, Canonical Design, crop and safe-area references resolve to the exact version.",
		measure:
			"Declared target ratios, small-use sizes and safe-area bounds are met.",
		advisory:
			"Identity, expression, small-size readability and light/dark visibility remain review observations.",
		review:
			"Review identity, expression, small-size readability and light/dark background visibility.",
		usageTests: [
			[
				"small_size_backgrounds",
				"Small-size and background test",
				"Review at small sizes on light and dark backgrounds within the safe area.",
			],
		],
		exportFields: [
			["use_variant", "marketing.usage", null, "unknown-preserved"],
			["visual_world_id", "asset.visual-world-id", null, "none"],
			["canonical_design_id", "asset.canonical-design-id", null, "none"],
			["native_size", "asset.native-size", "pixels", "none"],
			["crop_bounds", "asset.crop-bounds", "pixels", "pixel-origin-top-left"],
			["safe_area", "asset.safe-area", "pixels", "pixel-origin-top-left"],
			[
				"background_variant",
				"marketing.background-variant",
				null,
				"unknown-preserved",
			],
		],
	},
].map((template) => {
	const profilePrefix = template.profileId;
	const numericFieldIds = new Set([
		"frame_duration_ms",
		"layer_order",
		"parallax_speed",
	]);
	const listFieldIds = new Set([
		"frame_order",
		"mount_points",
		"event_links",
		"use_links",
		"neighbor_rules",
		"repeat_axes",
	]);
	const metadataFields = template.metadataFields.map((entry) => {
		const [id, name] = entry;
		if (!(id && name)) {
			throw new Error(`Invalid metadata field template for ${profilePrefix}.`);
		}
		return {
			id: `${profilePrefix}.${id}`,
			name,
			dataType: metadataFieldDataType(id, numericFieldIds, listFieldIds),
			required: true,
			description: `${name} for this exact ${profilePrefix} Asset Version.`,
		};
	});
	const rules = [
		{
			id: `${profilePrefix}.integrity`,
			name: "Roundtrip integrity",
			class: "integrity_gate" as const,
			input: "Supported source metadata and the exact Asset Version.",
			successCondition: template.integrity,
			failureCondition:
				"Unreadable content, broken references or lost metadata.",
			evidenceRequirement: "Record the exact checks and their observed result.",
			assetScope: profilePrefix,
			exportEffect: "Block export while this integrity gate is not passed.",
			required: true,
			waiverEligible: false,
		},
		{
			id: `${profilePrefix}.measurable-tolerance`,
			name: "Measurable tolerance",
			class: "waivable_requirement" as const,
			input:
				"The exact version's declared measurements and this contract revision.",
			successCondition: template.measure,
			failureCondition:
				"A declared measurable limit is outside its selected tolerance.",
			evidenceRequirement: "Record measured values and the method used.",
			assetScope: profilePrefix,
			exportEffect:
				"Block export unless this rule passes or has an eligible version-specific waiver.",
			required: true,
			waiverEligible: true,
		},
		{
			id: `${profilePrefix}.visual-advisory`,
			name: "Visual quality advisory",
			class: "quality_advisory" as const,
			input: "The exact version shown in its declared use context.",
			successCondition: template.advisory,
			failureCondition: "A reviewer observes a possible quality concern.",
			evidenceRequirement: "Capture the observation and review context.",
			assetScope: profilePrefix,
			exportEffect:
				"Display the advisory; it does not automatically block export.",
			required: false,
			waiverEligible: false,
		},
		{
			id: `${profilePrefix}.human-review`,
			name: "Required human review",
			class: "human_review" as const,
			input: "The exact version and the active Canonical Design when present.",
			successCondition: template.review,
			failureCondition: "The required review has not been recorded as passed.",
			evidenceRequirement: "Record the reviewer, method and rationale.",
			assetScope: profilePrefix,
			exportEffect: "Block export until the required human review passes.",
			required: true,
			waiverEligible: false,
		},
	];
	const usageTests = template.usageTests.map((entry) => {
		const [id, name, environment] = entry;
		if (!(id && name && environment)) {
			throw new Error(`Invalid usage test template for ${profilePrefix}.`);
		}
		return {
			id: `${profilePrefix}.${id}`,
			name,
			environment,
			passCriteria: `The ${name.toLocaleLowerCase("en-US")} has an observed passing result.`,
			evidenceRequirement:
				"Pin the exact Asset Version and record method and rationale.",
			required: true,
		};
	});
	const exportMappings = template.exportFields.map(
		([sourceFieldId, targetFieldId, unit, coordinateSystem]) => ({
			id: `${profilePrefix}.mapping.${sourceFieldId}`,
			sourceFieldId: `${profilePrefix}.${sourceFieldId}`,
			targetFieldId,
			unit,
			coordinateSystem,
			defaultBehavior:
				unit === null
					? "Preserve as unknown; never infer a value."
					: "No default.",
			readbackCheck: `Read back ${targetFieldId} and compare it with the pinned source value.`,
			required: true,
		})
	);
	return specializedProfileContractSchema.parse({
		profileId: template.profileId,
		revisionNumber: template.revisionNumber,
		metadataFields,
		rules,
		usageTests,
		exportMappings,
	});
});

export type SpecializedProfileId = z.infer<typeof specializedProfileIdSchema>;
export type SpecializedProfileContract = z.infer<
	typeof specializedProfileContractSchema
>;
export type ProfileContractRevisionRecord = z.infer<
	typeof profileContractRevisionRecordSchema
>;
export type ProfileContractsCatalog = z.infer<
	typeof profileContractsCatalogSchema
>;

export function isProfileQualityEvidenceValid(input: {
	rule: SpecializedProfileContract["rules"][number];
	result: "passed" | "failed" | "inconclusive" | "waived";
	observedValue?: string;
}) {
	if (input.result === "waived" && !input.rule.waiverEligible) {
		return false;
	}
	if (input.rule.waiverEligible && !input.observedValue?.trim()) {
		return false;
	}
	return true;
}

export interface SpecializedProfileContractStore {
	activate: (
		userId: string,
		input: z.infer<typeof profileContractActivateInputSchema>
	) => Promise<ProfileContractsCatalog | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<ProfileContractsCatalog | null>;
}

export function assessProfileQualityReadiness(
	contract: SpecializedProfileContract,
	results: ReadonlyMap<string, "passed" | "failed" | "inconclusive" | "waived">,
	usageTestResults: ReadonlyMap<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	> = new Map()
) {
	const requiredRules = contract.rules.filter(
		(rule) => rule.required && rule.class !== "quality_advisory"
	);
	const waivedRuleIds = requiredRules
		.filter(
			(rule) =>
				results.get(rule.id) === "waived" &&
				rule.class === "waivable_requirement" &&
				rule.waiverEligible
		)
		.map((rule) => rule.id);
	const outstandingRuleIds = requiredRules
		.filter(
			(rule) =>
				results.get(rule.id) !== "passed" && !waivedRuleIds.includes(rule.id)
		)
		.map((rule) => rule.id);
	const requiredUsageTests = contract.usageTests.filter(
		(test) => test.required
	);
	const outstandingUsageTestIds = requiredUsageTests
		.filter((test) => usageTestResults.get(test.id) !== "passed")
		.map((test) => test.id);
	const failedAdvisoryRuleIds = contract.rules
		.filter(
			(rule) =>
				rule.class === "quality_advisory" &&
				["failed", "inconclusive"].includes(results.get(rule.id) ?? "")
		)
		.map((rule) => rule.id);
	const isBlocked =
		outstandingRuleIds.length > 0 || outstandingUsageTestIds.length > 0;
	let status: "blocked" | "exceptions_ready" | "export_ready";
	if (isBlocked) {
		status = "blocked";
	} else if (waivedRuleIds.length > 0) {
		status = "exceptions_ready";
	} else {
		status = "export_ready";
	}
	return {
		status,
		outstandingRuleIds,
		outstandingUsageTestIds,
		waivedRuleIds,
		failedAdvisoryRuleIds,
	};
}
