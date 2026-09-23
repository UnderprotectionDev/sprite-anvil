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

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Bu alan seviye düzenleyicisi, fizik benzetimi veya oyun projesinin yetkili kaynağı değildir.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-02, RAS-04, RAS-05, RAS-06, RAS-07 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
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

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-02](../../prd/10-acceptance-scenarios.md)
- [RAS-04](../../prd/10-acceptance-scenarios.md)
- [RAS-05](../../prd/10-acceptance-scenarios.md)
- [RAS-06](../../prd/10-acceptance-scenarios.md)
- [RAS-07](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
