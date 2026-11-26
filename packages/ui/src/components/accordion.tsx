import { Accordion as AccordionPrimitive } from "@base-ui/react/accordion";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

function Accordion({ className, ...props }: AccordionPrimitive.Root.Props) {
	return (
		<AccordionPrimitive.Root
			className={cn(
				"rounded-card bg-workbench-strip flex w-full flex-col shadow-[inset_0_0_0_1px_var(--color-workbench-panel-hover)]",
				className
			)}
			data-slot="accordion"
			{...props}
		/>
	);
}

function AccordionItem({ className, ...props }: AccordionPrimitive.Item.Props) {
	return (
		<AccordionPrimitive.Item
			className={cn(
				"border-workbench-divider px-4 not-first:border-t",
				className
			)}
			data-slot="accordion-item"
			{...props}
		/>
	);
}

function AccordionTrigger({
	className,
	children,
	...props
}: AccordionPrimitive.Trigger.Props) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				className={cn(
					"group/accordion-trigger rounded-tag text-action text-foreground focus-visible:focus-ring data-disabled:text-workbench-utility-disabled-text **:data-[slot=accordion-trigger-icon]:text-muted-foreground hover:**:data-[slot=accordion-trigger-icon]:text-foreground aria-expanded:**:data-[slot=accordion-trigger-icon]:text-foreground relative flex min-h-11 flex-1 items-center gap-4 py-3 text-left font-semibold transition-colors outline-none data-disabled:pointer-events-none **:data-[slot=accordion-trigger-icon]:ml-auto **:data-[slot=accordion-trigger-icon]:size-4",
					className
				)}
				data-slot="accordion-trigger"
				{...props}
			>
				{children}
				<ChevronDownIcon
					className="pointer-events-none shrink-0 group-aria-expanded/accordion-trigger:hidden"
					data-slot="accordion-trigger-icon"
				/>
				<ChevronUpIcon
					className="pointer-events-none hidden shrink-0 group-aria-expanded/accordion-trigger:inline"
					data-slot="accordion-trigger-icon"
				/>
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: AccordionPrimitive.Panel.Props) {
	return (
		<AccordionPrimitive.Panel
			className="data-closed:animate-accordion-up data-open:animate-accordion-down text-data overflow-hidden"
			data-slot="accordion-content"
			{...props}
		>
			<div
				className={cn(
					"text-muted-foreground [&_a]:text-workbench-link [&_a]:hover:text-workbench-action-light h-(--accordion-panel-height) pt-0 pb-5 leading-[22px] data-ending-style:h-0 data-starting-style:h-0 [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-3",
					className
				)}
			>
				{children}
			</div>
		</AccordionPrimitive.Panel>
	);
}

export { Accordion, AccordionContent, AccordionItem, AccordionTrigger };
