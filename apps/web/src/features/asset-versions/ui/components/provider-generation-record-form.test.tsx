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
import { ProviderGenerationRecordForm } from "./provider-generation-record-form";

afterEach(cleanup);

function submitButton() {
	return screen.getByRole("button", {
		name: "Sağlayıcı üretim kaydını kaydet",
	});
}

test("records only the provider facts the user entered and leaves unknowns blank", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.type(screen.getByLabelText("İstenen genişlik (px)"), "96");
	await user.type(screen.getByLabelText("İstenen yükseklik (px)"), "96");
	await user.type(screen.getByLabelText("Tohum"), "seed-42");
	await user.click(
		screen.getByLabelText("Sağlayıcıya özgü parametreler (JSON)")
	);
	await user.paste('{"steps":28,"sampler":"euler"}');
	await user.click(
		screen.getByRole("button", { name: "Sağlayıcı üretim kaydını kaydet" })
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

	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.type(screen.getByLabelText("İstenen genişlik (px)"), "96");
	await user.click(
		screen.getByLabelText("Sağlayıcıya özgü parametreler (JSON)")
	);
	await user.paste("{invalid");
	await user.click(
		screen.getByRole("button", { name: "Sağlayıcı üretim kaydını kaydet" })
	);

	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"İstenen ölçünün genişlik ve yükseklik değerlerini birlikte girin."
	);
});

test("rejects malformed provider parameter JSON", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.click(
		screen.getByLabelText("Sağlayıcıya özgü parametreler (JSON)")
	);
	await user.paste("{invalid");
	await user.click(
		screen.getByRole("button", { name: "Sağlayıcı üretim kaydını kaydet" })
	);

	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Sağlayıcıya özgü parametreler geçerli bir JSON nesnesi olmalı ve 50.000 UTF-8 baytı aşmamalıdır."
	);
});

test("rejects an out-of-range requested dimension before the actual dimension", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.type(screen.getByLabelText("İstenen genişlik (px)"), "0");
	await user.type(screen.getByLabelText("İstenen yükseklik (px)"), "96");
	await user.type(screen.getByLabelText("Gerçekleşen genişlik (px)"), "96");
	// The browser's own min/max check blocks a click; submit directly to reach
	// the form's range validation.
	fireEvent.submit(submitButton().closest("form") as HTMLFormElement);

	await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));
	expect(onSave).not.toHaveBeenCalled();
	expect(screen.getByRole("alert")).toHaveTextContent(
		"İstenen ölçü 1 ile 100000 arasında tam sayı olmalıdır."
	);
});

test("rejects a partial or out-of-range actual dimension", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Sağlayıcı"), "Example Provider");
	await user.type(screen.getByLabelText("Gerçekleşen yükseklik (px)"), "64");
	const save = screen.getByRole("button", {
		name: "Sağlayıcı üretim kaydını kaydet",
	});
	await user.click(save);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Gerçekleşen ölçünün genişlik ve yükseklik değerlerini birlikte girin."
	);

	await user.type(screen.getByLabelText("Gerçekleşen genişlik (px)"), "100001");
	fireEvent.submit(save.closest("form") as HTMLFormElement);
	await waitFor(() =>
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Gerçekleşen ölçü 1 ile 100000 arasında tam sayı olmalıdır."
		)
	);
	expect(screen.getByRole("alert")).toHaveTextContent(
		"Gerçekleşen ölçü 1 ile 100000 arasında tam sayı olmalıdır."
	);
	expect(onSave).not.toHaveBeenCalled();
});

test("saves after a corrected resubmission, clears the error, and keeps the entered values", async () => {
	const user = userEvent.setup();
	const onSave = vi.fn().mockResolvedValue(true);
	render(
		<ProviderGenerationRecordForm onSave={onSave} writesDisabled={false} />
	);

	await user.type(screen.getByLabelText("Sağlayıcı"), "  Example Provider  ");
	await user.type(screen.getByLabelText("Model"), "  ");
	await user.type(screen.getByLabelText("İstenen genişlik (px)"), "32");
	const save = screen.getByRole("button", {
		name: "Sağlayıcı üretim kaydını kaydet",
	});
	await user.click(save);
	expect(screen.getByRole("alert")).toBeInTheDocument();

	await user.type(screen.getByLabelText("İstenen yükseklik (px)"), "48");
	expect(screen.getByRole("alert")).toHaveTextContent(
		"İstenen ölçünün genişlik ve yükseklik değerlerini birlikte girin."
	);
	await user.click(screen.getByLabelText("Referans kimlikleri"));
	await user.paste("ref-1, ref-2\nref-3");
	await user.click(screen.getByLabelText("Palet"));
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
	expect(screen.getByLabelText("Sağlayıcı")).toHaveValue(
		"  Example Provider  "
	);
});

test("disables every control and the save button while writes are disabled", () => {
	render(<ProviderGenerationRecordForm onSave={vi.fn()} writesDisabled />);

	for (const label of [
		"Sağlayıcı",
		"Arayüz / API",
		"Model",
		"Model sürümü",
		"İstenen genişlik (px)",
		"İstenen yükseklik (px)",
		"Gerçekleşen genişlik (px)",
		"Gerçekleşen yükseklik (px)",
		"Referans kimlikleri",
		"Palet",
		"Tohum",
		"Sağlayıcıya özgü parametreler (JSON)",
	]) {
		expect(screen.getByLabelText(label)).toBeDisabled();
	}
	expect(
		screen.getByRole("button", { name: "Sağlayıcı üretim kaydını kaydet" })
	).toBeDisabled();
	expect(
		screen.getByRole("group", { name: "İstenen ölçü (px)" })
	).toBeInTheDocument();
});
