const hasAssetVersionStorage = [
	"CLOUDFLARE_ACCOUNT_ID",
	"R2_ACCESS_KEY_ID",
	"R2_SECRET_ACCESS_KEY",
].every((key) => Boolean(process.env[key]));

export function createAssetRecordFixture() {
	const runId = crypto.randomUUID();
	return {
		assetVersionPngBase64:
			"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZpUAAAAASUVORK5CYII=",
		userName: "Asset Record E2E",
		email: `asset-record-e2e-${runId}@example.test`,
		password: "AssetRecordE2E-Password-1",
		projectName: `Asset Record Project ${runId.slice(0, 8)}`,
		generalArtDirection: "Readable silhouettes with restrained highlights",
		name: `Ash Knight ${runId.slice(0, 8)}`,
	} as const;
}

export const assetRecordFixture = createAssetRecordFixture();

export const assetVersionE2eEnabled = Boolean(
	process.env.CONTEXT_TEST_DATABASE_URL &&
		process.env.ASSET_RECORDS_E2E_VERSION_STORAGE === "1" &&
		process.env.CONTEXT_TEST_R2_BUCKET &&
		hasAssetVersionStorage
);
