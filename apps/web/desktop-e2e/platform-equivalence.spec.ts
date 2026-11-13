import { $, expect } from "@wdio/globals";
import { deliveryPlanningFixture as fixture } from "../e2e/delivery-planning-fixture";

describe("Platform Equivalence", () => {
	it("shows interim evidence on the desktop surface and offers no report without a run", async function () {
		if (!process.env.CONTEXT_TEST_DATABASE_URL) {
			this.skip();
		}

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

		await (await $("a=Platform Equivalence")).click();
		await $("h1=Platform Equivalence").waitForDisplayed();
		await $("p=No run has been recorded yet.").waitForDisplayed();
		await expect(
			await $("button=Create report from latest runs")
		).toBeDisabled();
		await expect(await $("p*=Phase 3 interim evidence")).toBeDisplayed();
	});
});
