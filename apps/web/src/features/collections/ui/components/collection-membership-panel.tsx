import type {
	CollectionCatalog,
	CollectionRecord,
} from "@sprite-anvil/api/collections";
import { Button } from "@sprite-anvil/ui/components/button";
import type { SyntheticEvent } from "react";

export function CollectionMembershipPanel({
	assetRecordsById,
	availableAssetRecords,
	memberships,
	onAddAssetRecord,
	onRemoveAssetRecord,
	onSelectedAssetRecordChange,
	savingOperation,
	selectedAssetRecordId,
	selectedCollection,
	writesDisabled,
}: {
	assetRecordsById: Map<string, CollectionCatalog["assetRecords"][number]>;
	availableAssetRecords: CollectionCatalog["assetRecords"];
	memberships: CollectionCatalog["memberships"];
	onAddAssetRecord: (event: SyntheticEvent<HTMLFormElement>) => void;
	onRemoveAssetRecord: (assetRecordId: string) => void;
	onSelectedAssetRecordChange: (assetRecordId: string) => void;
	savingOperation: string | null;
	selectedAssetRecordId: string;
	selectedCollection: CollectionRecord | null;
	writesDisabled: boolean;
}) {
	const content = selectedCollection ? (
		<CollectionMembers
			assetRecordsById={assetRecordsById}
			availableAssetRecords={availableAssetRecords}
			collection={selectedCollection}
			memberships={memberships}
			onAddAssetRecord={onAddAssetRecord}
			onRemoveAssetRecord={onRemoveAssetRecord}
			onSelectedAssetRecordChange={onSelectedAssetRecordChange}
			savingOperation={savingOperation}
			selectedAssetRecordId={selectedAssetRecordId}
			writesDisabled={writesDisabled}
		/>
	) : (
		<div className="space-y-2">
			<h2 className="font-semibold text-xl" id="collection-members-heading">
				Koleksiyon üyeliği
			</h2>
			<p className="text-muted-foreground text-sm">
				Bir Koleksiyon oluşturduğunuzda Varlık Kayıtlarını burada
				düzenleyebilirsiniz.
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
	memberships,
	onAddAssetRecord,
	onRemoveAssetRecord,
	onSelectedAssetRecordChange,
	savingOperation,
	selectedAssetRecordId,
	writesDisabled,
}: {
	assetRecordsById: Map<string, CollectionCatalog["assetRecords"][number]>;
	availableAssetRecords: CollectionCatalog["assetRecords"];
	collection: CollectionRecord;
	memberships: CollectionCatalog["memberships"];
	onAddAssetRecord: (event: SyntheticEvent<HTMLFormElement>) => void;
	onRemoveAssetRecord: (assetRecordId: string) => void;
	onSelectedAssetRecordChange: (assetRecordId: string) => void;
	savingOperation: string | null;
	selectedAssetRecordId: string;
	writesDisabled: boolean;
}) {
	const memberContent =
		memberships.length === 0 ? (
			<p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
				Bu Koleksiyonda henüz Varlık Kaydı yok.
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
				<p className="font-mono text-primary text-xs uppercase tracking-[0.16em]">
					Koleksiyon
				</p>
				<h2
					className="font-medium font-serif text-3xl tracking-tight"
					id="collection-members-heading"
				>
					{collection.name}
				</h2>
				<p className="text-muted-foreground text-sm">
					Farklı Varlık Ailelerindeki kayıtları birlikte tutabilirsiniz.
				</p>
			</header>

			<form
				className="flex flex-col gap-3 sm:flex-row"
				onSubmit={onAddAssetRecord}
			>
				<div className="min-w-0 flex-1 space-y-2">
					<label
						className="font-medium text-sm"
						htmlFor="collection-asset-record"
					>
						Varlık Kaydı
					</label>
					<select
						className="h-11 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
						id="collection-asset-record"
						name="assetRecordId"
						onChange={(event) =>
							onSelectedAssetRecordChange(event.target.value)
						}
						value={selectedAssetRecordId}
					>
						<option value="">Varlık Kaydı seçin</option>
						{availableAssetRecords.map((assetRecord) => (
							<option key={assetRecord.id} value={assetRecord.id}>
								{assetRecord.name}
								{assetRecord.assetFamilyName
									? ` · ${assetRecord.assetFamilyName}`
									: " · Varlık Ailesi atanmamış"}
							</option>
						))}
					</select>
				</div>
				<Button
					className="min-h-11 sm:mt-6"
					disabled={writesDisabled || !selectedAssetRecordId}
					type="submit"
				>
					{savingOperation === "add" ? "Ekleniyor…" : "Koleksiyona ekle"}
				</Button>
			</form>

			{availableAssetRecords.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Bu Koleksiyona eklenebilecek başka Varlık Kaydı yok.
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
	const recordName = assetRecord?.name ?? "Silinmiş Varlık Kaydı";
	const isRemoving = savingOperation === `remove-${membership.assetRecordId}`;

	return (
		<li className="flex flex-col justify-between gap-3 rounded-lg border p-4 sm:flex-row sm:items-center">
			<div className="min-w-0">
				<h3 className="truncate font-medium">{recordName}</h3>
				<p className="text-muted-foreground text-sm">
					{assetRecord?.assetFamilyName ?? "Varlık Ailesi belirtilmemiş"}
				</p>
			</div>
			<Button
				aria-label={`${recordName} Varlık Kaydını Koleksiyondan kaldır`}
				className="min-h-11"
				disabled={writesDisabled}
				onClick={() => onRemove(membership.assetRecordId)}
				type="button"
				variant="outline"
			>
				{isRemoving ? "Kaldırılıyor…" : "Kaldır"}
			</Button>
		</li>
	);
}
