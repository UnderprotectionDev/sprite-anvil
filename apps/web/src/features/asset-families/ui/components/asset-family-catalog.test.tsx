// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import { render, screen } from "@testing-library/react";
import { expect, test } from "vitest";
import { AssetFamilyCatalogView } from "./asset-family-catalog";

const projectId = "project-ash-knight";
const identityId = "identity-ash-knight";
const gameplayFamilyId = "family-gameplay";
const portraitFamilyId = "family-portrait";

const catalog: AssetFamilyCatalog = {
	subjectIdentities: [
		{
			id: identityId,
			projectId,
			name: "Ash Knight",
			createdAt: "2026-09-25T12:00:00.000Z",
		},
	],
	assetFamilies: [
		{
			id: gameplayFamilyId,
			projectId,
			subjectIdentityId: identityId,
			name: "Game Sprite",
			visualWorldId: "world-gameplay",
			useContext: "gameplay",
			createdAt: "2026-09-25T12:00:01.000Z",
		},
		{
			id: portraitFamilyId,
			projectId,
			subjectIdentityId: identityId,
			name: "Painted Portrait",
			visualWorldId: "world-portrait",
			useContext: "marketing",
			createdAt: "2026-09-25T12:00:02.000Z",
		},
	],
	assetRecords: [
		{
			id: "asset-base",
			projectId,
			assetFamilyId: gameplayFamilyId,
			name: "Ash Knight base",
			createdAt: "2026-09-25T12:00:03.000Z",
		},
		{
			id: "asset-east",
			projectId,
			assetFamilyId: gameplayFamilyId,
			name: "Ash Knight east",
			createdAt: "2026-09-25T12:00:04.000Z",
		},
		{
			id: "asset-portrait",
			projectId,
			assetFamilyId: portraitFamilyId,
			name: "Ash Knight portrait",
			createdAt: "2026-09-25T12:00:05.000Z",
		},
	],
	relationships: [
		{
			id: "relationship-east",
			projectId,
			assetFamilyId: gameplayFamilyId,
			sourceAssetRecordId: "asset-base",
			targetAssetRecordId: "asset-east",
			type: "direction",
			createdAt: "2026-09-25T12:00:06.000Z",
		},
	],
};

const visualWorlds = [
	{ id: "world-gameplay", name: "Gameplay" },
	{ id: "world-portrait", name: "Illustrated Portraits" },
];

test("shows separate families under one Subject Identity and keeps relations in their family", () => {
	render(
		<AssetFamilyCatalogView catalog={catalog} visualWorlds={visualWorlds} />
	);

	expect(screen.getByRole("heading", { name: "Ash Knight" })).toBeTruthy();
	expect(screen.getByText("Game Sprite")).toBeTruthy();
	expect(screen.getByText("Painted Portrait")).toBeTruthy();
	expect(screen.getByText("Gameplay")).toBeTruthy();
	expect(screen.getByText("Illustrated Portraits")).toBeTruthy();
	expect(screen.getByText("gameplay")).toBeTruthy();
	expect(screen.getByText("marketing")).toBeTruthy();
	expect(
		screen.getByText("Ash Knight base — Yön — Ash Knight east")
	).toBeTruthy();
	expect(
		screen.queryByText("Ash Knight base — Yön — Ash Knight portrait")
	).toBeNull();
});
