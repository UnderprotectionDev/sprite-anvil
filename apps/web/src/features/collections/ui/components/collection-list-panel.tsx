import type { CollectionCatalog } from "@sprite-anvil/api/collections";
import { Button } from "@sprite-anvil/ui/components/button";
import { Input } from "@sprite-anvil/ui/components/input";
import { Label } from "@sprite-anvil/ui/components/label";
import type { CollectionNameForm } from "../../hooks/use-collections-manager";

export function CollectionListPanel({
	collectionForm,
	collections,
	memberships,
	onSelectCollection,
	savingOperation,
	selectedCollectionId,
	writesDisabled,
}: {
	collectionForm: CollectionNameForm;
	collections: CollectionCatalog["collections"];
	memberships: CollectionCatalog["memberships"];
	onSelectCollection: (collectionId: string) => void;
	savingOperation: string | null;
	selectedCollectionId: string | null;
	writesDisabled: boolean;
}) {
	return (
		<section
			aria-labelledby="collections-heading"
			className="space-y-5 rounded-lg border p-5"
		>
			<header className="space-y-1">
				<h2 className="text-xl font-semibold" id="collections-heading">
					Your Collections
				</h2>
				<p className="text-muted-foreground text-sm">
					Collections organize records; they do not create family or delivery
					relationships.
				</p>
			</header>

			{collections.length === 0 ? (
				<p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
					No Collections yet. Enter a name to create your first Collection.
				</p>
			) : (
				<ul aria-label="Collections" className="space-y-2">
					{collections.map((collection) => {
						const memberCount = memberships.filter(
							(membership) => membership.collectionId === collection.id
						).length;
						return (
							<li key={collection.id}>
								<Button
									aria-pressed={selectedCollectionId === collection.id}
									className="h-auto min-h-11 w-full justify-between gap-3 px-3 py-2 text-left whitespace-normal"
									disabled={savingOperation !== null}
									onClick={() => onSelectCollection(collection.id)}
									type="button"
									variant="outline"
								>
									<span className="min-w-0 font-medium break-words">
										{collection.name}
									</span>
									<span className="text-muted-foreground shrink-0 text-sm">
										{memberCount} records
									</span>
								</Button>
							</li>
						);
					})}
				</ul>
			)}
			<details
				className="rounded-lg border p-3"
				open={collections.length === 0}
			>
				<summary className="focus-visible:outline-ring min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2">
					New Collection
				</summary>
				<form
					className="space-y-3"
					onSubmit={(event) => {
						event.preventDefault();
						event.stopPropagation();
						void collectionForm.handleSubmit();
					}}
				>
					<collectionForm.Field name="name">
						{(field) => (
							<div className="space-y-2">
								<Label
									className="text-sm font-medium"
									htmlFor="collection-name"
								>
									Collection name
								</Label>
								<Input
									autoComplete="off"
									className="h-11"
									id="collection-name"
									maxLength={120}
									name={field.name}
									onBlur={field.handleBlur}
									onChange={(event) => field.handleChange(event.target.value)}
									value={field.state.value}
								/>
							</div>
						)}
					</collectionForm.Field>
					<collectionForm.Subscribe selector={(state) => state.values.name}>
						{(collectionName) => (
							<Button
								className="min-h-11"
								disabled={writesDisabled || collectionName.trim().length === 0}
								type="submit"
							>
								{savingOperation === "create"
									? "Creating Collection…"
									: "Create Collection"}
							</Button>
						)}
					</collectionForm.Subscribe>
				</form>
			</details>
		</section>
	);
}
