import type { AssetVersion } from "@sprite-anvil/api/asset-versions";
import type { MarketingUsageReviewInput } from "@sprite-anvil/api/marketing-usage-reviews";
import {
	createMarketingUsageReviewPackage,
	marketingUsageItemSchema,
	marketingUsageReviewInputSchema,
} from "@sprite-anvil/api/marketing-usage-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useSelector } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import {
	StatusMessage,
	WriteOutcomeMessage,
} from "@/components/status-message";
import { ENV } from "@/env";
import {
	isWriteOutcomeUncertain,
	showErrorToast,
} from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";
import { MarketingUsagePreview } from "./marketing-usage-preview";

type Version = Pick<
	AssetVersion,
	| "id"
	| "assetRecordId"
	| "versionNumber"
	| "previewUrl"
	| "sourceImageDimensions"
>;
type Item = MarketingUsageReviewInput["items"][number];
const serverUrl = ENV.VITE_SERVER_URL?.replace(/\/$/u, "") ?? "";
const geometryLabels = {
	crop: "Crop",
	safeArea: "Safe area",
	displaySize: "Small usage size",
};
const observationLabels = {
	readability: "Readability at small size",
	safeArea: "Safe area result",
	crop: "Crop result",
};
const outcomeLabels = {
	passed: "Pass",
	failed: "Fail",
	inconclusive: "Inconclusive",
};
const purposeLabels = {
	logo: "Logo",
	opening: "Splash",
	store: "Store",
	marketing: "Marketing",
};
function initialItem(version: Version): Item {
	const size = version.sourceImageDimensions ?? { width: 1, height: 1 };
	return {
		assetRecordId: version.assetRecordId,
		assetVersionId: version.id,
		usePurpose: "logo",
		naturalSize: size,
		crop: { x: 0, y: 0, ...size },
		safeArea: { x: 0, y: 0, ...size },
		displaySize: { width: 64, height: 64 },
		presentation: "transparent",
		opaqueColor: null,
		observations: ["light", "dark"].map((background) => ({
			background: background as "light" | "dark",
			readability: "inconclusive",
			safeArea: "inconclusive",
			crop: "inconclusive",
			notes: "",
		})),
	};
}
export function MarketingUsageReviewManager({
	activation,
	projectId,
	family,
	canonicalDesignId,
	versions,
}: {
	activation: ProjectProfileContractActivation;
	projectId: string;
	family: { id: string; name: string; visualWorldId: string };
	canonicalDesignId: string | null;
	versions: Version[];
}) {
	const prefix = useId();
	const [defaultValues] = useState(() => ({
		item: initialItem(
			versions[0] ?? {
				id: "",
				assetRecordId: "",
				versionNumber: 1,
				previewUrl: "",
				sourceImageDimensions: null,
			}
		),
	}));
	const form = useForm({
		defaultValues,
		onSubmit: () => submit(),
	});
	const item = useSelector(form.store, (state) => state.values.item);
	const saveMutation = useMutation(
		orpc.marketingUsageReviews.save.mutationOptions({
			...mutationMeta,
			onSuccess: async (_saved, input) => {
				const reread = await query.refetch();
				if (
					reread.isError ||
					!reread.data?.some((record) => record.id === input.id)
				) {
					setUncertainId(input.id);
					setMessage(
						"Review saved, but reloading could not be verified. Check current records."
					);
				} else {
					setMessage("Review verified from the saved record.");
				}
			},
		})
	);
	const saving = saveMutation.isPending;
	const [uncertainId, setUncertainId] = useState<string | null>(null);
	const [message, setMessage] = useState("");
	const [readyKey, setReadyKey] = useState<string | null>(null);
	const query = useQuery(
		orpc.marketingUsageReviews.list.queryOptions({
			input: { projectId, assetFamilyId: family.id },
		})
	);
	const version = versions.find(
		(candidate) => candidate.id === item.assetVersionId
	);
	const previewKey = JSON.stringify([
		item.assetVersionId,
		item.crop,
		item.safeArea,
		item.displaySize,
		item.presentation,
		item.opaqueColor,
		version?.previewUrl,
	]);
	const geometryValid = marketingUsageItemSchema.safeParse({
		...item,
		observations: item.observations.map((observation) => ({
			...observation,
			notes: "preview",
		})),
	}).success;
	async function checkRecords() {
		const result = await query.refetch();
		if (
			!result.isError &&
			result.data?.some((record) => record.id === uncertainId)
		) {
			setUncertainId(null);
			setMessage("Review verified from the saved record.");
		} else {
			setMessage(
				"The result could not yet be verified. Check current records before resubmitting the same review."
			);
		}
	}
	async function submit() {
		const result = marketingUsageReviewInputSchema.safeParse({
			id: crypto.randomUUID(),
			projectId,
			assetFamilyId: family.id,
			contractRevisionId: activation.contractRevisionId,
			visualWorldId: family.visualWorldId,
			canonicalDesignId,
			items: [item],
		});
		if (!result.success) {
			setMessage(result.error.issues[0]?.message ?? "Check usage details.");
			return;
		}
		if (readyKey !== previewKey) {
			setMessage("Wait for previews to load.");
			return;
		}
		setMessage("");
		try {
			await saveMutation.mutateAsync(result.data);
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				showErrorToast(error, { kind: "mutation" });
				setUncertainId(result.data.id);
				setMessage("Save result is uncertain. Check current records.");
			} else {
				setMessage(getErrorMessage(error, "Could not save review."));
			}
		}
	}
	return (
		<section className="space-y-4 rounded-md border p-4">
			<h3 className="font-semibold">
				Test Logo and Marketing Uses · {family.name}
			</h3>
			<p className="text-muted-foreground text-sm">
				Crop and safe area are measured in pixels from the source image’s
				top-left corner. You assess small usage; in-game pixel scale is not
				applied. Portrait expression review is separate.
			</p>
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<FieldSet
					className="space-y-4"
					disabled={saving || uncertainId !== null}
				>
					<form.Field name="item">
						{(field) => (
							<MarketingUsageItemFields
								familyName={family.name}
								field={field}
								geometryValid={geometryValid}
								onPreviewReady={(ready) =>
									setReadyKey(ready ? previewKey : null)
								}
								onVersionSelected={() => setReadyKey(null)}
								prefix={prefix}
								previewBaseUrl={serverUrl}
								previewKey={previewKey}
								version={version}
								versions={versions}
							/>
						)}
					</form.Field>
					<Button
						disabled={
							readyKey !== previewKey || query.isPending || query.isError
						}
						type="submit"
					>
						{saving ? "Kaydediliyor…" : "Save usage review"}
					</Button>
				</FieldSet>
			</form>
			<WriteOutcomeMessage message={message} uncertain={uncertainId !== null} />
			{uncertainId ? (
				<Button onClick={checkRecords} type="button" variant="outline">
					Check current records
				</Button>
			) : null}
			{query.isError ? (
				<div className="space-y-2">
					<StatusMessage tone="error">Could not load reviews.</StatusMessage>
					<Button onClick={() => query.refetch()} type="button">
						Retry
					</Button>
				</div>
			) : null}
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<li className="rounded border p-3" key={record.id}>
						<p>{new Date(record.createdAt).toLocaleString("en-US")}</p>
						{record.items.map((usage) => (
							<div key={JSON.stringify(usage)}>
								<p>
									{purposeLabels[usage.usePurpose]} · {usage.displaySize.width}{" "}
									× {usage.displaySize.height} px ·{" "}
									{usage.presentation === "opaque" ? "Opak" : "Transparent"}
								</p>
								{usage.observations.map((observation) => (
									<p key={observation.background}>
										{observation.background === "light" ? "Light" : "Dark"}:{" "}
										{outcomeLabels[observation.readability]} /{" "}
										{outcomeLabels[observation.safeArea]} /{" "}
										{outcomeLabels[observation.crop]} · {observation.notes}
									</p>
								))}
							</div>
						))}
						<Button
							onClick={() => {
								const blob = new Blob(
									[
										JSON.stringify(
											createMarketingUsageReviewPackage(record),
											null,
											2
										),
									],
									{ type: "application/json" }
								);
								const url = URL.createObjectURL(blob);
								const link = document.createElement("a");
								link.href = url;
								link.download = `marketing-usage-${record.id}.json`;
								link.click();
								URL.revokeObjectURL(url);
							}}
							type="button"
							variant="outline"
						>
							Download usage evidence
						</Button>
					</li>
				))}
			</ul>
		</section>
	);
}

function MarketingUsageItemFields({
	familyName,
	field,
	geometryValid,
	onPreviewReady,
	onVersionSelected,
	prefix,
	previewKey,
	previewBaseUrl,
	version,
	versions,
}: {
	familyName: string;
	field: {
		handleChange: (item: Item) => void;
		state: { value: Item };
	};
	geometryValid: boolean;
	onPreviewReady: (ready: boolean) => void;
	onVersionSelected: () => void;
	prefix: string;
	previewKey: string;
	previewBaseUrl: string;
	version: Version | undefined;
	versions: Version[];
}) {
	const item = field.state.value;
	const update = (patch: Partial<Item>) =>
		field.handleChange({ ...item, ...patch });
	return (
		<>
			<Label className="block">
				Asset Version
				<NativeSelect
					aria-label="Asset Version"
					className="block w-full"
					onChange={(event) => {
						const selected = versions.find(
							(candidate) => candidate.id === event.target.value
						);
						if (selected) {
							field.handleChange(initialItem(selected));
							onVersionSelected();
						}
					}}
					value={item.assetVersionId}
				>
					{versions.map((candidate) => (
						<NativeSelectOption key={candidate.id} value={candidate.id}>
							Version {candidate.versionNumber} · {candidate.id.slice(0, 8)}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<Label className="block">
				Usage purpose
				<NativeSelect
					aria-label="Usage purpose"
					className="block"
					onChange={(event) =>
						update({
							usePurpose: event.target.value as Item["usePurpose"],
						})
					}
					value={item.usePurpose}
				>
					{Object.entries(purposeLabels).map(([value, label]) => (
						<NativeSelectOption key={value} value={value}>
							{label}
						</NativeSelectOption>
					))}
				</NativeSelect>
			</Label>
			<div className="grid gap-4 sm:grid-cols-3">
				{(["crop", "safeArea", "displaySize"] as const).map((key) => (
					<FieldSet className="space-y-2 rounded border p-3" key={key}>
						<FieldLegend>{geometryLabels[key]}</FieldLegend>
						{Object.entries(item[key]).map(([name, value]) => (
							<Label className="block text-sm" key={name}>
								{name}
								<Input
									aria-label={`${key} ${name}`}
									className="block w-full"
									max={32_768}
									min={name === "x" || name === "y" ? 0 : 1}
									onChange={(event) =>
										update({
											[key]: {
												...item[key],
												[name]: Number(event.target.value),
											},
										})
									}
									required
									step={1}
									type="number"
									value={value}
								/>
							</Label>
						))}
					</FieldSet>
				))}
			</div>
			<Label className="block">
				Sunum
				<NativeSelect
					aria-label="Sunum"
					className="block"
					onChange={(event) =>
						update({
							presentation: event.target.value as Item["presentation"],
							opaqueColor: event.target.value === "opaque" ? "#ffffff" : null,
						})
					}
					value={item.presentation}
				>
					<NativeSelectOption value="transparent">
						Transparent
					</NativeSelectOption>
					<NativeSelectOption value="opaque">Opak</NativeSelectOption>
				</NativeSelect>
			</Label>
			{item.presentation === "opaque" ? (
				<Label className="block">
					Opaque background color
					<Input
						aria-label="Opaque background color"
						className="block h-auto w-auto"
						onChange={(event) => update({ opaqueColor: event.target.value })}
						type="color"
						value={item.opaqueColor ?? "#ffffff"}
					/>
				</Label>
			) : null}
			{geometryValid && version ? (
				<MarketingUsagePreview
					item={item}
					key={previewKey}
					name={familyName}
					onReady={onPreviewReady}
					previewUrl={`${previewBaseUrl}${version.previewUrl}`}
				/>
			) : (
				<StatusMessage tone="error">
					Keep the crop and safe area within the source dimensions.
				</StatusMessage>
			)}
			{item.observations.map((observation, index) => (
				<FieldSet
					className="space-y-3 rounded border p-3"
					key={observation.background}
				>
					<FieldLegend>
						{observation.background === "light"
							? "Light background assessment"
							: "Dark background assessment"}
					</FieldLegend>
					{(["readability", "safeArea", "crop"] as const).map((key) => (
						<Label
							className="block"
							htmlFor={`${prefix}-${index}-${key}`}
							key={key}
						>
							{observationLabels[key]}
							<NativeSelect
								className="block"
								id={`${prefix}-${index}-${key}`}
								onChange={(event) =>
									update({
										observations: item.observations.map((entry, i) =>
											i === index
												? {
														...entry,
														[key]: event.target.value,
													}
												: entry
										),
									})
								}
								value={observation[key]}
							>
								{Object.entries(outcomeLabels).map(([value, label]) => (
									<NativeSelectOption key={value} value={value}>
										{label}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Label>
					))}
					<div>
						<Label className="block" htmlFor={`${prefix}-${index}-notes`}>
							Observation
						</Label>
						<Textarea
							className="block w-full"
							id={`${prefix}-${index}-notes`}
							maxLength={2000}
							onChange={(event) =>
								update({
									observations: item.observations.map((entry, i) =>
										i === index
											? { ...entry, notes: event.target.value }
											: entry
									),
								})
							}
							required
							value={observation.notes}
						/>
					</div>
				</FieldSet>
			))}
		</>
	);
}
