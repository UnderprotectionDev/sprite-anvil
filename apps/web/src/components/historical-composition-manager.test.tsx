// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest";
import type {
	HistoricalComposition,
	HistoricalCompositionInput,
} from "@sprite-anvil/api/historical-compositions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { HistoricalCompositionManager } from "@/components/historical-composition-manager";

const transport = vi.hoisted(() => ({
	pins: [] as HistoricalComposition[],
	saved: null as HistoricalCompositionInput | null,
	fail: false,
	rejection: null as Error | null,
	failHistory: false,
}));
vi.mock("@/utils/orpc", async () => {
	const { createTanstackQueryUtils } = await import("@orpc/tanstack-query");
	const client = {
		dependencyRevalidation: {
			list: async () => ({
				contextRevisions: [
					{ id: "old-context", revisionNumber: 1, isActive: false },
				],
				dependencyLinks: [],
			}),
			listHistoricalCompositions: async () => {
				await Promise.resolve();
				if (transport.failHistory) {
					throw new Error("Read failed");
				}
				return { pins: structuredClone(transport.pins) };
			},
			historicalCompositionOptions: async () => ({
				evidence: [],
				contracts: [],
			}),
			pinHistoricalComposition: (input: HistoricalCompositionInput) => {
				if (transport.rejection) {
					return Promise.reject(transport.rejection);
				}
				if (transport.fail) {
					return Promise.reject(new Error("Save failed"));
				}
				transport.saved = input;
				const pin: HistoricalComposition = {
					id: "pin-1",
					selection: input,
					unitVersionIds: ["old-unit"],
					assetVersionIds: ["old-canonical", "old-version"],
					report: {
						mode: "historical",
						exportEligible: false,
						blockers: [
							{
								code: "quality",
								targetId: "old-composite",
								message: "Zorunlu kullanım testi eksik.",
							},
						],
					},
					createdAt: "2026-10-02T12:00:00.000Z",
				};
				transport.pins.push(pin);
				return Promise.resolve(pin);
			},
		},
	};
	return { client, orpc: createTanstackQueryUtils(client as never) };
});

afterEach(() => {
	cleanup();
	transport.pins = [];
	transport.saved = null;
	transport.fail = false;
	transport.rejection = null;
	transport.failHistory = false;
});

function openManager() {
	return render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<HistoricalCompositionManager
				canonicalDesigns={[{ assetVersionId: "old-canonical" }]}
				composites={[
					{
						id: "old-composite",
						assetRecordId: "idle",
						versionNumber: 1,
						reviewEvents: [],
					},
				]}
				projectId="project-1"
				records={[{ id: "idle", name: "Ash Knight idle" }]}
				versions={[
					{ id: "old-version", assetRecordId: "idle", versionNumber: 1 },
					{ id: "old-canonical", assetRecordId: "idle", versionNumber: 2 },
				]}
			/>
		</QueryClientProvider>
	);
}

async function selectHistory() {
	await screen.findByRole("option", { name: "Context Revision 1" });
	fireEvent.change(screen.getByLabelText("Historical Composite Version"), {
		target: { value: "old-composite" },
	});
	fireEvent.change(screen.getByLabelText("Historical Context Revision"), {
		target: { value: "old-context" },
	});
	fireEvent.change(screen.getByLabelText("Historical Canonical Design"), {
		target: { value: "old-canonical" },
	});
}

test("explicitly saves old selections, shows unresolved blockers and rereads the historical report", async () => {
	const view = openManager();
	await selectHistory();
	fireEvent.click(
		screen.getByRole("button", { name: "Pin historical composition" })
	);
	await screen.findByText(
		"Historical selection saved; current Revalidation Required status did not change."
	);
	expect(transport.saved).toMatchObject({
		compositeVersionId: "old-composite",
		contextRevisionId: "old-context",
		canonicalDesignVersionId: "old-canonical",
		readinessEvidenceIds: [],
		dependencyVersionIds: [],
	});
	expect(
		await screen.findByText("Zorunlu kullanım testi eksik.")
	).toBeInTheDocument();
	view.unmount();
	openManager();
	expect(
		await screen.findByText("Zorunlu kullanım testi eksik.")
	).toBeInTheDocument();
});

test("does not claim success after an uncertain write and retains a safe retry with the same operation identity", async () => {
	openManager();
	await selectHistory();
	transport.fail = true;
	fireEvent.click(
		screen.getByRole("button", { name: "Pin historical composition" })
	);
	await screen.findByText(
		"Could not verify the save result. You can retry without changing the selection."
	);
	expect(transport.pins).toHaveLength(0);
	transport.fail = false;
	fireEvent.click(screen.getByRole("button", { name: "Retry historical pin" }));
	await waitFor(() => expect(transport.pins).toHaveLength(1));
});

test("releases selection controls after a confirmed validation rejection", async () => {
	openManager();
	await selectHistory();
	transport.rejection = Object.assign(
		new Error("Invalid historical selection"),
		{
			code: "BAD_REQUEST",
			status: 400,
		}
	);
	fireEvent.click(
		screen.getByRole("button", { name: "Pin historical composition" })
	);
	await screen.findByText("Invalid historical selection");
	expect(screen.getByLabelText("Historical Context Revision")).toBeEnabled();
	expect(
		screen.getByRole("button", { name: "Pin historical composition" })
	).toBeEnabled();
});

test("distinguishes a saved pin from a failed report reread", async () => {
	openManager();
	await selectHistory();
	transport.failHistory = true;
	fireEvent.click(
		screen.getByRole("button", { name: "Pin historical composition" })
	);
	await screen.findByText(
		"Historical selection saved, but the report could not be reread. Use Refresh historical selections to retry."
	);
	expect(transport.pins).toHaveLength(1);
});

test("pins the explicitly checked historical dependency versions", async () => {
	const user = userEvent.setup();
	openManager();
	await selectHistory();
	const pin = screen.getByRole("button", {
		name: "Pin historical composition",
	});
	expect(pin).toBeEnabled();
	const group = screen.getByRole("group", {
		name: "Historical dependency Asset Versions",
	});
	const oldVersion = within(group).getByRole("checkbox", {
		name: "Ash Knight idle · v1",
	});
	const canonical = within(group).getByRole("checkbox", {
		name: "Ash Knight idle · v2",
	});
	await user.click(oldVersion);
	await user.click(canonical);
	await user.click(oldVersion);
	expect(oldVersion).not.toBeChecked();
	expect(canonical).toBeChecked();
	await user.click(pin);
	await screen.findByText(
		"Historical selection saved; current Revalidation Required status did not change."
	);
	expect(transport.saved).toEqual({
		projectId: "project-1",
		idempotencyKey: expect.any(String),
		compositeVersionId: "old-composite",
		contextRevisionId: "old-context",
		canonicalDesignVersionId: "old-canonical",
		dependencyLinkIds: [],
		dependencyVersionIds: ["old-canonical"],
		readinessEvidenceIds: [],
		profileContractRevisionIds: [],
		reviewEventIds: [],
	});
});

test("requires all three exact historical versions before pinning", async () => {
	openManager();
	await screen.findByRole("option", { name: "Context Revision 1" });
	const pin = screen.getByRole("button", {
		name: "Pin historical composition",
	});
	fireEvent.change(screen.getByLabelText("Historical Composite Version"), {
		target: { value: "old-composite" },
	});
	fireEvent.change(screen.getByLabelText("Historical Context Revision"), {
		target: { value: "old-context" },
	});
	expect(pin).toBeDisabled();
	fireEvent.change(screen.getByLabelText("Historical Canonical Design"), {
		target: { value: "old-canonical" },
	});
	expect(pin).toBeEnabled();
});

test("keeps the pending selection locked while an uncertain write awaits retry", async () => {
	const user = userEvent.setup();
	openManager();
	await selectHistory();
	transport.fail = true;
	await user.click(
		screen.getByRole("button", { name: "Pin historical composition" })
	);
	await screen.findByText(
		"Could not verify the save result. You can retry without changing the selection."
	);
	expect(screen.getByLabelText("Historical Context Revision")).toBeDisabled();
	const oldVersion = screen.getByRole("checkbox", {
		name: "Ash Knight idle · v1",
	});
	await user.click(oldVersion);
	expect(oldVersion).not.toBeChecked();
});
