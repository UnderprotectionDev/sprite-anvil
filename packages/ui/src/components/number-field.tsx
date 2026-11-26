import { NumberField as NumberFieldPrimitive } from "@base-ui/react/number-field";
import { buttonVariants } from "@sprite-anvil/ui/components/button";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { MinusIcon, PlusIcon } from "lucide-react";
import type * as React from "react";

// Paper · 01 Components · 06 Extra primitives · Number field. A recessed 40px
// value well between two 40px raised step buttons; the unit sits inside the
// well and is read with the value. Arrow keys step by one, PageUp/PageDown by
// `largeStep` (Base UI defaults to ten).
function NumberField({ className, ...props }: NumberFieldPrimitive.Root.Props) {
	return (
		<NumberFieldPrimitive.Root
			className={cn("group/number-field flex flex-col gap-3", className)}
			data-slot="number-field"
			{...props}
		/>
	);
}

function NumberFieldGroup({
	className,
	...props
}: NumberFieldPrimitive.Group.Props) {
	return (
		<NumberFieldPrimitive.Group
			className={cn("flex items-center gap-2", className)}
			data-slot="number-field-group"
			{...props}
		/>
	);
}

const stepButtonClassName =
	"size-10 data-disabled:pointer-events-none data-disabled:bg-workbench-panel data-disabled:text-workbench-utility-disabled-text [&_svg:not([class*='size-'])]:size-4";

function NumberFieldDecrement({
	className,
	children,
	...props
}: NumberFieldPrimitive.Decrement.Props) {
	return (
		<NumberFieldPrimitive.Decrement
			className={cn(
				buttonVariants({ variant: "outline", size: "icon" }),
				stepButtonClassName,
				className
			)}
			data-slot="number-field-decrement"
			{...props}
		>
			{children ?? <MinusIcon aria-hidden="true" />}
		</NumberFieldPrimitive.Decrement>
	);
}

function NumberFieldIncrement({
	className,
	children,
	...props
}: NumberFieldPrimitive.Increment.Props) {
	return (
		<NumberFieldPrimitive.Increment
			className={cn(
				buttonVariants({ variant: "outline", size: "icon" }),
				stepButtonClassName,
				className
			)}
			data-slot="number-field-increment"
			{...props}
		>
			{children ?? <PlusIcon aria-hidden="true" />}
		</NumberFieldPrimitive.Increment>
	);
}

/** The recessed well that holds the input and its unit. */
function NumberFieldControl({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			className={cn(
				"well rounded-control focus-within:focus-ring has-aria-invalid:outline-destructive has-data-disabled:bg-workbench-utility-disabled has-data-disabled:text-workbench-utility-disabled-text flex h-10 min-w-0 flex-1 items-center gap-2 px-3 transition-colors has-aria-invalid:outline-2 has-aria-invalid:outline-offset-2",
				className
			)}
			data-slot="number-field-control"
			{...props}
		/>
	);
}

function NumberFieldInput({
	className,
	...props
}: NumberFieldPrimitive.Input.Props) {
	return (
		<NumberFieldPrimitive.Input
			className={cn(
				"text-body text-foreground placeholder:text-workbench-label-text disabled:text-workbench-utility-disabled-text h-full min-w-0 flex-1 bg-transparent font-mono tabular-nums outline-none focus-visible:outline-none! disabled:cursor-not-allowed",
				className
			)}
			data-slot="number-field-input"
			{...props}
		/>
	);
}

function NumberFieldUnit({
	className,
	...props
}: React.ComponentProps<"span">) {
	return (
		<span
			className={cn(
				"text-label text-workbench-faint-text shrink-0 font-mono select-none",
				className
			)}
			data-slot="number-field-unit"
			{...props}
		/>
	);
}

export {
	NumberField,
	NumberFieldControl,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
	NumberFieldUnit,
};
