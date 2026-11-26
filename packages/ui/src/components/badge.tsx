import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";

// Paper · 02 Display + feedback · Badge. Short, flat, non-interactive labels that
// must never read as buttons: no bevel and no solid fill. Every chip is 24px,
// radius 4, Inter 13 600. Status tones are a 14% tint of the tone with text and
// glyph in that tone, so meaning never rests on colour alone. Callers recolour a
// status tag by setting `--badge-tone`.
const toneTag =
	"bg-[color-mix(in_srgb,var(--badge-tone)_14%,transparent)] text-(--badge-tone) [&>svg]:stroke-3";
const neutralTag =
	"bg-[color-mix(in_srgb,var(--color-workbench-text)_8%,transparent)] text-workbench-muted-text";

const badgeVariants = cva(
	"group/badge focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! rounded-tag text-label inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1.5 overflow-hidden px-2 leading-4 font-semibold whitespace-nowrap outline-0 transition-colors has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:outline-2 aria-invalid:outline-offset-2 [&>svg]:pointer-events-none [&>svg]:size-3.5!",
	{
		variants: {
			variant: {
				default: cn(toneTag, "[--badge-tone:var(--color-primary)]"),
				secondary: cn(neutralTag, "[a]:hover:text-workbench-text"),
				// Pink needs lifting toward white to stay legible on its own tint.
				destructive: cn(
					toneTag,
					"[--badge-tone:color-mix(in_srgb,var(--color-destructive)_60%,white)]"
				),
				outline:
					"text-workbench-muted-text [a]:hover:text-workbench-text shadow-[inset_0_0_0_1px_var(--color-workbench-border-strong)]",
				ghost: "text-workbench-muted-text [a]:hover:text-workbench-text",
				link: "text-workbench-link underline-offset-4 [a]:hover:underline",
				meta: cn(neutralTag, "font-mono"),
				count: cn(neutralTag, "text-data min-w-6 px-1.5 font-bold"),
				success: cn(toneTag, "[--badge-tone:var(--color-workbench-success)]"),
				warning: cn(toneTag, "[--badge-tone:var(--color-workbench-warning)]"),
				info: cn(toneTag, "[--badge-tone:var(--color-workbench-data)]"),
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

function Badge({
	className,
	variant = "default",
	render,
	...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: "span",
		props: mergeProps<"span">(
			{
				className: cn(badgeVariants({ variant }), className),
			},
			props
		),
		render,
		state: {
			slot: "badge",
			variant,
		},
	});
}

export { Badge, badgeVariants };
