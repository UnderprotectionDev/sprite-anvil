import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm } from "@tanstack/react-form";
import { useState } from "react";
import { StatusMessage } from "@/components/status-message";
import type {
	OfflineStagingStore,
	StageableDraft,
} from "../../lib/offline-staging-store";
import { toStagedOperation } from "../../lib/staged-operation";
import { stagedOperationFormSchema } from "../../schemas";

type Tool = "pen" | "eraser" | "fill";

const refusalText = {
	invalid: "That edit is not a valid Working Draft operation.",
	limit: "This Working Draft reached the operation limit.",
	missing: "This staged Working Draft is no longer in this browser.",
} as const;

/**
 * Adds one pixel edit to a staged Working Draft. It is kept in this browser as
 * a local operation over the pinned base, so it works offline and survives a
 * reload; the cloud takes it at the reconnect check.
 */
export function StageOperationForm({
	draft,
	onAdded,
	store,
}: {
	draft: StageableDraft;
	onAdded: () => Promise<unknown>;
	store: Pick<OfflineStagingStore, "addStagedOperation">;
}) {
	const [message, setMessage] = useState<string | null>(null);
	const form = useForm({
		defaultValues: { tool: "pen" as Tool, x: "0", y: "0", color: "#000000" },
		validators: { onSubmit: stagedOperationFormSchema(draft.size) },
		onSubmit: async ({ value }) => {
			const parsed = stagedOperationFormSchema(draft.size).parse(value);
			const result = await store.addStagedOperation(
				draft.id,
				toStagedOperation(parsed)
			);
			setMessage(
				result === "added"
					? `Edit saved in this browser (${draft.appliedOperationCount + 1} operation(s) now).`
					: refusalText[result]
			);
			await onAdded();
		},
	});
	const idPrefix = `stage-edit-${draft.id}`;
	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="font-medium text-sm">Add a pixel edit while offline</p>
			<fieldset className="grid grid-cols-2 gap-2 sm:grid-cols-4">
				<legend className="sr-only">Pixel edit</legend>
				<form.Field name="tool">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor={`${idPrefix}-tool`}>
							<span>Tool</span>
							<NativeSelect
								className="w-full"
								id={`${idPrefix}-tool`}
								onChange={(event) =>
									field.handleChange(event.target.value as Tool)
								}
								value={field.state.value}
							>
								<NativeSelectOption value="pen">Pen</NativeSelectOption>
								<NativeSelectOption value="eraser">Eraser</NativeSelectOption>
								<NativeSelectOption value="fill">Fill</NativeSelectOption>
							</NativeSelect>
						</Label>
					)}
				</form.Field>
				<form.Field name="color">
					{(field) => (
						<Label className="space-y-1 text-xs" htmlFor={`${idPrefix}-color`}>
							<span>Colour</span>
							<Input
								className="h-8 w-12 p-0.5"
								id={`${idPrefix}-color`}
								onChange={(event) => field.handleChange(event.target.value)}
								type="color"
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{(["x", "y"] as const).map((name) => (
					<form.Field key={name} name={name}>
						{(field) => (
							<Label
								className="space-y-1 text-xs"
								htmlFor={`${idPrefix}-${name}`}
							>
								<span>{name === "x" ? "Pixel x" : "Pixel y"}</span>
								<Input
									id={`${idPrefix}-${name}`}
									inputMode="numeric"
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
								{field.state.meta.errors.length > 0 ? (
									<StatusMessage tone="error">
										{field.state.meta.errors
											.map((error) =>
												typeof error === "string" ? error : error?.message
											)
											.join(" ")}
									</StatusMessage>
								) : null}
							</Label>
						)}
					</form.Field>
				))}
			</fieldset>
			<Button size="sm" type="submit" variant="outline">
				Add edit to the staged draft
			</Button>
			{message ? <p role="status">{message}</p> : null}
		</form>
	);
}
