import {
	type DeliveryRefreshClassification,
	type DeliveryRefreshDecisionKind,
	type DeliveryRefreshPathClass,
	deliveryRefreshPathClasses,
} from "@sprite-anvil/api/delivery-refresh-classification";
import type { ReactNode } from "react";
import { pathClassSections } from "../../lib/path-class-sections";
import type { ChosenFolder } from "../../lib/read-target-folder";
import { DivergedPath } from "./diverged-path";
import { PathClassSection, PathList } from "./path-class-section";

/** The five path classes, each listed apart; a diverged path asks for the user's decision. */
export function PathClassSections({
	bundleTexts,
	classification,
	decided,
	onDecide,
	onShowDiff,
	target,
	viewed,
}: {
	bundleTexts: Map<string, string | null>;
	classification: DeliveryRefreshClassification;
	decided: Record<string, DeliveryRefreshDecisionKind>;
	onDecide: (path: string, kind: DeliveryRefreshDecisionKind) => void;
	onShowDiff: (path: string) => void;
	target: ChosenFolder | null;
	viewed: Record<string, boolean>;
}) {
	const entriesOf = (name: DeliveryRefreshPathClass) =>
		classification.entries.filter((entry) => entry.class === name);
	return deliveryRefreshPathClasses.map((name) => {
		const entries = entriesOf(name);
		const { description, title } = pathClassSections[name];
		let content: ReactNode = null;
		if (entries.length > 0) {
			content =
				name === "diverged" ? (
					<ul className="space-y-3">
						{entries.map((entry) => (
							<DivergedPath
								bundleText={bundleTexts.get(entry.path) ?? null}
								decision={decided[entry.path]}
								diffViewed={viewed[entry.path] === true}
								entry={entry}
								folderToken={target?.token ?? 0}
								key={entry.path}
								onDecide={(kind) => onDecide(entry.path, kind)}
								onShowDiff={() => onShowDiff(entry.path)}
								targetFile={target?.files.get(entry.path)}
							/>
						))}
					</ul>
				) : (
					<PathList paths={entries.map((entry) => entry.path)} />
				);
		}
		return (
			<PathClassSection
				count={entries.length}
				description={description}
				id={name}
				key={name}
				title={title}
			>
				{content}
			</PathClassSection>
		);
	});
}
