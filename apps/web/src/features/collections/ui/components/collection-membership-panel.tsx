import type {
	CollectionCatalog,
	CollectionRecord,
} from "@sprite-anvil/api/collections";
import { Button } from "@sprite-anvil/ui/components/button";
import { Label } from "@sprite-anvil/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@sprite-anvil/ui/components/native-select";
import type { CollectionMembershipForm } from "../../hooks/use-collections-manager";

export function CollectionMembershipPanel({
	assetRecordsById,
	availableAssetRecords,
	membershipForm,
	memberships,
	onRemoveAssetRecord,
	savingOperation,
	selectedCollection,
	writesDisabled,
}: {
	assetRecordsById: Map<string, CollectionCatalog["assetRecords"][number]>;
	availableAssetRecords: CollectionCatalog["assetRecords"];
	membershipForm: CollectionMembershipForm;
	memberships: CollectionCatalog["memberships"];
	onRemoveAssetRecord: (assetRecordId: string) => void;
	savingOperation: string | null;
	selectedCollection: CollectionRecord | null;
	writesDisabled: boolean;
}) {
	const content = selectedCollection ? (
		<CollectionMembers
			assetRecordsById={assetRecordsById}
			availableAssetRecords={availableAssetRecords}
			collection={selectedCollection}
			membershipForm={membershipForm}
			memberships={memberships}
			onRemoveAssetRecord={onRemoveAssetRecord}
			savingOperation={savingOperation}
			writesDisabled={writesDisabled}
		/>
	) : (
		<div className="space-y-2">
			<h2 className="text-xl font-semibold" id="collection-members-heading">
				Collection membership
			</h2>
			<p className="text-muted-foreground text-sm">
				After creating a Collection, you can organize Asset Records here.
			</p>
		</div>
	);

	return (
		<section
			aria-labelledby="collection-members-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			{content}
		</section>
	);
}

function CollectionMembers({
	assetRecordsById,
	availableAssetRecords,
	collection,
	membershipForm,
	memberships,
	onRemoveAssetRecord,
	savingOperation,
	writesDisabled,
}: {
	assetRecordsById: Map<string, CollectionCatalog["assetRecords"][number]>;
	availableAssetRecords: CollectionCatalog["assetRecords"];
	collection: CollectionRecord;
	membershipForm: CollectionMembershipForm;
	memberships: CollectionCatalog["memberships"];
	onRemoveAssetRecord: (assetRecordId: string) => void;
	savingOperation: string | null;
	writesDisabled: boolean;
}) {
	const memberContent =
		memberships.length === 0 ? (
			<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
				This Collection has no Asset Records yet.
			</p>
		) : (
			<ul className="space-y-3">
				{memberships.map((membership) => (
					<CollectionMemberItem
						assetRecord={assetRecordsById.get(membership.assetRecordId)}
						key={`${membership.collectionId}:${membership.assetRecordId}`}
						membership={membership}
						onRemove={onRemoveAssetRecord}
						savingOperation={savingOperation}
						writesDisabled={writesDisabled}
					/>
				))}
			</ul>
		);

	return (
		<>
			<header className="space-y-1">
				<p className="text-primary font-mono text-xs tracking-[0.16em] uppercase">
					Collection
				</p>
				<h2
					className="font-serif text-3xl font-medium tracking-tight"
					id="collection-members-heading"
				>
					{collection.name}
				</h2>
				<p className="text-muted-foreground text-sm">
					You can keep records from different Asset Families together.
				</p>
			</header>

			<form
				className="flex flex-col gap-3 sm:flex-row"
				onSubmit={(event) => {
					event.preventDefault();
					event.stopPropagation();
					void membershipForm.handleSubmit();
				}}
			>
				<membershipForm.Field name="assetRecordId">
					{(field) => (
						<div className="min-w-0 flex-1 space-y-2">
							<Label
								className="text-sm font-medium"
								htmlFor="collection-asset-record"
							>
								Asset Record
							</Label>
							<NativeSelect
								className="w-full [&>select]:h-11"
								id="collection-asset-record"
								name={field.name}
								onBlur={field.handleBlur}
								onChange={(event) => field.handleChange(event.target.value)}
								value={field.state.value}
							>
								<NativeSelectOption value="">
									Select an Asset Record
								</NativeSelectOption>
								{availableAssetRecords.map((assetRecord) => (
									<NativeSelectOption
										key={assetRecord.id}
										value={assetRecord.id}
									>
										{assetRecord.name}
										{assetRecord.assetFamilyName
											? ` · ${assetRecord.assetFamilyName}`
											: " · No Asset Family assigned"}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</div>
					)}
				</membershipForm.Field>
				<membershipForm.Subscribe
					selector={(state) => state.values.assetRecordId}
				>
					{(selectedAssetRecordId) => (
						<Button
							className="min-h-11 sm:mt-6"
							disabled={writesDisabled || !selectedAssetRecordId}
							type="submit"
						>
							{savingOperation === "add" ? "Adding…" : "Add to Collection"}
						</Button>
					)}
				</membershipForm.Subscribe>
			</form>

			{availableAssetRecords.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					No other Asset Records can be added to this Collection.
				</p>
			) : null}
			{memberContent}
		</>
	);
}

function CollectionMemberItem({
	assetRecord,
	membership,
	onRemove,
	savingOperation,
	writesDisabled,
}: {
	assetRecord: CollectionCatalog["assetRecords"][number] | undefined;
	membership: CollectionCatalog["memberships"][number];
	onRemove: (assetRecordId: string) => void;
	savingOperation: string | null;
	writesDisabled: boolean;
}) {
	const recordName = assetRecord?.name ?? "Erased Asset Record";
	const isRemoving = savingOperation === `remove-${membership.assetRecordId}`;

	return (
		<li className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
			<div className="min-w-0">
				<h3 className="truncate font-medium">{recordName}</h3>
				<p className="text-muted-foreground text-sm">
					{assetRecord?.assetFamilyName ?? "Asset Family not specified"}
				</p>
			</div>
			<Button
				aria-label={`${recordName} Remove Asset Record from Collection`}
				className="min-h-11"
				disabled={writesDisabled}
				onClick={() => onRemove(membership.assetRecordId)}
				type="button"
				variant="outline"
			>
				{isRemoving ? "Removing…" : "Remove"}
			</Button>
		</li>
	);
}
