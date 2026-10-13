import { $, browser, expect } from "@wdio/globals";

export async function openWorkspaceTask(label: string) {
	const button = await $(`button=${label}`);
	await button.waitForClickable();
	await button.click();
}

export async function activateFamilyProfile(name: string, version: string) {
	const familyUrl = await browser.getUrl();
	await (await $("a=Özel profil sözleşmeleri")).click();
	await openWorkspaceTask(name);
	const profile = await $(`section[aria-label='${name}'] article`);
	await (await profile.$("button=Sözleşmeyi etkinleştir")).click();
	await expect(
		await profile.$(`p=Bu projede etkin · ${version}`)
	).toBeDisplayed();
	await browser.url(familyUrl);
	await openWorkspaceTask("Profil incelemeleri");
}
