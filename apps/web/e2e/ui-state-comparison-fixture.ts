import { assetFamilyWorkspaceFixture } from "./asset-family-workspace-fixture";

export const uiStateComparisonFixture = {
	...assetFamilyWorkspaceFixture,
	userName: "UI State Comparison E2E",
	email: `ui-state-comparison-e2e-${crypto.randomUUID()}@example.test`,
	projectName: "Inventory UI Comparison Project",
	generalArtDirection: "Clear borders and consistent UI state colors",
	visualWorldName: "Inventory UI World",
	identityName: "Inventory UI",
	familyName: "Inventory UI Components",
	useContext: "Inventory screen",
	categoryLabel: "Arayüz ekranları ve bileşenleri",
	records: [
		{ name: "Inventory screen", uploadNote: "UI screen comparison fixture." },
		{
			name: "Inventory button states",
			uploadNote: "UI button state comparison fixture.",
		},
		{ name: "Inventory panel", uploadNote: "UI panel comparison fixture." },
		{
			name: "Inventory item slot",
			uploadNote: "UI item slot comparison fixture.",
		},
	],
};
