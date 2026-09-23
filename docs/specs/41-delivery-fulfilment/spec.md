# Teslimatı Kesin Paketlerle Gerçekleştirme

## Problem Statement

Kullanıcı hazır bir Teslimat Hedefinin her gereksinimini kesin paket ve varlık sürümlerine eşler; çakışmaları çözerek değişmez teslim kanıtı oluşturur. Hazır hedef ile Teslim Edildi durumu ayrıdır.

## Solution

Kullanıcı hazır bir Teslimat Hedefinin her gereksinimini kesin paket ve varlık sürümlerine eşler; çakışmaları çözerek değişmez teslim kanıtı oluşturur.

Hazır hedef ile Teslim Edildi durumu ayrıdır. Kullanıcı her gereksinimin hangi kesin paket ve sürümle karşılandığını karara bağlar.

Hazır hedefin her gereksinimi kesin paket ve varlık sürümüne eşlenir. Birden çok pakette aynı gereksinim karşılanıyorsa kullanıcı geçerli eşlemeyi seçer; gerçekleşme oluşmadan hedef Teslim Edildi sayılmaz.

Tamamlanma kanıtı: Çakışmasız eşleme değişmez gerçekleşme üretir; Hazır hedef yalnız geçerli gerçekleşme oluştuğunda Teslim Edildi sayılır.

## User Stories

1. Bir kullanıcı olarak Hazır Teslimat Hedefinin her gereksinimini kesin paket ve Varlık Sürümlerine eşlemek istiyorum; böylece gerçekleşmenin içerik kanıtı açık olur.
2. Bir kullanıcı olarak her hedef gereksinimi için hangi paketin hangi tam sürümü karşıladığını seçmek istiyorum; böylece hedefin kapsamı teslimat kaydında görünür.
3. Bir kullanıcı olarak aynı gereksinim birden çok pakette karşılanıyorsa geçerli eşlemeyi kendim seçmek istiyorum; böylece çatışma otomatik çözülmez.
4. Bir kullanıcı olarak hedefin gerekli kullanım ve çalışma zamanı kanıtlarını eşlemeye dahil etmek istiyorum; böylece yalnız dosya bulunması kabul kanıtı sayılmaz.
5. Bir kullanıcı olarak çakışmasız eşlemeyi değişmez Teslimat Gerçekleşmesi olarak kesinleştirmek istiyorum; böylece teslim anındaki kanıt korunur.
6. Bir kullanıcı olarak Hazır hedef ile Teslim Edildi sonucunu ayrı görmek istiyorum; böylece planın hazır olması gerçekleşmiş teslim diye gösterilmez.
7. Bir kullanıcı olarak Teslim Edildi durumunun ancak geçerli gerçekleşme oluşunca verilmesini istiyorum; böylece eksik eşleme tamamlanmış sayılmaz.
8. Bir kullanıcı olarak hedef veya paket değiştiğinde geçmiş gerçekleşmenin korunmasını istiyorum; böylece yeni kapsam eski teslim kaydını geriye dönük değiştirmez.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Kesin paketlerle gereksinim eşlemesi hazırlama:** Hazır Teslimat Hedefinin her gereksinimi kesin Dışa Aktarım Paketi ve Varlık Sürümüne eşlenir. Eksik veya çakışan eşlemeler kullanıcıya gösterilir.
- **Çakışmayı çözerek gerçekleşmeyi kesinleştirme:** Kullanıcı çakışan paket eşlemesini seçer ve değişmez Teslimat Gerçekleşmesi oluşturur. Hazır hedef yalnız geçerli gerçekleşme sonrası Teslim Edildi sayılır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** En yeni paket işareti geçmiş teslimata otomatik uygulanmaz; Hazır hedef tek başına teslim edilmiş sayılmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Çakışmasız eşleme değişmez gerçekleşme üretir; Hazır hedef yalnız geçerli gerçekleşme oluştuğunda Teslim Edildi sayılır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: En yeni paket işareti geçmiş teslimata otomatik uygulanmaz; Hazır hedef tek başına teslim edilmiş sayılmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

En yeni paket işareti geçmiş teslimata otomatik uygulanmaz; Hazır hedef tek başına teslim edilmiş sayılmaz.

## Further Notes

- Tek faz kaynağı: [`41-delivery-fulfilment/phase-context.md`](../../workflow/41-delivery-fulfilment/phase-context.md).
- Kanonik teknik adlar: Delivery Fulfilment. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0015](../../adr/0015-separate-delivery-planning-export-and-fulfilment.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
