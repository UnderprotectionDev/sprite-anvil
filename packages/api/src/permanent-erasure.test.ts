import { expect, test } from "bun:test";
import {
	erasureContractSupport,
	erasureImpactContractVersion,
	erasureImpactScopeSchema,
} from "./permanent-erasure";

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
