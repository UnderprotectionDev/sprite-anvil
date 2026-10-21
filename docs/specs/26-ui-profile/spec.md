# Arayüz Ekranı ve Bileşen Profilini Uygulama

## Problem Statement

Arayüz ekranları ve bileşen durumları aile stili, doğal ölçü, dokuz parçalı germe, metin güvenli alanı ve hedef boyut davranışıyla sınanır. Arayüz ekranı ile panel ve düğme gibi Türetilmiş Varlık niteliğindeki bileşenler kendi Görsel Dünyasında bir aile olur.

## Solution

Arayüz ekranları ve bileşen durumları aile stili, doğal ölçü, dokuz parçalı germe, metin güvenli alanı ve hedef boyut davranışıyla sınanır.

Arayüz ekranı ile panel ve düğme gibi Türetilmiş Varlık niteliğindeki bileşenler kendi Görsel Dünyasında bir aile olur. Durum kimliği ve germe alanı kesin metadata olarak taşınır.

Tamamlanma kanıtı: Bileşen durumları tutarlı görünür, panel hedef ölçülerde ve metin güvenli alanını koruyarak genişler; aynı sonuç dışa aktarımda okunur.

## User Stories

1. Bir kullanıcı olarak arayüz ekranını ve ondan türeyen panel, düğme veya benzeri bileşenleri kendi Görsel Dünyasında ilişkilendirmek istiyorum; böylece arayüz kuralları oyun içi sanattan ayrılır.
2. Bir kullanıcı olarak normal, seçili, basılı, devre dışı, açık veya kapalı bileşen durumlarını birlikte incelemek istiyorum; böylece durumlar aile stiliyle karşılaştırılır.
3. Bir kullanıcı olarak doğal ölçü ve dokuz parçalı germe paylarını kaydetmek istiyorum; böylece panel farklı hedef boyutlara uyarlanırken köşeler korunur.
4. Bir kullanıcı olarak paneli hedef ölçülerde ve metin güvenli alanı görünürken denemek istiyorum; böylece metin veya içerik germe alanına taşmaz.
5. Bir kullanıcı olarak durum kimliğini, germe alanını ve ekran-bileşen bağlantısını kesin metadata olarak korumak istiyorum; böylece dışa aktarım eşlemesi yeniden okunabilir.
6. Bir kullanıcı olarak düzeltilen bileşen durumunu yeni ekran düzeninde sınamak istiyorum; böylece tekil düzeltmenin aile ve yerleşime etkisini görebilirim.
7. Bir kullanıcı olarak bu profilin görsel bileşenleri değerlendirmesini, oyun etkileşim kodu veya genel arayüz çatısı üretmemesini istiyorum; böylece kullanım sınırı belirgin kalır.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Ekran ve Bileşen Durumlarını Karşılaştırma:** Ekran tasarımıyla normal, üzerine gelme, basılı, devre dışı, seçili, açık ve kapalı durumlar aynı aile stilinde incelenir. Ekran ve panel, düğme, eşya gözü gibi bileşenler aynı aile sınırında görünür. Normal, üzerine gelme, basılı, devre dışı ve seçili durumları karışmadan karşılaştırılır; durum kimlikleri dışa aktarımda korunur.
- **Germe ve Metin Alanını Sınama:** Doğal ölçü, dokuz parçalı germe payları ve metin güvenli alanı belirtilen hedef boyutlarda bozulmadan çalışır. Panelin dokuz parçalı germe payları köşeleri bozmadan farklı hedef ölçülerde uygulanır. Metin güvenli alanı ve doğal ölçü birlikte görülür; geçersiz pay veya sınır sözleşmedeki sınıfına göre değerlendirilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-07 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Ekran ve Bileşen Durumlarını Karşılaştırma için `uiStateComparisons.save/list` API sınırı, aynı ailedeki kesin ekran ve bileşen görsellerini, benzersiz bileşen/durum eşlemelerini, isteğe bağlı durum Birim Sürümlerini ve kullanıcı gözlemlerini kaydedip yeniden okur. Yetkisiz erişim, aile dışı veya silinmiş sürüm, etkin olmayan/değişmiş sözleşme, geçersiz görsel alanı, çakışan durum ve belirsiz yazma sonuçları ayrıca sınanır. Web ve masaüstü ortak arayüzü kaydetme, yeniden okuma ve aynı işlem kimliğiyle yeniden denemeyi sunar. İnceleme JSON arşivi durum eşlemelerini ve tam sürümleri korur; Dışa Aktarım Paketi veya germe/metin testi kanıtı değildir.
- Kaydedilmiş karşılaştırmanın sonucu yalnızca seçili ekran ve bileşen durumlarına aittir. Kayıt, tek başına tüm durumların geçtiği veya ailenin tam Özel Profil kanıtını tamamladığı anlamına gelmez; diğer sözleşme testleri ve tamamlanma değerlendirmesi ayrı kalır.
- #132 germe testi bu dosyanın aşağıdaki uygulama ve test kararlarıyla tanımlıdır. Diğer alt fazlar için mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Bileşen durumları tutarlı görünür, panel hedef ölçülerde ve metin güvenli alanını koruyarak genişler; aynı sonuç dışa aktarımda okunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.
- Kabul örnekleri: RAS-07. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.

## Further Notes

- Tek faz kaynağı: [`26-ui-profile/phase-context.md`](../../workflow/26-ui-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-07](../../prd/10-acceptance-scenarios.md)
- #132 uygulaması germe testi ve statik metadata eşlemesini içerir; tam RAS-07, ayrı aile/durum incelemesi, Dışa Aktarım Paketi ve motor doğrulaması teslim edilmiş sayılmaz. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.

## Germe ve Metin Alanını Sınama — #132 implementation

- **Sahiplik:** `packages/api/src/ui-stretch-tests.ts` ve `ui-profile-export.ts` kesin sözleşmeyi ve deterministik geometrik kanıtı; `apps/server/src/features/ui-profile/server/` kalıcı kaydı; `apps/web/src/features/ui-profile/ui/components/` ortak web/masaüstü arayüzünü sahiplenir. Mevcut örnekler: `packages/api/src/routers/background-layer-layouts.ts`, `apps/server/src/features/background-parallax-profile/server/background-layer-layout-store.ts`, `apps/web/src/features/background-parallax-profile/ui/components/background-layer-layout-manager.tsx`. Yeni bağımlılık yoktur. React/TanStack Query, oRPC/Zod ve Drizzle/PostgreSQL mevcut stack'tir.
- **Kesin girdi:** Bir aile ve Görsel Dünyası, etkin arayüz sözleşmesi revizyonu, isteğe bağlı kesin ekran sürümü, bileşen/durum kimlikleri, doğrulanmış kaynak ölçüleri, dört germe payı, kaynak koordinatlarındaki metin güvenli alanı, hedef ölçüler ve örnek metin sabitlenir. Her durum/hedef için kullanıcı Geçti, Başarısız veya Sonuçsuz sonucu ve gözlemini kaydeder. Eksik gözlem Sonuçsuz kalır. Kurulum değişikliği mevcut taslak gözlemlerini temizler; yeni kayıt geçmiş kaydı değiştirmez.
- **Geometri:** Koordinatlar sol üstten kaynak pikselidir. Paylar merkezde pozitif alan bırakmalıdır; metin güvenli alanı kaynak içinde kalmalıdır. Bu ihlaller `ui.state_and_stretch_integrity` Bütünlük Denetimidir ve kayıt reddedilir. Dokuz parçalı önizlemede köşeler doğal ölçüde, kenarlar bir eksende, merkez iki eksende gerilir. Güvenli alanın her sınırı aynı parçalı doğrusal dönüşümü kullanır; sonuç kesirli hedef koordinatı olabilir. Hedef, karşılıklı sabit payların toplamından büyük değilse `ui.target_size_and_text_bounds` İstisna Verilebilir Gereksinimi başarısızdır; kullanıcı Geçti seçse bile kullanım testi Başarısız kalır. Bu akış Kalite İstisnası vermez.
- **Sınırlar:** İşlem en fazla 24 durum, 12 hedef, hedef başına 4096 × 4096 piksel ve 2000 karakterlik metin/gözlem kabul eder. Bunlar bu işlemin girdi sınırlarıdır; Operasyonel Kabul Profili veya desteklenen en büyük proje iddiası değildir. Kullanıcı örnek metnin okunurluğunu, kırpılmasını ve durum stilini inceler; geometri kontrolü otomatik sanatsal başarı kararı değildir.
- **Yeniden okuma ve eşleme:** Doğal ölçü, germe payları, metin güvenli alanı, kesin durum/ekran sürümleri, kaynak özetleri, sözleşme anlık kaydı ve test sonuçları kalıcı kayıttan yeniden okunur. `ui-stretch-test/1.0.0` statik metadata indirmesi mevcut `ui.components.*` ve `ui.screen_component_link` yollarını taşır; bir bileşenin durumları tek bileşen altında gruplanır ve JSON geometrileri durum kimliğiyle anahtarlanır; eşleme kanıtla uyuşmuyorsa okuyucu reddeder. Bu işlem Dışa Aktarım Paketi başlatmaz, aile tamamlanması veya Export Ready hükmü vermez. Tam paket teslimi ve ayrı durum ailesi inceleme akışı kendi işleri olarak kalır.

### Testing Decisions — #132

- Birincil seam değişmez: `appRouter.uiStretchTests.save/list/export` üzerinden gerçek PostgreSQL'e yazma ve ayrı bağlantıdan yeniden okuma (`apps/server/src/features/ui-profile/server/tests/ui-stretch-tests.integration.test.ts`). Kaynak görsel depolaması bu testte dış sınırdır; gerçek yükleme, içerik doğrulama ve önizleme web E2E'de sınanır.
- Başarı/red kanıtı: kesin ölçü ve kaynak pinleri; idempotent aynı kayıt, farklı girdide kimlik çatışması; geçersiz pay/güvenli alan; kaynak ölçü sahteciliği; küçük hedefte Başarısız, eksik gözlemde Sonuçsuz; yetkisiz okuma/indirme, eski sözleşme, bozuk kaynak ve metadata roundtrip'i. Profil sözleşmesi etkin değilken arayüz sunulmaz.
- Metadata regresyonu: `__proto__`, `constructor` ve `toString` durum kimlikleri save/export ve JSON yeniden okuma boyunca üç geometri eşlemesinde korunur. Eksik geometri anahtarı ve geçersiz geometri değeri reddedilir; OpenAPI çıktısı durum kimliğiyle anahtarlanan sayısal geometri nesnelerini tanımlar.
- Web seam: `apps/web/e2e/ui-stretch-tests.spec.ts` gerçek kullanıcı kurulumu, 64 × 40 ve 80 × 48 geçerli hedeflerde dört köşe pikseli ve örnek metnin güvenli alana sığması; 8 × 7 geçersiz hedef, geçersiz girdiler, sayfa yenileme ve indirilen metadata'nın yeniden okunması. Tekrar çalıştırılabilir komut: `bun run test:e2e:ui-stretch` (yalnız disposable loopback PostgreSQL).
- Masaüstü seam: `apps/web/desktop-e2e/ui-stretch-tests.spec.ts` aynı ortak yüzeyde kaydetme ve yenileme. Testin eklenmesi çalıştırıldığı anlamına gelmez; gerçek Tauri/WebDriver kanıtı ayrı raporlanır.
- Görsel aile stili, metin okunurluğu ve düzeltilmiş durumun sanatsal uygunluğu kullanıcı incelemesidir. Dokuz parçalı köşe pikseli ve eşleme bütünlüğü ayrı deterministik kanıttır.
