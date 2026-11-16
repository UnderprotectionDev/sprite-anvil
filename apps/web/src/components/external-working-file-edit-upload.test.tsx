// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { ExternalWorkingFileEditUpload } from "@/components/external-working-file-edit-upload";

afterEach(cleanup);

function renderUpload() {
	const onImport = vi.fn().mockResolvedValue(true);
	render(<ExternalWorkingFileEditUpload onImport={onImport} />);
	return { onImport };
}

function selectCandidate(file: File) {
	fireEvent.change(screen.getByLabelText("PNG/WebP export"), {
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
	fireEvent.change(screen.getByLabelText("Editable working file"), {
		target: { files: [source] },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
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
			name: "Select, drop, or paste editable working file",
		}),
		{
			dataTransfer: {
				files: { item: (index: number) => (index === 0 ? source : null) },
			},
		}
	);

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
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
			name: "Select, drop, or paste editable working file",
		}),
		{
			clipboardData: {
				files: { item: (index: number) => (index === 0 ? source : null) },
			},
		}
	);

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	);

	expect(onImport).toHaveBeenCalledWith(candidate, source);
});

test("an unsupported export is rejected with its message and blocks saving", () => {
	renderUpload();
	selectCandidate(
		new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" })
	);

	expect(screen.getByRole("alert")).toHaveTextContent(
		"The Candidate Version file must be a nonempty PNG or WebP."
	);
	expect(
		screen.getByRole("button", {
			name: "Select, drop, or paste PNG/WebP export",
		})
	).toHaveTextContent("Select, drop, or paste file");
	expect(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	).toBeDisabled();
});

test("an empty editable source file is rejected and a valid choice clears the message", () => {
	renderUpload();
	const sourceInput = screen.getByLabelText("Editable working file");
	fireEvent.change(sourceInput, {
		target: { files: [new File([], "empty.aseprite")] },
	});

	expect(screen.getByRole("alert")).toHaveTextContent(
		"The working file must be nonempty and no larger than 100 MB."
	);

	fireEvent.change(sourceInput, { target: { files: [sourceFile()] } });

	expect(screen.queryByRole("alert")).toBeNull();
	expect(
		screen.getByRole("button", {
			name: "Select, drop, or paste editable working file",
		})
	).toHaveTextContent("Ash Knight.aseprite");
});

test("a successful import clears both selected files", async () => {
	const user = userEvent.setup();
	renderUpload();
	selectCandidate(makeCandidateFile());
	fireEvent.change(screen.getByLabelText("Editable working file"), {
		target: { files: [sourceFile()] },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	);

	expect(
		await screen.findAllByText("Select, drop, or paste file")
	).toHaveLength(2);
	expect(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	).toBeDisabled();
});

test("an incomplete import keeps the files and asks for a retry with the same files", async () => {
	const user = userEvent.setup();
	const onImport = vi.fn().mockResolvedValue(false);
	render(<ExternalWorkingFileEditUpload onImport={onImport} />);
	selectCandidate(makeCandidateFile());
	fireEvent.change(screen.getByLabelText("Editable working file"), {
		target: { files: [sourceFile()] },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	);

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Upload did not complete. Retry with the same files."
	);
	expect(screen.getByText("ash-knight.webp")).toBeTruthy();
	expect(screen.getByText("Ash Knight.aseprite")).toBeTruthy();
	expect(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	).toBeEnabled();
});

test("a failed import shows a retry message and disables controls while saving", async () => {
	const user = userEvent.setup();
	let rejectImport: (reason: unknown) => void = () => undefined;
	const onImport = vi.fn(
		() =>
			new Promise<boolean>((_resolve, reject) => {
				rejectImport = reject;
			})
	);
	render(<ExternalWorkingFileEditUpload onImport={onImport} />);
	selectCandidate(makeCandidateFile());
	fireEvent.change(screen.getByLabelText("Editable working file"), {
		target: { files: [sourceFile()] },
	});

	await user.click(
		screen.getByRole("button", {
			name: "Save Candidate Version and Managed Snapshot",
		})
	);

	expect(
		await screen.findByRole("button", {
			name: "Saving Candidate Version and Managed Snapshot…",
		})
	).toBeDisabled();
	expect(
		screen.getByRole("button", {
			name: "Select, drop, or paste editable working file",
		})
	).toBeDisabled();
	rejectImport(new Error("offline"));

	expect(await screen.findByRole("alert")).toHaveTextContent(
		"Could not import files. Try again."
	);
	expect(onImport).toHaveBeenCalledTimes(1);
});

test("disabled uploads keep every control disabled", () => {
	render(<ExternalWorkingFileEditUpload disabled onImport={vi.fn()} />);

	for (const button of screen.getAllByRole("button")) {
		expect(button).toBeDisabled();
	}
	expect(screen.getByLabelText("PNG/WebP export")).toBeDisabled();
	expect(screen.getByLabelText("Editable working file")).toBeDisabled();
});
