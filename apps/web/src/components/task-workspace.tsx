import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@sprite-anvil/ui/components/tabs";
import type { ReactNode } from "react";

export interface TaskSection {
	content: ReactNode;
	description: string;
	id: string;
	label: string;
}

/** Keep panels mounted so unsaved drafts survive task changes. */
export function TaskWorkspace({
	label,
	sections,
	initialSection,
}: {
	label: string;
	sections: TaskSection[];
	initialSection?: string;
}) {
	const selected =
		sections.find(({ id }) => id === initialSection) ?? sections[0];
	return (
		<Tabs className="min-w-0 gap-6" defaultValue={selected?.id}>
			<nav aria-label={label}>
				<TabsList
					aria-label={label}
					className="bg-card flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg border p-2"
				>
					{sections.map((section) => (
						<TabsTrigger
							className="min-h-11 flex-none px-3 text-left whitespace-normal"
							key={section.id}
							value={section.id}
						>
							{section.label}
						</TabsTrigger>
					))}
				</TabsList>
			</nav>
			{sections.map((section) => (
				<TabsContent keepMounted key={section.id} value={section.id}>
					<section aria-label={section.label} className="min-w-0 space-y-4">
						<p className="text-muted-foreground text-sm leading-relaxed">
							{section.description}
						</p>
						{section.content}
					</section>
				</TabsContent>
			))}
		</Tabs>
	);
}
