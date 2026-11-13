import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { StatusMessage } from "@/components/status-message";
import { frameSourceFormSchema } from "../../schemas";

/** Adds a frame from, or replaces the selected frame with, another Asset Version of this project. */
export function FrameSourceForm({
	disabled,
	onAdd,
	onReplace,
}: {
	disabled: boolean;
	onAdd: (assetVersionId: string) => void;
	onReplace: (assetVersionId: string) => void;
}) {
	const form = useForm({
		defaultValues: { assetVersionId: "" },
		validators: { onSubmit: frameSourceFormSchema },
	});

	function run(action: (assetVersionId: string) => void) {
		const parsed = frameSourceFormSchema.safeParse(form.state.values);
		if (parsed.success) {
			action(parsed.data.assetVersionId);
		} else {
			form.handleSubmit();
		}
	}

	return (
		<form
			className="space-y-2"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="font-medium text-sm">Frame from another Asset Version</p>
			<form.Field name="assetVersionId">
				{(field) => (
					<Label className="block space-y-1 text-xs" htmlFor="frame-source-id">
						<span>Asset Version ID (same size as a cell)</span>
						<Input
							aria-invalid={field.state.meta.errors.length > 0}
							id="frame-source-id"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
						{field.state.meta.errors.length > 0 ? (
							<StatusMessage tone="error">
								Enter a valid Asset Version ID.
							</StatusMessage>
						) : null}
					</Label>
				)}
			</form.Field>
			<div className="flex flex-wrap gap-2">
				<Button
					disabled={disabled}
					onClick={() => run(onAdd)}
					size="sm"
					type="button"
					variant="outline"
				>
					Add as new frame
				</Button>
				<Button
					disabled={disabled}
					onClick={() => run(onReplace)}
					size="sm"
					type="button"
					variant="outline"
				>
					Replace selected frame
				</Button>
			</div>
		</form>
	);
}
