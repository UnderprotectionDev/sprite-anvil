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
						)?.name ?? "Varlık Kaydı",
					versionNumber: selectedCanonicalVersion.versionNumber,
				}
			: null;

	return (
		<section aria-labelledby="asset-family-setup" className="space-y-4">
			<div>
				<h2 className="font-semibold text-2xl" id="asset-family-setup">
					İlişkileri kurun
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Aynı konu farklı bir Görsel Dünya veya kullanım bağlamındaysa yeni bir
					Varlık Ailesi oluşturun.
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
					Varlık Ailesi oluşturmak için önce bir Görsel Dünya tanımlayın.{" "}
					<Link
						className="underline underline-offset-4"
						search={{ projectId }}
						to="/context-proposals"
					>
						Proje Bağlamı sayfasına gidin
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
