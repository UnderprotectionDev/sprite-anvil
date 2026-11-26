// Paper · 01 Components · Forms + inputs. The recessed well every text field,
// select trigger, choice control and listbox sits in: #141414 face, 1px #0A0A0A
// edge, inner shade on top, inner light on the bottom lip and a 1px rim below.
// Written as plain utilities (not the `well` utility) so `cn` can override the
// border, fill and shadow when a control sits inside another well.
export const wellSurfaceClassName =
	"border border-pixel-edge bg-workbench-preview shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim)]";

// The same well lifted off the page as a listbox: adds the 8/24 drop shadow.
export const wellPopupSurfaceClassName =
	"border border-pixel-edge bg-workbench-preview shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light),0_1px_0_var(--color-workbench-well-rim),0_8px_24px_var(--color-workbench-drop-shadow)]";

// Rail of a slider: the well without its edge or rim.
export const wellRailClassName =
	"bg-workbench-preview shadow-[inset_0_1px_2px_var(--color-workbench-well-shade),inset_0_-1px_0_var(--color-workbench-well-light)]";
