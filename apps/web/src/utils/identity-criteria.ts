export const identityCriterionOptions = [
	{
		value: "independent_product_meaning",
		label: "Independent product meaning",
		description:
			"A character, object, or visual with its own identity and purpose in the game.",
	},
	{
		value: "independent_lifecycle",
		label: "Independent lifecycle",
		description: "An asset that changes or evolves independently.",
	},
	{
		value: "delivery_identity",
		label: "Delivery identity",
		description: "Content delivered to the game as a separate asset.",
	},
] as const;

export type IdentityCriterion =
	(typeof identityCriterionOptions)[number]["value"];

const identityCriterionLabels = Object.fromEntries(
	identityCriterionOptions.map(({ label, value }) => [value, label])
) as Record<IdentityCriterion, string>;

export function getIdentitySummary(identityCriteria: readonly string[]) {
	return identityCriteria.length > 0
		? identityCriteria
				.map(
					(criterion) =>
						identityCriterionLabels[criterion as IdentityCriterion] ?? criterion
				)
				.join(" · ")
		: "No rationale saved";
}
