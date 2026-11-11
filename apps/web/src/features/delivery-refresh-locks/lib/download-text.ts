/** Hands a JSON document to the user as a file download. */
export function downloadJson(text: string, filename: string) {
	const url = URL.createObjectURL(
		new Blob([text], { type: "application/json" })
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
