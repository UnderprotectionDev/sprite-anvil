// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { StyleModules } from "./style-modules";

afterEach(cleanup);

it("lets a user select existing rules for a module proposal", async () => {
	const create = vi.fn();
	render(
		<StyleModules
			copy={vi.fn()}
			create={create}
			project={
				{
					id: "p",
					currentContextRevision: {
						id: "r",
						rules: [
							{
								id: "outline",
								scope: { kind: "project", id: "p" },
								value: { type: "text", value: "dark" },
							},
						],
					},
				} as never
			}
			projects={[]}
		/>
	);
	fireEvent.change(screen.getByLabelText("Style Module name"), {
		target: { value: "Ink" },
	});
	fireEvent.click(screen.getByRole("checkbox", { name: "outline · project" }));
	fireEvent.click(screen.getByRole("button", { name: "Propose Style Module" }));
	await vi.waitFor(() =>
		expect(create).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Ink",
				rules: [{ ruleId: "outline", scope: { kind: "project", id: "p" } }],
			})
		)
	);
});

it("copies a selected module from another project into a proposal", async () => {
	const copy = vi.fn();
	render(
		<StyleModules
			copy={copy}
			create={vi.fn()}
			project={
				{
					id: "target",
					currentContextRevision: { id: "target-revision", rules: [] },
				} as never
			}
			projects={[
				{
					id: "source",
					name: "Source",
					currentContextRevision: {
						id: "source-revision",
						rules: [{ styleModule: { id: "module", name: "Ink", version: 2 } }],
					},
				} as never,
			]}
		/>
	);
	fireEvent.change(screen.getByLabelText("Style Module to copy"), {
		target: { value: "module" },
	});
	fireEvent.click(screen.getByRole("button", { name: "Copy to proposal" }));
	await vi.waitFor(() =>
		expect(copy).toHaveBeenCalledWith({
			projectId: "target",
			baseContextRevisionId: "target-revision",
			sourceProjectId: "source",
			sourceRevisionId: "source-revision",
			moduleId: "module",
			idempotencyKey: expect.any(String),
		})
	);
});

it.each(["create", "copy"])(
	"retries %s with the same key and starts a new action after success",
	async (operation) => {
		const request = vi
			.fn()
			.mockRejectedValueOnce(new Error("Network error"))
			.mockResolvedValue(undefined);
		render(
			<StyleModules
				copy={operation === "copy" ? request : vi.fn()}
				create={operation === "create" ? request : vi.fn()}
				project={
					{
						id: "target",
						currentContextRevision: { id: "revision", rules: [] },
					} as never
				}
				projects={[
					{
						id: "source",
						name: "Source",
						currentContextRevision: {
							id: "source-revision",
							rules: [
								{ styleModule: { id: "module", name: "Ink", version: 1 } },
							],
						},
					} as never,
				]}
			/>
		);
		if (operation === "create") {
			fireEvent.change(screen.getByLabelText("Style Module name"), {
				target: { value: "Ink" },
			});
		} else {
			fireEvent.change(screen.getByLabelText("Style Module to copy"), {
				target: { value: "module" },
			});
		}
		const button = screen.getByRole("button", {
			name:
				operation === "create" ? "Propose Style Module" : "Copy to proposal",
		});
		fireEvent.click(button);
		await vi.waitFor(() =>
			expect(screen.getByText("Network error")).toBeTruthy()
		);
		fireEvent.click(button);
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2));
		expect(request.mock.calls[0][0].idempotencyKey).toEqual(expect.any(String));
		expect(request.mock.calls[1][0].idempotencyKey).toBe(
			request.mock.calls[0][0].idempotencyKey
		);
		await vi.waitFor(() =>
			expect(screen.queryByText("Network error")).toBeNull()
		);
		fireEvent.click(button);
		await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(3));
		expect(request.mock.calls[2][0].idempotencyKey).not.toBe(
			request.mock.calls[1][0].idempotencyKey
		);
	}
);

it("keeps each unresolved payload key when inputs change and change back", async () => {
	const create = vi.fn().mockRejectedValue(new Error("Network error"));
	render(
		<StyleModules
			copy={vi.fn()}
			create={create}
			project={
				{ id: "p", currentContextRevision: { id: "r", rules: [] } } as never
			}
			projects={[]}
		/>
	);
	const name = screen.getByLabelText("Style Module name");
	const submit = screen.getByRole("button", { name: "Propose Style Module" });
	fireEvent.change(name, { target: { value: "Ink" } });
	fireEvent.click(submit);
	await vi.waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());
	fireEvent.change(name, { target: { value: "Paint" } });
	fireEvent.click(submit);
	await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(2));
	fireEvent.change(name, { target: { value: "Ink" } });
	fireEvent.click(submit);
	await vi.waitFor(() => expect(create).toHaveBeenCalledTimes(3));
	expect(create.mock.calls[1][0].idempotencyKey).not.toBe(
		create.mock.calls[0][0].idempotencyKey
	);
	expect(create.mock.calls[2][0].idempotencyKey).toBe(
		create.mock.calls[0][0].idempotencyKey
	);
});
