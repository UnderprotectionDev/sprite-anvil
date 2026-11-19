import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import {
	candidateVersionFormSchema,
	candidateVersionSubmitSchema,
} from "../../schemas";

const candidateVersionDefaults = {
	file: null as File | null,
	knownSource: "",
	supportingEvidence: "",
	unknownHistoryDetails: "",
	userRelationship: "unknown" as
		| "created_by_user"
		| "received_from_team"
		| "licensed_third_party"
		| "unknown",
};

export type CandidateVersionValues = typeof candidateVersionDefaults;

export function useCandidateVersionForm(
	onSubmit: (values: CandidateVersionValues) => Promise<void>
) {
	return useForm({
		defaultValues: candidateVersionDefaults,
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: candidateVersionSubmitSchema },
	});
}

export function CandidateVersionForm({
	busy,
	form,
	saving,
}: {
	busy: boolean;
	form: ReturnType<typeof useCandidateVersionForm>;
	saving: boolean;
}) {
	const values = useSelector(form.store, (state) => state.values);
	return (
		<form
			className="mt-4 space-y-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<form.Field name="file">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="asset-version-file"
					>
						<span>PNG or WebP file</span>
						<Input
							accept="image/png,image/webp"
							id="asset-version-file"
							onChange={(event) =>
								field.handleChange(event.target.files?.[0] ?? null)
							}
							required
							type="file"
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="unknownHistoryDetails">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="asset-version-missing-history"
					>
						<span>Unknown production history</span>
						<Textarea
							className="min-h-20 w-full"
							id="asset-version-missing-history"
							maxLength={1000}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Describe the unknown production information."
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="knownSource">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="asset-version-source"
					>
						<span>Known source</span>
						<Input
							id="asset-version-source"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="userRelationship">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="asset-version-relationship"
					>
						<span>Your relationship to the asset</span>
						<NativeSelect
							className="w-full"
							id="asset-version-relationship"
							onChange={(event) =>
								field.handleChange(
									event.target.value as typeof field.state.value
								)
							}
							value={field.state.value}
						>
							<NativeSelectOption value="unknown">Unknown</NativeSelectOption>
							<NativeSelectOption value="created_by_user">
								I created it
							</NativeSelectOption>
							<NativeSelectOption value="received_from_team">
								Received from team
							</NativeSelectOption>
							<NativeSelectOption value="licensed_third_party">
								Licensed third party
							</NativeSelectOption>
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="supportingEvidence">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="asset-version-evidence"
					>
						<span>Supporting evidence</span>
						<Textarea
							className="min-h-20 w-full"
							id="asset-version-evidence"
							onChange={(event) => field.handleChange(event.target.value)}
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<p className="text-muted-foreground text-xs">
				Legacy production history will be recorded as unknown.
			</p>
			<Button
				disabled={busy || !candidateVersionFormSchema.safeParse(values).success}
				type="submit"
			>
				{saving ? "Saving…" : "Save Candidate Version"}
			</Button>
		</form>
	);
}
