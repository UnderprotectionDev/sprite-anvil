import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { BackgroundOperation } from "@sprite-anvil/api/background-operations";
import type { Context } from "@sprite-anvil/api/context";
import type { ErasureApprovalInput } from "@sprite-anvil/api/permanent-erasure-deletion";
import type { ErasureApprovalOperations } from "@sprite-anvil/api/permanent-erasure-deletion-store";
import { IdempotencyConflictError } from "@sprite-anvil/api/record-publication";
import { appRouter } from "@sprite-anvil/api/routers/index";
import { projectId } from "./erasure-impact-fixtures";

const signedInUser = "user-1";
const reportId = "11111111-1111-4111-8111-111111111101";
const operation = {
	attemptCount: 0,
	cancelRequestedAt: null,
	createdAt: "2026-11-13T10:00:00.000Z",
	failureSummary: null,
	finishedAt: null,
	id: "99999999-9999-4999-8999-999999999901",
	kind: "deletion",
	maxAttempts: 3,
	progressPercent: null,
	progressStep: null,
	projectId,
	resultSummary: null,
	scopeSummary: "Permanent erasure of 1 managed copies and 2 whole containers",
	scopeTargetId: "99999999-9999-4999-8999-999999999902",
	startedAt: null,
	status: "pending",
	triggerSummary: "Erasure approved by the project owner",
	triggeredByUserId: signedInUser,
	updatedAt: "2026-11-13T10:00:00.000Z",
} satisfies BackgroundOperation;

const input: ErasureApprovalInput = {
	acknowledgements: { externalCopiesRemain: true, irreversible: true },
	confirmed: {
		archives: 1,
		bundles: 1,
		containerFiles: 2,
		fulfilments: 1,
		managedCopies: 1,
	},
	idempotencyKey: "approve-1",
	projectId,
	reportDigest: "a".repeat(64),
	reportId,
	selectedContainerIds: ["b1", "a1"],
};

function contextWith(
	operations: ErasureApprovalOperations | undefined,
	session: Context["session"] = { user: { id: signedInUser } } as never
) {
	return {
		erasureApprovalOperations: operations,
		session,
	} as unknown as Context;
}

const approve = (context: Context, body: unknown = input) =>
	call(appRouter.permanentErasure.approveErasure, body as never, { context });

test("a signed-in user approves an exact report and gets the Deletion Job as a Background Operation", async () => {
	const seen: { userId: string; input: ErasureApprovalInput }[] = [];
	const context = contextWith({
		approve: (userId, request) => {
			seen.push({ input: request, userId });
			return Promise.resolve({ operation, status: "accepted" });
		},
	});

	expect(await approve(context)).toEqual(operation);
	expect(seen).toEqual([{ input, userId: signedInUser }]);
});

test("without a session nothing is approved", async () => {
	let called = false;
	const context = contextWith(
		{
			approve: () => {
				called = true;
				return Promise.resolve(null);
			},
		},
		null as never
	);

	await expect(approve(context)).rejects.toMatchObject({
		code: "UNAUTHORIZED",
	});
	expect(called).toBe(false);
});

test("the approval input is strict: a missing acknowledgement or an unknown field never reaches the approval", async () => {
	let called = false;
	const context = contextWith({
		approve: () => {
			called = true;
			return Promise.resolve(null);
		},
	});

	await expect(
		approve(context, {
			...input,
			acknowledgements: { externalCopiesRemain: true, irreversible: false },
		})
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	await expect(
		approve(context, { ...input, approvedBy: "an-agent" })
	).rejects.toMatchObject({ code: "BAD_REQUEST" });
	expect(called).toBe(false);
});

test("a rejected approval is a bad request that names why, and an unknown project is not found", async () => {
	await expect(
		approve(
			contextWith({
				approve: () =>
					Promise.resolve({ reason: "report_changed", status: "rejected" }),
			})
		)
	).rejects.toMatchObject({
		code: "BAD_REQUEST",
		data: { reason: "report_changed", status: "rejected" },
	});
	await expect(
		approve(contextWith({ approve: () => Promise.resolve(null) }))
	).rejects.toMatchObject({ code: "NOT_FOUND" });
});

test("the same key with other content is a conflict", async () => {
	await expect(
		approve(
			contextWith({
				approve: () =>
					Promise.reject(new IdempotencyConflictError("Deletion Job")),
			})
		)
	).rejects.toMatchObject({ code: "CONFLICT" });
});

test("without the live executor wired the approval is unavailable, not silently accepted", async () => {
	await expect(approve(contextWith(undefined))).rejects.toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
	});
});
