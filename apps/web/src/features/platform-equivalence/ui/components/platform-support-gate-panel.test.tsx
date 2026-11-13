// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, expect, test } from "vitest";
import { PlatformSupportGatePanel } from "./platform-support-gate-panel";

const supportedPattern = /: Supported$/;
const openPattern = /^Open:/;
const publishedPattern = /^Published:/;

afterEach(cleanup);

test("an unmeasured combination is shown as unmeasured with its blockers, never as supported", () => {
	render(
		<PlatformSupportGatePanel
			summary={{
				combinations: [
					{
						blockers: [
							{ id: "RAS-03", kind: "scenario", reason: "different" },
							{
								kind: "delivery_refresh",
								part: "lock",
								reason: "not_evaluated",
							},
							{
								kind: "accessibility",
								reason: "not_measured",
								surface: "desktop",
							},
							{
								id: "OV-10",
								kind: "open_validation",
								reason: "not_published",
							},
						],
						combinationId: "combo-1",
						status: "unmeasured",
					},
				],
				openValidations: [
					{ id: "OV-08", state: "open" },
					{ id: "OV-09", state: "open" },
					{ id: "OV-10", state: "open" },
					{ id: "OV-11", state: "published" },
				],
				supportedCount: 0,
			}}
		/>
	);

	const gate = screen.getByRole("region", { name: "Platform Support Gate" });
	expect(within(gate).getByText("combo-1: Unmeasured")).toBeInTheDocument();
	expect(within(gate).queryByText(supportedPattern)).not.toBeInTheDocument();
	expect(
		within(gate).getByText("RAS-03: the surfaces produced different results")
	).toBeInTheDocument();
	expect(
		within(gate).getByText("Delivery Refresh Lock: not evaluated")
	).toBeInTheDocument();
	expect(
		within(gate).getByText("Desktop application accessibility: not measured")
	).toBeInTheDocument();
	expect(within(gate).getAllByText(openPattern)).toHaveLength(3);
	expect(within(gate).getByText(publishedPattern)).toBeInTheDocument();
});
