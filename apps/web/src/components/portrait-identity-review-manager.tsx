import type {
	AssetFamilyCatalog,
	AssetFamilyRecord,
} from "@sprite-anvil/api/asset-families";
import type { AssetRecord } from "@sprite-anvil/api/asset-records";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import {
	type PortraitIdentityReviewInput,
	type PortraitIdentityReviewRecord,
	type PortraitReviewItem,
	portraitIdentityReviewInputSchema,
	portraitReviewObservationSchema,
} from "@sprite-anvil/api/portrait-identity-reviews";
import type { ProjectProfileContractActivation } from "@sprite-anvil/api/specialized-profile-contracts";
import { Button } from "@sprite-anvil/ui/components/button";
import { FieldLegend, FieldSet } from "@sprite-anvil/ui/components/field";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import { Textarea } from "@sprite-anvil/ui/components/textarea";
import { useForm, useStore } from "@tanstack/react-form";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";
import { StatusMessage } from "@/components/status-message";
import { portraitIdentityReviewFormSchema } from "@/features/portrait-marketing-profile/schemas";
import { PortraitReviewItemFields } from "@/features/portrait-marketing-profile/ui/components/portrait-review-item-fields";
import { isWriteOutcomeUncertain } from "@/utils/error-notification";
import { getErrorMessage } from "@/utils/get-error-message";
import { mutationMeta } from "@/utils/mutation-meta";
import { orpc } from "@/utils/orpc";

const observationFields = [
	["identity", "Identity consistency"],
	["expression", "Expression consistency"],
	["crop", "Crop and face visibility"],
] as const;
const outcomeLabels = {
	passed: "Pass",
	failed: "Fail",
	inconclusive: "Inconclusive",
};
interface Props {
	activation: ProjectProfileContractActivation;
	assetRecords: AssetRecord[];
	family: AssetFamilyRecord;
	familyCatalog: AssetFamilyCatalog;
	versionCatalog: AssetVersionCatalog;
}
interface ReviewItemEntry {
	key: string;
	value: PortraitReviewItem;
}
function makeItem(
	version: AssetVersionCatalog["assetVersions"][number]
): PortraitReviewItem {
	const naturalSize = version.sourceImageDimensions ?? { width: 1, height: 1 };
	return {
		assetRecordId: version.assetRecordId,
		assetVersionId: version.id,
		expression: "",
		usagePurpose: "dialogue",
		naturalSize,
		crop: { x: 0, y: 0, ...naturalSize },
		targetSize: { width: 160, height: 160 },
		background: "light",
	};
}
function SavedReview({ record }: { record: PortraitIdentityReviewRecord }) {
	return (
		<li className="space-y-2 rounded border p-3">
			<p>
				{record.familyName} · {outcomeLabels[record.outcome]} ·{" "}
				{new Date(record.createdAt).toLocaleString("en-US")}
			</p>
			<p>{record.rationale}</p>
			<details>
				<summary className="cursor-pointer">Show review details</summary>
				<p>
					Subject Identity: {record.subjectIdentityId} · Visual World:{" "}
					{record.visualWorldId} · Canonical Design:{" "}
					{record.canonicalAssetVersionId}
				</p>
				<ul>
					{record.items.map((item) => (
						<li key={JSON.stringify(item)}>
							{
								record.versionPins.find(
									(p) => p.assetVersionId === item.assetVersionId
								)?.assetRecordName
							}{" "}
							· {item.expression} ·{" "}
							{item.usagePurpose === "dialogue" ? "Dialogue" : "UI"} ·{" "}
							{item.targetSize.width} × {item.targetSize.height} px · Crop:{" "}
							{item.crop.x}, {item.crop.y}, {item.crop.width} ×{" "}
							{item.crop.height} ·{" "}
							{
								{ light: "Light", dark: "Dark", transparent: "Transparent" }[
									item.background
								]
							}
						</li>
					))}
				</ul>
				{observationFields.map(([key, label]) => (
					<p key={key}>
						{label}: {outcomeLabels[record.observations[key].outcome]} ·{" "}
						{record.observations[key].notes}
					</p>
				))}
				<p>Pinned contract: {record.contractRevisionId}</p>
			</details>
		</li>
	);
}
export function PortraitIdentityReviewManager({
	activation,
	family,
	familyCatalog,
	versionCatalog,
	assetRecords,
}: Props) {
	const formId = useId();
	const query = useQuery(
		orpc.portraitIdentityReviews.list.queryOptions({
			input: { projectId: family.projectId, assetFamilyId: family.id },
		})
	);
	const canonical = versionCatalog.canonicalDesigns
		.filter((c) => c.assetFamilyId === family.id)
		.at(-1);
	const names = new Map(assetRecords.map((r) => [r.id, r.name]));
	const eligibleRecords = new Set(
		assetRecords
			.filter(
				(r) =>
					r.assetCategory === "portrait_logo_marketing" &&
					r.availability !== "erased"
			)
			.map((r) => r.id)
	);
	const versions = versionCatalog.assetVersions.filter(
		(v) =>
			v.assetFamilyId === family.id &&
			eligibleRecords.has(v.assetRecordId) &&
			v.integrityVerified &&
			v.contentDigest &&
			v.sourceImageDimensions &&
			(v.id === canonical?.assetVersionId ||
				familyCatalog.relationships.some(
					(link) =>
						link.type === "derivative" &&
						link.assetFamilyId === family.id &&
						link.sourceAssetVersionId === canonical?.assetVersionId &&
						link.targetAssetRecordId === v.assetRecordId
				))
	);
	const [defaultValues] = useState(() => ({
		items: versions.slice(0, 2).map(
			(version): ReviewItemEntry => ({
				key: crypto.randomUUID(),
				value: makeItem(version),
			})
		),
		observations: {
			identity: { outcome: "inconclusive", notes: "" },
			expression: { outcome: "inconclusive", notes: "" },
			crop: { outcome: "inconclusive", notes: "" },
		} as PortraitIdentityReviewInput["observations"],
		rationale: "",
	}));
	const [ready, setReady] = useState<Set<string>>(() => new Set());
	const [pending, setPending] = useState<PortraitIdentityReviewInput | null>(
		null
	);
	const saveMutation = useMutation(
		orpc.portraitIdentityReviews.save.mutationOptions(mutationMeta)
	);
	const [saving, setSaving] = useState(false);
	const [message, setMessage] = useState("");
	const locked = saving || pending !== null;
	const form = useForm({
		defaultValues,
		onSubmit: ({ value }) => submit(value),
		validators: { onSubmit: portraitIdentityReviewFormSchema },
	});
	const values = useStore(form.store, (state) => state.values);
	const { items, observations, rationale } = values;
	const input = portraitIdentityReviewInputSchema.safeParse({
		id: crypto.randomUUID(),
		projectId: family.projectId,
		assetFamilyId: family.id,
		visualWorldId: family.visualWorldId,
		subjectIdentityId: family.subjectIdentityId,
		canonicalDesignId: canonical?.id,
		contractRevisionId: activation.contractRevisionId,
		items: items.map((i) => i.value),
		observations,
		rationale,
	});
	const canSave =
		input.success &&
		items.every((i) => ready.has(JSON.stringify(i.value))) &&
		items.every((i) => versions.some((v) => v.id === i.value.assetVersionId)) &&
		versionCatalog.assetVersions.find((v) => v.id === canonical?.assetVersionId)
			?.reviewDisposition === "approved" &&
		!query.isPending &&
		!query.isError;
	async function submit(_value: typeof defaultValues) {
		if (locked || !canSave || !input.success) {
			return;
		}
		setSaving(true);
		setMessage("");
		try {
			const saved = await saveMutation.mutateAsync(input.data);
			const result = await query.refetch();
			if (result.isError || !result.data?.some((r) => r.id === saved.id)) {
				setPending(input.data);
				setMessage("Could not verify the save result. Check the record again.");
			} else {
				setMessage("Portrait review saved.");
			}
		} catch (error) {
			if (isWriteOutcomeUncertain(error)) {
				setPending(input.data);
			}
			setMessage(getErrorMessage(error, "Could not save portrait review."));
		} finally {
			setSaving(false);
		}
	}
	async function reconcile() {
		if (!pending) {
			return;
		}
		setSaving(true);
		try {
			const result = await query.refetch();
			if (result.isError || !result.data?.some((r) => r.id === pending.id)) {
				setMessage("Could not verify the save result. Check the record again.");
				return;
			}
			setPending(null);
			setMessage("Portrait review saved.");
		} catch (error) {
			setMessage(
				getErrorMessage(
					error,
					"Could not verify the save result. Check the record again.",
					"query"
				)
			);
		} finally {
			setSaving(false);
		}
	}
	const subject = familyCatalog.subjectIdentities.find(
		(s) => s.id === family.subjectIdentityId
	);
	const related = familyCatalog.assetFamilies.filter(
		(f) =>
			f.id !== family.id && f.subjectIdentityId === family.subjectIdentityId
	);
	return (
		<section
			aria-label="Review Portrait Identity and Crop"
			className="space-y-4 rounded-lg border p-4"
		>
			<h3 className="font-semibold">
				Review Portrait Identity and Crop · {family.name}
			</h3>
			<p>
				Subject Identity: {subject?.name ?? family.subjectIdentityId} · Usage:{" "}
				{family.useContext}. This family's Visual World and Canonical Design
				lineage is preserved.
			</p>
			{related.length > 0 ? (
				<p>
					Other families with the same Subject Identity:{" "}
					{related.map((f) => f.name).join(", ")}
				</p>
			) : null}
			<p>
				Canonical Design:{" "}
				{names.get(canonical?.assetRecordId ?? "") ?? "Not selected"} · Version{" "}
				{versionCatalog.assetVersions.find(
					(v) => v.id === canonical?.assetVersionId
				)?.versionNumber ?? "—"}
			</p>
			{versions.length < 2 ? (
				<p>
					Upload portrait versions for at least two expressions and link Derived
					Assets to this family's approved Canonical Design.
				</p>
			) : null}
			<form
				className="space-y-4"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					form.handleSubmit();
				}}
			>
				<form.Field mode="array" name="items">
					{(itemsField) => (
						<>
							<div className="grid gap-4 lg:grid-cols-2">
								{itemsField.state.value.map((item, index) => (
									<form.Field key={item.key} name={`items[${index}].value`}>
										{(itemField) => (
											<PortraitReviewItemFields
												disabled={locked}
												field={itemField}
												index={index}
												names={names}
												onReady={(isReady) =>
													setReady((current) => {
														const next = new Set(current);
														const key = JSON.stringify(item.value);
														if (isReady) {
															next.add(key);
														} else {
															next.delete(key);
														}
														return next;
													})
												}
												onRemove={() => itemsField.removeValue(index)}
												versions={versions}
											/>
										)}
									</form.Field>
								))}
							</div>
							<Button
								disabled={locked || versions.length === 0 || items.length >= 24}
								onClick={() => {
									const [version] = versions;
									if (version) {
										itemsField.pushValue({
											key: crypto.randomUUID(),
											value: makeItem(version),
										});
									}
								}}
								type="button"
								variant="outline"
							>
								Add expression
							</Button>
						</>
					)}
				</form.Field>
				<FieldSet className="space-y-3" disabled={locked}>
					<FieldLegend>Comparison observations</FieldLegend>
					{observationFields.map(([key, label]) => (
						<div className="grid gap-2 sm:grid-cols-2" key={key}>
							<div className="grid gap-1">
								<Label htmlFor={`${formId}-${key}`}>{label}</Label>
								<form.Field name={`observations.${key}.outcome`}>
									{(field) => (
										<NativeSelect
											className="w-full"
											id={`${formId}-${key}`}
											onChange={(e) =>
												field.handleChange(
													portraitReviewObservationSchema.shape.outcome.parse(
														e.target.value
													)
												)
											}
											value={field.state.value}
										>
											{Object.entries(outcomeLabels).map(([value, text]) => (
												<NativeSelectOption key={value} value={value}>
													{text}
												</NativeSelectOption>
											))}
										</NativeSelect>
									)}
								</form.Field>
							</div>
							<Label className="grid gap-1">
								{label} notes
								<form.Field name={`observations.${key}.notes`}>
									{(field) => (
										<Textarea
											maxLength={1000}
											onChange={(e) => field.handleChange(e.target.value)}
											required
											value={field.state.value}
										/>
									)}
								</form.Field>
							</Label>
						</div>
					))}
					<Label className="grid gap-1">
						Review rationale
						<form.Field name="rationale">
							{(field) => (
								<Textarea
									maxLength={2000}
									onChange={(e) => field.handleChange(e.target.value)}
									required
									value={field.state.value}
								/>
							)}
						</form.Field>
					</Label>
				</FieldSet>
				<p className="text-muted-foreground text-sm">
					Compare two expressions in the loaded previews and enter observations.
					You make the visual assessment; saving does not mark the family
					complete or ready for export.
				</p>
				<Button disabled={locked || !canSave} type="submit">
					{saving ? "Saving…" : "Save portrait review"}
				</Button>
			</form>
			{message ? <p role="status">{message}</p> : null}
			{pending ? (
				<Button
					disabled={saving}
					onClick={() => void reconcile()}
					type="button"
					variant="outline"
				>
					Check the record again
				</Button>
			) : null}
			{query.isError ? (
				<StatusMessage tone="error">
					Could not load reviews.{" "}
					<Button
						onClick={() => void query.refetch()}
						type="button"
						variant="outline"
					>
						Reload
					</Button>
				</StatusMessage>
			) : null}
			<h4 className="font-medium">Saved portrait reviews</h4>
			<ul className="space-y-3">
				{query.data?.map((record) => (
					<SavedReview key={record.id} record={record} />
				))}
			</ul>
		</section>
	);
}
export function PortraitIdentityReviewSections({
	activation,
	assetRecords,
	familyCatalog,
	versionCatalog,
	families,
}: Omit<Props, "family" | "activation"> & {
	activation?: ProjectProfileContractActivation;
	families: AssetFamilyRecord[];
}) {
	if (activation?.contract.profileId !== "portrait_logo_marketing") {
		return null;
	}
	const recordIds = new Set(
		assetRecords
			.filter((r) => r.assetCategory === "portrait_logo_marketing")
			.map((r) => r.id)
	);
	return families
		.filter((f) =>
			familyCatalog.assetRecords.some(
				(r) => r.assetFamilyId === f.id && recordIds.has(r.id)
			)
		)
		.map((family) => (
			<PortraitIdentityReviewManager
				activation={activation}
				assetRecords={assetRecords}
				family={family}
				familyCatalog={familyCatalog}
				key={`${family.id}-${activation.contractRevisionId}`}
				versionCatalog={versionCatalog}
			/>
		));
}
