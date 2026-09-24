import type {
	AssetFamilyCatalog,
	AssetFamilyRelationshipType,
} from "@sprite-anvil/api/asset-families";
import { Link } from "@tanstack/react-router";
import type { SyntheticEvent } from "react";
import {
	AssetFamilyForm,
	AssetFamilyRelationshipForm,
	AssetRecordForm,
	SubjectIdentityForm,
} from "../forms/asset-family-forms";

export interface AssetFamilyFormState {
	assetRecordName: string;
	familyName: string;
	familyUseContext: string;
	relationshipType: AssetFamilyRelationshipType;
	selectedAssetRecordFamilyId: string;
	selectedRelationshipFamilyId: string;
	selectedRelationshipSourceId: string;
	selectedRelationshipTargetId: string;
	selectedSubjectIdentityId: string;
	selectedVisualWorldId: string;
	subjectIdentityName: string;
}

export interface AssetFamilyFormHandlers {
	onAssetRecordFamilyChange: (value: string) => void;
	onAssetRecordNameChange: (value: string) => void;
	onFamilyNameChange: (value: string) => void;
	onFamilyUseContextChange: (value: string) => void;
	onRelationshipFamilyChange: (value: string) => void;
	onRelationshipSourceChange: (value: string) => void;
	onRelationshipTargetChange: (value: string) => void;
	onRelationshipTypeChange: (value: AssetFamilyRelationshipType) => void;
	onSubjectIdentityChange: (value: string) => void;
	onSubjectIdentityNameChange: (value: string) => void;
	onVisualWorldChange: (value: string) => void;
	submitAssetFamily: (event: SyntheticEvent<HTMLFormElement>) => void;
	submitAssetRecord: (event: SyntheticEvent<HTMLFormElement>) => void;
	submitRelationship: (event: SyntheticEvent<HTMLFormElement>) => void;
	submitSubjectIdentity: (event: SyntheticEvent<HTMLFormElement>) => void;
}

export function AssetFamilyManagementForms({
	catalog,
	disabled,
	formHandlers,
	formState,
	isScopeError,
	isScopeLoaded,
	isSaving,
	visualWorlds,
}: {
	catalog: AssetFamilyCatalog;
	disabled: boolean;
	formHandlers: AssetFamilyFormHandlers;
	formState: AssetFamilyFormState;
	isScopeError: boolean;
	isScopeLoaded: boolean;
	isSaving: string | null;
	visualWorlds: { id: string; name: string }[];
}) {
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
					isSaving={isSaving === "subject-identity"}
					name={formState.subjectIdentityName}
					onNameChange={formHandlers.onSubjectIdentityNameChange}
					onSubmit={formHandlers.submitSubjectIdentity}
				/>
				<AssetFamilyForm
					disabled={disabled || isScopeError}
					families={catalog.assetFamilies}
					isSaving={isSaving === "asset-family"}
					name={formState.familyName}
					onNameChange={formHandlers.onFamilyNameChange}
					onSubjectIdentityChange={formHandlers.onSubjectIdentityChange}
					onSubmit={formHandlers.submitAssetFamily}
					onUseContextChange={formHandlers.onFamilyUseContextChange}
					onVisualWorldChange={formHandlers.onVisualWorldChange}
					selectedSubjectIdentityId={formState.selectedSubjectIdentityId}
					selectedVisualWorldId={formState.selectedVisualWorldId}
					subjectIdentities={catalog.subjectIdentities}
					useContext={formState.familyUseContext}
					visualWorlds={visualWorlds}
				/>
			</div>
			{isScopeLoaded && visualWorlds.length === 0 ? (
				<p className="rounded-lg border border-dashed p-4 text-sm">
					Varlık Ailesi oluşturmak için önce bir Görsel Dünya tanımlayın.{" "}
					<Link
						className="underline underline-offset-4"
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
						isSaving={isSaving === "asset-record"}
						name={formState.assetRecordName}
						onAssetFamilyChange={formHandlers.onAssetRecordFamilyChange}
						onNameChange={formHandlers.onAssetRecordNameChange}
						onSubmit={formHandlers.submitAssetRecord}
						selectedAssetFamilyId={formState.selectedAssetRecordFamilyId}
					/>
					<AssetFamilyRelationshipForm
						assetFamilies={catalog.assetFamilies}
						assetRecords={catalog.assetRecords}
						disabled={disabled}
						isSaving={isSaving === "relationship"}
						onFamilyChange={formHandlers.onRelationshipFamilyChange}
						onSourceChange={formHandlers.onRelationshipSourceChange}
						onSubmit={formHandlers.submitRelationship}
						onTargetChange={formHandlers.onRelationshipTargetChange}
						onTypeChange={formHandlers.onRelationshipTypeChange}
						selectedAssetFamilyId={formState.selectedRelationshipFamilyId}
						selectedSourceId={formState.selectedRelationshipSourceId}
						selectedTargetId={formState.selectedRelationshipTargetId}
						type={formState.relationshipType}
					/>
				</div>
			) : null}
		</section>
	);
}
