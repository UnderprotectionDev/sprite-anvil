// @vitest-environment jsdom
import type { RightsRecord } from "@sprite-anvil/api/rights-records";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { expect, test, vi } from "vitest";
import { RightsRecordDetails } from "./rights-record-details";

vi.mock("../../lib/rights-record-api", () => ({
	rightsRecordEvidenceFileUrl: () => "/evidence",
}));

test("shows excluded evidence metadata without an unavailable download link", () => {
	const record: RightsRecord = {
		id: "r",
		projectId: "p",
		assetRecordId: "a",
		referenceId: null,
		versionNumber: 1,
		state: "documented",
		createdAt: "2026-11-01T10:00:00.000Z",
		source: null,
		rightsHolderOrProvider: null,
		assertedScope: null,
		evidence: null,
		restrictions: null,
		uncertainty: null,
		evidenceFile: {
			fileName: "license.pdf",
			contentLength: 10,
			sha256: "a".repeat(64),
			sourceContentType: "application/pdf",
			availability: "excluded",
		},
	};
	render(<RightsRecordDetails projectId="p" record={record} />);
	expect(
		screen.getByText("license.pdf (not included in Project Archive)")
	).toBeInTheDocument();
	expect(
		screen.queryByRole("link", { name: "license.pdf" })
	).not.toBeInTheDocument();
});
