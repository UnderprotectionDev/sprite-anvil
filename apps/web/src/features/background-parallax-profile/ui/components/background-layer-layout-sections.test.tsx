// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { BackgroundLayerLayoutSections } from "./background-layer-layout-sections";

vi.mock("./background-layer-layout-manager", () => ({
	BackgroundLayerLayoutManager: ({ familyName }: { familyName: string }) => (
		<h2>{familyName}</h2>
	),
}));
afterEach(cleanup);
test("shows layouts only for families containing background records", () => {
	const contract = specializedProfileContractCatalog.find(
		(entry) => entry.profileId === "background_parallax"
	);
	if (!contract) {
		throw new Error("Background contract missing");
	}
	render(
		<BackgroundLayerLayoutSections
			activation={{
				projectId: "project",
				activatedByUserId: "user",
				contractRevisionId: "contract",
				contract,
				activatedAt: "2026-10-11T00:00:00Z",
			}}
			assetRecords={[
				{
					id: "sky",
					name: "Sky",
					assetCategory: "background_parallax",
					availability: "active",
				},
			]}
			families={[
				{ id: "background", name: "Forest", visualWorldId: "world" },
				{ id: "object", name: "Crates", visualWorldId: "world" },
			]}
			familyRecords={[{ id: "sky", assetFamilyId: "background" }]}
			projectId="project"
			versions={[]}
		/>
	);
	expect(screen.getByRole("heading", { name: "Forest" })).toBeVisible();
	expect(
		screen.queryByRole("heading", { name: "Crates" })
	).not.toBeInTheDocument();
});
