import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
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
	const values = useStore(form.store, (state) => state.values);
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
						<span>PNG veya WebP dosyası</span>
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
						<span>Bilinmeyen üretim geçmişi</span>
						<Textarea
							className="min-h-20 w-full"
							id="asset-version-missing-history"
							maxLength={1000}
							onChange={(event) => field.handleChange(event.target.value)}
							placeholder="Bilinmeyen üretim bilgilerini belirtin."
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
						<span>Bilinen kaynak</span>
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
						<span>Varlıkla ilişkiniz</span>
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
							<NativeSelectOption value="unknown">
								Bilinmiyor
							</NativeSelectOption>
							<NativeSelectOption value="created_by_user">
								Ben oluşturdum
							</NativeSelectOption>
							<NativeSelectOption value="received_from_team">
								Ekipten aldım
							</NativeSelectOption>
							<NativeSelectOption value="licensed_third_party">
								Lisanslı üçüncü taraf
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
						<span>Destekleyici kanıt</span>
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
				Eski üretim geçmişi bilinmiyor olarak kaydedilecek.
			</p>
			<Button
				disabled={busy || !candidateVersionFormSchema.safeParse(values).success}
				type="submit"
			>
				{saving ? "Kaydediliyor…" : "Aday sürümü kaydet"}
			</Button>
		</form>
	);
}
