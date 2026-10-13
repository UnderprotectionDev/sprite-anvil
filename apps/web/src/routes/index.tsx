import { buttonVariants } from "@sprite-anvil/ui/components/button";
import { createFileRoute, Link } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/")({ component: HomeComponent });

function HomeComponent() {
	const { data: session } = authClient.useSession();
	return (
		<main className="mx-auto w-full max-w-5xl space-y-10 px-4 py-12 sm:px-6">
			<header className="max-w-3xl space-y-5">
				<p className="font-mono text-primary text-sm">Sprite Anvil</p>
				<h1 className="font-semibold text-4xl leading-tight sm:text-5xl">
					Oyun görsellerinizi tek yerde yönetin.
				</h1>
				<p className="text-lg text-muted-foreground">
					Bir oyun projesi seçin; görsel kurallarını belirleyin, varlıkları
					bulun ve sürümlerini inceleyin.
				</p>
				{session ? (
					<Link className={`${buttonVariants()} min-h-11`} to="/projects">
						Oyun projelerini aç
					</Link>
				) : (
					<Link className={`${buttonVariants()} min-h-11`} to="/login">
						Başlamak için giriş yap
					</Link>
				)}
			</header>
			<ol className="grid gap-4 sm:grid-cols-3">
				{[
					[
						"1 · Projenizi açın",
						"Yeni bir oyun projesi oluşturun veya mevcut projenize devam edin.",
					],
					[
						"2 · Varlıklarınızı bulun",
						"Kayıtları arayın, koleksiyonlarda düzenleyin veya dosyaları içe aktarın.",
					],
					[
						"3 · Çalışmayı sürdürün",
						"Bir kaydı açarak sürümlerine, üretim paketlerine ve inceleme kanıtlarına ulaşın.",
					],
				].map(([title, description]) => (
					<li className="space-y-3 rounded-lg border bg-card p-6" key={title}>
						<h2 className="font-semibold text-lg">{title}</h2>
						<p className="text-muted-foreground text-sm leading-relaxed">
							{description}
						</p>
					</li>
				))}
			</ol>
		</main>
	);
}
