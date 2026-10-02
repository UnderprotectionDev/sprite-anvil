# Varlık Sürümünü İnceleme

## Problem Statement

Kullanıcı kesin Varlık Sürümünü onaylama, reddetme veya yeniden Aday yapma kararını değişmez İnceleme Kaydıyla verir. Kararın geçmişi, sürümün güncel Bağlama Uygunluk ve Kalite Kontrol Durumundan ayrı korunur.

## Solution

Kullanıcı kesin Varlık Sürümünü onaylama, reddetme veya yeniden Aday yapma kararını değişmez İnceleme Kaydıyla verir. Kararın geçmişi, sürümün güncel Bağlama Uygunluk ve Kalite Kontrol Durumundan ayrı korunur.

Ana Tasarım onaylanmadan Türetilmiş Varlıkların keşif sonuçları nihai kabul sayılmaz. Bütünlük hatası veya eksik zorunlu kanıt onayı durdurur. Toplu inceleme her uygun öğe için ayrı kayıt üretir; engelli öğe sessizce atlanmaz veya otomatik istisna almaz.

Tamamlanma kanıtı: Kullanıcının her kesin sürüm için verdiği son karar, zamanı ve gerekçesi geçmiş kararları silmeden izlenir; toplu işlemde her onay ayrı İnceleme Kaydıdır.

## User Stories

1. Bir kullanıcı olarak kesin bir Aday Sürüm için Onayla veya Reddet kararı vermek istiyorum; böylece inceleme sonucu kullanıcıya ait kalır.
2. Bir kullanıcı olarak her kararın zamanı, seçimi ve verdiğim gerekçeyi İnceleme Kaydında saklamak istiyorum; böylece değişiklik geçmişi izlenebilir olur.
3. Bir kullanıcı olarak kararımı değiştirdiğimde yeni İnceleme Kaydı oluşturmak istiyorum; böylece geçmiş karar silinmeden güncel karar belirlenir.
4. Bir kullanıcı olarak onaylanan sürümün kimliği ve içeriğini değişmez tutmak istiyorum; böylece yeni içerik yeni Aday Sürüm olarak değerlendirilir.
5. Bir kullanıcı olarak bağlam veya Ana Tasarım değiştiğinde geçmiş onayın korunmasını istiyorum; böylece tarihsel karar güncel Bağlama Uygunluk durumuyla karıştırılmaz.
6. Bir kullanıcı olarak Onaylı Sürümün kendiliğinden Bağlama Uygun veya Dışa Aktarıma Hazır sayılmamasını istiyorum; böylece onay, güncel kalite ve uygunluk kanıtı yerine geçmez.
7. Bir kullanıcı olarak ajan veya bağlantının benim adıma İnceleme Kaydı oluşturmamasını istiyorum; böylece kesin kabul kararı kullanıcı kontrolünde kalır.

## Normatif gereksinimler

- **QLT-01 — Kalite kanıtı ve kullanıcı kararı:** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.
- **AUT-01 — Hazırlık ve kesinleştirme:** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir.


## Implementation Decisions

- **Kesin sürüme İnceleme Kaydı yazma:** Kullanıcı kesin Varlık Sürümü için Onaylı, Reddedildi veya Aday kararını değişmez İnceleme Kaydı ile verir. Bütünlük veya zorunlu kanıt eksikse onay engellenir.
- **Toplu incelemede kararları ayırma:** Toplu inceleme her uygun sürüm için ayrı İnceleme Kaydı üretir; engelli öğe sessizce atlanmaz. Geçmiş kararlar ve diğer durum eksenleri korunur.
- **Toplu karar önizlemesi ve kesinleştirme:** Kullanıcı seçtiği kesin sürümler için Onayla, Reddet veya Aday yap kararını ve gerekçesini belirler. Önizleme her sürümün uygunluğunu ve engellerini ayrı gösterir; hiçbir karar yazmaz. Engelli seçimde bütün toplu işlem durur. Kullanıcı seçimi değiştirdikten sonra yeni önizleme üzerinden açıkça kesinleştirir. Sunucu onay kanıtını yeniden denetler; önizlemeden beri inceleme kararı değişmişse işlem çakışmayla durur. OPS-02 uyarınca kayıtlar tek atomik işlemle yazılır ve aynı istek anahtarı ikinci kayıt üretmez. Otomatik Kalite İstisnası veya Ana Tasarım seçimi yapılmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Ürün sözleşmesi [`asset-versions.ts`](../../../packages/api/src/asset-versions.ts), kullanıcı API yolu [`routers/asset-versions.ts`](../../../packages/api/src/routers/asset-versions.ts) üzerinden sunulur. Kalıcı yeniden okuma seam’i [`version-review.integration.test.ts`](../../../apps/server/src/version-review.integration.test.ts); kaynak kanıtı ve API hata yolları [`asset-version-lineage.test.ts`](../../../apps/server/src/asset-version-lineage.test.ts) ile sınanır. Ortak web/masaüstü yazma bileşeninin sunucu hata mesajını gösterip başarı iddiası üretmemesi [`use-asset-version-writes.test.tsx`](../../../apps/web/src/features/asset-versions/ui/hooks/use-asset-version-writes.test.tsx) ile sınanır. Bileşen testleri tarayıcı veya masaüstü uçtan uca doğrulaması değildir.
- Onay kapısı kesin Varlık Sürümünü kullanır; başka veya daha yeni sürümün kanıtını taşımaz. Daha yeni sürüme ait bir ölçüm, kesin sürümün kendi güncel kanıtını geçersiz kılmaz. Etkin profilin zorunlu kural, insan incelemesi ve kullanım testi kanıtı eksik veya güncel değilse onay engellenir; başarısız Bütünlük Denetimi de onayı engeller. İstisna Verilebilir Gereksinim geçmiş veya kesin sürüme ait geçerli Kalite İstisnası ile karşılanmış olmalıdır. Kalite Uyarısı onay kapısı değildir. Kaydedilmiş kullanım testi sonucu onay ile Dışa Aktarıma Hazır hesabını birleştirmez: kullanıcı kararı ayrı kaydedilir, hazır olma sonucu engelli kalabilir. Ret ve Aday kararları onay kanıtı gerektirmez. Profil kanıtı için Gerekli Öğeler Listesi bağlantısı yoksa etkin profilin zorunlu kanıtı tamamlanmış sayılmaz.
- Kalıcı test Onaylı → Reddedildi → Aday → Onaylı kararlarını yeni bağlantıyla yeniden okur; eski kesin sürümü, daha yeni sürümün birimine ölçüm kaydedilse bile kendi kanıtıyla yeni sürümden bağımsız inceler. Bağlam değişikliği geçmiş onayları silmez; eski kanıtla yeni onay yazılması engellenir. Oturumsuz ve başka kullanıcı erişimi reddedilir. Boş gerekçe giriş sınırında reddedilir.
- Toplu kullanıcı/API seam’i `previewBatchReview` ve `reviewBatch` işlemleridir. [`batch-version-review.integration.test.ts`](../../../apps/server/src/batch-version-review.integration.test.ts) ayrı sürümlere ayrı kayıt, engelli seçimde sıfır yazma, eşzamanlı aynı isteğin tekrar güvenliği, farklı içerikle anahtar kullanımı, eski önizleme, yeni bağlantıdan geçmişi okuma, bağlam değişikliği ve yetkisiz erişimi sınar. [`batch-version-review.test.ts`](../../../apps/server/src/batch-version-review.test.ts) zorunlu kalite kanıtının önizlemede görünmesini ve engelli toplu onayın reddini sınar. Ortak web/masaüstü [`batch-review-controls.test.tsx`](../../../apps/web/src/features/asset-versions/ui/components/batch-review-controls.test.tsx) seçim, engel, iptal, kesinleştirme ve aynı anahtarla tekrar yolunu; yazma hook testi sunucu reddinde yanlış başarı bildirimi üretilmemesini sınar. Bileşen testleri gerçek tarayıcı veya Tauri uçtan uca doğrulaması değildir.
- Fazın özgül başarı ve red kanıtı: Kullanıcının her kesin sürüm için verdiği son karar, zamanı ve gerekçesi geçmiş kararları silmeden izlenir; toplu işlemde her onay ayrı İnceleme Kaydıdır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.

## Further Notes

- Tek faz kaynağı: [`17-version-review/phase-context.md`](../../workflow/17-version-review/phase-context.md).
- Kanonik teknik adlar: Review Event, Review Disposition. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Kalite kanıtı ve kullanıcı kararı.
- [`AUT-01`](../../prd/03-project-and-asset-foundations.md) — Hazırlık ve kesinleştirme.
- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)
- [ADR 0005](../../adr/0005-separate-historical-approval-from-current-applicability.md)
- [ADR 0011](../../adr/0011-quality-waivers-are-version-specific.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- İlk issue kesin sürüme İnceleme Kaydı yolunu, ikinci issue toplu inceleme yolunu teslim eder. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
