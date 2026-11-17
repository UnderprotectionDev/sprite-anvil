import type { Page } from "@playwright/test";
import {
	assetFamilyWorkspaceFixture,
	prepareAssetFamilyWorkspace,
} from "./asset-family-workspace-fixture";
export const assetFamilyComparisonFixture = assetFamilyWorkspaceFixture;
export async function prepareAssetFamilyComparisonWorkspace(page: Page) {
	const result = await prepareAssetFamilyWorkspace(page);
	return {
		familyName: result.familyName,
		comparison: page.getByRole("region", {
			name: `${result.familyName} state and direction family comparison`,
		}),
	};
}
