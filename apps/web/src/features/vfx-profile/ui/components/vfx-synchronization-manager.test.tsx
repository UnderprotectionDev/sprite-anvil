// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import type { VfxSynchronizationInput } from "@sprite-anvil/api/vfx-synchronization";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { VfxSynchronizationManager } from "./vfx-synchronization-manager";

const mocks = vi.hoisted(() => ({ save: vi.fn(), list: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	client: { vfxSynchronization: { save: mocks.save } },
	orpc: {
		vfxSynchronization: {
			list: {
				queryOptions: () => ({ queryKey: ["reviews"], queryFn: mocks.list }),
			},
		},
		familyReadiness: {
			list: {
				queryOptions: () => ({
					queryKey: ["readiness"],
					queryFn: async () => ({ items: [] }),
				}),
			},
		},
	},
}));
vi.mock("./vfx-synchronization-editor", () => ({
	VfxSynchronizationEditor: ({
		disabled,
		readOnly,
		onSave,
	}: {
		disabled: boolean;
		readOnly: boolean;
		onSave: (input: VfxSynchronizationInput) => Promise<void>;
	}) => {
		const [name, setName] = useState("Spell release");
		return (
			<div>
				<label>
					Review name
					<input
						disabled={disabled || readOnly}
						onChange={(e) => setName(e.target.value)}
						value={name}
					/>
				</label>
				<button
					disabled={disabled || readOnly}
					onClick={() =>
						void onSave({
							id: "8a3bf45a-0039-4761-b996-b0d45f732877",
							name,
						} as VfxSynchronizationInput)
					}
					type="button"
				>
					Save test review
				</button>
			</div>
		);
	},
}));
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function mount() {
	mocks.list.mockResolvedValue([]);
	const contract = specializedProfileContractCatalog.find(
		(item) => item.profileId === "visual_effect_projectile_shadow_mark"
	);
	if (!contract) {
		throw new Error("Effect contract fixture missing");
	}
	const props: ComponentProps<typeof VfxSynchronizationManager> = {
		projectId: "project",
		assetFamilyId: "effects",
		familyName: "Spell",
		catalog: {
			assetVersions: [],
			unitVersions: [],
			canonicalDesigns: [],
			compositeVersions: [],
		},
		activation: {
			contractRevisionId: "effect@1",
			contract,
			projectId: "project",
			activatedAt: "2026-10-11T09:00:00.000Z",
			activatedByUserId: "user",
		},
		recordNames: {},
		categories: {},
	};
	render(
		<QueryClientProvider
			client={
				new QueryClient({ defaultOptions: { queries: { retry: false } } })
			}
		>
			<VfxSynchronizationManager {...props} />
		</QueryClientProvider>
	);
}
async function uncertainSave() {
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	mount();
	const save = screen.getByRole("button", { name: "Save test review" });
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.change(screen.getByLabelText("Review name"), {
		target: { value: "Edited release" },
	});
	fireEvent.click(save);
	await screen.findByText(
		"Save outcome is uncertain. Check current records before continuing."
	);
	return save;
}
test("retries the unchanged draft with the same operation id after a successful empty readback", async () => {
	const save = await uncertainSave();
	fireEvent.click(
		screen.getByRole("button", { name: "Check current records" })
	);
	const retry = await screen.findByRole("button", {
		name: "Retry synchronization save",
	});
	expect(save).toBeDisabled();
	expect(screen.getByLabelText("Review name")).toHaveValue("Edited release");
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	fireEvent.click(retry);
	await waitFor(() => expect(mocks.save).toHaveBeenCalledTimes(2));
	expect(mocks.save.mock.calls[1]?.[0]).toEqual(mocks.save.mock.calls[0]?.[0]);
	expect(save).toBeDisabled();
});
test("keeps the draft locked when readback fails", async () => {
	const save = await uncertainSave();
	mocks.list.mockRejectedValueOnce(new Error("Offline"));
	fireEvent.click(
		screen.getByRole("button", { name: "Check current records" })
	);
	await screen.findByRole("alert");
	expect(save).toBeDisabled();
	expect(
		screen.queryByRole("button", { name: "Retry synchronization save" })
	).not.toBeInTheDocument();
	expect(screen.getByLabelText("Review name")).toHaveValue("Edited release");
});
test("accepts a late committed record without resending the operation", async () => {
	await uncertainSave();
	mocks.list.mockResolvedValueOnce([
		{
			id: "8a3bf45a-0039-4761-b996-b0d45f732877",
			name: "Edited release",
			createdAt: "2026-10-11T09:00:00.000Z",
			contractRevisionId: "effect@1",
			waiverEvidence: [],
		},
	]);
	fireEvent.click(
		screen.getByRole("button", { name: "Check current records" })
	);
	await screen.findByText(
		"Synchronization review verified from persistent storage."
	);
	expect(mocks.save).toHaveBeenCalledTimes(1);
	expect(
		screen.queryByRole("button", { name: "Retry synchronization save" })
	).not.toBeInTheDocument();
});
