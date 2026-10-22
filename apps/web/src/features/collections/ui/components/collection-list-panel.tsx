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
				<h2 className="font-semibold text-xl" id="collections-heading">
					Koleksiyonlarınız
				</h2>
				<p className="text-muted-foreground text-sm">
					Koleksiyonlar kayıtları düzenler; aile veya teslimat ilişkisi
					oluşturmaz.
				</p>
			</header>

			{collections.length === 0 ? (
				<p className="rounded-lg border border-dashed p-4 text-muted-foreground text-sm">
					Henüz Koleksiyon yok. Adını yazarak ilk Koleksiyonunuzu oluşturun.
				</p>
			) : (
				<ul aria-label="Koleksiyonlar" className="space-y-2">
					{collections.map((collection) => {
						const memberCount = memberships.filter(
							(membership) => membership.collectionId === collection.id
						).length;
						return (
							<li key={collection.id}>
								<Button
									aria-pressed={selectedCollectionId === collection.id}
									className="h-auto min-h-11 w-full justify-between gap-3 whitespace-normal px-3 py-2 text-left"
									disabled={savingOperation !== null}
									onClick={() => onSelectCollection(collection.id)}
									type="button"
									variant="outline"
								>
									<span className="min-w-0 break-words font-medium">
										{collection.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-sm">
										{memberCount} kayıt
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
				<summary className="min-h-11 cursor-pointer py-3 font-medium focus-visible:outline-2 focus-visible:outline-ring">
					Yeni Koleksiyon
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
									className="font-medium text-sm"
									htmlFor="collection-name"
								>
									Koleksiyon adı
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
									? "Koleksiyon oluşturuluyor…"
									: "Koleksiyon oluştur"}
							</Button>
						)}
					</collectionForm.Subscribe>
				</form>
			</details>
		</section>
	);
}
