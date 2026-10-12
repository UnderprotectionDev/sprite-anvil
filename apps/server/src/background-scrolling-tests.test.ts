import { expect, test } from "bun:test";
import { call } from "@orpc/server";
import type { Context } from "@sprite-anvil/api/context";
import { appRouter } from "@sprite-anvil/api/routers/index";

test("scrolling-test API rejects unauthenticated static completion evidence", async () => {
	await expect(
		call(
			appRouter.backgroundScrollingTests.list,
			{ projectId: "private", assetFamilyId: "background" },
			{ context: { session: null } as Context }
		)
	).rejects.toMatchObject({ code: "UNAUTHORIZED" });
});
