/** The first eight characters of an id, enough to tell records apart on screen. */
export function shortId(id: string) {
	return id.slice(0, 8);
}
