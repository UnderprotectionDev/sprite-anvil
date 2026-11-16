# Teslimat Gerçekleşmelerini Karşılaştırma

## Problem Statement

Kullanıcı iki değişmez Teslimat Gerçekleşmesi arasındaki üretim ve kanıt farkını inceler. Karşılaştırma yeni teslimat veya geçmiş kaydı değiştirmez.

## Solution

Kullanıcı iki değişmez Teslimat Gerçekleşmesi arasındaki üretim ve kanıt farkını inceler.

Karşılaştırma yeni teslimat veya geçmiş kaydı değiştirmez.

Tamamlanma kanıtı: Eklenen, çıkarılan ve değişen Varlık Sürümleri; bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemeleri ayrı gösterilir.

## User Stories

1. Bir kullanıcı olarak iki değişmez Teslimat Gerçekleşmesini karşılaştırmak istiyorum; böylece teslimatlar arasındaki değişimi geçmiş kayıtları değiştirmeden inceleyebilirim.
2. Bir kullanıcı olarak eklenen, çıkarılan ve değişen Varlık Sürümlerini görmek istiyorum; böylece içerik farkı açıkça belirir.
3. Bir kullanıcı olarak Bağlam, kalite kanıtı ve Kalite İstisnası farklarını ayrı görmek istiyorum; böylece kabul dayanaklarındaki değişiklikler birbirine karışmaz.
4. Bir kullanıcı olarak Hak Kaydı ve çalışma zamanı kanıtı farklarını görmek istiyorum; böylece teslimatın kaynak ve gerçek kullanım riski karşılaştırılır.
5. Bir kullanıcı olarak Dışa Aktarım Paketi ile gereksinim eşlemesi değişikliklerini incelemek istiyorum; böylece her hedef koşulunun hangi kanıtla karşılandığı anlaşılır.
6. Bir kullanıcı olarak fark görünümünün geçmiş Teslim Edildi durumunu kendiliğinden geçersiz kılmamasını istiyorum; böylece karşılaştırma yeni karar veya teslimat oluşturmaz.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Teslimat Gerçekleşmelerini Karşılaştırma:** Kullanıcı iki değişmez Teslimat Gerçekleşmesi arasındaki üretim ve kanıt farkını inceler. Karşılaştırma yeni teslimat veya geçmiş kaydı değiştirmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Fark görünümü geçmiş Teslim Edildi durumunu kendiliğinden geçersiz kılmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Kanıt karşılaştırmasının yardımcı testi [`delivery-evidence-diff.test.ts`](../../../apps/server/src/features/delivery-fulfilment/server/tests/delivery-evidence-diff.test.ts), public router testi [`delivery-fulfilment-diff.test.ts`](../../../apps/server/src/features/delivery-fulfilment/server/tests/delivery-fulfilment-diff.test.ts) ve görünür sonuç testi [`delivery-diff-view.test.tsx`](../../../apps/web/src/features/delivery-fulfilment/ui/views/delivery-diff-view.test.tsx) içindedir. Mevcut API sözleşmesi: [`delivery-diff.ts`](../../../packages/api/src/delivery-diff.ts).
- Fazın özgül başarı ve red kanıtı: Eklenen, çıkarılan ve değişen Varlık Sürümleri; bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemeleri ayrı gösterilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Fark görünümü geçmiş Teslim Edildi durumunu kendiliğinden geçersiz kılmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Fark görünümü geçmiş Teslim Edildi durumunu kendiliğinden geçersiz kılmaz.

## Further Notes

- Tek faz kaynağı: [`42-delivery-diff/phase-context.md`](../../workflow/42-delivery-diff/phase-context.md).
- Kanonik teknik adlar: Delivery Diff. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0015](../../adr/0015-separate-delivery-planning-export-and-fulfilment.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- PRD ve bu spec hedef davranışı tanımlar; mevcut sözleşmeler ve testler tek başına tüm kabul senaryolarının tamamlandığını göstermez. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
