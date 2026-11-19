export class ImportInboxContentLengthError extends Error {
	constructor() {
		super("Import Inbox file content length does not match its declaration");
		this.name = "ImportInboxContentLengthError";
	}
}
