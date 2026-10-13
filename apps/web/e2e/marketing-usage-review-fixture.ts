import { assetFamilyWorkspaceFixture } from "./asset-family-workspace-fixture";
export const marketingUsageFixture = {
	...assetFamilyWorkspaceFixture,
	userName: "Marketing usage owner",
	email:
		process.env.MARKETING_USAGE_E2E_EMAIL ??
		`marketing-review-${crypto.randomUUID()}@example.test`,
	password: "MarketingReview-Password-1",
	projectName: "Marketing usage project",
	generalArtDirection: "Readable illustrated promotion art",
	visualWorldName: "Marketing world",
	identityName: "Anvil identity",
	familyName: "Anvil marketing",
	useContext: "Store promotion",
	categoryLabel: "Portreler, logolar ve tanıtım görselleri",
	records: [{ name: "Anvil logo", uploadNote: "Authored marketing fixture." }],
};
export function readMarketingPreviewPresentation() {
	const heading = Array.from(document.querySelectorAll("h3")).find(
		(element) =>
			element.textContent ===
			"Logo ve Tanıtım Kullanımlarını Sınama · Anvil marketing"
	);
	if (!heading?.parentElement) {
		throw new Error("Marketing review was not found.");
	}
	return Array.from(heading.parentElement.querySelectorAll("figure img")).map(
		(image) => {
			const style = getComputedStyle(image);
			return {
				width: Math.round(Number.parseFloat(style.width) * 100) / 100,
				height: Math.round(Number.parseFloat(style.height) * 100) / 100,
				left: Math.round(Number.parseFloat(style.left) * 100) / 100,
				top: Math.round(Number.parseFloat(style.top) * 100) / 100,
				rendering: style.imageRendering,
				ready:
					image instanceof HTMLImageElement &&
					image.complete &&
					image.naturalWidth > 0,
			};
		}
	);
}
