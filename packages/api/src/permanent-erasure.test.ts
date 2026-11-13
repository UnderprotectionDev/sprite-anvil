import { expect, test } from "bun:test";
import {
	erasureContractSupport,
	erasureImpactContractVersion,
	erasureImpactPrepareOutputSchema,
	erasureImpactScopeSchema,
} from "./permanent-erasure";
import { buildErasureImpactScope } from "./permanent-erasure-scope";

test("only the known major contract version is supported", () => {
	expect(erasureContractSupport(erasureImpactContractVersion)).toEqual({
		status: "supported",
	});
	expect(erasureContractSupport("erasure-impact-report/1.4.0")).toEqual({
		status: "supported",
	});
	expect(erasureContractSupport("erasure-impact-report/2.0.0")).toEqual({
		major: 2,
		status: "unsupported_major",
	});
	expect(erasureContractSupport("report/1")).toEqual({ status: "malformed" });
});

test("a scope with an unknown field is rejected, never read as valid", () => {
	const result = erasureImpactScopeSchema.safeParse({
		contractVersion: erasureImpactContractVersion,
		requiredNewField: true,
	});
	expect(result.success).toBe(false);
});

const digest = "a".repeat(64);

function builtScope() {
	const built = buildErasureImpactScope(
		{
			archives: [],
			assetRecord: { availability: "active", id: "asset-1" },
			bundles: [],
			fulfilments: [],
			versions: [{ byteSize: 12, id: "version-1", sha256: digest }],
		},
		{ projectId: "project-1", retention: null }
	);
	if (!built.ok) {
		throw new Error("expected a scope");
	}
	return built.scope;
}

test("a managed copy carries identity, size and digest only: a file name or content type is rejected", () => {
	const scope = builtScope();
	expect(scope.managedCopies).toEqual([
		{ assetVersionId: "version-1", byteSize: 12, sha256: digest },
	]);
	for (const extra of [
		{ fileName: "hero.png" },
		{ contentType: "image/png" },
	]) {
		expect(
			erasureImpactScopeSchema.safeParse({
				...scope,
				managedCopies: [{ ...scope.managedCopies[0], ...extra }],
			}).success
		).toBe(false);
	}
});

test("the prepare answer is strict: an unknown field is rejected", () => {
	const scope = builtScope();
	const report = {
		...scope,
		createdAt: "2026-11-13T10:00:00.000Z",
		id: "report-1",
		reportDigest: digest,
	};
	expect(
		erasureImpactPrepareOutputSchema.safeParse({ report, status: "created" })
			.success
	).toBe(true);
	expect(
		erasureImpactPrepareOutputSchema.safeParse({
			extra: true,
			report,
			status: "created",
		}).success
	).toBe(false);
});
