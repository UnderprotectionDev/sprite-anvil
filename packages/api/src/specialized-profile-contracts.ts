import { specializedProfileIds } from "@sprite-anvil/db/specialized-profile-ids";
import { z } from "zod";

export { specializedProfileIds } from "@sprite-anvil/db/specialized-profile-ids";

export const specializedProfileIdSchema = z.enum(specializedProfileIds);
export type SpecializedProfileId = z.infer<typeof specializedProfileIdSchema>;

export const profileRuleClasses = [
	"integrity_gate",
	"waivable_requirement",
	"quality_advisory",
] as const;

const stableIdSchema = z.string().regex(/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/);
const descriptionSchema = z.string().trim().min(1).max(1200);

const profileMetadataFieldSchema = z
	.object({
		description: descriptionSchema,
		exportPath: stableIdSchema,
		id: stableIdSchema,
		label: z.string().trim().min(1).max(120),
		required: z.boolean(),
		scope: descriptionSchema,
		type: z.enum([
			"identifier",
			"text",
			"text_list",
			"integer",
			"number",
			"boolean",
			"json",
		]),
		unit: z.string().trim().min(1).max(80).nullable(),
		coordinateSystem: z.string().trim().min(1).max(120).nullable(),
	})
	.strict();

const profileRuleSchema = z
	.object({
		class: z.enum(profileRuleClasses),
		evidence: descriptionSchema,
		exportEffect: descriptionSchema,
		failureResult: descriptionSchema,
		id: stableIdSchema,
		input: descriptionSchema,
		scope: descriptionSchema,
		successResult: descriptionSchema,
		waiverEligibility: z.boolean(),
	})
	.strict();

const requiredHumanReviewSchema = z
	.object({
		evidence: descriptionSchema,
		exportEffect: descriptionSchema,
		failureResult: descriptionSchema,
		id: stableIdSchema,
		input: descriptionSchema,
		label: z.string().trim().min(1).max(160),
		required: z.literal(true),
		scope: descriptionSchema,
		successResult: descriptionSchema,
	})
	.strict();

const usageTestSchema = z
	.object({
		evidence: descriptionSchema,
		exportEffect: descriptionSchema,
		failureResult: descriptionSchema,
		id: stableIdSchema,
		input: descriptionSchema,
		label: z.string().trim().min(1).max(160),
		required: z.literal(true),
		scope: descriptionSchema,
		successResult: descriptionSchema,
	})
	.strict();

const exportMappingSchema = z
	.object({
		absentBehavior: z.enum(["stop_export", "preserve_unknown"]),
		coordinateSystem: z.string().trim().min(1).max(120).nullable(),
		fieldId: stableIdSchema,
		id: stableIdSchema,
		readbackCheck: descriptionSchema,
		targetPath: stableIdSchema,
		unit: z.string().trim().min(1).max(80).nullable(),
	})
	.strict();

const specializedProfileContractBaseSchema = z
	.object({
		contractSchemaVersion: z.literal("asset-profile/1.0.0"),
		exportMappings: z.array(exportMappingSchema).min(1),
		humanReviews: z.array(requiredHumanReviewSchema).min(1),
		metadataFields: z.array(profileMetadataFieldSchema).min(1),
		name: z.string().trim().min(1).max(160),
		profileId: specializedProfileIdSchema,
		rules: z.array(profileRuleSchema).min(3),
		supportedAssetCategories: z.array(specializedProfileIdSchema).min(1),
		usageTests: z.array(usageTestSchema).min(1),
		version: z.string().regex(/^\d+\.\d+\.\d+$/),
	})
	.strict();

type SpecializedProfileContractInput = z.infer<
	typeof specializedProfileContractBaseSchema
>;

function validateSupportedCategory(
	contract: SpecializedProfileContractInput,
	context: z.RefinementCtx
) {
	if (
		contract.supportedAssetCategories.length !== 1 ||
		contract.supportedAssetCategories[0] !== contract.profileId
	) {
		context.addIssue({
			code: "custom",
			path: ["supportedAssetCategories"],
			message:
				"A profile contract must support exactly its matching asset category.",
		});
	}
}

function validateExportMappings(
	contract: SpecializedProfileContractInput,
	context: z.RefinementCtx
) {
	const fieldIds = new Set(contract.metadataFields.map((field) => field.id));
	const mappingFieldIds = new Set(
		contract.exportMappings.map((mapping) => mapping.fieldId)
	);
	if (mappingFieldIds.size !== contract.exportMappings.length) {
		context.addIssue({
			code: "custom",
			path: ["exportMappings"],
			message: "Each metadata field must have at most one export mapping.",
		});
	}
	for (const field of contract.metadataFields) {
		const mapping = contract.exportMappings.find(
			(candidate) => candidate.fieldId === field.id
		);
		if (!mapping) {
			context.addIssue({
				code: "custom",
				path: ["metadataFields"],
				message: `Metadata field ${field.id} has no export mapping.`,
			});
			continue;
		}
		if (mapping.targetPath !== field.exportPath) {
			context.addIssue({
				code: "custom",
				path: ["exportMappings"],
				message: `Export mapping for ${field.id} does not match its declared target.`,
			});
		}
		if (field.required && mapping.absentBehavior !== "stop_export") {
			context.addIssue({
				code: "custom",
				path: ["exportMappings"],
				message: `Required metadata field ${field.id} must stop export when absent.`,
			});
		}
	}
	for (const mapping of contract.exportMappings) {
		if (!fieldIds.has(mapping.fieldId)) {
			context.addIssue({
				code: "custom",
				path: ["exportMappings"],
				message: `Export mapping ${mapping.id} references an unknown metadata field.`,
			});
		}
	}
}

function validateRules(
	contract: SpecializedProfileContractInput,
	context: z.RefinementCtx
) {
	const ruleIds = new Set<string>();
	for (const rule of contract.rules) {
		if (ruleIds.has(rule.id)) {
			context.addIssue({
				code: "custom",
				path: ["rules"],
				message: `Rule id ${rule.id} is not unique.`,
			});
		}
		ruleIds.add(rule.id);
		if (rule.waiverEligibility && rule.class !== "waivable_requirement") {
			context.addIssue({
				code: "custom",
				path: ["rules"],
				message: `Rule ${rule.id} cannot allow a waiver for its class.`,
			});
		}
	}
}

function validateRequiredEvidenceIds(
	contract: SpecializedProfileContractInput,
	context: z.RefinementCtx
) {
	for (const [field, items] of [
		["humanReviews", contract.humanReviews],
		["usageTests", contract.usageTests],
	] as const) {
		const ids = items.map((item) => item.id);
		if (new Set(ids).size !== ids.length) {
			context.addIssue({
				code: "custom",
				path: [field],
				message: `${field} ids must be unique.`,
			});
		}
	}
	const qualityEvidenceIds = new Set(contract.rules.map((rule) => rule.id));
	for (const review of contract.humanReviews) {
		if (qualityEvidenceIds.has(review.id)) {
			context.addIssue({
				code: "custom",
				path: ["humanReviews"],
				message: `Human review id ${review.id} cannot reuse a quality rule id.`,
			});
		}
	}
}

export const specializedProfileContractSchema =
	specializedProfileContractBaseSchema.superRefine((contract, context) => {
		validateSupportedCategory(contract, context);
		validateExportMappings(contract, context);
		validateRules(contract, context);
		validateRequiredEvidenceIds(contract, context);
	});

export type SpecializedProfileContract = z.infer<
	typeof specializedProfileContractSchema
>;

export function isProfileQualityEvidenceValid(input: {
	rule: SpecializedProfileContract["rules"][number];
	result: "passed" | "failed" | "inconclusive" | "waived";
	observedValue?: string;
}) {
	if (
		input.result === "waived" &&
		(input.rule.class !== "waivable_requirement" ||
			!input.rule.waiverEligibility)
	) {
		return false;
	}
	if (input.rule.waiverEligibility && !input.observedValue?.trim()) {
		return false;
	}
	return true;
}

export function assessProfileQualityReadiness(
	contract: SpecializedProfileContract,
	results: ReadonlyMap<string, "passed" | "failed" | "inconclusive" | "waived">,
	usageTestResults: ReadonlyMap<
		string,
		"passed" | "failed" | "inconclusive" | "waived"
	> = new Map(),
	humanReviewResults: ReadonlyMap<
		string,
		"passed" | "failed" | "inconclusive"
	> = new Map()
) {
	const requiredRules = contract.rules.filter(
		(rule) => rule.class !== "quality_advisory"
	);
	const waivedRuleIds = requiredRules
		.filter(
			(rule) =>
				results.get(rule.id) === "waived" &&
				rule.class === "waivable_requirement" &&
				rule.waiverEligibility
		)
		.map((rule) => rule.id);
	const outstandingRuleIds = requiredRules
		.filter(
			(rule) =>
				results.get(rule.id) !== "passed" && !waivedRuleIds.includes(rule.id)
		)
		.map((rule) => rule.id);
	const requiredUsageTests = contract.usageTests;
	const outstandingUsageTestIds = requiredUsageTests
		.filter((test) => usageTestResults.get(test.id) !== "passed")
		.map((test) => test.id);
	const outstandingHumanReviewIds = contract.humanReviews
		.filter(
			(review) =>
				review.required && humanReviewResults.get(review.id) !== "passed"
		)
		.map((review) => review.id);
	const failedAdvisoryRuleIds = contract.rules
		.filter(
			(rule) =>
				rule.class === "quality_advisory" &&
				["failed", "inconclusive"].includes(results.get(rule.id) ?? "")
		)
		.map((rule) => rule.id);
	const isBlocked =
		outstandingRuleIds.length > 0 ||
		outstandingUsageTestIds.length > 0 ||
		outstandingHumanReviewIds.length > 0;
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
		outstandingHumanReviewIds,
		waivedRuleIds,
		failedAdvisoryRuleIds,
	};
}

export const projectProfileContractActivationSchema = z
	.object({
		activatedAt: z.iso.datetime(),
		activatedByUserId: z.string().min(1),
		contract: specializedProfileContractSchema,
		contractRevisionId: z.string().min(1),
		projectId: z.string().min(1).max(200),
	})
	.strict();
export type ProjectProfileContractActivation = z.infer<
	typeof projectProfileContractActivationSchema
>;

export interface SpecializedProfileContractStore {
	activate: (
		userId: string,
		projectId: string,
		profileId: SpecializedProfileId,
		contract: SpecializedProfileContract
	) => Promise<boolean>;
	getActive: (
		userId: string,
		projectId: string,
		profileId: SpecializedProfileId
	) => Promise<ProjectProfileContractActivation | null>;
	list: (
		userId: string,
		projectId: string
	) => Promise<ProjectProfileContractActivation[] | null>;
}

export const specializedProfileContractsListInputSchema = z.object({
	projectId: z.string().trim().min(1).max(200),
});

export const specializedProfileContractInputSchema = z.object({
	profileId: specializedProfileIdSchema,
	projectId: z.string().trim().min(1).max(200),
});

export const specializedProfileContractsListOutputSchema = z.object({
	profiles: z.array(
		z.object({
			activeContract: projectProfileContractActivationSchema.nullable(),
			definition: specializedProfileContractSchema,
		})
	),
});
export type SpecializedProfileContractsListOutput = z.infer<
	typeof specializedProfileContractsListOutputSchema
>;

const metadataField = (
	id: string,
	label: string,
	type: SpecializedProfileContract["metadataFields"][number]["type"],
	required: boolean,
	scope: string,
	description: string,
	exportPath: string,
	unit: string | null = null,
	coordinateSystem: string | null = null
) => ({
	coordinateSystem,
	description,
	exportPath,
	id,
	label,
	required,
	scope,
	type,
	unit,
});

type ContractSeed = Omit<
	SpecializedProfileContract,
	"exportMappings" | "contractSchemaVersion" | "version"
> & { version?: string };

function defineContract(seed: ContractSeed): SpecializedProfileContract {
	const version = seed.version ?? "1.0.0";
	const exportMappings: SpecializedProfileContract["exportMappings"] =
		seed.metadataFields.map((field) => ({
			absentBehavior: field.required ? "stop_export" : "preserve_unknown",
			coordinateSystem: field.coordinateSystem,
			fieldId: field.id,
			id: `${field.id}_mapping`,
			readbackCheck: `Read ${field.exportPath} after export and preserve its value, unit, and coordinate system.`,
			targetPath: field.exportPath,
			unit: field.unit,
		}));
	return specializedProfileContractSchema.parse({
		...seed,
		contractSchemaVersion: "asset-profile/1.0.0",
		exportMappings,
		version,
	});
}

export const iconLightDarkTargetSizeTestId = "icon.light_dark_target_size";

export const specializedProfileContractCatalog = [
	defineContract({
		version: "1.0.1",
		profileId: "character_creature_animation",
		name: "Karakter, yaratık ve animasyon",
		supportedAssetCategories: ["character_creature_animation"],
		metadataFields: [
			metadataField(
				"frame_id",
				"Kare kimliği",
				"identifier",
				true,
				"Her animasyon karesi",
				"Kare kimliği içe aktarma ve yeniden okumada aynı kalır.",
				"animation.frames.id"
			),
			metadataField(
				"frame_region",
				"Kare alanı",
				"json",
				true,
				"Her animasyon karesi",
				"Kare bölgesi kaynak görsel koordinatlarında korunur.",
				"animation.frames.region",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"frame_order",
				"Kare sırası",
				"integer",
				true,
				"Her animasyon karesi",
				"Karelerin animasyon içindeki sırası korunur.",
				"animation.frames.order"
			),
			metadataField(
				"direction_id",
				"Yön kimliği",
				"identifier",
				true,
				"Her yön ve kare grubu",
				"Yön bağlantısı korunur ve yön kimliği uydurulmaz.",
				"animation.directions.id"
			),
			metadataField(
				"duration_ms",
				"Kare süresi",
				"integer",
				true,
				"Her animasyon karesi",
				"Kare süresi pozitif milisaniye olarak korunur.",
				"animation.frames.duration_ms",
				"ms"
			),
			metadataField(
				"loop_mode",
				"Döngü biçimi",
				"text",
				true,
				"Her animasyon",
				"Döngü biçimi dışa aktarım ve yeniden okumada korunur.",
				"animation.loop_mode"
			),
			metadataField(
				"pivot",
				"Dönüş noktası",
				"json",
				false,
				"Kare veya birim",
				"Koordinatlar tanımlı piksel düzleminde korunur.",
				"animation.frames.pivot",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"ground_point",
				"Zemin noktası",
				"json",
				false,
				"Kare veya birim",
				"Zemine temas koordinatı korunur.",
				"animation.frames.ground_point",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"mount_points",
				"Sabitleme noktaları",
				"json",
				false,
				"Kare veya birim",
				"Noktalar kararlı kimlikleriyle korunur.",
				"animation.frames.mount_points",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"collision_areas",
				"Çarpışma alanları",
				"json",
				false,
				"Kare veya birim",
				"Alan sınırları ve kimlikleri korunur.",
				"animation.frames.collision_areas",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"event_links",
				"Olay bağlantıları",
				"json",
				false,
				"Kare veya animasyon",
				"Olay kimliği ve zamanlaması korunur.",
				"animation.frames.events"
			),
		],
		rules: [
			{
				id: "character.frame_metadata_roundtrip",
				class: "integrity_gate",
				input:
					"Frame id, direction id, order, duration, pivot, ground point, mount points, collision areas, and event links.",
				successResult:
					"All declared frame identities and linked metadata are unchanged after import, edit, export, and readback.",
				failureResult:
					"A missing frame link or changed field blocks completion and export.",
				evidence:
					"Before-and-after field values, frame identities, and roundtrip comparison.",
				scope:
					"The exact Unit Version and Composite Version covered by this contract.",
				exportEffect:
					"Retain every frame field and identity in the profile manifest; block export on mismatch.",
				waiverEligibility: false,
			},
			{
				id: "character.ground_and_loop_tolerance",
				class: "waivable_requirement",
				input:
					"Measured ground-line drift and loop boundary difference for the selected Unit Version.",
				successResult:
					"The measured drift is within the tolerance defined for this version.",
				failureResult:
					"The out-of-tolerance measurement is reported against the exact frame and version.",
				evidence:
					"Measured values, tolerance, frame ids, and comparison images or playback capture.",
				scope:
					"Only the measured frame group in the selected Unit Version or Composite Version.",
				exportEffect:
					"Carry the rule id, observed value, and any version-specific waiver into the bundle.",
				waiverEligibility: true,
			},
			{
				id: "character.identity_and_silhouette_advisory",
				class: "quality_advisory",
				input:
					"Side-by-side human comparison with the selected Canonical Design.",
				successResult:
					"The user records whether identity, silhouette, equipment side, and grounding need follow-up.",
				failureResult:
					"An advisory remains visible for user review and does not decide acceptance.",
				evidence:
					"Human note tied to the compared version and Canonical Design.",
				scope:
					"The selected character or creature family and reviewed versions.",
				exportEffect:
					"Include advisory evidence when present; never convert it to an automatic artistic verdict.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "character.identity_silhouette_review",
				label: "Kimlik, siluet ve ekipman tarafı incelemesi",
				input:
					"Selected Canonical Design, required directions, palette, perspective, scale, and ground contact.",
				successResult:
					"The user records a review outcome and rationale for the exact version.",
				failureResult:
					"The review remains incomplete; no automated result substitutes for the user's decision.",
				evidence:
					"Review outcome, rationale, selected version, and Canonical Design id.",
				scope: "Selected family and reviewed directions.",
				exportEffect:
					"Reference the exact human review record in the export manifest.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "character.multi_direction_playback",
				label: "Çok yönlü oynatma ve sahne geçişi",
				input:
					"Pinned direction and frame versions, per-frame durations, and linked events.",
				successResult:
					"Required directions play at their declared timing and the scene transition preserves event timing.",
				failureResult:
					"The exact failing direction, frame, or event is recorded as failed or inconclusive.",
				evidence:
					"Tested version ids, direction ids, playback result, and event timeline.",
				scope:
					"The selected family and the exact Unit Versions used by the test.",
				exportEffect:
					"Pin the tested version ids and test result to the contract revision.",
				required: true,
			},
		],
	}),
	defineContract({
		profileId: "object_weapon_equipment_states",
		name: "Obje, silah, ekipman ve durum",
		supportedAssetCategories: ["object_weapon_equipment_states"],
		metadataFields: [
			metadataField(
				"state_id",
				"Durum kimliği",
				"identifier",
				true,
				"Her durum birimi",
				"Durum kimliği tüm geçiş ve dışa aktarım kayıtlarında korunur.",
				"object.states.id"
			),
			metadataField(
				"direction_id",
				"Yön kimliği",
				"identifier",
				true,
				"Her yön birimi",
				"Yön eşlemesi sessizce değiştirilmez.",
				"object.directions.id"
			),
			metadataField(
				"natural_size",
				"Doğal ölçü",
				"json",
				true,
				"Varlık sürümü",
				"Genişlik ve yükseklik piksel birimiyle korunur.",
				"object.natural_size",
				"px"
			),
			metadataField(
				"pivot",
				"Dönüş noktası",
				"json",
				false,
				"Birim sürümü",
				"Görsel merkezden ayrı yerleşim noktası korunur.",
				"object.pivot",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"ground_and_sort_points",
				"Zemin ve sıralama noktaları",
				"json",
				false,
				"Birim sürümü",
				"Zemin teması ve Y sıralama koordinatları ayrıdır.",
				"object.placement_points",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"usage_links",
				"Kullanım bağlantıları",
				"json",
				false,
				"Varlık ailesi",
				"Bağlı karakter veya zemin kimlikleri korunur.",
				"object.usage_links"
			),
		],
		rules: [
			{
				id: "object.state_direction_links_integrity",
				class: "integrity_gate",
				input:
					"State ids, direction ids, pivots, ordering points, and state transition links.",
				successResult:
					"Every declared state and placement link resolves to its exact unit.",
				failureResult:
					"Missing, duplicate, or conflicting links block completion and export.",
				evidence:
					"Resolved unit ids, state map, and relationship roundtrip comparison.",
				scope:
					"The selected object or equipment family and its declared state/direction units.",
				exportEffect:
					"Retain stable state, direction, pivot, and sorting point ids; block export on broken links.",
				waiverEligibility: false,
			},
			{
				id: "object.scale_and_placement_tolerance",
				class: "waivable_requirement",
				input:
					"Measured scale, pivot, ground contact, and Y-sorting offsets for the selected version.",
				successResult:
					"Measurements are within the tolerances declared for the selected version.",
				failureResult:
					"Out-of-range measurements are attached to the exact state or direction.",
				evidence:
					"Measurements, declared tolerances, unit ids, and scene-test record.",
				scope: "Only measured units in the selected object family and version.",
				exportEffect:
					"Carry observed values and any version-specific waiver with the affected unit.",
				waiverEligibility: true,
			},
			{
				id: "object.family_consistency_advisory",
				class: "quality_advisory",
				input:
					"Human comparison of scale, perspective, material language, and state distinction.",
				successResult:
					"The user records whether the family is visually distinguishable in context.",
				failureResult:
					"A visible advisory remains for review without issuing compatibility judgment.",
				evidence: "Human comparison notes and the exact family versions.",
				scope:
					"The selected family only; no inferred character-equipment combinations.",
				exportEffect:
					"Include advisory evidence when present without asserting automatic compatibility.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "object.family_scale_perspective_review",
				label: "Aile ölçeği, perspektifi ve malzeme incelemesi",
				input:
					"Declared states, directions, material language, approved character, grid, and target ground.",
				successResult:
					"The user records a review outcome for family scale and placement.",
				failureResult:
					"The review remains incomplete until the user records a decision.",
				evidence:
					"Review outcome, rationale, exact versions, and placement context.",
				scope: "The selected object or equipment family.",
				exportEffect: "Reference the review record and its pinned versions.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "object.approved_character_ground_scene",
				label: "Onaylı karakter ve zeminle sahne testi",
				input:
					"Pinned object states, approved character version, project grid, and target grounds.",
				successResult:
					"The selected states keep declared scale, ground contact, and sorting placement in the scene.",
				failureResult:
					"The failing state and context are recorded as failed or inconclusive.",
				evidence:
					"Pinned object and character versions, tested grounds, and result.",
				scope:
					"The exact family units and approved scene inputs used by this test.",
				exportEffect:
					"Pin the exact test inputs and result to the contract revision.",
				required: true,
			},
		],
	}),
	defineContract({
		profileId: "icon",
		name: "İkon",
		supportedAssetCategories: ["icon"],
		metadataFields: [
			metadataField(
				"usage_variant",
				"Kullanım çeşidi",
				"identifier",
				true,
				"Her ikon sürümü",
				"Kullanım amacı kararlı kimlikle korunur.",
				"icon.usage_variant"
			),
			metadataField(
				"source_size",
				"Kaynak ölçüsü",
				"json",
				true,
				"Kaynak görsel",
				"Kaynak genişlik ve yüksekliği piksel olarak korunur.",
				"icon.source_size",
				"px"
			),
			metadataField(
				"logical_size",
				"Mantıksal ölçü",
				"json",
				true,
				"Kullanım çeşidi",
				"Mantıksal genişlik ve yükseklik korunur.",
				"icon.logical_size",
				"px"
			),
			metadataField(
				"scale_rule",
				"Ölçekleme kuralı",
				"text",
				true,
				"Kullanım çeşidi",
				"Ölçekleme tercihi okunabilir bir değer olarak korunur.",
				"icon.scale_rule"
			),
			metadataField(
				"color_space",
				"Renk alanı",
				"text",
				true,
				"Kaynak görsel",
				"Renk alanı içe aktarma ve yeniden okumada korunur.",
				"icon.color_space"
			),
			metadataField(
				"asset_version_id",
				"Varlık Sürümü",
				"identifier",
				true,
				"Seçilen ikon",
				"Tam Varlık Sürümü kimliği taşınır.",
				"icon.asset_version_id"
			),
		],
		rules: [
			{
				id: "icon.metadata_roundtrip",
				class: "integrity_gate",
				input:
					"Usage variant, source and logical sizes, color space, and exact Asset Version id.",
				successResult:
					"Every declared value survives the import-to-export readback unchanged.",
				failureResult:
					"A missing or changed structural value blocks completion and export.",
				evidence:
					"Source and readback metadata values, color profile, and exact version id.",
				scope: "The selected icon Asset Version and declared usage variants.",
				exportEffect:
					"Keep usage variant, sizes, color space, and complete version identity in the bundle.",
				waiverEligibility: false,
			},
			{
				id: "icon.target_size_tolerance",
				class: "waivable_requirement",
				input:
					"Measured logical size, color, and inner padding for the selected usage variant.",
				successResult:
					"Measurements meet the version's declared target bounds.",
				failureResult:
					"Out-of-bound measurements are recorded against the exact usage variant.",
				evidence:
					"Measured target size, color values, padding, and declared limits.",
				scope: "Only the measured usage variant of the selected icon version.",
				exportEffect:
					"Carry the measured value and any permitted version-specific waiver.",
				waiverEligibility: true,
			},
			{
				id: "icon.readability_advisory",
				class: "quality_advisory",
				input:
					"Human comparison at target size on light and dark backgrounds and in grayscale.",
				successResult:
					"The user records whether silhouette, interior spacing, and family scale remain readable.",
				failureResult: "A non-blocking advisory is shown for human follow-up.",
				evidence: "Human notes and target-size comparison captures.",
				scope: "The selected icon and its family at declared usage sizes.",
				exportEffect:
					"Include advisory evidence when present; do not infer a universal art rule.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "icon.silhouette_and_family_scale_review",
				label: "Siluet, okunurluk ve aile ölçeği incelemesi",
				input:
					"Target-size icon, grayscale view, light/dark backgrounds, and neighboring family icons.",
				successResult:
					"The user records a review outcome for silhouette and relative object scale.",
				failureResult:
					"No automatic readability verdict is issued; an unrecorded required review stays incomplete.",
				evidence:
					"Review outcome, rationale, usage variant, and exact Asset Version.",
				scope: "The selected icon and its declared family.",
				exportEffect:
					"Reference the review result and exact Asset Version in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: iconLightDarkTargetSizeTestId,
				label: "Açık ve koyu zeminde hedef boyut testi",
				input:
					"Pinned icon version, logical sizes, scale rule, and light/dark interface backgrounds.",
				successResult:
					"The icon keeps its declared silhouette and logical size in each target context.",
				failureResult:
					"The failing size or background is recorded as failed or inconclusive.",
				evidence: "Pinned version, tested sizes, backgrounds, and result.",
				scope: "The selected icon's declared usage variants.",
				exportEffect:
					"Pin target contexts, usage variants, and result to the contract revision.",
				required: true,
			},
		],
	}),
	defineContract({
		version: "1.0.1",
		profileId: "visual_effect_projectile_shadow_mark",
		name: "Görsel efekt, fırlatılan nesne, gölge ve yüzey işareti",
		supportedAssetCategories: ["visual_effect_projectile_shadow_mark"],
		metadataFields: [
			metadataField(
				"frame_id",
				"Kare kimliği",
				"identifier",
				true,
				"Her efekt karesi",
				"Kare kimliği ve sırası roundtrip boyunca korunur.",
				"effect.frames.id"
			),
			metadataField(
				"frame_region",
				"Kare alanı",
				"json",
				true,
				"Her efekt karesi",
				"Kare bölgesi kaynak görsel koordinatlarında korunur.",
				"effect.frames.region",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"frame_order",
				"Kare sırası",
				"integer",
				true,
				"Her efekt karesi",
				"Efekt karelerinin sırası roundtrip boyunca korunur.",
				"effect.frames.order"
			),
			metadataField(
				"duration_ms",
				"Kare süresi",
				"integer",
				true,
				"Her efekt karesi",
				"Süre pozitif milisaniye olarak korunur.",
				"effect.frames.duration_ms",
				"ms"
			),
			metadataField(
				"origin",
				"Başlangıç noktası",
				"json",
				true,
				"Efekt sürümü",
				"Başlangıç koordinatları tanımlı piksel düzleminde korunur.",
				"effect.origin",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"layer",
				"Katman",
				"integer",
				true,
				"Her efekt örneği",
				"Katman sırası korunur.",
				"effect.layer"
			),
			metadataField(
				"event_id",
				"Olay kimliği",
				"identifier",
				false,
				"Sahip animasyona bağlı efekt",
				"Sahip olay kimliği eşleşiyorsa aynen taşınır.",
				"effect.event_id"
			),
			metadataField(
				"overflow_allowed",
				"Hücre dışına taşma izni",
				"boolean",
				true,
				"Efekt sözleşmesi",
				"Bilinçli taşma izin bilgisi açıkça korunur.",
				"effect.overflow_allowed"
			),
			metadataField(
				"alpha_data",
				"Şeffaflık verisi",
				"json",
				true,
				"Efekt karesi",
				"Şeffaflık alanı kayıpsız korunur.",
				"effect.frames.alpha_data"
			),
			metadataField(
				"loop_mode",
				"Döngü biçimi",
				"text",
				true,
				"Her efekt animasyonu",
				"Döngü biçimi dışa aktarım ve yeniden okumada korunur.",
				"effect.loop_mode"
			),
		],
		rules: [
			{
				id: "effect.frame_and_alpha_integrity",
				class: "integrity_gate",
				input:
					"Frame ids, duration, origin, layer, event links, and readable alpha data.",
				successResult:
					"All frame and alpha fields remain readable and unchanged after roundtrip.",
				failureResult:
					"Unreadable composition, alpha data, or broken frame link blocks completion and export.",
				evidence:
					"Frame identities, alpha metadata, and source-to-readback values.",
				scope: "The exact effect Unit Version and any pinned owner animation.",
				exportEffect:
					"Retain all structural fields and block export on corruption or missing required links.",
				waiverEligibility: false,
			},
			{
				id: "effect.cell_overflow",
				class: "waivable_requirement",
				input:
					"Measured cell overflow and the declared overflow permission for the selected version.",
				successResult:
					"Overflow is within the declared bound or explicitly permitted for this rule.",
				failureResult:
					"The observed overflow is reported for the exact effect frame and version.",
				evidence:
					"Overflow measurement, declared permission, frame ids, and any waiver rationale.",
				scope: "Only measured effect frames in the selected Unit Version.",
				exportEffect:
					"Carry overflow permission and any exact version waiver; never waive composition or alpha corruption.",
				waiverEligibility: true,
			},
			{
				id: "effect.background_readability_advisory",
				class: "quality_advisory",
				input:
					"Human comparison on transparent, light, dark, and actual scene backgrounds.",
				successResult:
					"The user records visibility and contrast concerns for follow-up.",
				failureResult:
					"The advisory is visible without declaring the effect accepted or rejected.",
				evidence: "Human notes, backgrounds, and compared effect versions.",
				scope: "The selected effect's declared backgrounds and owner context.",
				exportEffect:
					"Include advisory evidence when present without relaxing integrity requirements.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "effect.readability_and_timing_review",
				label: "Zeminlerde okunurluk ve zamanlama incelemesi",
				input:
					"Effect playback alone and synchronized with its owner animation on declared backgrounds.",
				successResult:
					"The user records readability, layer, origin, and event timing review.",
				failureResult:
					"The required review remains incomplete until the user records an outcome.",
				evidence:
					"Review record, rationale, compared backgrounds, and pinned owner/effect versions.",
				scope:
					"The selected effect and the exact owner animation used for comparison.",
				exportEffect:
					"Reference the review record and pinned versions in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "effect.owner_event_sync",
				label: "Sahip animasyon ve olay eşzamanlama testi",
				input:
					"Pinned owner animation, event id, effect frame durations, origin, and layer.",
				successResult:
					"The effect starts on the declared event and preserves frame timing in playback.",
				failureResult:
					"The mismatched event or frame and result are recorded as failed or inconclusive.",
				evidence:
					"Pinned versions, event timeline, frame timing, and playback result.",
				scope: "The exact effect and owner versions under test.",
				exportEffect:
					"Pin owner, effect, event, and test result in the profile manifest.",
				required: true,
			},
		],
	}),
	defineContract({
		profileId: "tileset_terrain_texture",
		name: "Karo seti, arazi ve kesintisiz doku",
		supportedAssetCategories: ["tileset_terrain_texture"],
		metadataFields: [
			metadataField(
				"tile_id",
				"Karo kimliği",
				"identifier",
				true,
				"Her karo birimi",
				"Karo kimliği atlas ve komşuluk kayıtlarında sabit kalır.",
				"tileset.tiles.id"
			),
			metadataField(
				"atlas_region",
				"Atlas alanı",
				"json",
				true,
				"Her karo birimi",
				"Atlas dikdörtgeni piksel düzleminde korunur.",
				"tileset.tiles.atlas_region",
				"px",
				"atlas_top_left"
			),
			metadataField(
				"neighbor_map",
				"Komşuluk eşlemesi",
				"json",
				false,
				"Karo veya arazi kuralı",
				"Komşu kimlikleri ve yönleri korunur.",
				"tileset.neighbor_map"
			),
			metadataField(
				"terrain_id",
				"Arazi kimliği",
				"identifier",
				false,
				"Arazi bağlı karolar",
				"Arazi referansı kararlı kimlikle korunur.",
				"tileset.terrain_id"
			),
			metadataField(
				"animation",
				"Animasyon",
				"json",
				false,
				"Animasyonlu karo",
				"Kare ve süre bilgileri varsa aynen taşınır.",
				"tileset.animation"
			),
			metadataField(
				"repeat_axes",
				"Doku tekrar eksenleri",
				"text_list",
				false,
				"Kesintisiz doku",
				"Seçilen tekrar eksenleri korunur.",
				"texture.repeat_axes"
			),
		],
		rules: [
			{
				id: "tileset.neighbor_and_edge_integrity",
				class: "integrity_gate",
				input:
					"Tile ids, atlas regions, neighbor links, terrain references, and exact edge samples.",
				successResult:
					"Every declared neighbor resolves and deterministic edge checks match.",
				failureResult:
					"Broken links or non-matching required edges block completion and export.",
				evidence:
					"Tile ids, atlas coordinates, neighbor map, and edge comparison result.",
				scope:
					"The selected tileset or texture units and declared neighbor combinations.",
				exportEffect:
					"Retain tile identity and neighbor mapping; block export on broken references or failed exact edge checks.",
				waiverEligibility: false,
			},
			{
				id: "tileset.atlas_and_join_tolerance",
				class: "waivable_requirement",
				input:
					"Measured atlas dimensions and declared transition/join tolerance for the selected version.",
				successResult:
					"Measurements stay within the profile's declared atlas and join limits.",
				failureResult:
					"The affected tile, connection, and measurement are reported.",
				evidence:
					"Dimensions, join values, declared tolerances, and test map input.",
				scope:
					"Only the measured atlas or join rule for the selected Unit Version.",
				exportEffect:
					"Carry exact values and any allowed version waiver with affected tiles.",
				waiverEligibility: true,
			},
			{
				id: "tileset.visible_repeat_advisory",
				class: "quality_advisory",
				input:
					"Human review of visible repetition in 2x2, 3x3, and shifted repeats.",
				successResult:
					"The user records whether repeated patterns need follow-up.",
				failureResult:
					"A non-blocking visual advisory remains available to the user.",
				evidence:
					"Repeat previews and human notes for each tested arrangement.",
				scope: "The selected seamless texture and declared repeat axes.",
				exportEffect:
					"Include repeat settings and advisory evidence without treating subjective repetition as exact edge failure.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "tileset.transition_and_repetition_review",
				label: "Geçiş ve görünür tekrar incelemesi",
				input:
					"Test map of corners, edges, corridor, single-terrain fill, random combinations, and repeat previews.",
				successResult:
					"The user records visual transition and repetition findings by tile id.",
				failureResult:
					"The required review remains incomplete until recorded against the exact units.",
				evidence:
					"Review outcome, tile ids, test map arrangement, and repeat captures.",
				scope: "Only the selected tileset or texture units and scenarios.",
				exportEffect:
					"Reference the exact reviewed units and scenario results in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "tileset.corner_corridor_repeat_map",
				label: "Köşe, koridor ve tekrar test haritası",
				input:
					"Pinned tile ids, neighbor rules, terrain mapping, and a paintable map with required combinations.",
				successResult:
					"Required combinations resolve and repeat settings read back unchanged.",
				failureResult:
					"The failing tile or combination and test result are recorded.",
				evidence:
					"Pinned tile versions, map combinations, repeat values, and result.",
				scope: "The selected tileset and texture units in this test map.",
				exportEffect:
					"Pin the tested map inputs, mappings, repeat axes, and result.",
				required: true,
			},
		],
	}),
	defineContract({
		version: "1.0.1",
		profileId: "background_parallax",
		name: "Arka plan ve katmanlı kaydırma",
		supportedAssetCategories: ["background_parallax"],
		metadataFields: [
			metadataField(
				"layer_version_id",
				"Katman Asset Version kimliği",
				"identifier",
				true,
				"Her arka plan katmanı",
				"Katmanın tam Asset Version kimliği dışa aktarımda ve yeniden okumada korunur.",
				"background.layers.asset_version_id"
			),
			metadataField(
				"layer_id",
				"Katman kimliği",
				"identifier",
				true,
				"Her arka plan katmanı",
				"Katman kimliği dışa aktarımda ve yeniden okumada korunur.",
				"background.layers.id"
			),
			metadataField(
				"layer_order",
				"Katman sırası",
				"integer",
				true,
				"Her arka plan katmanı",
				"Sıralama değeri aynen taşınır.",
				"background.layers.order"
			),
			metadataField(
				"relative_speed",
				"Göreli hız",
				"number",
				true,
				"Her arka plan katmanı",
				"Göreli kaydırma hızı değer ve birimiyle korunur.",
				"background.layers.relative_speed",
				"ratio"
			),
			metadataField(
				"loop_and_crop_mode",
				"Döngü ve kırpma biçimi",
				"json",
				true,
				"Her arka plan katmanı",
				"Döngü ve kırpma tercihleri korunur.",
				"background.layers.loop_crop_mode"
			),
			metadataField(
				"natural_size",
				"Doğal ölçü",
				"json",
				true,
				"Her arka plan katmanı",
				"Genişlik ve yükseklik piksel olarak korunur.",
				"background.layers.natural_size",
				"px"
			),
			metadataField(
				"safe_area",
				"Güvenli alan",
				"json",
				true,
				"Hedef görüntü oranı",
				"Güvenli alan aynı koordinat düzleminde korunur.",
				"background.safe_area",
				"px",
				"source_image_top_left"
			),
		],
		rules: [
			{
				id: "background.layer_link_integrity",
				class: "integrity_gate",
				input:
					"Layer ids, order, relative speed, loop/crop modes, natural size, and safe area.",
				successResult:
					"All layers retain declared order and metadata through readback.",
				failureResult:
					"Missing layers, invalid order references, or lost crop/safe-area data block completion and export.",
				evidence:
					"Layer ids, ordering, dimensions, and source-to-readback values.",
				scope: "The selected background family and pinned layer versions.",
				exportEffect:
					"Retain the full layer map, order, speed, crop, loop, and safe-area values.",
				waiverEligibility: false,
			},
			{
				id: "background.ratio_and_safe_area_tolerance",
				class: "waivable_requirement",
				input:
					"Measured target aspect ratio, crop, safe area, and loop seam for the selected version.",
				successResult:
					"Measurements stay within the version's declared bounds.",
				failureResult:
					"Out-of-range values are reported against the exact layer and target ratio.",
				evidence:
					"Ratio, crop and safe-area values, loop measurements, and declared bounds.",
				scope:
					"Only the measured background version and declared target ratios.",
				exportEffect:
					"Carry exact measurements and any version-specific waiver with the affected layer.",
				waiverEligibility: true,
			},
			{
				id: "background.contrast_and_visibility_advisory",
				class: "quality_advisory",
				input:
					"Human review of contrast, visible player area, and seam appearance during motion.",
				successResult: "The user records context-specific visibility findings.",
				failureResult:
					"A non-blocking advisory remains without treating a static view as completed motion evidence.",
				evidence: "Human notes and target-ratio playback captures.",
				scope: "The selected background layers and target gameplay context.",
				exportEffect:
					"Include review evidence when present; no still image alone asserts the usage test passed.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "background.player_visibility_review",
				label: "Oyuncu görünürlüğü ve kontrast incelemesi",
				input:
					"Pinned background layers, target ratios, player silhouette, and declared safe area.",
				successResult:
					"The user records whether the player remains visible in the selected contexts.",
				failureResult:
					"The review stays incomplete until the user records the decision.",
				evidence:
					"Review outcome, target ratios, safe-area values, and player context.",
				scope: "The selected background family and tested contexts.",
				exportEffect:
					"Reference the human review and the exact target context in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "background.parallax_scroll_playback",
				label: "Katmanlı kaydırma oynatma testi",
				input:
					"Pinned layer versions, relative speeds, loop/crop modes, target ratio, and player silhouette.",
				successResult:
					"Layers move at declared relative speeds and preserve loop, crop, contrast, and safe area.",
				failureResult:
					"The failing layer, ratio, or playback segment is recorded as failed or inconclusive.",
				evidence:
					"Pinned versions, target ratio, playback segment, and result.",
				scope:
					"The exact background layers and player context used by the test.",
				exportEffect:
					"Pin tested layer versions, target ratio, and usage-test result.",
				required: true,
			},
		],
	}),
	defineContract({
		profileId: "ui",
		name: "Arayüz ekranı ve bileşeni",
		supportedAssetCategories: ["ui"],
		metadataFields: [
			metadataField(
				"component_id",
				"Bileşen kimliği",
				"identifier",
				true,
				"Her arayüz bileşeni",
				"Bileşen kimliği ekran bağlantılarında kararlı kalır.",
				"ui.components.id"
			),
			metadataField(
				"state_id",
				"Durum kimliği",
				"identifier",
				true,
				"Her bileşen durumu",
				"Normal, seçili ve diğer durumlar açık kimlikle taşınır.",
				"ui.components.states.id"
			),
			metadataField(
				"natural_size",
				"Doğal ölçü",
				"json",
				true,
				"Her ekran veya bileşen",
				"Ölçüler piksel olarak korunur.",
				"ui.components.natural_size",
				"px"
			),
			metadataField(
				"stretch_margins",
				"Dokuz parçalı germe payları",
				"json",
				false,
				"Gerilebilen panel veya çerçeve",
				"Kenar payları ve koordinat temelinin bilgisi korunur.",
				"ui.components.stretch_margins",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"text_safe_area",
				"Metin güvenli alanı",
				"json",
				true,
				"Metin taşıyan bileşen",
				"Metin sınırı seçilen koordinat düzleminde korunur.",
				"ui.components.text_safe_area",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"screen_component_link",
				"Ekran ve bileşen bağlantısı",
				"identifier",
				false,
				"Ekrana bağlı bileşen",
				"Bağlantı kimliği çözümlenebilir kaldığında korunur.",
				"ui.screen_component_link"
			),
		],
		rules: [
			{
				id: "ui.state_and_stretch_integrity",
				class: "integrity_gate",
				input:
					"Component/state ids, natural size, stretch margins, safe area, and screen links.",
				successResult:
					"All declared ids resolve and geometric values survive export/readback.",
				failureResult:
					"Broken state/link or invalid required geometry blocks completion and export.",
				evidence:
					"State map, measured geometry, and source-to-readback comparison.",
				scope: "The selected UI screen/component family and pinned versions.",
				exportEffect:
					"Retain state ids, stretch geometry, safe areas, and screen/component references.",
				waiverEligibility: false,
			},
			{
				id: "ui.target_size_and_text_bounds",
				class: "waivable_requirement",
				input:
					"Measured target size, text safe-area bounds, and nine-slice margins.",
				successResult:
					"The values stay within the declared target dimensions and margin bounds.",
				failureResult:
					"Invalid bounds are reported for the exact state and target size.",
				evidence:
					"Target dimensions, margin values, text bounds, and declared tolerance.",
				scope:
					"Only the measured UI state and target sizes in the selected version.",
				exportEffect:
					"Carry measured values and any version-specific waiver; required absent fields still stop export.",
				waiverEligibility: true,
			},
			{
				id: "ui.state_style_advisory",
				class: "quality_advisory",
				input:
					"Human comparison of screen and component states in the selected Visual World.",
				successResult:
					"The user records whether states remain visually distinguishable and consistent.",
				failureResult: "A non-blocking advisory remains for user review.",
				evidence: "Human notes and compared state versions.",
				scope: "The selected UI family and its declared states.",
				exportEffect:
					"Include advisory evidence when present without generating gameplay interaction code.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "ui.family_state_review",
				label: "Arayüz ailesi ve durum incelemesi",
				input:
					"Screen, component states, family style, and selected Visual World.",
				successResult:
					"The user records a review outcome for the declared states.",
				failureResult: "The required review remains incomplete until recorded.",
				evidence: "Review outcome, rationale, state ids, and exact versions.",
				scope: "The selected UI family only.",
				exportEffect:
					"Reference the review record and pinned states in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "ui.target_size_stretch_and_text",
				label: "Hedef ölçü, germe ve metin alanı testi",
				input:
					"Pinned component states, target sizes, stretch margins, and text safe area.",
				successResult:
					"The component stretches within declared margins and preserves its text safe area.",
				failureResult:
					"The failing state, size, or geometry is recorded as failed or inconclusive.",
				evidence:
					"Pinned state versions, tested dimensions, margin geometry, and result.",
				scope: "The selected UI family and each tested target size.",
				exportEffect:
					"Pin component, state, target dimensions, and test result in the manifest.",
				required: true,
			},
		],
	}),
	defineContract({
		profileId: "portrait_logo_marketing",
		name: "Portre, logo ve tanıtım görseli",
		supportedAssetCategories: ["portrait_logo_marketing"],
		metadataFields: [
			metadataField(
				"use_purpose",
				"Kullanım amacı",
				"identifier",
				true,
				"Her görsel sürümü",
				"Portre, logo veya tanıtım amacı kararlı değerle korunur.",
				"marketing.use_purpose"
			),
			metadataField(
				"visual_world_id",
				"Görsel Dünya kimliği",
				"identifier",
				true,
				"Her görsel sürümü",
				"Görsel Dünya bağlantısı tam kimlikle korunur.",
				"marketing.visual_world_id"
			),
			metadataField(
				"canonical_design_id",
				"Ana Tasarım kimliği",
				"identifier",
				false,
				"Ana Tasarıma bağlı sürüm",
				"Ana Tasarım kimliği varsa aynen taşınır.",
				"marketing.canonical_design_id"
			),
			metadataField(
				"natural_size",
				"Doğal ölçü",
				"json",
				true,
				"Her görsel sürümü",
				"Genişlik ve yükseklik piksel olarak korunur.",
				"marketing.natural_size",
				"px"
			),
			metadataField(
				"crop_and_safe_area",
				"Kırpma ve güvenli alan",
				"json",
				true,
				"Her kullanım çeşidi",
				"Kırpma ve güvenli alan aynı koordinat düzleminde korunur.",
				"marketing.crop_safe_area",
				"px",
				"source_image_top_left"
			),
			metadataField(
				"background_variant",
				"Arka plan çeşidi",
				"text",
				true,
				"Her kullanım çeşidi",
				"Şeffaf, açık veya koyu arka plan seçimi taşınır.",
				"marketing.background_variant"
			),
		],
		rules: [
			{
				id: "marketing.world_design_and_crop_integrity",
				class: "integrity_gate",
				input:
					"Use purpose, Visual World, Canonical Design link, natural size, crop, and safe area.",
				successResult:
					"All required references resolve and the declared crop geometry reads back unchanged.",
				failureResult:
					"Broken world/design links or missing required crop data block completion and export.",
				evidence:
					"Resolved ids, crop bounds, source values, and readback comparison.",
				scope:
					"The selected portrait, logo, or marketing Asset Version and usage variant.",
				exportEffect:
					"Retain use purpose, exact references, natural size, crop, safe area, and background variant.",
				waiverEligibility: false,
			},
			{
				id: "marketing.ratio_and_safe_area_tolerance",
				class: "waivable_requirement",
				input:
					"Measured target ratio, small-use readability dimensions, and safe-area bounds.",
				successResult:
					"Measurements meet the declared target bounds for the selected purpose.",
				failureResult:
					"Out-of-range values are reported for the exact usage variant.",
				evidence:
					"Target ratio, rendered dimensions, safe-area values, and declared tolerance.",
				scope: "Only measured variants of the selected Asset Version.",
				exportEffect:
					"Carry measured values and any permitted version-specific waiver.",
				waiverEligibility: true,
			},
			{
				id: "marketing.identity_and_readability_advisory",
				class: "quality_advisory",
				input:
					"Human comparison of expression, identity, crop, and small-size readability.",
				successResult:
					"The user records whether the image communicates its selected purpose.",
				failureResult:
					"A non-blocking advisory remains; promotion use is not judged by pixel-art constraints.",
				evidence: "Human notes and small-size/background comparison captures.",
				scope: "The selected use purpose and its declared display contexts.",
				exportEffect:
					"Include advisory evidence when present without applying gameplay pixel-scale rules.",
				waiverEligibility: false,
			},
		],
		humanReviews: [
			{
				id: "marketing.identity_expression_and_crop_review",
				label: "Kimlik, ifade ve kırpma incelemesi",
				input:
					"Selected Visual World, Canonical Design, usage purpose, crop, and display backgrounds.",
				successResult:
					"The user records identity, expression, and purpose-specific crop review.",
				failureResult:
					"The review remains incomplete until the user records an outcome.",
				evidence:
					"Review decision, rationale, selected purpose, and exact references.",
				scope: "The selected portrait, logo, or marketing Asset Version.",
				exportEffect:
					"Reference human review and pinned design/world records in the bundle.",
				required: true,
			},
		],
		usageTests: [
			{
				id: "marketing.small_use_background_crop",
				label: "Küçük kullanım, arka plan ve kırpma testi",
				input:
					"Pinned version, usage purpose, target ratios, safe area, and light/dark or transparent backgrounds.",
				successResult:
					"The selected use remains readable and its crop/safe area is preserved in each target context.",
				failureResult:
					"The failing purpose, size, background, or crop is recorded as failed or inconclusive.",
				evidence:
					"Pinned version, target sizes, backgrounds, crop values, and result.",
				scope: "The exact usage variants and display contexts tested.",
				exportEffect:
					"Pin each tested purpose, background, crop, and result; do not apply game-sprite constraints to promotion art.",
				required: true,
			},
		],
	}),
] as const satisfies readonly SpecializedProfileContract[];

export function getSpecializedProfileContract(profileId: SpecializedProfileId) {
	return specializedProfileContractCatalog.find(
		(contract) => contract.profileId === profileId
	);
}
