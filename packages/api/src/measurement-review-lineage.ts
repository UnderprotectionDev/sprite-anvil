import type { z } from "zod";
import type { assetVersionCatalogSchema, UnitVersion } from "./asset-versions";
import type { Context } from "./context";
import { recordProductBoundary } from "./measurement-workflows";

type Catalog = z.infer<typeof assetVersionCatalogSchema>;
function predecessor(unit: UnitVersion, units: UnitVersion[]) {
	const matches = units.filter(
		(old) =>
			old.assetRecordId === unit.assetRecordId &&
			old.assetVersionId === unit.sourceAssetVersionId &&
			old.unitType === unit.unitType &&
			old.unitKey === unit.unitKey &&
			old.versionNumber < unit.versionNumber
	);
	return matches.length === 1 ? matches[0] : undefined;
}
interface Target {
	id: string;
	kind: "unit_version" | "composite_version" | "asset_version";
}
async function assetTargets(
	context: Context,
	projectId: string,
	catalog: Catalog,
	target: { id: string }
): Promise<Target[]> {
	const targets: Target[] = [];

	const version = catalog.assetVersions.find((item) => item.id === target.id);
	if (!version) {
		return targets;
	}
	for (const unit of catalog.unitVersions.filter(
		(item) => item.assetVersionId === target.id
	)) {
		const previous = predecessor(unit, catalog.unitVersions);
		if (previous) {
			targets.push({ id: previous.id, kind: "unit_version" });
		}
	}
	const packageId =
		version.productionEvidence.manualImportEvidence?.generationPackageId;
	if (packageId && context.generationPackageStore) {
		const packages = await context.generationPackageStore.list(
			context.session?.user.id ?? "",
			projectId,
			version.assetRecordId
		);
		const correction = packages?.find(
			(item) => item.id === packageId
		)?.correction;
		if (
			correction &&
			correction.sourceAssetVersionId !== version.id &&
			catalog.assetVersions.some(
				(item) =>
					item.id === correction.sourceAssetVersionId &&
					item.assetRecordId === version.assetRecordId &&
					item.versionNumber < version.versionNumber
			)
		) {
			const original = correction.targetUnitVersionId;
			if (!original) {
				targets.push({
					id: correction.sourceAssetVersionId,
					kind: "asset_version",
				});
			} else if (
				catalog.unitVersions.some(
					(unit) =>
						unit.id === original &&
						unit.assetVersionId === correction.sourceAssetVersionId &&
						unit.assetRecordId === version.assetRecordId
				)
			) {
				targets.push({ id: original, kind: "unit_version" });
			}
		}
	}
	return targets;
}
function compositeTargets(catalog: Catalog, target: { id: string }): Target[] {
	const targets: Target[] = [];

	const current = catalog.compositeVersions.find(
		(item) => item.id === target.id
	);
	if (!current) {
		return targets;
	}
	const matches = catalog.compositeVersions.filter(
		(old) =>
			old.assetRecordId === current.assetRecordId &&
			old.versionNumber < current.versionNumber &&
			old.compositionMemberships.length ===
				current.compositionMemberships.length &&
			current.compositionMemberships.every((member) => {
				const unit = catalog.unitVersions.find(
					(item) => item.id === member.unitVersionId
				);
				const prior = unit && predecessor(unit, catalog.unitVersions);
				return old.compositionMemberships.some(
					(item) =>
						item.unitType === member.unitType &&
						item.unitKey === member.unitKey &&
						(item.unitVersionId === member.unitVersionId ||
							item.unitVersionId === prior?.id)
				);
			}) &&
			current.compositionMemberships.some(
				(member) =>
					!old.compositionMemberships.some(
						(item) => item.unitVersionId === member.unitVersionId
					)
			)
	);
	if (matches.length === 1 && matches[0]) {
		targets.push({ id: matches[0].id, kind: "composite_version" });
	}
	return targets;
}
export async function recordRepairedReview(
	context: Context,
	projectId: string,
	catalog: Catalog,
	target: { kind: "asset" | "composite"; id: string }
) {
	if (
		!(context.productMeasurementRecorder && context.surface && context.session)
	) {
		return;
	}
	try {
		const targets =
			target.kind === "asset"
				? await assetTargets(context, projectId, catalog, target)
				: compositeTargets(catalog, target);

		await Promise.all(
			[
				...new Map(
					targets.map((item) => [`${item.kind}:${item.id}`, item])
				).values(),
			].map((item) =>
				recordProductBoundary(context, {
					userId: context.session?.user.id ?? "",
					projectId,
					workflowId: item.id,
					eventFamily: "review_and_repair",
					eventName: "repaired_version_reviewed",
					phase: "finish",
					recordKind: item.kind,
					outcomeClass: "completed",
					counters: {},
				})
			)
		);
	} catch {
		console.error("product_measurement_boundary_failed");
	}
}
