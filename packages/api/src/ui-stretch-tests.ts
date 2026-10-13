import { z } from "zod";
import { specializedProfileContractSchema } from "./specialized-profile-contracts";

const id = z.string().trim().min(1).max(200);
const size = z
	.object({
		width: z.number().int().positive().max(32_768),
		height: z.number().int().positive().max(32_768),
	})
	.strict();
const rectangle = size
	.extend({
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
	})
	.strict();
const margins = z
	.object({
		left: z.number().int().nonnegative(),
		right: z.number().int().nonnegative(),
		top: z.number().int().nonnegative(),
		bottom: z.number().int().nonnegative(),
	})
	.strict();
const reference = z.object({ assetRecordId: id, assetVersionId: id }).strict();
export const uiStretchStateSchema = reference
	.extend({
		componentId: id,
		stateId: id,
		naturalSize: size,
		stretchMargins: margins,
		textSafeArea: rectangle,
	})
	.strict()
	.superRefine((state, ctx) => {
		const { naturalSize: n, stretchMargins: m, textSafeArea: s } = state;
		if (m.left + m.right >= n.width || m.top + m.bottom >= n.height) {
			ctx.addIssue({
				code: "custom",
				path: ["stretchMargins"],
				message: "Stretch margins must leave a positive source center.",
			});
		}
		if (s.x + s.width > n.width || s.y + s.height > n.height) {
			ctx.addIssue({
				code: "custom",
				path: ["textSafeArea"],
				message: "Text safe area must fit inside the source image.",
			});
		}
	});
const outcome = z.enum(["passed", "failed", "inconclusive"]);
const observation = z
	.object({
		componentId: id,
		stateId: id,
		targetIndex: z.number().int().nonnegative(),
		outcome,
		notes: z.string().trim().min(1).max(2000),
	})
	.strict();
export const uiStretchTestListInputSchema = z
	.object({ projectId: id, assetFamilyId: id })
	.strict();
export const uiStretchTestInputSchema = uiStretchTestListInputSchema
	.extend({
		id: z.uuid(),
		visualWorldId: id,
		contractRevisionId: id,
		screen: reference.optional(),
		states: z.array(uiStretchStateSchema).min(1).max(24),
		sampleText: z.string().trim().min(1).max(2000),
		targets: z
			.array(
				size
					.extend({
						width: z.number().int().positive().max(4096),
						height: z.number().int().positive().max(4096),
					})
					.strict()
			)
			.min(1)
			.max(12),
		observations: z.array(observation).max(288),
	})
	.strict()
	.superRefine((input, ctx) => {
		const keys = input.states.map((s) =>
			JSON.stringify([s.componentId, s.stateId])
		);
		if (new Set(keys).size !== keys.length) {
			ctx.addIssue({
				code: "custom",
				path: ["states"],
				message: "Component and state identities must be unique.",
			});
		}
		const observed = input.observations.map((o) =>
			JSON.stringify([o.componentId, o.stateId, o.targetIndex])
		);
		if (
			new Set(observed).size !== observed.length ||
			input.observations.some(
				(o) =>
					o.targetIndex >= input.targets.length ||
					!input.states.some(
						(s) => s.componentId === o.componentId && s.stateId === o.stateId
					)
			)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["observations"],
				message:
					"Observations must uniquely reference a declared state and target size.",
			});
		}
	});
export type UiStretchTestInput = z.infer<typeof uiStretchTestInputSchema>;
export type UiStretchState = z.infer<typeof uiStretchStateSchema>;

/** Map a source coordinate through the same three bands used to draw nine slices. */
function stretchCoordinate(
	value: number,
	source: number,
	target: number,
	start: number,
	end: number
) {
	if (value <= start) {
		return value;
	}
	if (value >= source - end) {
		return target - (source - value);
	}
	return (
		start + ((value - start) * (target - start - end)) / (source - start - end)
	);
}
export function evaluateUiStretchTest(input: UiStretchTestInput) {
	return input.states.flatMap((state) =>
		input.targets.map((target, targetIndex) => {
			const m = state.stretchMargins;
			const valid =
				target.width > m.left + m.right && target.height > m.top + m.bottom;
			const s = state.textSafeArea;
			const x = stretchCoordinate(
				s.x,
				state.naturalSize.width,
				target.width,
				m.left,
				m.right
			);
			const y = stretchCoordinate(
				s.y,
				state.naturalSize.height,
				target.height,
				m.top,
				m.bottom
			);
			const right = stretchCoordinate(
				s.x + s.width,
				state.naturalSize.width,
				target.width,
				m.left,
				m.right
			);
			const bottom = stretchCoordinate(
				s.y + s.height,
				state.naturalSize.height,
				target.height,
				m.top,
				m.bottom
			);
			const seen = input.observations.find(
				(o) =>
					o.componentId === state.componentId &&
					o.stateId === state.stateId &&
					o.targetIndex === targetIndex
			);
			return {
				componentId: state.componentId,
				stateId: state.stateId,
				targetIndex,
				ruleId: "ui.target_size_and_text_bounds" as const,
				ruleClass: "waivable_requirement" as const,
				geometry: valid ? ("passed" as const) : ("failed" as const),
				outcome: valid
					? (seen?.outcome ?? "inconclusive")
					: ("failed" as const),
				targetTextSafeArea: valid
					? { x, y, width: right - x, height: bottom - y }
					: null,
			};
		})
	);
}
const evaluation = z
	.object({
		componentId: id,
		stateId: id,
		targetIndex: z.number().int().nonnegative(),
		ruleId: z.literal("ui.target_size_and_text_bounds"),
		ruleClass: z.literal("waivable_requirement"),
		geometry: z.enum(["passed", "failed"]),
		outcome,
		targetTextSafeArea: z
			.object({
				x: z.number().nonnegative(),
				y: z.number().nonnegative(),
				width: z.number().positive(),
				height: z.number().positive(),
			})
			.strict()
			.nullable(),
	})
	.strict();
const versionPin = reference
	.extend({
		assetRecordName: z.string().min(1).max(120),
		versionNumber: z.number().int().positive(),
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		contentLength: z.number().int().positive(),
		contentType: z.enum(["image/png", "image/webp"]),
		naturalSize: size,
	})
	.strict();
export const uiStretchTestRecordSchema = uiStretchTestInputSchema
	.extend({
		contractVersion: z.literal("ui-stretch-test/1.0.0"),
		contractSnapshot: specializedProfileContractSchema,
		createdAt: z.string().datetime(),
		createdByUserId: id,
		versionPins: z.array(versionPin).min(1).max(25),
		evaluations: z.array(evaluation).min(1).max(288),
	})
	.strict()
	.superRefine((record, ctx) => {
		if (record.contractSnapshot.profileId !== "ui") {
			ctx.addIssue({
				code: "custom",
				path: ["contractSnapshot"],
				message:
					"UI Stretch Test requires the UI Specialized Profile Contract.",
			});
		}
		const sources = [
			...record.states,
			...(record.screen ? [record.screen] : []),
		];
		if (
			new Set(record.versionPins.map((p) => p.assetVersionId)).size !==
				record.versionPins.length ||
			sources.some(
				(s) =>
					!record.versionPins.some(
						(p) =>
							p.assetVersionId === s.assetVersionId &&
							p.assetRecordId === s.assetRecordId
					)
			) ||
			record.versionPins.some(
				(p) => !sources.some((s) => s.assetVersionId === p.assetVersionId)
			) ||
			record.states.some(
				(s) =>
					!record.versionPins.some(
						(p) =>
							p.assetVersionId === s.assetVersionId &&
							p.naturalSize.width === s.naturalSize.width &&
							p.naturalSize.height === s.naturalSize.height
					)
			)
		) {
			ctx.addIssue({
				code: "custom",
				path: ["versionPins"],
				message:
					"Every screen and state must retain its exact source version and dimensions.",
			});
		}
		if (
			JSON.stringify(record.evaluations) !==
			JSON.stringify(evaluateUiStretchTest(record))
		) {
			ctx.addIssue({
				code: "custom",
				path: ["evaluations"],
				message: "Stretch evidence does not match the exact input.",
			});
		}
	});
export type UiStretchTestRecord = z.infer<typeof uiStretchTestRecordSchema>;
export interface UiStretchTestStore {
	append: (
		userId: string,
		record: UiStretchTestRecord
	) => Promise<UiStretchTestRecord | null>;
	list: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<UiStretchTestRecord[] | null>;
	listAccessibleVersionIds: (
		userId: string,
		projectId: string,
		assetFamilyId: string
	) => Promise<Set<string> | null>;
}
