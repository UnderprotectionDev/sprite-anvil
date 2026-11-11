import { z } from "zod";
import {
	comparePaths,
	deliveryRelativePathSchema,
} from "./delivery-path-schemas";
import { sha256Schema } from "./export-bundle-manifest";

/**
 * The one path classification web and desktop share for a Delivery Refresh.
 * It is pure and compares only paths the previous Delivery Refresh Lock owns
 * (plus the new bundle's own paths). A target file that is in neither list is
 * never an input, so it can never be changed or deleted by a refresh.
 */

export const deliveryRefreshPathClasses = [
	"unchanged",
	"to-update",
	"stale",
	"missing",
	"diverged",
] as const;
export type DeliveryRefreshPathClass =
	(typeof deliveryRefreshPathClasses)[number];

export const deliveryRefreshDecisionKinds = [
	"preserve",
	"other_destination",
	"replace",
] as const;
export type DeliveryRefreshDecisionKind =
	(typeof deliveryRefreshDecisionKinds)[number];

/**
 * A user's decision on one diverged path. Replacing overwrites the user's own file, so
 * it carries `diffViewed: true`, the surface's statement that the user saw the differences
 * before choosing; a replace without it is refused here and ignored by the plan.
 */
export const deliveryRefreshDecisionSchema = z.discriminatedUnion("decision", [
	z
		.object({
			decision: z.literal("preserve"),
			path: deliveryRelativePathSchema,
		})
		.strict(),
	z
		.object({
			decision: z.literal("other_destination"),
			path: deliveryRelativePathSchema,
		})
		.strict(),
	z
		.object({
			decision: z.literal("replace"),
			diffViewed: z.literal(true),
			path: deliveryRelativePathSchema,
		})
		.strict(),
]);
export type DeliveryRefreshDecision = z.infer<
	typeof deliveryRefreshDecisionSchema
>;

interface PathDigest {
	path: string;
	sha256: string;
}

/** One target path as the surface found it before writing; `null` means the path is absent. */
export interface DeliveryRefreshObservation {
	path: string;
	sha256: string | null;
}

export interface DeliveryRefreshPathEntry {
	class: DeliveryRefreshPathClass;
	/** Digest the previous lock recorded; null when the lock never owned the path. */
	lockSha256: string | null;
	/** Digest in the new bundle; null when the bundle no longer ships the path. */
	nextSha256: string | null;
	path: string;
	/** Digest found in the target; null when the path is absent. */
	targetSha256: string | null;
}

export interface DeliveryRefreshClassification {
	/** Path-sorted. */
	entries: DeliveryRefreshPathEntry[];
}

function classifyOne(
	lockSha256: string | null,
	nextSha256: string | null,
	targetSha256: string | null
): DeliveryRefreshPathClass {
	if (lockSha256 === null) {
		// Not owned: only a new bundle path reaches here. An absent path is simply added;
		// a present file with other bytes is not ours to overwrite without a decision.
		if (targetSha256 === null) {
			return "to-update";
		}
		return targetSha256 === nextSha256 ? "unchanged" : "diverged";
	}
	if (targetSha256 === null) {
		return "missing";
	}
	if (targetSha256 !== lockSha256) {
		return targetSha256 === nextSha256 ? "unchanged" : "diverged";
	}
	if (nextSha256 === null) {
		return "stale";
	}
	return nextSha256 === lockSha256 ? "unchanged" : "to-update";
}

/**
 * Sorts every lock-owned and bundle path into unchanged, to-update, stale, missing or
 * diverged. `observed` may hold other target files; they are ignored.
 */
export function classifyDeliveryRefreshPaths(input: {
	next: PathDigest[];
	observed: DeliveryRefreshObservation[];
	previous: PathDigest[];
}): DeliveryRefreshClassification {
	const lock = new Map(input.previous.map((f) => [f.path, f.sha256]));
	const next = new Map(input.next.map((f) => [f.path, f.sha256]));
	const target = new Map(input.observed.map((f) => [f.path, f.sha256]));
	const paths = [...new Set([...lock.keys(), ...next.keys()])].sort(
		comparePaths
	);
	return {
		entries: paths.map((path) => {
			const lockSha256 = lock.get(path) ?? null;
			const nextSha256 = next.get(path) ?? null;
			const targetSha256 = target.get(path) ?? null;
			return {
				class: classifyOne(lockSha256, nextSha256, targetSha256),
				lockSha256,
				nextSha256,
				path,
				targetSha256,
			};
		}),
	};
}

/** A diverged path the new bundle still ships: writing it needs the user's decision. */
export function requiresDeliveryRefreshDecision(
	entry: DeliveryRefreshPathEntry
): boolean {
	return entry.class === "diverged" && entry.nextSha256 !== null;
}

/** A diverged path the user kept out of a refresh. */
export interface DeliveryRefreshHeldPath {
	decision: Exclude<DeliveryRefreshDecisionKind, "replace">;
	path: string;
}

export type DeliveryRefreshOutcome = "complete" | "halted" | "partial";

export interface DeliveryRefreshPlan {
	/** Paths a surface may write now, path-sorted: updates, restores and replaced divergences. */
	applied: string[];
	/** Diverged paths that still wait for a decision. Nothing is written for them. */
	halted: DeliveryRefreshPathEntry[];
	/** Diverged paths the user kept out of this refresh (preserve or another destination). */
	held: DeliveryRefreshHeldPath[];
	/** Never "complete" while a path is halted or held back. */
	outcome: DeliveryRefreshOutcome;
	/**
	 * Diverged paths the new bundle no longer ships: the user's edited file stays in place,
	 * is not written and stops being owned. Reported apart so it never vanishes silently.
	 */
	staleDiverged: DeliveryRefreshPathEntry[];
}

/** What the classification and the user's decisions allow a surface to write. */
export function planDeliveryRefresh(
	classification: DeliveryRefreshClassification,
	decisions: DeliveryRefreshDecision[]
): DeliveryRefreshPlan {
	// A replace without the diff-viewed proof is no decision: the path keeps waiting.
	const decided = new Map(
		decisions.flatMap((d) =>
			d.decision === "replace" && d.diffViewed !== true
				? []
				: [[d.path, d.decision] as const]
		)
	);
	const applied: string[] = [];
	const held: DeliveryRefreshHeldPath[] = [];
	const halted: DeliveryRefreshPathEntry[] = [];
	const staleDiverged: DeliveryRefreshPathEntry[] = [];
	for (const entry of classification.entries) {
		if (requiresDeliveryRefreshDecision(entry)) {
			const decision = decided.get(entry.path);
			if (decision === "replace") {
				applied.push(entry.path);
			} else if (decision) {
				held.push({ decision, path: entry.path });
			} else {
				halted.push(entry);
			}
		} else if (entry.class === "diverged") {
			staleDiverged.push(entry);
		} else if (
			entry.nextSha256 !== null &&
			(entry.class === "to-update" || entry.class === "missing")
		) {
			applied.push(entry.path);
		}
	}
	let outcome: DeliveryRefreshOutcome = "complete";
	if (halted.length > 0) {
		outcome = "halted";
	} else if (held.length > 0) {
		outcome = "partial";
	}
	return { applied, halted, held, outcome, staleDiverged };
}

/** The lock contract major this build can refresh from. */
export const supportedDeliveryRefreshLockMajor = 1;

const lockVersionPattern = /^(\d+)\.\d+\.\d+$/;

const lockContractShape = z.object({
	bundleId: z.string().min(1),
	bundleManifestDigest: sha256Schema,
	contractVersion: z.string().regex(lockVersionPattern),
	destinationLabel: z.string().min(1),
	files: z
		.array(
			z.object({
				byteSize: z.number().int().positive(),
				path: z.string().min(1),
				sha256: sha256Schema,
			})
		)
		.min(1),
	lockDigest: sha256Schema,
	profileId: z.string().min(1),
	profileRevisionId: z.string().min(1),
});

export type DeliveryRefreshLockContractCheck =
	| { ok: true }
	| { ok: false; reason: "malformed" | "unsupported_major" };

/**
 * Whether a lock can be refreshed from: it must carry a full `major.minor.patch`
 * contract version of a known major and every required field. Either failure stops the refresh.
 */
export function checkDeliveryRefreshLockContract(
	lock: unknown
): DeliveryRefreshLockContractCheck {
	const version = (lock as { contractVersion?: unknown } | null)
		?.contractVersion;
	const major =
		typeof version === "string"
			? lockVersionPattern.exec(version)?.[1]
			: undefined;
	if (
		major !== undefined &&
		Number(major) !== supportedDeliveryRefreshLockMajor
	) {
		return { ok: false, reason: "unsupported_major" };
	}
	return lockContractShape.safeParse(lock).success
		? { ok: true }
		: { ok: false, reason: "malformed" };
}
