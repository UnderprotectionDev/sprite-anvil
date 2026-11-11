import type { ReactNode } from "react";

/** One path class of the review, listed apart from every other class. */
export function PathClassSection({
	children,
	count,
	description,
	id,
	title,
}: {
	children?: ReactNode;
	count: number;
	description: string;
	id: string;
	title: string;
}) {
	return (
		<section
			aria-labelledby={`path-class-${id}`}
			className="space-y-2 border-t pt-4"
		>
			<h3 className="font-semibold text-base" id={`path-class-${id}`}>
				{title} ({count})
			</h3>
			<p className="text-muted-foreground text-sm">{description}</p>
			{children ?? (count === 0 ? <p className="text-sm">No paths.</p> : null)}
		</section>
	);
}

export function PathList({ paths }: { paths: string[] }) {
	return (
		<ul className="space-y-1 font-mono text-sm">
			{paths.map((path) => (
				<li key={path}>{path}</li>
			))}
		</ul>
	);
}
