// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import type {
	PortraitIdentityReviewInput,
	PortraitIdentityReviewRecord,
} from "@sprite-anvil/api/portrait-identity-reviews";
import { getPortraitReviewOutcome } from "@sprite-anvil/api/portrait-identity-reviews";
import { getSpecializedProfileContract } from "@sprite-anvil/api/specialized-profile-contracts";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { PortraitIdentityReviewManager } from "@/components/portrait-identity-review-manager";

const mocks = vi.hoisted(() => ({ list: vi.fn(), save: vi.fn() }));
vi.mock("@/utils/orpc", () => ({
	orpc: {
		portraitIdentityReviews: {
			save: {
				mutationOptions: (options?: object) => ({
					...options,
					mutationFn: (input: unknown) => mocks.save(input),
				}),
			},
			list: {
				queryOptions: () => ({
					queryKey: ["portrait-reviews"],
					queryFn: mocks.list,
				}),
			},
		},
	},
}));
type Props = ComponentProps<typeof PortraitIdentityReviewManager>;
function requireContract() {
	const value = getSpecializedProfileContract("portrait_logo_marketing");
	if (!value) {
		throw new Error("Missing portrait contract");
	}
	return value;
}
const contract = requireContract();
const gameplayText = /Hero gameplay/u;
const savedText = /Hero portraits · Inconclusive/u;
const versions = ["neutral", "happy"].map((name) => ({
	id: `${name}-version`,
	assetRecordId: name,
	assetFamilyId: "family",
	integrityVerified: true,
	contentDigest: "a".repeat(64),
	versionNumber: 1,
	previewUrl: `/${name}.png`,
	sourceImageDimensions: { width: 600, height: 800 },
	reviewDisposition: "approved",
}));
const props = {
	activation: {
		contract,
		contractRevisionId: "portrait@1",
		projectId: "project",
	},
	family: {
		id: "family",
		projectId: "project",
		name: "Hero portraits",
		subjectIdentityId: "hero",
		visualWorldId: "illustration",
		useContext: "Dialogue",
	},
	familyCatalog: {
		subjectIdentities: [{ id: "hero", name: "Hero" }],
		assetFamilies: [
			{ id: "family", subjectIdentityId: "hero" },
			{ id: "sprite", name: "Hero gameplay", subjectIdentityId: "hero" },
		],
		assetRecords: [],
		relationships: [
			{
				type: "derivative",
				assetFamilyId: "family",
				sourceAssetVersionId: "neutral-version",
				targetAssetRecordId: "happy",
			},
		],
	},
	assetRecords: ["neutral", "happy"].map((id) => ({
		id,
		name: id,
		assetCategory: "portrait_logo_marketing",
		availability: "active",
	})),
	versionCatalog: {
		assetVersions: versions,
		canonicalDesigns: [
			{
				id: "design",
				assetFamilyId: "family",
				assetVersionId: "neutral-version",
				assetRecordId: "neutral",
			},
		],
	},
} as unknown as Props;
function mount() {
	const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
	return render(
		<QueryClientProvider client={qc}>
			<PortraitIdentityReviewManager {...props} />
		</QueryClientProvider>
	);
}
afterEach(() => {
	cleanup();
	vi.resetAllMocks();
});
function fill() {
	for (const [index, field] of screen
		.getAllByLabelText("Expression name")
		.entries()) {
		fireEvent.change(field, {
			target: { value: index === 0 ? "Neutral" : "Happy" },
		});
	}
	for (const label of [
		"Identity consistency notes",
		"Expression consistency notes",
		"Crop and face visibility notes",
		"Review rationale",
	]) {
		fireEvent.change(screen.getByLabelText(label), {
			target: { value: "Compared the face in dialogue." },
		});
	}
	for (const img of screen.getAllByRole("img")) {
		Object.defineProperty(img, "naturalWidth", {
			configurable: true,
			value: 600,
		});
		Object.defineProperty(img, "naturalHeight", {
			configurable: true,
			value: 800,
		});
		fireEvent.load(img);
	}
}
function makeSaved(
	input: PortraitIdentityReviewInput
): PortraitIdentityReviewRecord {
	return {
		...input,
		canonicalAssetVersionId: "neutral-version",
		familyName: "Hero portraits",
		useContext: "Dialogue",
		contractSnapshot: contract,
		createdAt: "2026-10-13T10:00:00.000Z",
		reviewedByUserId: "owner",
		outcome: getPortraitReviewOutcome(input.observations),
		versionPins: versions.map((v) => ({
			assetRecordId: v.assetRecordId,
			assetRecordName: v.assetRecordId,
			assetVersionId: v.id,
			contentDigest: "a".repeat(64),
			contentLength: 80,
			contentType: "image/png",
			versionNumber: 1,
			naturalSize: { width: 600, height: 800 },
		})),
	};
}
test("compares expressions at exact usage size and rereads the saved user review", async () => {
	let stored: PortraitIdentityReviewRecord[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(stored));
	mocks.save.mockImplementation((input: PortraitIdentityReviewInput) => {
		const record = makeSaved(input);
		stored = [record];
		return Promise.resolve(record);
	});
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	expect(screen.getByText(gameplayText)).toBeInTheDocument();
	fill();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save portrait review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save portrait review" }));
	await screen.findByText("Portrait review saved.");
	expect(stored[0].outcome).toBe("inconclusive");
	expect(stored[0].items[0].targetSize).toEqual({ width: 160, height: 160 });
	cleanup();
	mount();
	await screen.findByText("Compared the face in dialogue.");
	expect(screen.getByText(savedText)).toBeInTheDocument();
});
test("blocks unloaded and broken previews and invalid crop bounds", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fill();
	fireEvent.change(screen.getAllByLabelText("Crop X")[0], {
		target: { value: "700" },
	});
	expect(
		screen.getByRole("button", { name: "Save portrait review" })
	).toBeDisabled();
	expect(mocks.save).not.toHaveBeenCalled();
});
test("locks uncertain saves and confirms persistence through readback without resending", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fill();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save portrait review" })
		).toBeEnabled()
	);
	fireEvent.click(screen.getByRole("button", { name: "Save portrait review" }));
	await screen.findByRole("button", { name: "Check the record again" });
	const [[request]] = mocks.save.mock.calls;
	mocks.save.mockResolvedValue(makeSaved(request));
	mocks.list.mockResolvedValue([makeSaved(request)]);
	fireEvent.click(
		screen.getByRole("button", { name: "Check the record again" })
	);
	await screen.findByText("Portrait review saved.");
	expect(mocks.save).toHaveBeenCalledOnce();
});

test("revokes save eligibility when a previously loaded preview fails", async () => {
	mocks.list.mockResolvedValue([]);
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fill();
	await waitFor(() =>
		expect(
			screen.getByRole("button", { name: "Save portrait review" })
		).toBeEnabled()
	);
	fireEvent.error(screen.getAllByRole("img")[0]);
	expect(
		screen.getByRole("button", { name: "Save portrait review" })
	).toBeDisabled();
});

test("keeps an unconfirmed write locked when readback still cannot find it", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fill();
	const save = screen.getByRole("button", {
		name: "Save portrait review",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	const check = await screen.findByRole("button", {
		name: "Check the record again",
	});
	const readsBeforeCheck = mocks.list.mock.calls.length;
	fireEvent.click(check);
	await waitFor(() =>
		expect(mocks.list.mock.calls.length).toBeGreaterThan(readsBeforeCheck)
	);
	await screen.findByText(
		"Could not verify the save result. Check the record again."
	);
	expect(mocks.save).toHaveBeenCalledOnce();
	expect(save).toBeDisabled();
});

test("adds and removes expressions and submits the edited item fields and observations", async () => {
	let stored: PortraitIdentityReviewRecord[] = [];
	mocks.list.mockImplementation(() => Promise.resolve(stored));
	mocks.save.mockImplementation((input: PortraitIdentityReviewInput) => {
		const record = makeSaved(input);
		stored = [record];
		return Promise.resolve(record);
	});
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	expect(
		screen.getAllByText(
			"Expression name, usage size, and a crop within the source bounds are required."
		)
	).toHaveLength(2);
	fireEvent.click(screen.getByRole("button", { name: "Add expression" }));
	expect(screen.getAllByLabelText("Expression name")).toHaveLength(3);
	fireEvent.click(
		screen.getAllByRole("button", { name: "Remove expression" })[2]
	);
	expect(screen.getAllByLabelText("Expression name")).toHaveLength(2);
	fireEvent.change(screen.getAllByLabelText("Usage purpose")[0], {
		target: { value: "ui" },
	});
	fireEvent.change(screen.getAllByLabelText("Arka plan")[0], {
		target: { value: "dark" },
	});
	fireEvent.change(screen.getAllByLabelText("Usage width")[0], {
		target: { value: "137" },
	});
	fireEvent.change(screen.getAllByLabelText("Crop X")[0], {
		target: { value: "8" },
	});
	fireEvent.change(screen.getAllByLabelText("Crop width")[0], {
		target: { value: "592" },
	});
	fireEvent.change(screen.getByLabelText("Identity consistency"), {
		target: { value: "passed" },
	});
	fireEvent.change(screen.getByLabelText("Crop and face visibility"), {
		target: { value: "failed" },
	});
	fill();
	expect(
		screen.queryByText(
			"Expression name, usage size, and a crop within the source bounds are required."
		)
	).toBeNull();
	const save = screen.getByRole("button", {
		name: "Save portrait review",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByText("Portrait review saved.");
	expect(mocks.save).toHaveBeenCalledWith(
		expect.objectContaining({
			rationale: "Compared the face in dialogue.",
			observations: {
				identity: {
					outcome: "passed",
					notes: "Compared the face in dialogue.",
				},
				expression: {
					outcome: "inconclusive",
					notes: "Compared the face in dialogue.",
				},
				crop: { outcome: "failed", notes: "Compared the face in dialogue." },
			},
			items: [
				expect.objectContaining({
					assetVersionId: "neutral-version",
					expression: "Neutral",
					usagePurpose: "ui",
					background: "dark",
					crop: { x: 8, y: 0, width: 592, height: 800 },
					targetSize: { width: 137, height: 160 },
				}),
				expect.objectContaining({
					assetVersionId: "happy-version",
					expression: "Happy",
					usagePurpose: "dialogue",
					background: "light",
				}),
			],
		})
	);
});

test("disables every review control while an uncertain write is unresolved", async () => {
	mocks.list.mockResolvedValue([]);
	mocks.save.mockRejectedValueOnce(new TypeError("Failed to fetch"));
	mount();
	await waitFor(() => expect(mocks.list).toHaveBeenCalled());
	fill();
	const save = screen.getByRole("button", {
		name: "Save portrait review",
	});
	await waitFor(() => expect(save).toBeEnabled());
	fireEvent.click(save);
	await screen.findByRole("button", { name: "Check the record again" });
	for (const control of [
		...screen.getAllByLabelText("Expression name"),
		...screen.getAllByLabelText("Portrait version"),
		screen.getByLabelText("Identity consistency"),
		screen.getByLabelText("Review rationale"),
	]) {
		expect(control).toBeDisabled();
	}
	expect(screen.getByRole("button", { name: "Add expression" })).toBeDisabled();
});
