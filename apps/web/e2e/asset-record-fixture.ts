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

export const assetRecordMeasurementInputs = [
	{
		accessibleName: "Source Image Dimensions — Proposal — Width (px)",
		id: "sourceImageDimensions-proposal-width",
		value: "512",
	},
	{
		accessibleName: "Source Image Dimensions — Proposal — Height (px)",
		id: "sourceImageDimensions-proposal-height",
		value: "256",
	},
	{
		accessibleName: "Source Image Dimensions — Confirmed value — Width (px)",
		id: "sourceImageDimensions-confirmed-width",
		value: "1024",
	},
	{
		accessibleName: "Source Image Dimensions — Confirmed value — Height (px)",
		id: "sourceImageDimensions-confirmed-height",
		value: "512",
	},
	{
		accessibleName: "Logical Resolution — Proposal — Width (px)",
		id: "logicalResolution-proposal-width",
		value: "72",
	},
	{
		accessibleName: "Logical Resolution — Proposal — Height (px)",
		id: "logicalResolution-proposal-height",
		value: "80",
	},
	{
		accessibleName: "Logical Resolution — Confirmed value — Width (px)",
		id: "logicalResolution-confirmed-width",
		value: "73",
	},
	{
		accessibleName: "Logical Resolution — Confirmed value — Height (px)",
		id: "logicalResolution-confirmed-height",
		value: "81",
	},
	{
		accessibleName: "Cell Dimensions — Proposal — Width (px)",
		id: "cellDimensions-proposal-width",
		value: "24",
	},
	{
		accessibleName: "Cell Dimensions — Proposal — Height (px)",
		id: "cellDimensions-proposal-height",
		value: "32",
	},
	{
		accessibleName: "Cell Dimensions — Confirmed value — Width (px)",
		id: "cellDimensions-confirmed-width",
		value: "26",
	},
	{
		accessibleName: "Cell Dimensions — Confirmed value — Height (px)",
		id: "cellDimensions-confirmed-height",
		value: "34",
	},
	{
		accessibleName: "Visible Content Bounds — Proposal — X (px)",
		id: "visibleContentBounds-proposal-x",
		value: "3",
	},
	{
		accessibleName: "Visible Content Bounds — Proposal — Y (px)",
		id: "visibleContentBounds-proposal-y",
		value: "4",
	},
	{
		accessibleName: "Visible Content Bounds — Proposal — Width (px)",
		id: "visibleContentBounds-proposal-width",
		value: "66",
	},
	{
		accessibleName: "Visible Content Bounds — Proposal — Height (px)",
		id: "visibleContentBounds-proposal-height",
		value: "74",
	},
	{
		accessibleName: "Visible Content Bounds — Proposal — Koordinat temeli",
		id: "visibleContentBounds-proposal-coordinateSpace",
		kind: "select",
		value: "logicalResolution",
	},
	{
		accessibleName: "Visible Content Bounds — Confirmed value — X (px)",
		id: "visibleContentBounds-confirmed-x",
		value: "2",
	},
	{
		accessibleName: "Visible Content Bounds — Confirmed value — Y (px)",
		id: "visibleContentBounds-confirmed-y",
		value: "3",
	},
	{
		accessibleName: "Visible Content Bounds — Confirmed value — Width (px)",
		id: "visibleContentBounds-confirmed-width",
		value: "60",
	},
	{
		accessibleName: "Visible Content Bounds — Confirmed value — Height (px)",
		id: "visibleContentBounds-confirmed-height",
		value: "70",
	},
	{
		accessibleName:
			"Visible Content Bounds — Confirmed value — Koordinat temeli",
		id: "visibleContentBounds-confirmed-coordinateSpace",
		kind: "select",
		value: "logicalResolution",
	},
	{
		accessibleName: "Display Scale — Proposal — Scale",
		id: "displayScale-proposal-value",
		value: "2.5",
	},
	{
		accessibleName: "Display Scale — Confirmed value — Scale",
		id: "displayScale-confirmed-value",
		value: "2",
	},
	{
		accessibleName: "Atlas Dimensions — Proposal — Width (px)",
		id: "atlasDimensions-proposal-width",
		value: "1024",
	},
	{
		accessibleName: "Atlas Dimensions — Proposal — Height (px)",
		id: "atlasDimensions-proposal-height",
		value: "512",
	},
	{
		accessibleName: "Atlas Dimensions — Confirmed value — Width (px)",
		id: "atlasDimensions-confirmed-width",
		value: "2048",
	},
	{
		accessibleName: "Atlas Dimensions — Confirmed value — Height (px)",
		id: "atlasDimensions-confirmed-height",
		value: "1024",
	},
] as const;

interface AssetRecordMeasurementInput {
	accessibleName: string;
	id: string;
	kind?: "number" | "select";
	value: string;
}

const measurementLabels = {
	atlasDimensions: "Atlas Dimensions",
	cellDimensions: "Cell Dimensions",
	displayScale: "Display Scale",
	logicalResolution: "Logical Resolution",
	sourceImageDimensions: "Source Image Dimensions",
	visibleContentBounds: "Visible Content Bounds",
} as const;

const fieldLabels = {
	height: "Height (px)",
	value: "Scale",
	width: "Width (px)",
	x: "X (px)",
	y: "Y (px)",
} as const;

function numberInput(
	measurement: keyof typeof measurementLabels,
	state: "proposal" | "confirmed",
	field: keyof typeof fieldLabels,
	value: string
): AssetRecordMeasurementInput {
	const stateLabel = state === "proposal" ? "Proposal" : "Confirmed value";
	return {
		accessibleName: `${measurementLabels[measurement]} — ${stateLabel} — ${fieldLabels[field]}`,
		id: `${measurement}-${state}-${field}`,
		kind: "number",
		value,
	};
}

function coordinateSpaceInput(
	state: "proposal" | "confirmed",
	value: "logicalResolution" | "cellDimensions"
): AssetRecordMeasurementInput {
	const stateLabel = state === "proposal" ? "Proposal" : "Confirmed value";
	return {
		accessibleName: `Visible Content Bounds — ${stateLabel} — Koordinat temeli`,
		id: `visibleContentBounds-${state}-coordinateSpace`,
		kind: "select",
		value,
	};
}

export const assetRecordMeasurementScenarios = [
	{ name: assetRecordFixture.name, inputs: assetRecordMeasurementInputs },
	{
		name: "Health Potion Icon",
		inputs: [
			numberInput("sourceImageDimensions", "proposal", "width", "128"),
			numberInput("sourceImageDimensions", "proposal", "height", "128"),
			numberInput("logicalResolution", "proposal", "width", "64"),
			numberInput("logicalResolution", "proposal", "height", "64"),
			numberInput("visibleContentBounds", "proposal", "x", "4"),
			numberInput("visibleContentBounds", "proposal", "y", "4"),
			numberInput("visibleContentBounds", "proposal", "width", "56"),
			numberInput("visibleContentBounds", "proposal", "height", "56"),
			coordinateSpaceInput("proposal", "logicalResolution"),
			numberInput("displayScale", "proposal", "value", "2"),
		],
	},
	{
		name: "Stone Path Tiles",
		inputs: [
			numberInput("sourceImageDimensions", "proposal", "width", "512"),
			numberInput("sourceImageDimensions", "proposal", "height", "512"),
			numberInput("cellDimensions", "proposal", "width", "32"),
			numberInput("cellDimensions", "proposal", "height", "32"),
			numberInput("visibleContentBounds", "proposal", "x", "1"),
			numberInput("visibleContentBounds", "proposal", "y", "2"),
			numberInput("visibleContentBounds", "proposal", "width", "29"),
			numberInput("visibleContentBounds", "proposal", "height", "28"),
			coordinateSpaceInput("proposal", "cellDimensions"),
			numberInput("atlasDimensions", "proposal", "width", "512"),
			numberInput("atlasDimensions", "proposal", "height", "512"),
		],
	},
	{
		name: "Frost Mage Portrait",
		inputs: [
			numberInput("sourceImageDimensions", "proposal", "width", "2400"),
			numberInput("sourceImageDimensions", "proposal", "height", "3200"),
			numberInput("logicalResolution", "proposal", "width", "1200"),
			numberInput("logicalResolution", "proposal", "height", "1600"),
			numberInput("visibleContentBounds", "proposal", "x", "90"),
			numberInput("visibleContentBounds", "proposal", "y", "100"),
			numberInput("visibleContentBounds", "proposal", "width", "1000"),
			numberInput("visibleContentBounds", "proposal", "height", "1400"),
			coordinateSpaceInput("proposal", "logicalResolution"),
			numberInput("displayScale", "proposal", "value", "0.5"),
		],
	},
] satisfies readonly {
	name: string;
	inputs: readonly AssetRecordMeasurementInput[];
}[];

export const assetVersionE2eEnabled = Boolean(
	process.env.CONTEXT_TEST_DATABASE_URL &&
		process.env.ASSET_RECORDS_E2E_VERSION_STORAGE === "1" &&
		process.env.CONTEXT_TEST_R2_BUCKET &&
		hasAssetVersionStorage
);
