// Paper · 01 Components · 03 Navigation + menus: the one shared menu recipe used by
// dropdown, context and menubar menus, the navigation-menu panel and the command
// palette. A recessed #141414 well with a 1px edge and soft drop shadow, radius 8,
// no bevel, 8px inset, 36px rows with a 16px icon lane, a flat highlighted row and
// Geist Mono 12/16 shortcuts on the right.

/** Recessed well shading without the drop shadow (open triggers, search wells). */
export const menuWellClassName =
	"border border-pixel-edge bg-workbench-preview shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)]";

/** The floating menu panel: recessed well plus the soft drop shadow. */
export const menuPanelClassName =
	"rounded-card border border-pixel-edge bg-workbench-preview p-2 text-workbench-text shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim),0_8px_24px_var(--color-workbench-drop-shadow)] outline-none focus-visible:outline-none!";

/** Open and close motion shared by positioned menu popups. */
export const menuMotionClassName =
	"data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:fade-in-0 data-open:zoom-in-95 data-closed:fade-out-0 data-closed:zoom-out-95 data-closed:animate-out data-open:animate-in duration-100";

/**
 * A 36px menu row without state selectors (cmdk and Base UI mark state
 * differently). Icons that are direct children sit in the 16px lane and read
 * `--menu-icon`; shortcuts read `--menu-shortcut`. A trailing chevron opts out
 * of the icon colour with `data-chevron` and stays faint.
 */
export const menuRowClassName =
	"relative flex h-9 cursor-default items-center gap-2 rounded-control-sm px-2 font-medium text-data text-workbench-text outline-hidden focus-visible:outline-none! select-none [--menu-icon:var(--color-workbench-muted-text)] [--menu-shortcut:var(--color-workbench-muted-text)] data-[variant=destructive]:text-workbench-danger data-[variant=destructive]:[--menu-icon:var(--color-workbench-danger-hover)] data-inset:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:not([data-chevron])]:[color:var(--menu-icon)]";

/**
 * A Base UI menu row: muted icons at rest, full text and a flat #333333 row when
 * highlighted, danger text on a destructive row, label grey when disabled.
 */
export const menuItemClassName = `${menuRowClassName} data-highlighted:bg-workbench-panel not-data-[variant=destructive]:data-highlighted:[--menu-icon:var(--color-workbench-text)] data-disabled:pointer-events-none data-disabled:text-workbench-label-text data-disabled:[--menu-icon:var(--color-workbench-label-text)] data-disabled:[--menu-shortcut:var(--color-workbench-label-text)]`;

/** Check and radio rows keep the indicator in the leading 16px lane. */
export const menuChoiceItemClassName = `${menuItemClassName} pl-8`;

/** The leading 16px indicator lane of a check or radio row. */
export const menuIndicatorClassName =
	"pointer-events-none absolute left-2 flex size-4 items-center justify-center";

/** The selected radio dot: a filled nav-chip dot in the 16px lane. */
export const menuRadioDotClassName = "size-2.25 rounded-full bg-workbench-nav";

/** The trailing submenu chevron: faint, outside the icon colour rule. */
export const menuChevronClassName = "ml-auto size-4 text-workbench-faint-text";

/** A label naming the subject of the menu; extra content sits on the right. */
export const menuLabelClassName =
	"flex h-8 items-center justify-between gap-2 px-2 font-semibold text-label text-workbench-faint-text data-inset:pl-8";

/** A 1px divider inside the 8px inset with 4px above and below. */
export const menuSeparatorClassName = "my-1 h-px shrink-0 bg-workbench-divider";

/**
 * Shortcut text on the right of a row. Inter, because Geist Mono lacks the key
 * symbols and the fallback glyphs sit at uneven sizes.
 */
export const menuShortcutClassName =
	"ml-auto font-sans font-medium text-[13px] leading-4 tracking-[0.08em] [color:var(--menu-shortcut,var(--color-workbench-muted-text))]";
