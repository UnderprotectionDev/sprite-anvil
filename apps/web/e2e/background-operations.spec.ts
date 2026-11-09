import { expect, type Page, test } from "@playwright/test";

const projectId = "00000000-0000-4000-8000-000000000001";
const project = {
	id: projectId,
	name: "Moonlit Vale",
	generalArtDirection: "Readable pixel art",
	createdAt: "2026-10-13T00:00:00.000Z",
	currentContextRevision: null,
};
const operationsUrl = `/projects/${projectId}/operations`;
const exportScope = "Export bundle for Ash Knight";
const archiveScope = "Archive Forest Quest";
const restoreScope = "Restore Forest Quest";
const cancelRequestedText =
	"Cancel requested. Waiting for the operation to stop safely.";
const cancelledText = "Cancelled. The operation stopped before it finished.";
const completedDespiteText = /so it completed\. This is not a cancel\./;
const cancelButtonText = /^Cancel/;

type OperationStatus =
	| "cancel_requested"
	| "cancelled"
	| "completed"
	| "failed"
	| "pending"
	| "running";

function operation(id: string, overrides: Record<string, unknown> = {}) {
	return {
		attemptCount: 1,
		cancelRequestedAt: null as string | null,
		createdAt: new Date(Date.now() - 60_000).toISOString(),
		failureSummary: null,
		finishedAt: null,
		id,
		kind: "export",
		maxAttempts: 3,
		progressPercent: null,
		progressStep: null,
		projectId,
		resultSummary: null as string | null,
		scopeSummary: exportScope,
		scopeTargetId: null,
		startedAt: null,
		status: "running" as OperationStatus,
		triggerSummary: "Requested from the export panel",
		triggeredByUserId: "test-user",
		updatedAt: new Date().toISOString(),
		...overrides,
	};
}

type Operation = ReturnType<typeof operation>;

/**
 * The cloud is mocked: no screen creates a Background Operation, so the
 * authoritative record is served from `cloud.operations` and the cancel call
 * answers the way the cloud would for each status.
 */
async function mockCloud(page: Page, operations: Operation[]) {
	const cloud = {
		cancels: [] as { id: string; projectId: string }[],
		failList: false,
		/** What a Running operation becomes when the user asks to cancel it. */
		cancelResult: "cancel_requested" as OperationStatus,
		operations,
	};
	await page.route("**/api/auth/get-session", (route) =>
		route.fulfill({
			json: {
				session: {
					id: "test-session",
					userId: "test-user",
					expiresAt: "2099-01-01T00:00:00.000Z",
				},
				user: { id: "test-user", name: "Test User", email: "test@example.com" },
			},
		})
	);
	await page.route("**/rpc/**", (route) => {
		const [, rpc = ""] = new URL(route.request().url()).pathname.split("/rpc/");
		if (rpc === "projects/get") {
			return route.fulfill({ json: { json: project } });
		}
		if (rpc === "backgroundOperations/list") {
			if (cloud.failList) {
				return route.fulfill({
					status: 500,
					json: { json: { code: "INTERNAL_SERVER_ERROR", status: 500 } },
				});
			}
			return route.fulfill({
				json: { json: { operations: cloud.operations } },
			});
		}
		if (rpc === "backgroundOperations/cancel") {
			const { json } = route.request().postDataJSON() as {
				json: { id: string; projectId: string };
			};
			cloud.cancels.push(json);
			const target = cloud.operations.find(({ id }) => id === json.id);
			if (!target) {
				return route.fulfill({
					status: 404,
					json: { json: { code: "NOT_FOUND", status: 404 } },
				});
			}
			target.cancelRequestedAt = new Date().toISOString();
			target.status =
				target.status === "pending" ? "cancelled" : cloud.cancelResult;
			if (target.status === "completed") {
				target.resultSummary = "Exported 12 frames.";
			}
			return route.fulfill({ json: { json: target } });
		}
		return route.fulfill({ json: { json: [] } });
	});
	return cloud;
}

test("shows progress, a visible failure with its attempts, and a completed result from the record", async ({
	page,
}) => {
	await mockCloud(page, [
		operation("op-running", {
			attemptCount: 2,
			progressPercent: 40,
			progressStep: "Packing frames",
		}),
		operation("op-failed", {
			attemptCount: 3,
			failureSummary: "The storage was busy. It failed after 3 attempts.",
			kind: "archive",
			scopeSummary: archiveScope,
			status: "failed",
		}),
		operation("op-done", {
			kind: "restore",
			resultSummary: "Restored 4 Asset Versions.",
			scopeSummary: restoreScope,
			status: "completed",
		}),
	]);
	await page.goto(operationsUrl);

	await expect(
		page.getByRole("heading", { name: "Background operations" })
	).toBeVisible();
	const running = page
		.getByRole("listitem")
		.filter({ hasText: `Export: ${exportScope}` });
	await expect(running.getByText("Running", { exact: true })).toBeVisible();
	await expect(running.getByText("Attempt 2 of 3")).toBeVisible();
	await expect(running.getByRole("progressbar")).toHaveAttribute(
		"aria-valuenow",
		"40"
	);
	await expect(running.getByText("Packing frames (40%)")).toBeVisible();

	const failed = page
		.getByRole("listitem")
		.filter({ hasText: `Archive: ${archiveScope}` });
	await expect(failed.getByText("Failed", { exact: true })).toBeVisible();
	await expect(failed.getByText("Attempt 3 of 3")).toBeVisible();
	await expect(failed.getByRole("alert")).toHaveText(
		"The storage was busy. It failed after 3 attempts."
	);
	// A failed operation can no longer be cancelled and shows no progress.
	await expect(
		failed.getByRole("button", { name: cancelButtonText })
	).toHaveCount(0);
	await expect(failed.getByRole("progressbar")).toHaveCount(0);

	const done = page
		.getByRole("listitem")
		.filter({ hasText: `Restore: ${restoreScope}` });
	await expect(done.getByText("Completed", { exact: true })).toBeVisible();
	await expect(done.getByText("Restored 4 Asset Versions.")).toBeVisible();
});

test("a load failure offers a retry that re-reads the record", async ({
	page,
}) => {
	const cloud = await mockCloud(page, [operation("op-running")]);
	cloud.failList = true;
	await page.goto(operationsUrl);
	await expect(
		page.getByText("Background operations could not be loaded.")
	).toBeVisible();

	cloud.failList = false;
	await page.getByRole("button", { name: "Retry" }).click();
	await expect(page.getByText(`Export: ${exportScope}`)).toBeVisible();
});

test("cancelling a Pending operation is a Cancelled record, and a Running one first reads Cancel Requested", async ({
	page,
}) => {
	const cloud = await mockCloud(page, [
		operation("op-pending", { attemptCount: 0, status: "pending" }),
		operation("op-running", {
			kind: "archive",
			scopeSummary: archiveScope,
		}),
	]);
	await page.goto(operationsUrl);

	await page
		.getByRole("button", { name: `Cancel Export: ${exportScope}` })
		.click();
	await expect(page.getByText(cancelledText)).toBeVisible();
	await expect(
		page.getByRole("button", { name: `Cancel Export: ${exportScope}` })
	).toHaveCount(0);

	const cancelRunning = page.getByRole("button", {
		name: `Cancel Archive: ${archiveScope}`,
	});
	await cancelRunning.focus();
	await page.keyboard.press("Enter");
	await expect(page.getByText(cancelRequestedText)).toBeVisible();
	// A request is not a cancel: the status stays Cancel Requested until the cloud stops it.
	await expect(
		page
			.getByRole("listitem")
			.filter({ hasText: archiveScope })
			.getByText("Cancel Requested", { exact: true })
	).toBeVisible();
	expect(cloud.cancels.map(({ id }) => id)).toEqual([
		"op-pending",
		"op-running",
	]);
	expect(cloud.cancels.every((call) => call.projectId === projectId)).toBe(
		true
	);
});

test("work past the irreversible boundary completes and is never shown as a successful cancel", async ({
	page,
}) => {
	const cloud = await mockCloud(page, [operation("op-running")]);
	cloud.cancelResult = "completed";
	await page.goto(operationsUrl);

	await page
		.getByRole("button", { name: `Cancel Export: ${exportScope}` })
		.click();
	await expect(page.getByText(completedDespiteText)).toBeVisible();
	await expect(page.getByText("Exported 12 frames.")).toBeVisible();
	await expect(page.getByText(cancelledText)).toHaveCount(0);
	await expect(page.getByText("Completed", { exact: true })).toBeVisible();
});
