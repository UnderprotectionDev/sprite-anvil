import { expect, test } from "bun:test";
import type { ErasureImpactScope } from "./permanent-erasure";
import {
	deletionReceiptContractSupport,
	deletionReceiptContractVersion,
	type ErasureAuthorizeInput,
	erasureAuthorizeRequestDigest,
	selectedErasureCounts,
} from "./permanent-erasure-deletion";

const scope = {
	containers: [
		{ embeddedFileCount: 2, id: "b1", kind: "export_bundle" },
		{ embeddedFileCount: 3, id: "a1", kind: "project_archive" },
		{ embeddedFileCount: 5, id: "a2", kind: "project_archive" },
	],
	fulfilments: [{ id: "f1" }, { id: "f2" }],
	managedCopies: [{ assetVersionId: "v1" }, { assetVersionId: "v2" }],
} as unknown as ErasureImpactScope;

test("selected counts follow the chosen containers, while copies and fulfilments always count in full", () => {
	expect(selectedErasureCounts(scope, ["b1", "a2"])).toEqual({
		archives: 1,
		bundles: 1,
		containerFiles: 7,
		fulfilments: 2,
		managedCopies: 2,
	});
	expect(selectedErasureCounts(scope, [])).toEqual({
		archives: 0,
		bundles: 0,
		containerFiles: 0,
		fulfilments: 2,
		managedCopies: 2,
	});
});

const input: ErasureAuthorizeInput = {
	acknowledgements: { externalCopiesRemain: true, irreversible: true },
	confirmed: {
		archives: 1,
		bundles: 1,
		containerFiles: 5,
		fulfilments: 2,
		managedCopies: 2,
	},
	idempotencyKey: "key-1",
	projectId: "7a1f0f0e-8f4e-4c36-9a53-0b0b6a2f2a01",
	reportDigest: "a".repeat(64),
	reportId: "11111111-1111-4111-8111-111111111101",
	selectedContainerIds: ["b1", "a1"],
};

test("the request digest ignores selection order and the idempotency key, but not the content", async () => {
	const base = await erasureAuthorizeRequestDigest(input);
	expect(
		await erasureAuthorizeRequestDigest({
			...input,
			idempotencyKey: "key-2",
			selectedContainerIds: ["a1", "b1"],
		})
	).toBe(base);
	expect(
		await erasureAuthorizeRequestDigest({
			...input,
			selectedContainerIds: ["b1"],
		})
	).not.toBe(base);
	expect(
		await erasureAuthorizeRequestDigest({
			...input,
			reportDigest: "b".repeat(64),
		})
	).not.toBe(base);
});

test("only the known major receipt contract version is supported", () => {
	expect(
		deletionReceiptContractSupport(deletionReceiptContractVersion)
	).toEqual({ status: "supported" });
	expect(deletionReceiptContractSupport("deletion-receipt/1.7.2")).toEqual({
		status: "supported",
	});
	expect(deletionReceiptContractSupport("deletion-receipt/2.0.0")).toEqual({
		major: 2,
		status: "unsupported_major",
	});
	expect(deletionReceiptContractSupport("receipt/1")).toEqual({
		status: "malformed",
	});
});
