import { dependencyFacets } from "@sprite-anvil/api/asset-record-tracking";
import { Button } from "@sprite-anvil/ui/components/button";
import { Checkbox } from "@sprite-anvil/ui/components/checkbox";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useStore } from "@tanstack/react-form";
import {
	derivativeLinkFormSchema,
	derivativeLinkSubmitSchema,
} from "../../schemas";

type DependencyFacet = (typeof dependencyFacets)[number];

const dependencyFacetLabels: Record<DependencyFacet, string> = {
	equipment: "Ekipman",
	identity: "Kimlik",
	other: "Diğer",
	palette: "Palet",
	perspective: "Perspektif",
	silhouette: "Siluet",
	theme: "Tema",
	timing: "Zamanlama",
};

const derivativeLinkDefaults = {
	dependencyFacets: [] as DependencyFacet[],
	derivativeAssetRecordId: "",
};

export type DerivativeLinkValues = typeof derivativeLinkDefaults;

export function useDerivativeLinkForm(
	onSubmit: (values: DerivativeLinkValues) => Promise<void>
) {
	return useForm({
		defaultValues: derivativeLinkDefaults,
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: derivativeLinkSubmitSchema },
	});
}

export function DerivativeLinkForm({
	busy,
	familyLabel,
	form,
	options,
}: {
	busy: boolean;
	familyLabel: string;
	form: ReturnType<typeof useDerivativeLinkForm>;
	options: readonly { id: string; name: string }[];
}) {
	const values = useStore(form.store, (state) => state.values);
	return (
		<form
			className="mt-4 space-y-3 border-t pt-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<p className="text-sm">{familyLabel}</p>
			<form.Field name="derivativeAssetRecordId">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="derivative-record"
					>
						<span>Türetilmiş Asset Record</span>
						<NativeSelect
							className="w-full"
							id="derivative-record"
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						>
							<NativeSelectOption value="">Kayıt seçin</NativeSelectOption>
							{options.map((option) => (
								<NativeSelectOption key={option.id} value={option.id}>
									{option.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="dependencyFacets">
				{(field) => (
					<FieldSet className="gap-0 space-y-2">
						<FieldLegend className="mb-0">Bağımlılık Tanımı</FieldLegend>
						<div className="grid gap-2 sm:grid-cols-2">
							{dependencyFacets.map((facet) => (
								<Label className="text-sm leading-normal" key={facet}>
									<Checkbox
										checked={field.state.value.includes(facet)}
										onCheckedChange={(checked) =>
											field.handleChange(
												checked
													? [...new Set([...field.state.value, facet])]
													: field.state.value.filter((item) => item !== facet)
											)
										}
									/>
									<span>{dependencyFacetLabels[facet]}</span>
								</Label>
							))}
						</div>
					</FieldSet>
				)}
			</form.Field>
			<Button
				disabled={busy || !derivativeLinkFormSchema.safeParse(values).success}
				type="submit"
			>
				Türevi bağla
			</Button>
		</form>
	);
}
