// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { StyleModules } from "./style-modules";

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
		})
	);
});
