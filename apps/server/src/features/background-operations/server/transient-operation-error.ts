/** A failure worth another attempt; `message` is shown to the user. */
export class TransientOperationError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "TransientOperationError";
	}
}
