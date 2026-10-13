import { Button } from "@sprite-anvil/ui/components/button";
import { type ReactNode, useId, useState } from "react";

export interface TaskSection {
	content: ReactNode;
	description: string;
	id: string;
	label: string;
}

/** App workspace navigation. Keep panels mounted so unsaved drafts survive task changes. */
export function TaskWorkspace({
	label,
	sections,
	initialSection,
}: {
	label: string;
	sections: TaskSection[];
	initialSection?: string;
}) {
	const workspaceId = useId();
	const [selectedId, setSelectedId] = useState(
		initialSection ?? sections[0]?.id
	);
	const selected =
		sections.find((section) => section.id === selectedId) ?? sections[0];
	return (
		<div className="min-w-0 space-y-6">
			<nav
				aria-label={label}
				className="flex flex-wrap gap-2 rounded-lg border bg-card p-2"
			>
				{sections.map((section) => (
					<Button
						aria-controls={`${workspaceId}-${section.id}`}
						aria-pressed={selected?.id === section.id}
						className="min-h-11 whitespace-normal text-left"
						key={section.id}
						onClick={() => setSelectedId(section.id)}
						type="button"
						variant={selected?.id === section.id ? "default" : "ghost"}
					>
						{section.label}
					</Button>
				))}
			</nav>
			{sections.map((section) => (
				<section
					aria-label={section.label}
					className="min-w-0 space-y-6"
					hidden={selected?.id !== section.id}
					id={`${workspaceId}-${section.id}`}
					key={section.id}
				>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{section.description}
					</p>
					{section.content}
				</section>
			))}
		</div>
	);
}
