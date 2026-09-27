import type { CollectionCatalog } from "@sprite-anvil/api/collections";
import { Button } from "@sprite-anvil/ui/components/button";
import type { SyntheticEvent } from "react";

export function CollectionListPanel({
	collectionName,
	collections,
	memberships,
	onCollectionNameChange,
	onCreateCollection,
	onSelectCollection,
	savingOperation,
	selectedCollectionId,
	writesDisabled,
}: {
	collectionName: string;
	collections: CollectionCatalog["collections"];
	memberships: CollectionCatalog["memberships"];
	onCollectionNameChange: (name: string) => void;
	onCreateCollection: (event: SyntheticEvent<HTMLFormElement>) => void;
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

			<form className="space-y-3" onSubmit={onCreateCollection}>
				<div className="space-y-2">
					<label className="font-medium text-sm" htmlFor="collection-name">
						Koleksiyon adı
					</label>
					<input
						autoComplete="off"
						className="h-11 w-full rounded-md border bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
						id="collection-name"
						maxLength={120}
						name="name"
						onChange={(event) => onCollectionNameChange(event.target.value)}
						value={collectionName}
					/>
				</div>
				<Button
					className="min-h-11"
					disabled={writesDisabled || collectionName.trim().length === 0}
					type="submit"
				>
					{savingOperation === "create"
						? "Koleksiyon oluşturuluyor…"
						: "Koleksiyon oluştur"}
				</Button>
			</form>

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
								<button
									aria-pressed={selectedCollectionId === collection.id}
									className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
									disabled={savingOperation !== null}
									onClick={() => onSelectCollection(collection.id)}
									type="button"
								>
									<span className="truncate font-medium">
										{collection.name}
									</span>
									<span className="shrink-0 text-muted-foreground text-sm">
										{memberCount} kayıt
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</section>
	);
}
