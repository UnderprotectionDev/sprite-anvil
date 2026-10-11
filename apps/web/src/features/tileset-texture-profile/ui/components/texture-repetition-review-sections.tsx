import {
	TextureRepetitionReviewManager,
	type TextureRepetitionReviewManagerProps,
} from "./texture-repetition-review-manager";
export function TextureRepetitionReviewSections({
	families,
	activation,
	...props
}: Omit<
	TextureRepetitionReviewManagerProps,
	"assetFamilyId" | "familyName" | "activation"
> & {
	families: { id: string; name: string }[];
	activation?: TextureRepetitionReviewManagerProps["activation"];
}) {
	if (!activation) {
		return null;
	}
	return families.map((family) => (
		<TextureRepetitionReviewManager
			{...props}
			activation={activation}
			assetFamilyId={family.id}
			familyName={family.name}
			key={family.id}
		/>
	));
}
