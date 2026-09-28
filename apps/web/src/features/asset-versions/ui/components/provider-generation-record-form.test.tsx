// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ProviderGenerationRecordForm } from "./provider-generation-record-form";

afterEach(cleanup);

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
