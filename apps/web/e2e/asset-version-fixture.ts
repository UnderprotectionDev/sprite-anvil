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
		"Ash Knight base · Version 1 — Derived Asset — Ash Knight east",
	png: Buffer.from(
		"iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAACXBIWXMAAAsTAAALEwEAmpwYAAAAWUlEQVRYhWNgGAVDDeR3zviPD48sBzw9XoGCRx2QP+LSQP5gdEA+rR2UTy8H5JNo0agD8kejoHM0Ec4YzYb/h3dBxECkI8m2EB2MOiB/NAo6R3oiHAUMdAIApRlBiwhnmmsAAAAASUVORK5CYII=",
		"base64"
	),
} as const;
