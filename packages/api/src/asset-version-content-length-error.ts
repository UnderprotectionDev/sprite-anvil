export class AssetVersionContentLengthError extends Error {
	constructor() {
		super("Asset Version content length mismatch");
		this.name = "AssetVersionContentLengthError";
	}
}
