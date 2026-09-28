// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ExternalWorkingFileEditUpload } from "./external-working-file-edit-upload";

afterEach(cleanup);

function renderUpload() {
	const onImport = vi.fn().mockResolvedValue(true);
	render(<ExternalWorkingFileEditUpload onImport={onImport} />);
	return { onImport };
}

function selectCandidate(file: File) {
	fireEvent.change(screen.getByLabelText("PNG/WebP dışa aktarımı"), {
		target: { files: [file] },
	});
}

function makeCandidateFile() {
	return new File([new Uint8Array([5, 6, 7])], "ash-knight.webp", {
		lastModified: 1000,
		type: "image/webp",
	});
}

function sourceFile() {
	return new File([new Uint8Array([1, 2, 3, 4])], "Ash Knight.aseprite", {
		lastModified: 2000,
		type: "application/octet-stream",
	});
}

test("file selection imports the PNG/WebP with its editable source file", async () => {
	const user = userEvent.setup();
	const { onImport } = renderUpload();
	const candidate = makeCandidateFile();
	const source = sourceFile();
	selectCandidate(candidate);
	fireEvent.change(screen.getByLabelText("Düzenlenebilir çalışma dosyası"), {
		target: { files: [source] },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Aday Sürüm ve Yönetilen Kopyayı kaydet",
		})
	);

	expect(onImport).toHaveBeenCalledWith(candidate, source);
});

test("dropping an editable source file imports it with the selected export", async () => {
	const user = userEvent.setup();
	const { onImport } = renderUpload();
	const candidate = makeCandidateFile();
	const source = sourceFile();
	selectCandidate(candidate);
	fireEvent.drop(
		screen.getByRole("button", {
			name: "Düzenlenebilir çalışma dosyası seç, sürükle veya yapıştır",
		}),
		{
			dataTransfer: {
				files: { item: (index: number) => (index === 0 ? source : null) },
			},
		}
	);

	await user.click(
		screen.getByRole("button", {
			name: "Aday Sürüm ve Yönetilen Kopyayı kaydet",
		})
	);

	expect(onImport).toHaveBeenCalledWith(candidate, source);
});

test("pasting an editable source file imports it with the selected export", async () => {
	const user = userEvent.setup();
	const { onImport } = renderUpload();
	const candidate = makeCandidateFile();
	const source = sourceFile();
	selectCandidate(candidate);
	fireEvent.paste(
		screen.getByRole("button", {
			name: "Düzenlenebilir çalışma dosyası seç, sürükle veya yapıştır",
		}),
		{
			clipboardData: {
				files: { item: (index: number) => (index === 0 ? source : null) },
			},
		}
	);

	await user.click(
		screen.getByRole("button", {
			name: "Aday Sürüm ve Yönetilen Kopyayı kaydet",
		})
	);

	expect(onImport).toHaveBeenCalledWith(candidate, source);
});
