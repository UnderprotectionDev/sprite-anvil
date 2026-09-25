// @vitest-environment jsdom

import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
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
			sourceAssetVersionId: null,
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

const assetVersionCatalog: AssetVersionCatalog = {
	assetVersions: [
		{
			id: "version-base-v1",
			projectId,
			assetFamilyId: gameplayFamilyId,
			assetRecordId: "asset-base",
			versionNumber: 1,
			contentType: "image/png",
			contentLength: 68,
			contentDigest: "a".repeat(64),
			integrityVerified: true,
			previewUrl: `/api/projects/${projectId}/asset-versions/version-base-v1/preview`,
			reviewDisposition: "approved",
			reviewEvents: [
				{
					id: "event-candidate",
					assetVersionId: "version-base-v1",
					type: "candidate",
					rationale: null,
					createdAt: "2026-09-25T12:00:07.000Z",
				},
				{
					id: "event-approved",
					assetVersionId: "version-base-v1",
					type: "approved",
					rationale: null,
					createdAt: "2026-09-25T12:00:08.000Z",
				},
			],
			createdAt: "2026-09-25T12:00:06.000Z",
		},
	],
	canonicalDesigns: [
		{
			id: "canonical-design-base",
			projectId,
			assetFamilyId: gameplayFamilyId,
			assetRecordId: "asset-base",
			assetVersionId: "version-base-v1",
			createdAt: "2026-09-25T12:00:09.000Z",
		},
	],
};

afterEach(cleanup);

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

test("shows the exact Asset Version selected as Canonical Design and used by a derivative", () => {
	const versionedCatalog: AssetFamilyCatalog = {
		...catalog,
		relationships: [
			...catalog.relationships,
			{
				id: "relationship-derivative",
				projectId,
				assetFamilyId: gameplayFamilyId,
				sourceAssetRecordId: "asset-base",
				sourceAssetVersionId: "version-base-v1",
				targetAssetRecordId: "asset-east",
				type: "derivative",
				createdAt: "2026-09-25T12:00:10.000Z",
			},
		],
	};

	render(
		<AssetFamilyCatalogView
			assetVersionCatalog={assetVersionCatalog}
			catalog={versionedCatalog}
			visualWorlds={visualWorlds}
		/>
	);

	expect(screen.getByText("Ash Knight base · Sürüm 1")).toBeTruthy();
	expect(
		screen
			.getAllByRole("listitem")
			.some((item) =>
				item.textContent?.includes(
					"Ash Knight base · Sürüm 1 — Türetilmiş Varlık — Ash Knight east"
				)
			)
	).toBe(true);
});
