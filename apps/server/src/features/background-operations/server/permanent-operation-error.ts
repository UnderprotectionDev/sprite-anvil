/** A failure another attempt cannot fix; `message` is shown to the user. */
export class PermanentOperationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "PermanentOperationError";
	}
}
