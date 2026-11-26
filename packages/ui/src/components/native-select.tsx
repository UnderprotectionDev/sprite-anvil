import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectTrigger,
} from "@sprite-anvil/ui/components/select";
import { cn } from "@sprite-anvil/ui/lib/utils";
import { wellSurfaceClassName } from "@sprite-anvil/ui/lib/well-surface";
import { ChevronDownIcon } from "lucide-react";
import * as React from "react";

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
	size?: "sm" | "default";
};

interface ListedOption {
	disabled: boolean;
	index: number;
	label: string;
}

interface ListedGroup {
	label: string | null;
	options: ListedOption[];
}

interface OpenList {
	groups: ListedGroup[];
	/** The field name, repeated on the popup for screen readers. */
	name: string | undefined;
	selected: number;
}

const OPEN_KEYS = new Set(["Enter", " ", "ArrowDown", "ArrowUp"]);

function readName(select: HTMLSelectElement): string | undefined {
	const ids = select.getAttribute("aria-labelledby")?.split(" ") ?? [];
	const referenced = ids.map((id) => document.querySelector(`[id="${id}"]`));
	const sources = ids.length > 0 ? referenced : [...(select.labels ?? [])];
	const text = sources.map((source) => {
		// A wrapping label also contains the options; they are not its name.
		const copy = source?.cloneNode(true) as Element | undefined;
		for (const nested of copy?.querySelectorAll("select") ?? []) {
			nested.remove();
		}
		return copy?.textContent?.trim();
	});
	return (
		select.getAttribute("aria-label") ||
		text.filter(Boolean).join(" ") ||
		undefined
	);
}

function readList(select: HTMLSelectElement): OpenList {
	const groups: ListedGroup[] = [];
	let parent: Element | null = null;
	for (const option of select.options) {
		if (option.hidden) {
			continue;
		}
		const optgroup =
			option.parentElement instanceof HTMLOptGroupElement
				? option.parentElement
				: null;
		let group = groups.at(-1);
		if (!group || parent !== optgroup) {
			group = { label: optgroup?.label ?? null, options: [] };
			groups.push(group);
			parent = optgroup;
		}
		group.options.push({
			disabled: option.disabled || Boolean(optgroup?.disabled),
			index: option.index,
			label: option.label,
		});
	}
	return { groups, name: readName(select), selected: select.selectedIndex };
}

// Paper · 01 Components · Native Select. A real select in the input well, so
// value, onChange and forms work as usual. Browsers draw the open list with the
// OS menu, so pointer and keyboard open the Select list over it instead.
function NativeSelect({
	className,
	size = "default",
	onChange,
	onKeyDown,
	onMouseDown,
	ref,
	...props
}: NativeSelectProps) {
	const selectRef = React.useRef<HTMLSelectElement>(null);
	const [list, setList] = React.useState<OpenList | null>(null);
	React.useImperativeHandle(
		ref,
		() => selectRef.current as HTMLSelectElement,
		[]
	);

	// Options can change while the list is open (a query refetch); re-read them so
	// the row that is clicked is the option that gets selected.
	const isOpen = list !== null;
	React.useEffect(() => {
		const select = selectRef.current;
		if (!(isOpen && select)) {
			return;
		}
		const observer = new MutationObserver(() => setList(readList(select)));
		observer.observe(select, {
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true,
		});
		return () => observer.disconnect();
	}, [isOpen]);

	const open = () => {
		const select = selectRef.current;
		if (select && !(select.multiple || select.size > 1 || select.disabled)) {
			select.focus();
			setList(readList(select));
		}
	};

	const choose = (index: number) => {
		const select = selectRef.current;
		setList(null);
		if (select && select.selectedIndex !== index) {
			select.selectedIndex = index;
			select.dispatchEvent(new Event("input", { bubbles: true }));
			select.dispatchEvent(new Event("change", { bubbles: true }));
		}
	};

	return (
		<div
			className={cn("group/native-select relative w-fit", className)}
			data-size={size}
			data-slot="native-select-wrapper"
		>
			<select
				className={cn(
					wellSurfaceClassName,
					"rounded-control text-data text-foreground selection:bg-workbench-selection selection:text-workbench-on-selection focus-visible:focus-ring aria-invalid:outline-destructive aria-invalid:focus-visible:outline-destructive! disabled:text-workbench-utility-disabled-text has-[option[value='']:checked]:text-workbench-faint-text h-10 w-full min-w-0 appearance-none py-0 pr-9 pl-3 outline-0 transition-colors duration-120 select-none disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:outline-2 aria-invalid:outline-offset-2 data-[size=sm]:h-9"
				)}
				data-size={size}
				data-slot="native-select"
				onChange={(event) => {
					setList(null);
					onChange?.(event);
				}}
				onKeyDown={(event) => {
					onKeyDown?.(event);
					if (!event.defaultPrevented && OPEN_KEYS.has(event.key)) {
						event.preventDefault();
						open();
					}
				}}
				onMouseDown={(event) => {
					onMouseDown?.(event);
					if (!event.defaultPrevented && event.button === 0) {
						event.preventDefault();
						open();
					}
				}}
				ref={selectRef}
				{...props}
			/>
			<ChevronDownIcon
				aria-hidden="true"
				className="text-workbench-faint-text pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 select-none"
				data-slot="native-select-icon"
			/>
			{list ? (
				<Select
					onOpenChange={(next) => {
						if (!next) {
							setList(null);
						}
					}}
					onValueChange={(value) => choose(Number(value))}
					open
					value={String(list.selected)}
				>
					{/* Anchor only: the select above stays the focusable control. */}
					<SelectTrigger
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10 h-full w-full opacity-0"
						tabIndex={-1}
					/>
					<SelectContent
						align="start"
						alignItemWithTrigger={false}
						finalFocus={selectRef}
						listLabel={list.name}
					>
						{list.groups.map((group) => (
							<SelectGroup key={group.options[0]?.index}>
								{group.label ? <SelectLabel>{group.label}</SelectLabel> : null}
								{group.options.map((option) => (
									<SelectItem
										disabled={option.disabled}
										key={option.index}
										value={String(option.index)}
									>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						))}
					</SelectContent>
				</Select>
			) : null}
		</div>
	);
}

function NativeSelectOption({
	className,
	...props
}: React.ComponentProps<"option">) {
	return (
		<option
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			data-slot="native-select-option"
			{...props}
		/>
	);
}

function NativeSelectOptGroup({
	className,
	...props
}: React.ComponentProps<"optgroup">) {
	return (
		<optgroup
			className={cn("bg-[Canvas] text-[CanvasText]", className)}
			data-slot="native-select-optgroup"
			{...props}
		/>
	);
}

export { NativeSelect, NativeSelectOptGroup, NativeSelectOption };
