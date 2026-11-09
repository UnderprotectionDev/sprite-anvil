import { $, $$, browser, expect } from "@wdio/globals";
import { deliveryPlanningFixture as fixture } from "../e2e/delivery-planning-fixture";
import { openWorkspaceTask } from "./workspace-navigation";

const checkboxIn = (label: string) =>
	`//label[contains(normalize-space(.), '${label}')]//input[@type='checkbox']`;

async function headings(level: "h3") {
	const elements = await $$(`//ol[@aria-label='Dependent work']//${level}`);
	return Promise.all(elements.map((element) => element.getText()));
}

describe("Delivery Planning", () => {
	it("activates a Delivery Target, re-versions it and opens its Readiness Plan on the desktop surface", async function () {
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
		await openWorkspaceTask("Görsel Dünyalar ve Temalar");
		await $("input[placeholder='Örn. Yüksek yaylalar']").setValue(
			fixture.visualWorldName
		);
		await (await $("button=Görsel Dünya ekle")).click();
		await $(`strong=${fixture.visualWorldName}`).waitForDisplayed();

		await (await $("a=Projeler")).click();
		await (await $("a=Varlık Aileleri")).click();
		await openWorkspaceTask("Aile ve temsil ilişkileri");
		await $("input[id='subject-identity-name']").setValue(fixture.identityName);
		await (await $("button=Varlık Kimliği oluştur")).click();
		await openWorkspaceTask("Aile kataloğu");
		await $(`h2=${fixture.identityName}`).waitForDisplayed();

		for (const family of fixture.families) {
			// biome-ignore lint/performance/noAwaitInLoops: Desktop interactions within each family setup must occur in order.
			await openWorkspaceTask("Aile ve temsil ilişkileri");
			await $("input[id='asset-family-name']").setValue(family.familyName);
			await $("#asset-family-visual-world").selectByVisibleText(
				fixture.visualWorldName
			);
			await $("input[id='asset-family-use-context']").setValue(
				fixture.useContext
			);
			await (await $("button=Varlık Ailesi oluştur")).click();
			await (await $(checkboxIn("Bağımsız ürün anlamı"))).click();
			await $("input[id='asset-record-name']").setValue(family.recordName);
			await (await $("button=Varlık Kaydı ekle")).click();
			await openWorkspaceTask("Aile kataloğu");
			await $(`h3=${family.familyName}`).waitForDisplayed();
		}

		for (const family of fixture.families) {
			// biome-ignore lint/performance/noAwaitInLoops: Each family's list is saved and activated before the next.
			await openWorkspaceTask("Tamamlanma ve kanıtlar");
			await $(
				"//label[span[normalize-space()='İnceleme ve tamamlanma için aile']]//select"
			).selectByVisibleText(family.familyName);
			await (await $("button=Öğe ekle")).click();
			await $("//label[span[normalize-space()='Öğe adı']]//input").setValue(
				family.itemName
			);
			await $(
				"//label[span[normalize-space()='Varlık Kaydı']]//select"
			).selectByVisibleText(family.recordName);
			await (await $("button=Taslak sürümü kaydet")).click();
			await $("p=Yeni liste sürümü taslak olarak kaydedildi.").waitForDisplayed(
				{ timeout: 20_000 }
			);
			await (await $("button=Bu sürümü etkinleştir")).click();
			await $(
				"p=Gerekli Öğeler Listesi sürümü etkinleştirildi."
			).waitForDisplayed({ timeout: 20_000 });
		}

		await (await $("a=Delivery Targets")).click();
		await $("h1=Delivery Targets").waitForDisplayed();
		await $("p=This project has no Delivery Targets yet.").waitForDisplayed();

		// Review a draft spanning both families.
		await (await $("button=New Delivery Target")).click();
		await $("#delivery-target-name").setValue(fixture.targetName);
		await expect(await $("#delivery-target-purpose").getValue()).toBe("");
		await $("#delivery-target-purpose").selectByVisibleText("Demo");
		await $("#delivery-target-default-production").selectByVisibleText(
			"Missing history is advisory"
		);
		await (await $(checkboxIn("Documented"))).click();
		for (const family of fixture.families) {
			// biome-ignore lint/performance/noAwaitInLoops: Checkbox interactions stay sequential for stable rendering.
			await (await $(checkboxIn(family.familyName))).click();
		}
		await (await $("button=Save draft")).click();
		const review = await $("section[aria-label='Draft review']");
		await review.waitForDisplayed({ timeout: 20_000 });
		for (const family of fixture.families) {
			// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same review section in order.
			await expect(await review.$(`p=${family.familyName}`).isDisplayed()).toBe(
				true
			);
		}
		await $("span=Not activated").waitForDisplayed();

		// Activate and re-read after a reload.
		await (await review.$("button=Activate revision")).click();
		await $("h3=Active revision 1").waitForDisplayed({ timeout: 20_000 });
		await browser.refresh();
		await $("h3=Active revision 1").waitForDisplayed({ timeout: 20_000 });

		// Re-version with evidence policies and see the scope diff.
		await (await $("button=New revision")).click();
		await $("#delivery-target-default-production").selectByVisibleText(
			"Full Generation Package history"
		);
		await (await $(checkboxIn("Assertion only"))).click();
		await (await $(checkboxIn("Results"))).click();
		await (await $("button=Save draft")).click();
		const nextReview = await $("section[aria-label='Draft review']");
		await nextReview.waitForDisplayed({ timeout: 20_000 });
		await (await nextReview.$("button=Activate revision")).click();
		await $("h3=Active revision 2").waitForDisplayed({ timeout: 20_000 });
		const diff = await $("section[aria-label='Scope diff against revision 1']");
		await diff.waitForDisplayed();
		await diff.$("p=Production Evidence Policy changed").waitForDisplayed();
		await diff.$("p=Rights Evidence Policy changed").waitForDisplayed();

		await browser.refresh();
		await $("h3=Active revision 2").waitForDisplayed({ timeout: 20_000 });
		await $(
			"section[aria-label='Scope diff against revision 1']"
		).waitForDisplayed();

		// The Readiness Plan stays Blocked and Not delivered; a reorder persists.
		await (await $("a=Open Readiness Plan")).click();
		await $("h1=Readiness Plan").waitForDisplayed();
		await $("p=Target Readiness: Blocked").waitForDisplayed({
			timeout: 20_000,
		});
		await $("p=Delivery Status: Not delivered").waitForDisplayed();

		// Records without an Asset Version leave each required item incomplete.
		for (const family of fixture.families) {
			// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same list in order.
			await $(
				`//ul[@aria-label='Blockers']//p[text()='${family.itemName}']`
			).waitForDisplayed();
		}
		await $(
			"//ul[@aria-label='Blockers']//p[text()='Required item incomplete']"
		).waitForDisplayed();
		for (const term of [
			"Target requirement",
			"Work opened",
			"User priority",
			"Revalidation impact",
		]) {
			// biome-ignore lint/performance/noAwaitInLoops: Assertions read the same step in order.
			await $(
				`//ol[@aria-label='Dependent work']//dt[text()='${term}']`
			).waitForDisplayed();
		}

		const before = await headings("h3");
		await expect(before.length >= 2).toBe(true);
		await (
			await $(
				"//ol[@aria-label='Dependent work']//button[contains(@aria-label, ' down')]"
			)
		).click();
		await browser.waitUntil(
			async () => {
				const after = await headings("h3");
				return after[0] === before[1] && after[1] === before[0];
			},
			{ timeout: 20_000, timeoutMsg: "The reordered plan was not shown." }
		);
		await browser.refresh();
		await browser.waitUntil(
			async () => {
				const after = await headings("h3");
				return after[0] === before[1] && after[1] === before[0];
			},
			{ timeout: 20_000, timeoutMsg: "The reorder did not persist." }
		);
	});
});
