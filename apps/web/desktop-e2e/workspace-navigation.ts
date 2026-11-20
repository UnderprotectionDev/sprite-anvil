import { $, browser, expect } from "@wdio/globals";

export async function openWorkspaceTask(label: string) {
	const button = await $(
		`//button[(not(@role) or @role="tab") and normalize-space(.)="${label}"]`
	);
	await button.waitForClickable();
	await button.click();
}

export async function activateFamilyProfile(name: string, version: string) {
	const familyUrl = await browser.getUrl();
	await (await $("a=Profile Contracts")).click();
	await openWorkspaceTask(name);
	const profile = await $(`section[aria-label='${name}'] article`);
	await (await profile.$("button=Activate contract")).click();
	await expect(
		await profile.$(`p=Active in this project · ${version}`)
	).toBeDisplayed();
	await browser.url(familyUrl);
	await openWorkspaceTask("Profile reviews");
}

export async function uploadFamilyCandidate(
	recordName: string,
	pngPath: string
) {
	const familyUrl = await browser.getUrl();
	const record = await $(
		`//section[@aria-label='Version and dependency operations']//li[h4[normalize-space(.)='${recordName}']]`
	);
	await (await record.$("a=Upload Asset Version")).click();
	await openWorkspaceTask("Versions and files");
	await $("#asset-version-file").setValue(pngPath);
	await $("#asset-version-missing-history").setValue(
		"Test image created for the disposable review fixture."
	);
	await $("#asset-version-source").setValue("Desktop review fixture");
	await $("#asset-version-relationship").selectByAttribute(
		"value",
		"created_by_user"
	);
	await (await $("button=Save Candidate Version")).click();
	await $("p=Candidate Version saved.").waitForDisplayed();
	await browser.url(familyUrl);
	await openWorkspaceTask("Version and dependency operations");
}
