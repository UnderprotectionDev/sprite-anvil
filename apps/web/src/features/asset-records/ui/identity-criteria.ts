export const identityCriterionOptions = [
	{
		value: "independent_product_meaning",
		label: "Bağımsız ürün anlamı",
		description:
			"Oyunda kendi kimliği ve amacı olan karakter, nesne veya görsel.",
	},
	{
		value: "independent_lifecycle",
		label: "Bağımsız yaşam döngüsü",
		description: "Kendi kararlarıyla ayrı değişen veya gelişen varlık.",
	},
	{
		value: "delivery_identity",
		label: "Teslimat kimliği",
		description: "Oyuna ayrı bir varlık olarak teslim edilen içerik.",
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
		: "Gerekçe kaydedilmemiş";
}
