export class AssetVersionIntegrityError extends Error {
	constructor() {
		super("Asset Version content failed integrity validation");
		this.name = "AssetVersionIntegrityError";
	}
}
