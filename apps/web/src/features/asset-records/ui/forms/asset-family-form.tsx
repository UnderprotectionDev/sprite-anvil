import type { AssetRecordTrackingDetail } from "@sprite-anvil/api/asset-record-tracking";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { useForm, useSelector } from "@tanstack/react-form";
import { assetFamilyFormSchema, assetFamilySubmitSchema } from "../../schemas";

const assetFamilyDefaults = {
	familyName: "",
	familyUseContext: "",
	visualWorldId: "",
};

export type AssetFamilyValues = typeof assetFamilyDefaults;

export function useAssetFamilyForm(
	onSubmit: (values: AssetFamilyValues) => Promise<void>
) {
	return useForm({
		defaultValues: assetFamilyDefaults,
		onSubmit: ({ value }) => onSubmit(value),
		validators: { onSubmit: assetFamilySubmitSchema },
	});
}

export function AssetFamilyForm({
	approvedFileName,
	busy,
	form,
	visualWorlds,
}: {
	approvedFileName: string;
	busy: boolean;
	form: ReturnType<typeof useAssetFamilyForm>;
	visualWorlds: AssetRecordTrackingDetail["tracking"]["visualWorlds"];
}) {
	const values = useSelector(form.store, (state) => state.values);
	return (
		<form
			className="mt-4 space-y-3 border-t pt-3"
			onSubmit={(event) => {
				event.preventDefault();
				event.stopPropagation();
				form.handleSubmit();
			}}
		>
			<h4 className="text-sm font-medium">Create family for Derived Assets</h4>
			<form.Field name="familyName">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="family-name"
					>
						<span>Family name</span>
						<Input
							id="family-name"
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<form.Field name="visualWorldId">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="family-world"
					>
						<span>Visual World</span>
						<NativeSelect
							className="w-full"
							id="family-world"
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						>
							<NativeSelectOption value="">
								Select a Visual World
							</NativeSelectOption>
							{visualWorlds.map((world) => (
								<NativeSelectOption key={world.id} value={world.id}>
									{world.name}
								</NativeSelectOption>
							))}
						</NativeSelect>
					</Label>
				)}
			</form.Field>
			<form.Field name="familyUseContext">
				{(field) => (
					<Label
						className="block space-y-1 text-sm leading-normal"
						htmlFor="family-use-context"
					>
						<span>Usage context</span>
						<Input
							id="family-use-context"
							onChange={(event) => field.handleChange(event.target.value)}
							required
							value={field.state.value}
						/>
					</Label>
				)}
			</form.Field>
			<p className="text-muted-foreground text-xs">
				The Approved Version will be used as the Canonical Design:{" "}
				{approvedFileName}.
			</p>
			<Button
				disabled={busy || !assetFamilyFormSchema.safeParse(values).success}
				type="submit"
			>
				Create family
			</Button>
		</form>
	);
}
