/** A write lost to a concurrent change and can be sent again unchanged. */
export class RetryablePublicationError extends Error {
	constructor(record: string) {
		super(`${record} was not published because of a concurrent change.`);
		this.name = "RetryablePublicationError";
	}
}
