// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { MarketingUsagePreview } from "./marketing-usage-preview";

afterEach(cleanup);
test("shows exact small-use crop on light and dark backgrounds with safe area and smooth scaling", () => {
	render(
		<MarketingUsagePreview
			item={{
				naturalSize: { width: 301, height: 199 },
				crop: { x: 10, y: 5, width: 280, height: 180 },
				safeArea: { x: 20, y: 20, width: 260, height: 150 },
				displaySize: { width: 77, height: 51 },
				presentation: "opaque",
				opaqueColor: "#ffcc00",
			}}
			name="Anvil logo"
			previewUrl="/logo.png"
		/>
	);
	expect(screen.getAllByRole("img")).toHaveLength(2);
	expect(screen.getAllByRole("img")[0]).toHaveAttribute(
		"crossorigin",
		"use-credentials"
	);
	expect(screen.getAllByRole("img")[0]).toHaveStyle({
		imageRendering: "auto",
		width: "82.775px",
	});
	expect(screen.getAllByLabelText("Güvenli alan")).toHaveLength(2);
});
