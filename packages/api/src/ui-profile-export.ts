import { z } from "zod";
import {
	type UiStretchTestRecord,
	uiStretchTestRecordSchema,
} from "./ui-stretch-tests";

/** Static profile metadata; this does not start an Export Bundle or emit runtime UI code. */
export function makeUiProfileManifest(input: UiStretchTestRecord) {
	const record = uiStretchTestRecordSchema.parse(input);
	return {
		contract_version: "ui-stretch-test/1.0.0" as const,
		contract_revision_id: record.contractRevisionId,
		ui: {
			screen_component_link: record.screen
				? {
						asset_record_id: record.screen.assetRecordId,
						asset_version_id: record.screen.assetVersionId,
					}
				: null,
			components: [
				...new Set(record.states.map((state) => state.componentId)),
			].map((componentId) => {
				const states = record.states.filter(
					(state) => state.componentId === componentId
				);
				return {
					id: componentId,
					states: states.map((state) => ({
						id: state.stateId,
						asset_record_id: state.assetRecordId,
						asset_version_id: state.assetVersionId,
					})),
					natural_size: Object.fromEntries(
						states.map((state) => [state.stateId, state.naturalSize])
					),
					stretch_margins: Object.fromEntries(
						states.map((state) => [state.stateId, state.stretchMargins])
					),
					text_safe_area: Object.fromEntries(
						states.map((state) => [state.stateId, state.textSafeArea])
					),
				};
			}),
		},
		evidence: record,
	};
}

const manifestBaseSchema = z
	.object({
		contract_version: z.literal("ui-stretch-test/1.0.0"),
		contract_revision_id: z.string(),
		ui: z
			.object({
				screen_component_link: z
					.object({ asset_record_id: z.string(), asset_version_id: z.string() })
					.strict()
					.nullable(),
				components: z.array(
					z
						.object({
							id: z.string(),
							states: z.array(
								z
									.object({
										id: z.string(),
										asset_record_id: z.string(),
										asset_version_id: z.string(),
									})
									.strict()
							),
							natural_size: z.record(
								z.string(),
								z.object({ width: z.number(), height: z.number() }).strict()
							),
							stretch_margins: z.record(
								z.string(),
								z
									.object({
										left: z.number(),
										right: z.number(),
										top: z.number(),
										bottom: z.number(),
									})
									.strict()
							),
							text_safe_area: z.record(
								z.string(),
								z
									.object({
										x: z.number(),
										y: z.number(),
										width: z.number(),
										height: z.number(),
									})
									.strict()
							),
						})
						.strict()
				),
			})
			.strict(),
		evidence: uiStretchTestRecordSchema,
	})
	.strict();
export const uiProfileManifestSchema = manifestBaseSchema.superRefine(
	(manifest, ctx) => {
		if (
			JSON.stringify(manifest) !==
			JSON.stringify(
				manifestBaseSchema.parse(makeUiProfileManifest(manifest.evidence))
			)
		) {
			ctx.addIssue({
				code: "custom",
				message: "UI profile mapping does not match its pinned evidence.",
			});
		}
	}
);
export function readUiProfileManifest(json: string) {
	return uiProfileManifestSchema.parse(JSON.parse(json));
}
