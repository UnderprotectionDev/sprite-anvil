import { expect, test, vi } from "vitest";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { uploadProjectArchive } from "./upload-project-archive";

vi.mock("@/utils/hono-api", () => ({
	projectApiUrl: () => "/project",
	honoPostFileJson: vi.fn().mockResolvedValue({ invalid: true }),
}));

test("treats an invalid accepted response as an uncertain write", async () => {
	const error = await uploadProjectArchive({
		file: new File(["zip"], "a.zip"),
		name: "A",
		projectId: "p",
		idempotencyKey: "key",
	}).catch((value: unknown) => value);
	expect(isWriteOutcomeUncertain(error)).toBe(true);
});
