// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/utils/orpc", () => ({ orpc: {} }));

import { afterEach, describe, expect, it, vi } from "vitest";
import { MeasurementContent } from "./measurement-view";

vi.mock("@/utils/orpc", () => ({ orpc: {} }));

afterEach(cleanup);

const deliveryVersion = /delivery.*version 2/i;

describe("Measurement view", () => {
	it("lists activated versions", () => {
		render(
			<MeasurementContent
				activate={vi.fn()}
				compute={vi.fn()}
				definitions={[{ id: "x", metricId: "delivery", version: 2 } as never]}
			/>
		);
		expect(screen.getByText(deliveryVersion)).toBeTruthy();
	});
	it("validates activation before sending", async () => {
		const activate = vi.fn();
		render(
			<MeasurementContent
				activate={activate}
				compute={vi.fn()}
				definitions={[]}
			/>
		);
		fireEvent.click(
			screen.getByRole("button", { name: "Activate Measurement Definition" })
		);
		expect(await screen.findByRole("alert")).toBeTruthy();
		expect(activate).not.toHaveBeenCalled();
	});
	it("suggests registered events for the selected family and phase", () => {
		render(
			<MeasurementContent
				activate={vi.fn()}
				compute={vi.fn()}
				definitions={[]}
			/>
		);
		fireEvent.change(screen.getByLabelText("Event family"), {
			target: { value: "export_delivery" },
		});
		const start = document.getElementById("measurement-start-events");
		const end = document.getElementById("measurement-end-events");
		expect(
			start?.querySelector('option[value="delivery_target_activated"]')
		).toBeTruthy();
		expect(
			end?.querySelector('option[value="delivery_target_ready"]')
		).toBeTruthy();
		expect(
			end?.querySelector('option[value="delivery_target_delivered"]')
		).toBeTruthy();
		expect(
			end?.querySelector('option[value="candidate_preview_reached"]')
		).toBeFalsy();
	});
	it("shows compute failures", async () => {
		render(
			<MeasurementContent
				activate={vi.fn()}
				compute={vi.fn().mockRejectedValue(new Error("Compute failed"))}
				definitions={[]}
			/>
		);
		fireEvent.click(screen.getByRole("button", { name: "Compute report" }));
		expect(await screen.findByText("Compute failed")).toBeTruthy();
	});
});
