import type { ProjectContextCreateInput } from "@sprite-anvil/api/project-context";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm } from "@tanstack/react-form";
import { projectSetupFormSchema } from "../../schemas";

interface ProjectSetupFormProps {
	isCheckingOutcome?: boolean;
	isOutcomeUncertain?: boolean;
	isPending: boolean;
	onCancel?: () => void;
	onCheckOutcome?: () => void;
	onSubmit: (input: ProjectContextCreateInput) => void;
}

export function ProjectSetupForm({
	isCheckingOutcome = false,
	isOutcomeUncertain = false,
	isPending,
	onCancel,
	onCheckOutcome,
	onSubmit,
}: ProjectSetupFormProps) {
	const form = useForm({
		defaultValues: { name: "", generalArtDirection: "" },
		onSubmit: ({ value }) => {
			if (isOutcomeUncertain) {
				return;
			}
			onSubmit(value);
		},
		validators: { onSubmit: projectSetupFormSchema },
	});

	return (
		<section className="context-panel project-setup">
			<div className="panel-heading">
				<div>
					<p className="panel-index">PROJECT FOUNDATION</p>
					<h2>{onCancel ? "New project" : "Create your first project"}</h2>
				</div>
				{onCancel ? (
					<Button className="quiet-button" onClick={onCancel} type="button">
						Cancel
					</Button>
				) : null}
			</div>
			<p className="panel-copy">
				A project name and art direction are enough to get started. This step
				creates an empty base revision; it does not activate a rule.
			</p>
			<form
				className="context-form"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field name="name">
					{(field) => (
						<Label className="context-field">
							<span>Project name</span>
							<Input
								autoComplete="off"
								disabled={isPending || isOutcomeUncertain}
								maxLength={120}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="e.g. Moonlit Vale"
								required
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				<form.Field name="generalArtDirection">
					{(field) => (
						<Label className="context-field">
							<span>Art direction</span>
							<Textarea
								disabled={isPending || isOutcomeUncertain}
								maxLength={1000}
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								placeholder="Describe the visual world of the game in a few sentences."
								required
								rows={3}
								value={field.state.value}
							/>
						</Label>
					)}
				</form.Field>
				{isOutcomeUncertain && onCheckOutcome ? (
					<Button
						className="quiet-button"
						disabled={isCheckingOutcome}
						onClick={onCheckOutcome}
						type="button"
					>
						{isCheckingOutcome ? "Checking status…" : "Check status"}
					</Button>
				) : null}
				<Button
					className="signal-button"
					disabled={isPending || isOutcomeUncertain}
					type="submit"
				>
					{isPending ? "Creating…" : "Create project"}
				</Button>
			</form>
		</section>
	);
}
