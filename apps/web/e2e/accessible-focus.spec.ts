import { test } from "@playwright/test";
import {
	expectAccessibleName,
	expectVisibleFocus,
	tabTo,
} from "./accessibility";

test("the landing page is reachable by keyboard with visible focus", async ({
	page,
}) => {
	await page.goto("/");
	const start = page.getByRole("link", { name: "Sign in to get started" });
	await tabTo(page, start);
	await expectAccessibleName(start);
	await expectVisibleFocus(start);
});

test("the skip link is reachable by keyboard with visible focus", async ({
	page,
}) => {
	await page.goto("/");
	const skip = page.locator(".skip-link");
	await tabTo(page, skip);
	await expectVisibleFocus(skip);
});
