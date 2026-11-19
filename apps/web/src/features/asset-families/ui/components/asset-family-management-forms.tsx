import type { AssetFamilyCatalog } from "@sprite-anvil/api/asset-families";
import type { AssetVersionCatalog } from "@sprite-anvil/api/asset-versions";
import { Link } from "@tanstack/react-router";
import type { AssetFamilyForms } from "../../hooks/use-asset-family-forms";
import {
	AssetFamilyForm,
	AssetFamilyRelationshipForm,
	AssetRecordForm,
	SubjectIdentityForm,
} from "../forms/asset-family-forms";

export function AssetFamilyManagementForms({
	projectId,
	catalog,
	assetVersionCatalog,
	disabled,
	forms,
	isScopeError,
	isScopeLoaded,
	isSaving,
	visualWorlds,
}: {
	projectId: string;
	catalog: AssetFamilyCatalog;
	assetVersionCatalog: AssetVersionCatalog;
	disabled: boolean;
	forms: AssetFamilyForms;
	isScopeError: boolean;
	isScopeLoaded: boolean;
	isSaving: string | null;
	visualWorlds: { id: string; name: string }[];
}) {
	const selectedCanonicalDesign = assetVersionCatalog.canonicalDesigns
		.filter(
			(design) => design.assetFamilyId === forms.selection.relationshipFamilyId
		)
		.at(-1);
	const selectedCanonicalVersion = selectedCanonicalDesign
		? assetVersionCatalog.assetVersions.find(
				(version) => version.id === selectedCanonicalDesign.assetVersionId
			)
		: undefined;
	const canonicalDesign =
		selectedCanonicalDesign && selectedCanonicalVersion
			? {
					assetRecordId: selectedCanonicalDesign.assetRecordId,
					assetVersionId: selectedCanonicalDesign.assetVersionId,
					recordName:
						catalog.assetRecords.find(
							(record) => record.id === selectedCanonicalDesign.assetRecordId
						)?.name ?? "Asset Record",
					versionNumber: selectedCanonicalVersion.versionNumber,
				}
			: null;

	return (
		<section aria-labelledby="asset-family-setup" className="space-y-4">
			<div>
				<h2 className="text-2xl font-semibold" id="asset-family-setup">
					Set up relationships
				</h2>
				<p className="text-muted-foreground mt-1 text-sm">
					Create a new Asset Family when the same subject has a different Visual
					World or usage context.
				</p>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<SubjectIdentityForm
					disabled={disabled}
					form={forms.subjectIdentityForm}
					isSaving={isSaving === "subject-identity"}
				/>
				<AssetFamilyForm
					disabled={disabled || isScopeError}
					families={catalog.assetFamilies}
					form={forms.assetFamilyForm}
					isSaving={isSaving === "asset-family"}
					selectedSubjectIdentityId={forms.selection.subjectIdentityId}
					selectedVisualWorldId={forms.selection.visualWorldId}
					subjectIdentities={catalog.subjectIdentities}
					visualWorlds={visualWorlds}
				/>
			</div>
			{isScopeLoaded && visualWorlds.length === 0 ? (
				<p className="rounded-lg border border-dashed p-4 text-sm">
					Define a Visual World before creating an Asset Family.{" "}
					<Link
						className="underline underline-offset-4"
						search={{ projectId }}
						to="/context-proposals"
					>
						Go to Project Context
					</Link>
				</p>
			) : null}
			{catalog.assetFamilies.length > 0 ? (
				<div className="grid gap-4 md:grid-cols-2">
					<AssetRecordForm
						assetFamilies={catalog.assetFamilies}
						assetRecords={catalog.assetRecords}
						disabled={disabled}
						form={forms.assetRecordForm}
						isSaving={isSaving === "asset-record"}
						selectedAssetFamilyId={forms.selection.assetRecordFamilyId}
					/>
					<AssetFamilyRelationshipForm
						assetFamilies={catalog.assetFamilies}
						assetRecords={catalog.assetRecords}
						canonicalDesign={canonicalDesign}
						disabled={disabled}
						form={forms.relationshipForm}
						isSaving={isSaving === "relationship"}
						selectedAssetFamilyId={forms.selection.relationshipFamilyId}
						selectedSourceId={forms.selection.relationshipSourceId}
						selectedTargetId={forms.selection.relationshipTargetId}
					/>
				</div>
			) : null}
		</section>
	);
}
