import type {
	AssetFamilyCatalog,
	AssetFamilyRelationship,
} from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";

import { WindowVirtualList } from "@sprite-anvil/ui/components/window-virtual-list";
import { Link } from "@tanstack/react-router";

const relationshipLabels = {
	direction: "Direction",
	animation: "Animation",
	state: "State",
	derivative: "Derived Asset",
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
			<p className="text-muted-foreground rounded-lg border border-dashed p-5">
				No Subject Identity yet. Create one first.
			</p>
		);
	}

	return (
		<WindowVirtualList
			ariaLabel="Subject Identities"
			getItemKey={(identity) => identity.id}
			items={catalog.subjectIdentities}
			renderItem={(identity) => {
				const families = catalog.assetFamilies.filter(
					(family) => family.subjectIdentityId === identity.id
				);

				return (
					<section className="border-l-primary rounded-lg border border-l-2 p-5">
						<p className="text-primary font-mono text-xs tracking-widest uppercase">
							Subject Identity
						</p>
						<h2 className="mt-1 font-serif text-2xl font-semibold">
							{identity.name}
						</h2>
						{families.length === 0 ? (
							<p className="text-muted-foreground mt-3 text-sm">
								This Subject Identity has no Asset Families yet.
							</p>
						) : (
							<ul className="border-border mt-4 ml-2 space-y-3 border-l pl-4">
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
					</section>
				);
			}}
		/>
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
			<p className="text-muted-foreground font-mono text-xs tracking-wider uppercase">
				Asset Family
			</p>
			<h3 className="font-medium">{family.name}</h3>
			<p className="mt-2 text-sm">
				<strong>Canonical Design:</strong>{" "}
				{canonicalDesign && canonicalRecord && canonicalVersion
					? `${canonicalRecord.name} · Version ${canonicalVersion.versionNumber}`
					: "Not selected yet"}
			</p>
			<p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
				<span className="rounded-sm border px-2 py-1">
					{visualWorldName ?? "Visual World not found"}
				</span>
				<span className="border-primary/40 text-primary rounded-sm border px-2 py-1">
					{family.useContext}
				</span>
			</p>
			<h4 className="mt-4 text-sm font-medium">Asset Records</h4>
			{familyRecords.length > 0 ? (
				<ul className="mt-1 list-inside list-disc text-sm">
					{familyRecords.map((assetRecord) => (
						<li key={assetRecord.id}>
							<Link
								className="inline-flex min-h-11 items-center underline underline-offset-4"
								params={{
									projectId: assetRecord.projectId,
									assetRecordId: assetRecord.id,
								}}
								to="/projects/$projectId/assets/$assetRecordId"
							>
								{assetRecord.name}
							</Link>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground mt-1 text-sm">
					No Asset Records yet.
				</p>
			)}
			{familyRelationships.length > 0 ? (
				<>
					<h4 className="mt-4 text-sm font-medium">Family relationships</h4>
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
		sourceVersionLabel = ` · Version ${versionNumber ?? "unknown"}`;
	} else if (relationship.type === "derivative") {
		sourceVersionLabel = " · source version not specified in the older record";
	}

	return (
		<li>
			{source.name}
			{sourceVersionLabel} — {relationshipLabels[relationship.type]} —{" "}
			{target.name}
		</li>
	);
}
