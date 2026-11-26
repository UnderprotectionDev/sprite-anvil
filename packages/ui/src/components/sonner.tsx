"use client";

import { buttonVariants } from "@sprite-anvil/ui/components/button";
import {
	BanIcon,
	CheckIcon,
	ExclamationMarkIcon,
	InfoIcon,
	LoaderCircleIcon,
	XIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

// Paper · 02 Display + feedback · Sonner. Transient toast, bottom right: a neutral
// #232323 panel with a 1px ring and an 8/24 drop shadow, never tinted. The same
// 32px glyph block and 16px padding as Alert; only the glyph block carries the
// tone. Title Inter 14/20 600, description 13/18 muted; actions are 28px Utility
// buttons (radius 6).
const neutralGlyph =
	"[&_[data-icon]]:bg-workbench-control [&_[data-icon]]:text-workbench-on-selection";

const neutralRichColors = {
	"--success-bg": "var(--normal-bg)",
	"--success-border": "var(--normal-border)",
	"--success-text": "var(--normal-text)",
	"--info-bg": "var(--normal-bg)",
	"--info-border": "var(--normal-border)",
	"--info-text": "var(--normal-text)",
	"--warning-bg": "var(--normal-bg)",
	"--warning-border": "var(--normal-border)",
	"--warning-text": "var(--normal-text)",
	"--error-bg": "var(--normal-bg)",
	"--error-border": "var(--normal-border)",
	"--error-text": "var(--normal-text)",
};

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
	const { theme = "dark" } = useTheme();

	return (
		<Sonner
			className="toaster group"
			icons={{
				success: <CheckIcon strokeWidth={3} />,
				info: <InfoIcon strokeWidth={2.6} />,
				warning: <ExclamationMarkIcon strokeWidth={3} />,
				error: <BanIcon strokeWidth={2.8} />,
				loading: <LoaderCircleIcon className="animate-spin" />,
				close: <XIcon />,
			}}
			style={
				{
					"--normal-bg": "var(--color-workbench-background)",
					"--normal-text": "var(--color-workbench-text)",
					"--normal-border": "var(--color-workbench-panel-hover)",
					"--border-radius": "var(--radius-card)",
					...neutralRichColors,
					...style,
				} as React.CSSProperties
			}
			theme={theme as ToasterProps["theme"]}
			{...props}
			toastOptions={{
				...toastOptions,
				unstyled: true,
				classNames: {
					toast:
						"flex w-(--width) items-center gap-3 rounded-card bg-workbench-background p-4 font-sans text-workbench-text shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover),0_8px_24px_var(--color-workbench-drop-shadow)] focus-visible:focus-ring",
					icon: "flex size-8 shrink-0 items-center justify-center rounded-control-sm [&_svg]:size-4",
					content: "flex min-w-0 flex-1 flex-col gap-0.5",
					title: "font-semibold text-data text-workbench-text",
					description: "text-label text-workbench-muted-text",
					default: neutralGlyph,
					loading: neutralGlyph,
					success:
						"[&_[data-icon]]:bg-workbench-success [&_[data-icon]]:text-workbench-on-action",
					error:
						"[&_[data-icon]]:bg-workbench-danger [&_[data-icon]]:text-workbench-on-action",
					warning:
						"[&_[data-icon]]:bg-workbench-warning [&_[data-icon]]:text-workbench-on-action",
					info: "[&_[data-icon]]:bg-workbench-data [&_[data-icon]]:text-workbench-on-action",
					actionButton: `${buttonVariants({ variant: "outline", size: "xs" })} [--bevel-depth:3px]! [--bevel-edge:var(--color-pixel-utility-low)]!`,
					cancelButton: buttonVariants({ variant: "ghost", size: "xs" }),
					closeButton: `${buttonVariants({ variant: "ghost", size: "icon-xs" })} order-last text-workbench-muted-text`,
					...toastOptions?.classNames,
				},
			}}
		/>
	);
};

export { Toaster };
