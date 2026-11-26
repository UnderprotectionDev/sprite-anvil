import { createCn } from "cn/config";

// The Design Language font-size tokens (`text-label`, `text-body`, ...) are not in the
// default merge config, so they would be taken for text colours and silently drop the
// colour (or the size) next to them. Every primitive merges through this `cn`.
export const cn = createCn({
	extend: {
		classGroups: {
			rounded: [
				{
					rounded: [
						"tag",
						"control",
						"control-sm",
						"card",
						"overlay",
						"preview",
					],
				},
			],
			"font-size": [
				{
					text: [
						"label",
						"data",
						"body",
						"action",
						"subhead",
						"heading-compact",
						"heading",
						"metric",
					],
				},
			],
		},
	},
});
