import { Label } from "@sprite-anvil/ui/components/label";
import { Separator } from "@sprite-anvil/ui/components/separator";
import { cn } from "@sprite-anvil/ui/lib/utils";
import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { CircleAlertIcon } from "lucide-react";
import { useMemo } from "react";

function FieldSet({ className, ...props }: React.ComponentProps<"fieldset">) {
	return (
		<fieldset
			className={cn(
				"flex flex-col gap-4 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3",
				className
			)}
			data-slot="field-set"
			{...props}
		/>
	);
}

function FieldLegend({
	className,
	variant = "legend",
	...props
}: React.ComponentProps<"legend"> & { variant?: "legend" | "label" }) {
	return (
		<legend
			className={cn(
				"data-[variant=label]:text-data data-[variant=legend]:text-subhead text-foreground mb-3 data-[variant=label]:font-medium data-[variant=legend]:font-semibold",
				className
			)}
			data-slot="field-legend"
			data-variant={variant}
			{...props}
		/>
	);
}

function FieldGroup({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"group/field-group @container/field-group flex w-full flex-col gap-5 data-[slot=checkbox-group]:gap-3 *:data-[slot=field-group]:gap-4",
				className
			)}
			data-slot="field-group"
			{...props}
		/>
	);
}

const fieldVariants = cva("group/field flex w-full gap-2", {
	variants: {
		orientation: {
			vertical: "flex-col *:w-full [&>.sr-only]:w-auto",
			horizontal:
				"flex-row items-center gap-x-2.5 has-[>[data-slot=field-content]]:items-start *:data-[slot=field-label]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-0.5",
			responsive:
				"flex-col *:w-full @md/field-group:flex-row @md/field-group:items-center @md/field-group:*:w-auto @md/field-group:has-[>[data-slot=field-content]]:items-start @md/field-group:*:data-[slot=field-label]:flex-auto [&>.sr-only]:w-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
		},
	},
	defaultVariants: {
		orientation: "vertical",
	},
});

function Field({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof fieldVariants>) {
	return (
		<div
			className={cn(fieldVariants({ orientation }), className)}
			data-orientation={orientation}
			data-slot="field"
			role="group"
			{...props}
		/>
	);
}

function FieldContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"group/field-content flex flex-1 flex-col gap-1",
				className
			)}
			data-slot="field-content"
			{...props}
		/>
	);
}

function FieldLabel({
	className,
	...props
}: React.ComponentProps<typeof Label>) {
	return (
		// biome-ignore lint/a11y/noLabelWithoutControl: pass-through label; the caller supplies htmlFor or the wrapped control.
		<Label
			className={cn(
				"group/field-label peer/field-label group-data-[disabled=true]/field:text-workbench-faint-text flex w-fit gap-2",
				// Choice card (a label wrapping a Field): flat 1px outline; the chosen card is
				// a raised #333333 face with the focus-blue outline offset 2px.
				"has-[>[data-slot=field]]:rounded-control has-[>[data-slot=field]]:border-workbench-panel-hover has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col has-[>[data-slot=field]]:border has-[>[data-slot=field]]:transition-colors has-[>[data-slot=field]]:duration-120 *:data-[slot=field]:px-4 *:data-[slot=field]:py-3.5",
				"has-[>[data-slot=field]]:has-data-checked:border-workbench-control has-[>[data-slot=field]]:has-data-checked:bg-workbench-panel has-[>[data-slot=field]]:has-data-checked:focus-ring has-[>[data-slot=field]]:has-[:focus-visible]:focus-ring has-[>[data-slot=field]]:has-data-checked:shadow-[inset_0_1px_0_var(--color-workbench-raised-light),0_1px_0_var(--color-pixel-edge)]",
				className
			)}
			data-slot="field-label"
			{...props}
		/>
	);
}

function FieldTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"text-data text-foreground group-data-[disabled=true]/field:text-workbench-utility-disabled-text flex w-fit items-center gap-2 font-medium",
				className
			)}
			data-slot="field-label"
			{...props}
		/>
	);
}

function FieldDescription({ className, ...props }: React.ComponentProps<"p">) {
	return (
		<p
			className={cn(
				"text-label text-muted-foreground text-left font-normal group-has-data-horizontal/field:text-balance [[data-variant=legend]+&]:-mt-1.5",
				"[&>a:hover]:text-workbench-action-light [&>a]:text-workbench-link [&>a]:underline [&>a]:underline-offset-4",
				className
			)}
			data-slot="field-description"
			{...props}
		/>
	);
}

function FieldSeparator({
	children,
	className,
	...props
}: React.ComponentProps<"div"> & {
	children?: React.ReactNode;
}) {
	return (
		<div
			className={cn(
				"text-label relative -my-2 h-5 group-data-[variant=outline]/field-group:-mb-2",
				className
			)}
			data-content={!!children}
			data-slot="field-separator"
			{...props}
		>
			<Separator className="absolute inset-0 top-1/2" />
			{children ? (
				<span
					className="bg-background text-workbench-faint-text relative mx-auto block w-fit px-2"
					data-slot="field-separator-content"
				>
					{children}
				</span>
			) : null}
		</div>
	);
}

function FieldError({
	className,
	children,
	errors,
	...props
}: React.ComponentProps<"div"> & {
	errors?: Array<{ message?: string } | undefined>;
}) {
	const content = useMemo(() => {
		if (children) {
			return children;
		}

		if (!errors?.length) {
			return null;
		}

		const uniqueErrors = [
			...new Map(errors.map((error) => [error?.message, error])).values(),
		];

		if (uniqueErrors.length === 1) {
			return uniqueErrors[0]?.message;
		}

		return (
			<ul className="ml-4 flex list-disc flex-col gap-1">
				{uniqueErrors.map((error) =>
					error?.message ? <li key={error.message}>{error.message}</li> : null
				)}
			</ul>
		);
	}, [children, errors]);

	if (!content) {
		return null;
	}

	return (
		<div
			className={cn(
				"text-label text-workbench-danger-soft flex items-start gap-1.5 font-normal",
				className
			)}
			data-slot="field-error"
			role="alert"
			{...props}
		>
			<CircleAlertIcon
				aria-hidden="true"
				className="text-workbench-danger-hover mt-px size-4 shrink-0"
			/>
			<div className="min-w-0 flex-1">{content}</div>
		</div>
	);
}

export {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
};
