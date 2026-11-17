import { specializedProfileContractCatalog } from "@sprite-anvil/api/specialized-profile-contracts";
import { expect, test } from "vitest";
import { builtinProfilePresentation } from "./builtin-profile-labels";

test("translates known catalog items only for presentation and preserves custom values", () => {
	const contract = specializedProfileContractCatalog.find(
		(item) => item.profileId === "icon"
	);
	if (!contract) {
		throw new Error("Icon contract is missing");
	}
	const original = structuredClone(contract);
	const translated = builtinProfilePresentation(contract);
	expect(translated.metadataFields[0]?.label).toBe("Usage variant");
	expect(translated.metadataFields[0]?.description).toBe(
		"The usage purpose retains its stable ID."
	);
	expect(translated.metadataFields[0]?.scope).toBe("Each icon version");
	expect(contract).toEqual(original);
	const custom = structuredClone(contract);
	const [customField] = custom.metadataFields;
	const [originalField] = contract.metadataFields;
	if (!(customField && originalField)) {
		throw new Error("Icon metadata is missing");
	}
	customField.label = "Kullanıcı alanı";
	expect(builtinProfilePresentation(custom).metadataFields[0]?.label).toBe(
		"Kullanıcı alanı"
	);
	customField.id = "custom_field";
	customField.label = originalField.label;
	expect(builtinProfilePresentation(custom).metadataFields[0]?.label).toBe(
		originalField.label
	);
});
