export function FieldErrors({ errors }: { errors: unknown[] }) {
	const messages = errors.flatMap((error) =>
		typeof error === "object" && error !== null && "message" in error
			? [String(error.message)]
			: []
	);
	if (messages.length === 0) {
		return null;
	}
	return (
		<ul className="space-y-1 text-destructive text-sm">
			{messages.map((message) => (
				<li key={message}>{message}</li>
			))}
		</ul>
	);
}
