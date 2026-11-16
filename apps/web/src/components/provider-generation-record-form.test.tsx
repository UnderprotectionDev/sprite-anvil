// @vitest-environment jsdom

import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProviderGenerationRecordForm } from "@/components/provider-generation-record-form";

afterEach(cleanup);

function submitButton() {
	return screen.getByRole("button", {
		name: "Save Provider Generation Record",
	});
}

test("records only the provider facts the user entered and leaves unknowns blank", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "Example Provider");
	await user.type(screen.getByLabelText("Requested width (px)"), "96");
	await user.type(screen.getByLabelText("Requested height (px)"), "96");
	await user.type(screen.getByLabelText("Tohum"), "seed-42");
	await user.click(
		screen.getByLabelText("Provider-specific parameters (JSON)")
	);
	await user.paste('{"steps":28,"sampler":"euler"}');
	await user.click(
		screen.getByRole("button", { name: "Save Provider Generation Record" })
	);

	expect(onSave).toHaveBeenCalledWith({
		actualDimensions: null,
		interface: null,
		model: null,
		modelVersion: null,
		palette: [],
		provider: "Example Provider",
		providerParameters: { steps: 28, sampler: "euler" },
		referenceIds: [],
		requestedDimensions: { height: 96, width: 96 },
		seed: "seed-42",
	});
});

test("keeps a partial dimension pair and malformed JSON out of the record", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "Example Provider");
	await user.type(screen.getByLabelText("Requested width (px)"), "96");
	await user.click(
		screen.getByLabelText("Provider-specific parameters (JSON)")
	);
	await user.paste("{invalid");
	await user.click(
		screen.getByRole("button", { name: "Save Provider Generation Record" })
	);

	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Enter both width and height for requested dimensions."
	);
});

test("rejects malformed provider parameter JSON", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "Example Provider");
	await user.click(
		screen.getByLabelText("Provider-specific parameters (JSON)")
	);
	await user.paste("{invalid");
	await user.click(
		screen.getByRole("button", { name: "Save Provider Generation Record" })
	);

	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Provider-specific parameters must be a valid JSON object and no larger than 50,000 UTF-8 bytes."
	);
});

test("rejects an out-of-range requested dimension before the actual dimension", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "Example Provider");
	await user.type(screen.getByLabelText("Requested width (px)"), "0");
	await user.type(screen.getByLabelText("Requested height (px)"), "96");
	await user.type(screen.getByLabelText("Actual width (px)"), "96");
	// The browser's own min/max check blocks a click; submit directly to reach
	// the form's range validation.
	fireEvent.submit(submitButton().closest("form") as HTMLFormElement);

	await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Requested dimensions must be integers from 1 to 100000."
	);
});

test("rejects a partial or out-of-range actual dimension", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "Example Provider");
	await user.type(screen.getByLabelText("Actual height (px)"), "64");
	const save = screen.getByRole("button", {
		name: "Save Provider Generation Record",
	});
	await user.click(save);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Enter both width and height for actual dimensions."
	);

	await user.type(screen.getByLabelText("Actual width (px)"), "100001");
	fireEvent.submit(save.closest("form") as HTMLFormElement);
	await waitFor(() =>
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Actual dimensions must be integers from 1 to 100000."
		)
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Actual dimensions must be integers from 1 to 100000."
	);
	expect(onSave).not.toHaveBeenCalled();
});

test("saves after a corrected resubmission, clears the error, and keeps the entered values", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Provider"), "  Example Provider  ");
	await user.type(screen.getByLabelText("Model"), "  ");
	await user.type(screen.getByLabelText("Requested width (px)"), "32");
	const save = screen.getByRole("button", {
		name: "Save Provider Generation Record",
	});
	await user.click(save);
	expect(screen.getByRole("alert")).toBeInTheDocument();

	await user.type(screen.getByLabelText("Requested height (px)"), "48");
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Enter both width and height for requested dimensions."
	);
	await user.click(screen.getByLabelText("Reference IDs"));
	await user.paste("ref-1, ref-2\nref-3");
	await user.click(screen.getByLabelText("Palette"));
	await user.paste("#000000\n\n#ffffff");
	await user.click(save);

	expect(screen.queryByRole("alert")).toBeNull();
	expect(onSave).toHaveBeenCalledTimes(1);
	expect(onSave).toHaveBeenCalledWith({
		actualDimensions: null,
		interface: null,
		model: null,
		modelVersion: null,
		palette: ["#000000", "#ffffff"],
		provider: "Example Provider",
		providerParameters: {},
		referenceIds: ["ref-1", "ref-2", "ref-3"],
		requestedDimensions: { height: 48, width: 32 },
		seed: null,
	});
	expect(screen.getByLabelText("Provider")).toHaveValue("  Example Provider  ");
});

test("disables every control and the save button while writes are disabled", () => {
	render(<ProviderGenerationRecordForm onSave={vi.fn()} writesDisabled />);

	for (const label of [
		"Provider",
		"Interface / API",
		"Model",
		"Model version",
		"Requested width (px)",
		"Requested height (px)",
		"Actual width (px)",
		"Actual height (px)",
		"Reference IDs",
		"Palette",
		"Tohum",
		"Provider-specific parameters (JSON)",
	]) {
		expect(screen.getByLabelText(label)).toBeDisabled();
	}
	expect(
		screen.getByRole("button", { name: "Save Provider Generation Record" })
	).toBeDisabled();
	expect(
		screen.getByRole("group", { name: "Requested dimensions (px)" })
	).toBeInTheDocument();
});
