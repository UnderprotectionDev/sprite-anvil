import type {
	AssetFamilyCatalog,
	AssetFamilyRelationship,
} from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";

const relationshipLabels = {
	direction: "Yön",
	animation: "Animasyon",
	state: "Durum",
	derivative: "Türetilmiş Varlık",
} as const;

export function AssetFamilyCatalogView({
	catalog,
	assetVersionCatalog,
	visualWorlds,
}: {
	catalog: AssetFamilyCatalog;
	assetVersionCatalog?: AssetVersionCatalog;
	visualWorlds: { id: string; name: string }[];
}) {
	const visualWorldNames = new Map(
		visualWorlds.map((visualWorld) => [visualWorld.id, visualWorld.name])
	);
	const assetRecordsById = new Map(
		catalog.assetRecords.map((assetRecord) => [assetRecord.id, assetRecord])
	);
	const assetVersionsById = new Map(
		(assetVersionCatalog?.assetVersions ?? []).map((assetVersion) => [
			assetVersion.id,
			assetVersion,
		])
	);

	if (catalog.subjectIdentities.length === 0) {
		return (
			<p className="rounded-lg border border-dashed p-5 text-muted-foreground">
				Henüz Varlık Kimliği yok. Önce bir kimlik oluşturun.
			</p>
		);
	}

	return (
		<ul className="space-y-5">
			{catalog.subjectIdentities.map((identity) => {
				const families = catalog.assetFamilies.filter(
					(family) => family.subjectIdentityId === identity.id
				);

				return (
					<li
						className="rounded-lg border border-l-2 border-l-primary p-5"
						key={identity.id}
					>
						<p className="font-mono text-primary text-xs uppercase tracking-widest">
							Varlık Kimliği
						</p>
						<h2 className="mt-1 font-semibold font-serif text-2xl">
							{identity.name}
						</h2>
						{families.length === 0 ? (
							<p className="mt-3 text-muted-foreground text-sm">
								Bu Varlık Kimliği için henüz Varlık Ailesi yok.
							</p>
						) : (
							<ul className="mt-4 ml-2 space-y-3 border-border border-l pl-4">
								{families.map((family) => (
									<FamilyCatalogItem
										assetRecords={catalog.assetRecords}
										assetRecordsById={assetRecordsById}
										assetVersionsById={assetVersionsById}
										canonicalDesigns={
											assetVersionCatalog?.canonicalDesigns ?? []
										}
										family={family}
										key={family.id}
										relationships={catalog.relationships}
										visualWorldName={visualWorldNames.get(family.visualWorldId)}
									/>
								))}
							</ul>
						)}
					</li>
				);
			})}
		</ul>
	);
}

function FamilyCatalogItem({
	assetRecords,
	assetRecordsById,
	assetVersionsById,
	canonicalDesigns,
	family,
	relationships,
	visualWorldName,
}: {
	assetRecords: AssetFamilyCatalog["assetRecords"];
	assetRecordsById: Map<string, AssetFamilyCatalog["assetRecords"][number]>;
	assetVersionsById: Map<string, AssetVersionCatalog["assetVersions"][number]>;
	canonicalDesigns: AssetVersionCatalog["canonicalDesigns"];
	family: AssetFamilyCatalog["assetFamilies"][number];
	relationships: AssetFamilyCatalog["relationships"];
	visualWorldName?: string;
}) {
	const familyRecords = assetRecords.filter(
		(record) => record.assetFamilyId === family.id
	);
	const familyRelationships = relationships.filter(
		(relationship) => relationship.assetFamilyId === family.id
	);
	const canonicalDesign = canonicalDesigns
		.filter((design) => design.assetFamilyId === family.id)
		.at(-1);
	const canonicalVersion = canonicalDesign
		? assetVersionsById.get(canonicalDesign.assetVersionId)
		: undefined;
	const canonicalRecord = canonicalDesign
		? assetRecordsById.get(canonicalDesign.assetRecordId)
		: undefined;

	return (
		<li className="border-b pb-4 last:border-b-0" key={family.id}>
			<p className="font-mono text-muted-foreground text-xs uppercase tracking-wider">
				Varlık Ailesi
			</p>
			<h3 className="font-medium">{family.name}</h3>
			<p className="mt-2 text-sm">
				<strong>Ana Tasarım:</strong>{" "}
				{canonicalDesign && canonicalRecord && canonicalVersion
					? `${canonicalRecord.name} · Sürüm ${canonicalVersion.versionNumber}`
					: "Henüz seçilmedi"}
			</p>
			<p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<span className="rounded-sm border px-2 py-1">
					{visualWorldName ?? "Görsel Dünya bulunamadı"}
				</span>
				<span className="rounded-sm border border-primary/40 px-2 py-1 text-primary">
					{family.useContext}
				</span>
			</p>
			<h4 className="mt-4 font-medium text-sm">Varlık Kayıtları</h4>
			{familyRecords.length > 0 ? (
				<ul className="mt-1 list-inside list-disc text-sm">
					{familyRecords.map((assetRecord) => (
						<li key={assetRecord.id}>{assetRecord.name}</li>
					))}
				</ul>
			) : (
				<p className="mt-1 text-muted-foreground text-sm">
					Henüz Varlık Kaydı yok.
				</p>
			)}
			{familyRelationships.length > 0 ? (
				<>
					<h4 className="mt-4 font-medium text-sm">Aile içi ilişkiler</h4>
					<ul className="mt-1 space-y-1 text-sm">
						{familyRelationships.map((relationship) => (
							<RelationshipLine
								assetRecordsById={assetRecordsById}
								assetVersionsById={assetVersionsById}
								key={relationship.id}
								relationship={relationship}
							/>
						))}
					</ul>
				</>
			) : null}
		</li>
	);
}

function RelationshipLine({
	assetRecordsById,
	assetVersionsById,
	relationship,
}: {
	assetRecordsById: Map<string, AssetFamilyCatalog["assetRecords"][number]>;
	assetVersionsById: Map<string, AssetVersionCatalog["assetVersions"][number]>;
	relationship: AssetFamilyRelationship;
}) {
	const source = assetRecordsById.get(relationship.sourceAssetRecordId);
	const target = assetRecordsById.get(relationship.targetAssetRecordId);
	if (!(source && target)) {
		return null;
	}

	let sourceVersionLabel = "";
	if (relationship.sourceAssetVersionId) {
		const versionNumber = assetVersionsById.get(
			relationship.sourceAssetVersionId
		)?.versionNumber;
		sourceVersionLabel = ` · Sürüm ${versionNumber ?? "bilinmiyor"}`;
	} else if (relationship.type === "derivative") {
		sourceVersionLabel = " · kaynak sürümü eski kayıtta belirtilmemiş";
	}

	return (
		<li>
			{source.name}
			{sourceVersionLabel} — {relationshipLabels[relationship.type]} —{" "}
			{target.name}
		</li>
	);
}
