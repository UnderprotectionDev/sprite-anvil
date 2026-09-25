const runId = crypto.randomUUID();

export const assetVersionFixture = {
	userName: "Asset Version E2E",
	email: `asset-version-e2e-${runId}@example.test`,
	password: "AssetVersionE2E-Password-1",
	projectName: "Ash Knight Asset Versions",
	generalArtDirection: "Pixel art with readable silhouettes",
	visualWorldName: "Asset Version Gameplay",
	identityName: "Ash Knight",
	familyName: "Gameplay Sprite",
	useContext: "combat sprite",
	sourceName: "Ash Knight base",
	derivativeName: "Ash Knight east",
	visibleLineage:
		"Ash Knight base · Sürüm 1 — Türetilmiş Varlık — Ash Knight east",
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lR0AAAAASUVORK5CYII=",
		"base64"
	),
} as const;
