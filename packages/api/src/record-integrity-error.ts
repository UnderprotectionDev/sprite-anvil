/** A published record failed its digest or relation check and was not reported as success. */
export class RecordIntegrityError extends Error {
	constructor(message: string, options?: ErrorOptions) {
		super(message, options);
		this.name = "RecordIntegrityError";
	}
}
