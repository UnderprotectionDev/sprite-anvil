# Sahne Kalite Kontrolü Yapma

## Problem Statement

Kullanıcı kesin varlık sürümlerini hafif bir kullanım sahnesinde birlikte deneyerek ölçek, katman, geçiş, olay, kamera ve okunurluğu değerlendirir. Profil odaklı sahne testi, farklı varlıkları gerçek kullanıma yakın koşullarda karşılaştırır.

## Solution

Kullanıcı kesin varlık sürümlerini hafif bir kullanım sahnesinde birlikte deneyerek ölçek, katman, geçiş, olay, kamera ve okunurluğu değerlendirir.

Profil odaklı sahne testi, farklı varlıkları gerçek kullanıma yakın koşullarda karşılaştırır.

Tamamlanma kanıtı: Karo, arka plan, karakter, obje, gölge ve efektler birlikte yerleştirilir; hareket, animasyon geçişi, Y sıralaması ve kamera profildeki kullanım kanıtına bağlanır.

## User Stories

1. Bir kullanıcı olarak kesin Varlık Sürümlerini hafif bir kullanım sahnesine yerleştirmek istiyorum; böylece farklı görsellerin ölçek ve perspektifini birlikte değerlendirebilirim.
2. Bir kullanıcı olarak karo, arka plan, karakter, obje, gölge ve efekti aynı sahnede görmek istiyorum; böylece aileler arası kullanım etkileşimi incelenir.
3. Bir kullanıcı olarak karakteri hareket ettirip bekleme, yürüme ve saldırı geçişlerini oynatmak istiyorum; böylece animasyon ve hareket sürekliliğini görebilirim.
4. Bir kullanıcı olarak efekti ilgili olay anına bağlayıp katman ve Y sıralamasını incelemek istiyorum; böylece sahne içi zamanlama ve örtüşme değerlendirilir.
5. Bir kullanıcı olarak farklı kamera davranışlarını ve kontrastı hafif sahne koşulunda denemek istiyorum; böylece okunurluk gerçek kullanıma yakın görünür.
6. Bir kullanıcı olarak pivot, zemin, sıralama, olay ve çarpışma bilgilerini görsel katman olarak göstermek istiyorum; böylece oyun içi metadata'yı yerleşimle birlikte inceleyebilirim.
7. Bir kullanıcı olarak kalite kanıtı ile öznel sanat kararını ayrı tutmak istiyorum; böylece sahne testi otomatik mükemmellik veya hukuki uygunluk hükmü vermez.
8. Bir kullanıcı olarak bu alanın hafif test düzeyinde kalmasını istiyorum; böylece sahne önizlemesi tam seviye düzenleyicisi, fizik benzetimi veya oyun projesinin yetkili kaynağı gibi sunulmaz.

## Normatif gereksinimler

- **QLT-01 — Kalite kanıtı ve kullanıcı kararı:** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.
- PRD 06-scene-quality-and-pixel-editor.md §4.10 bölümü ayrıca bu fazın davranışını belirler.

## Implementation Decisions

- **Sahne Kalite Kontrolü Yapma:** Kullanıcı kesin varlık sürümlerini hafif bir kullanım sahnesinde birlikte deneyerek ölçek, katman, geçiş, olay, kamera ve okunurluğu değerlendirir. Profil odaklı sahne testi, farklı varlıkları gerçek kullanıma yakın koşullarda karşılaştırır.

- **Uygulama sınırı:** `/projects/$projectId/scene-qa` route’u; React, TanStack Query ve mevcut UI primitives. Çizim `docs/tech-stack.md` Scene Preview girdisi olan PixiJS 8 ile yapılır; örnek `apps/web/src/features/background-parallax-profile/ui/components/background-scrolling-scene.ts`. API oRPC/Zod, kayıt Drizzle/PostgreSQL; örnek `packages/api/src/routers/background-scrolling-tests.ts` ve `apps/server/src/features/background-parallax-profile/server/background-scrolling-test-store.ts`. Yeni bağımlılık eklenmez.
- **Kesin kanıt:** Her yerleşim Varlık Sürümü, etkin profil sözleşmesi sürümü ve sözleşmenin kullanım testi kimliğini taşır. Kullanıcı gözlemleri ölçek, sıralama, geçiş, olay, kamera ve okunurluk için ayrı tutulur; puan veya otomatik kabul sonucu yoktur. Kaynak içerik özeti ve doğal ölçüler sunucuda doğrulanır; profil tanımları ve sürüm bilgileri değişmez kayda sabitlenir.
- **Hafif oynatma:** En fazla 24 yerleşim ve tek hareketli karakter; 64–1920 × 64–1080 viewport, 3–30 saniye test, 1×–8× tam sayı ölçek. Karakter idle → walk → attack → idle geçişini test süresinin %0–30, %30–60, %60–85 ve %85–100 aralıklarında oynatır. Kullanıcı kare alanları/süreleri ve yürüme yer değiştirmesini ayarlar; isabet anı saldırı aralığında olur, efekt bu anla başlar. Fixed, Follow character ve Pan kameraları ile katman içi Y sıralaması denenir. Karo rolü seçili kareyi tekrarlar; ayrı karo komşuluk testi bu faza taşınmaz.
- **Görsel kılavuzlar:** Pivot, zemin, sıralama ve efekt başlangıç noktaları ile kullanıcı yazımlı hitbox/hurtbox/collision alanları ayrı önizleme katmanıdır. Bunlar Gameplay Metadata kayıtlarına yazılmaz veya şeffaflıktan çıkarılmaz. Oyun metadata’sının inceleme/dışa aktarım yolu kendi özelliğinde kalır. Hareket otomatik başlamaz ve durdurulabilir; bu davranış azaltılmış hareket tercihinde de aynıdır.
- **Kalıcı kayıt:** Kaydetme aynı işlem kimliği için idempotenttir; farklı içerikle aynı kimlik reddedilir. DB ekleme sınırı proje sahipliğini, okunabilir kaynak kayıtlarını ve etkin profil snapshot’larını yeniden kontrol eder. Belirsiz yazma sonucunda yeni kayıt gönderilmez; `Check saved evidence` ile aynı kimlik yeniden okunur. Ayar değiştiğinde tamamlanmış oynatma kanıtı sıfırlanır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Bu alan seviye düzenleyicisi, fizik benzetimi veya oyun projesinin yetkili kaynağı değildir.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-02, RAS-04, RAS-05, RAS-06, RAS-07 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- API sınırı `appRouter.sceneQa.save` → `appRouter.sceneQa.list`: [`scene-qa.test.ts`](../../../apps/server/src/scene-qa.test.ts) kesin sürüm/profil pinlerini, altı rolü, yeniden okumayı, idempotency çakışmasını, yetkisiz/başka kullanıcı erişimini, eksik oynatmayı, bozuk içeriği ve kayıt/yeniden okuma hatalarını sınar. Depolama ve dosya doğrulama sınırları bu testte bellek adaptörleriyle temsil edilir; canlı PostgreSQL/R2 doğrulaması değildir.
- Görünür akış: [`scene-qa-view.test.tsx`](../../../apps/web/src/features/scene-qa-playground/ui/views/scene-qa-view.test.tsx) eksik veri durumunu; [`scene-qa-placement-editor.test.tsx`](../../../apps/web/src/features/scene-qa-playground/ui/components/scene-qa-placement-editor.test.tsx) isteğe bağlı obje karelerinin kaldırılmasını ve zorunlu karakter karelerinin korunmasını sınar. [`scene-qa.spec.ts`](../../../apps/web/e2e/scene-qa.spec.ts) gerçek PixiJS çizimi, hareket/geçiş oynatması, altı rol, gözlem kaydı ve yeniden açma ile okunamayan görsel yolunu sınar. Yanıtı kesilen kaydetme işleminde aynı kayıt kimliğinin `Check saved evidence` ile yeniden okunmasını ayrıca doğrular. Tarayıcı testinin API yanıtları kontrollü test verisidir; bulut kalıcılığı veya masaüstü WebDriver kanıtı sayılmaz.
- Masaüstü seam’i: [`scene-qa.spec.ts`](../../../apps/web/desktop-e2e/scene-qa.spec.ts) gerçek Tauri/WebKit ve PixiJS çiziminde altı rolü, tamamlanmış oynatmayı, gözlem kaydını, sayfa yenilemesinden sonra yeniden okumayı ve kanıtın tekrar önizlenmesini sınar. HTTP sınırı yalnız loopback üzerinde kontrollü yanıtlar verir; PostgreSQL/R2 kalıcılığı yerine geçmez. Test `SCENE_QA_DESKTOP_API_PORT` ile açıkça seçilir; uygulama aynı portu `VITE_SERVER_URL` ile kullanacak biçimde test için derlenir. Embedded WebDriver’ın select-option tıklamasında `change` göndermemesi nedeniyle seçimler DOM `change` sınırından uygulanır; native açılır liste etkileşiminin kanıtı sayılmaz.
- Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Karo, arka plan, karakter, obje, gölge ve efektler birlikte yerleştirilir; hareket, animasyon geçişi, Y sıralaması ve kamera profildeki kullanım kanıtına bağlanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Bu alan seviye düzenleyicisi, fizik benzetimi veya oyun projesinin yetkili kaynağı değildir.
- Kabul örnekleri: RAS-01, RAS-02, RAS-04, RAS-05, RAS-06, RAS-07. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Bu alan seviye düzenleyicisi, fizik benzetimi veya oyun projesinin yetkili kaynağı değildir.

## Further Notes

- Tek faz kaynağı: [`28-scene-qa/phase-context.md`](../../workflow/28-scene-qa/phase-context.md).
- Kanonik teknik adlar: Scene QA Playground. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Kalite kanıtı ve kullanıcı kararı.
- [PRD §4.10](../../prd/06-scene-quality-and-pixel-editor.md) — bu alt bölümde ayrı gereksinim kimliği yok; kapsamı doğrudan bölüm metni belirler.

**İlgili mimari sınırlar**

- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md): ortak web/masaüstü arayüzü ve yetkili bulut kaydı.
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md): kaynak sürümler değişmeden kesin kimlikleri korunur.
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md): gözlem kullanıcıya aittir; otomatik sanat kabulü veya asset onayı oluşmaz.
- [ADR 0017](../../adr/0017-treat-runtime-validation-as-one-way-user-finalized-evidence.md): sahne kanıtı Runtime Validation Record yerine geçmez.

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-02](../../prd/10-acceptance-scenarios.md)
- [RAS-04](../../prd/10-acceptance-scenarios.md)
- [RAS-05](../../prd/10-acceptance-scenarios.md)
- [RAS-06](../../prd/10-acceptance-scenarios.md)
- [RAS-07](../../prd/10-acceptance-scenarios.md)
- Sahne kaydı PostgreSQL üzerinde ayrı `scene_qa_playgrounds` tablosuna yazılır. Canlı DB hazırlama/ready doğrulaması, API testleri ve kontrollü tarayıcı kanıtı ayrı teslim koşullarıdır; birinin çalışması diğerinin tamamlandığını göstermez.
