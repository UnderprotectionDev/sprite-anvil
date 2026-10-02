import type { QualityVersionTarget } from "@sprite-anvil/api/family-readiness";
import type { Database } from "@sprite-anvil/db";
import {
	compositeVersions,
	unitVersions,
} from "@sprite-anvil/db/schema/asset-versions";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";

export function qualityVersionTargetFromEvidence(evidence: {
	unitVersionId: string | null;
	compositeVersionId: string | null;
}): QualityVersionTarget | null {
	if (evidence.unitVersionId) {
		return { kind: "unit", id: evidence.unitVersionId };
	}
	return evidence.compositeVersionId
		? { kind: "composite", id: evidence.compositeVersionId }
		: null;
}

export function isAvailableQualityVersionTarget(
	target: QualityVersionTarget | null,
	availableTargets: QualityVersionTarget[]
) {
	return (
		target !== null &&
		availableTargets.some(
			(available) =>
				available.kind === target.kind && available.id === target.id
		)
	);
}

export interface QualityTargetedEvidenceRow {
	compositeVersionId: string | null;
	itemId: string;
	kind: string;
	unitVersionId: string | null;
}

export function readAssessmentQualityVersionTarget(
	evidenceRows: QualityTargetedEvidenceRow[],
	itemId: string,
	availableTargets: QualityVersionTarget[]
): QualityVersionTarget | null {
	const latestAssessableEvidence = evidenceRows.find(
		(evidence) =>
			evidence.itemId === itemId &&
			evidence.kind === "quality" &&
			isAvailableQualityVersionTarget(
				qualityVersionTargetFromEvidence(evidence),
				availableTargets
			)
	);
	return latestAssessableEvidence
		? qualityVersionTargetFromEvidence(latestAssessableEvidence)
		: null;
}

export async function readQualityVersionTargets(
	db: Database,
	projectId: string,
	assetRecordIds: string[],
	exactVersion?: { assetRecordId: string; assetVersionId: string }
) {
	if (assetRecordIds.length === 0) {
		return new Map<string, QualityVersionTarget[]>();
	}
	const [units, composites] = await Promise.all([
		db
			.select()
			.from(unitVersions)
			.where(
				and(
					eq(unitVersions.projectId, projectId),
					inArray(unitVersions.assetRecordId, assetRecordIds),
					exactVersion
						? or(
								ne(unitVersions.assetRecordId, exactVersion.assetRecordId),
								eq(unitVersions.assetVersionId, exactVersion.assetVersionId)
							)
						: undefined
				)
			)
			.orderBy(desc(unitVersions.versionNumber)),
		db
			.select()
			.from(compositeVersions)
			.where(
				and(
					eq(compositeVersions.projectId, projectId),
					inArray(compositeVersions.assetRecordId, assetRecordIds)
				)
			)
			.orderBy(desc(compositeVersions.versionNumber)),
	]);
	const targets = new Map<string, QualityVersionTarget[]>();
	const identities = new Set<string>();
	for (const unit of units) {
		const identity = JSON.stringify([
			unit.assetRecordId,
			unit.unitType,
			unit.unitKey,
		]);
		if (identities.has(identity)) {
			continue;
		}
		identities.add(identity);
		const recordTargets = targets.get(unit.assetRecordId) ?? [];
		recordTargets.push({ kind: "unit", id: unit.id });
		targets.set(unit.assetRecordId, recordTargets);
	}
	for (const composite of composites) {
		const identity = `composite:${composite.assetRecordId}`;
		if (identities.has(identity)) {
			continue;
		}
		identities.add(identity);
		const recordTargets = targets.get(composite.assetRecordId) ?? [];
		recordTargets.push({ kind: "composite", id: composite.id });
		targets.set(composite.assetRecordId, recordTargets);
	}
	return targets;
}
