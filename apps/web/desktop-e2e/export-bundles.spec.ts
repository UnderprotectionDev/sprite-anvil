import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildFixtureBundleFiles,
	writeBundleDirectory,
} from "@sprite-anvil/api/export-bundle-verification-fixture";
import { $, expect } from "@wdio/globals";
import { deliveryPlanningFixture as fixture } from "../e2e/delivery-planning-fixture";

describe("Export Bundles", () => {
	it("re-reads a manifest and reports the offline integrity result on the desktop surface", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

		// The WebDriver file input cannot choose a directory, so the manifest and
		// checksum list are chosen flat. The files they list are then missing, and
		// the desktop verifier must report that exactly as the Workbench does.
		const directory = mkdtempSync(join(tmpdir(), "export-bundle-desktop-"));
		writeBundleDirectory(await buildFixtureBundleFiles(), directory);

		await (await $("a=Sign In")).waitForClickable();
		await (await $("a=Sign In")).click();
		await (await $("button=Need an account? Sign Up")).click();
		await $("h2=Create Account").waitForDisplayed();
		await $("input[name='name']").setValue(fixture.userName);
		await $("input[name='email']").setValue(fixture.email);
		await $("input[name='password']").setValue(fixture.password);
		await (await $("button=Sign Up")).click();
		await $("h1=Oyun projeleri").waitForDisplayed({ timeout: 30_000 });

		await (await $("a=Proje Bağlamı")).click();
		await $("//label[span[text()='Proje adı']]/input").setValue(
			fixture.projectName
		);
		await $("//label[span[text()='Genel sanat yaklaşımı']]/textarea").setValue(
			fixture.generalArtDirection
		);
		await (await $("button=Projeyi oluştur")).click();

		await (await $("a=Export Bundles")).click();
		await $("h1=Export Bundles").waitForDisplayed();
		await $("#bundle-directory").setValue(
			`${join(directory, "manifest.json")}\n${join(directory, "checksums.txt")}`
		);

		await $("p=Integrity check failed.").waitForDisplayed();
		await $("dt=Manifest contract version").waitForDisplayed();
		await expect(await $("p=Integrity check failed.")).toBeDisplayed();
	});
});
