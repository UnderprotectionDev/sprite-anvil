export class ImportInboxIntegrityError extends Error {
	constructor() {
		super("Import Inbox file checksum does not match its managed record");
		this.name = "ImportInboxIntegrityError";
	}
}
