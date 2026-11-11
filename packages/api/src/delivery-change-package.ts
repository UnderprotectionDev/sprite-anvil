import { z } from "zod";
import { deliveryRelativePathSchema } from "./delivery-path-schemas";
import {
	type DeliveryRefreshClassification,
	type DeliveryRefreshDecision,
	deliveryRefreshDecisionKinds,
	deliveryRefreshPathClasses,
	planDeliveryRefresh,
} from "./delivery-refresh-classification";
import { deliveryRefreshLockContractVersion } from "./delivery-refresh-locks";
import { sha256Schema } from "./export-bundle-manifest";

export const deliveryChangePackageFormat =
	"sprite-anvil.delivery-change-package";
export const deliveryChangePackageContractVersion = "1.0.0";
const supportedChangePackageMajor = 1;
const majorPattern = /^(\d+)\.\d+\.\d+$/;

const fileSchema = z
	.object({
		byteSize: z.number().int().positive(),
		path: deliveryRelativePathSchema,
		sha256: sha256Schema,
	})
	.strict();

const entrySchema = z
	.object({
		class: z.enum(deliveryRefreshPathClasses),
		decision: z.enum(deliveryRefreshDecisionKinds).nullable(),
		lockSha256: sha256Schema.nullable(),
		nextSha256: sha256Schema.nullable(),
		path: deliveryRelativePathSchema,
		targetSha256: sha256Schema.nullable(),
	})
	.strict();

/**
 * The downloadable result of a web refresh review: the lock the refresh would record and
 * the divergence report. It is data only (JSON); it holds no file bytes, script or
 * absolute path, and no unrecognised target file. A desktop surface applies the same
 * meaning to a folder the user granted; on the web the user applies `changes` by hand.
 */
export const deliveryChangePackageSchema = z
	.object({
		changes: z.array(fileSchema),
		contractVersion: z
			.string()
			.refine(
				(version) =>
					Number(majorPattern.exec(version)?.[1]) ===
					supportedChangePackageMajor,
				"Unsupported change package contract version."
			),
		format: z.literal(deliveryChangePackageFormat),
		/** The lock a completed refresh would record; null while a divergence waits for a decision. */
		lock: z
			.object({
				bundleId: z.string(),
				bundleManifestDigest: sha256Schema,
				contractVersion: z.string(),
				destinationLabel: z.string(),
				files: z.array(fileSchema),
				profileId: z.string(),
				profileRevisionId: z.string(),
			})
			.strict()
			.nullable(),
		previousLockId: z.string(),
		report: z
			.object({
				applied: z.array(deliveryRelativePathSchema),
				entries: z.array(entrySchema),
				halted: z.array(entrySchema),
				outcome: z.enum(["complete", "halted", "partial"]),
				/** Diverged paths the new bundle no longer ships: left in place and no longer owned. */
				staleDiverged: z.array(entrySchema),
				preserved: z.array(
					z
						.object({
							decision: z.enum(["other_destination", "preserve"]),
							path: deliveryRelativePathSchema,
						})
						.strict()
				),
			})
			.strict(),
	})
	.strict();
export type DeliveryChangePackage = z.infer<typeof deliveryChangePackageSchema>;

export function buildDeliveryChangePackage(input: {
	bundle: {
		bundleId: string;
		bundleManifestDigest: string;
		files: { byteSize: number; path: string; sha256: string }[];
		profileId: string;
		profileRevisionId: string;
	};
	classification: DeliveryRefreshClassification;
	decisions: DeliveryRefreshDecision[];
	previous: { destinationLabel: string; id: string };
}): DeliveryChangePackage {
	const { bundle, classification, decisions, previous } = input;
	const plan = planDeliveryRefresh(classification, decisions);
	const decided = new Map(decisions.map((d) => [d.path, d.decision]));
	const entries = classification.entries.map((entry) => ({
		...entry,
		decision: decided.get(entry.path) ?? null,
	}));
	const heldPaths = new Set(plan.held.map((held) => held.path));
	const bundleFile = new Map(bundle.files.map((file) => [file.path, file]));
	return {
		changes: plan.applied.map((path) => {
			const { byteSize, sha256 } = bundleFile.get(path) as {
				byteSize: number;
				sha256: string;
			};
			return { byteSize, path, sha256 };
		}),
		contractVersion: deliveryChangePackageContractVersion,
		format: deliveryChangePackageFormat,
		lock:
			plan.outcome === "halted"
				? null
				: {
						bundleId: bundle.bundleId,
						bundleManifestDigest: bundle.bundleManifestDigest,
						contractVersion: deliveryRefreshLockContractVersion,
						destinationLabel: previous.destinationLabel,
						files: bundle.files
							.filter((file) => !heldPaths.has(file.path))
							.map(({ byteSize, path, sha256 }) => ({
								byteSize,
								path,
								sha256,
							})),
						profileId: bundle.profileId,
						profileRevisionId: bundle.profileRevisionId,
					},
		previousLockId: previous.id,
		report: {
			applied: plan.applied,
			entries,
			halted: entries.filter((entry) =>
				plan.halted.some((halted) => halted.path === entry.path)
			),
			outcome: plan.outcome,
			preserved: plan.held,
			staleDiverged: entries.filter((entry) =>
				plan.staleDiverged.some((stale) => stale.path === entry.path)
			),
		},
	};
}

export function renderDeliveryChangePackage(pkg: DeliveryChangePackage) {
	return `${JSON.stringify(pkg, null, 2)}\n`;
}
