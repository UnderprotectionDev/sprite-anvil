function messagesOf(errors: unknown[]) {
	return errors.flatMap((error) =>
		typeof error === "object" && error !== null && "message" in error
			? [String(error.message)]
			: []
	);
}

function errorListId(fieldId: string) {
	return `${fieldId}-errors`;
}

/**
 * The attributes that tie an input to its `FieldErrors` list: marked invalid and
 * described by the list only while it shows a message.
 */
export function fieldErrorAttributes(fieldId: string, errors: unknown[]) {
	return messagesOf(errors).length === 0
		? {}
		: {
				"aria-describedby": errorListId(fieldId),
				"aria-invalid": true as const,
			};
}

/** The messages for one input, announced when they appear; `fieldId` is that input's id. */
export function FieldErrors({
	errors,
	fieldId,
}: {
	errors: unknown[];
	fieldId: string;
}) {
	const messages = messagesOf(errors);
	if (messages.length === 0) {
		return null;
	}
	return (
		<ul
			className="space-y-1 text-destructive text-sm"
			id={errorListId(fieldId)}
			role="alert"
		>
			{messages.map((message) => (
				<li key={message}>{message}</li>
			))}
		</ul>
	);
}
