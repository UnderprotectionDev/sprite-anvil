/** Hands the zip to the browser as a file download. */
export function downloadZip(bytes: Uint8Array, fileName: string) {
	const url = URL.createObjectURL(
		new Blob([Uint8Array.from(bytes)], { type: "application/zip" })
	);
	const link = document.createElement("a");
	link.href = url;
	link.download = fileName;
	link.click();
	URL.revokeObjectURL(url);
}
