import { expect, test } from "bun:test";
import {
	backgroundOperationStatuses,
	canTransitionBackgroundOperation,
	isBackgroundOperationActive,
	shouldShowOperationProgress,
} from "./background-operations";

test("keeps the six statuses and never leaves a final one", () => {
	expect(backgroundOperationStatuses).toEqual([
		"pending",
		"running",
		"completed",
		"failed",
		"cancel_requested",
		"cancelled",
	]);
	for (const final of ["completed", "failed", "cancelled"] as const) {
		expect(isBackgroundOperationActive(final)).toBe(false);
		for (const next of backgroundOperationStatuses) {
			expect(canTransitionBackgroundOperation(final, next)).toBe(false);
		}
	}
});

test("allows the lifecycle path and a retry back to Pending, and refuses skips", () => {
	expect(canTransitionBackgroundOperation("pending", "running")).toBe(true);
	expect(canTransitionBackgroundOperation("running", "completed")).toBe(true);
	expect(canTransitionBackgroundOperation("running", "pending")).toBe(true);
	expect(canTransitionBackgroundOperation("pending", "completed")).toBe(false);
	// An unstoppable cancel request still ends in the real result.
	expect(
		canTransitionBackgroundOperation("cancel_requested", "completed")
	).toBe(true);
});

test("shows progress only for an active operation that has waited a second", () => {
	const createdAt = "2026-11-06T10:00:00.000Z";
	const created = Date.parse(createdAt);
	expect(
		shouldShowOperationProgress({ createdAt, status: "running" }, created + 999)
	).toBe(false);
	expect(
		shouldShowOperationProgress(
			{ createdAt, status: "running" },
			created + 1000
		)
	).toBe(true);
	expect(
		shouldShowOperationProgress(
			{ createdAt, status: "pending" },
			created + 5000
		)
	).toBe(true);
	expect(
		shouldShowOperationProgress(
			{ createdAt, status: "completed" },
			created + 5000
		)
	).toBe(false);
});
