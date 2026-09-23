# Tarihsel Teslimat Hak Riskini Bildirme

## Problem Statement

Yeni bir Hak Kaydı geçmiş teslimatın sabitlediği hak politikasıyla uyuşmazsa kullanıcı etkilenen tarihsel kullanımı görür. Bildirim geçmiş Teslim Edildi sonucunu veya paket kanıtını değiştirmeden yeni kullanım kararını bilgilendirir.

## Solution

Yeni bir Hak Kaydı geçmiş teslimatın sabitlediği hak politikasıyla uyuşmazsa kullanıcı etkilenen tarihsel kullanımı görür.

Bildirim geçmiş Teslim Edildi sonucunu veya paket kanıtını değiştirmeden yeni kullanım kararını bilgilendirir.

Tamamlanma kanıtı: Değişmez Tarihsel Risk Bildirimi riskli kaynağı, yeni hak sürümünü, etkilenen kullanımı ve saptama zamanını gösterir; yeni hedef güncel politikayla değerlendirilir.

## User Stories

1. Bir kullanıcı olarak yeni Hak Kaydı sürümü geçmiş teslimatın sabitlediği politikayla uyuşmadığında etkilenen tarihsel kullanımı görmek istiyorum; böylece yeni risk bağlamıma yansır.
2. Bir kullanıcı olarak Tarihsel Risk Bildiriminde kaynak, yeni hak sürümü, etkilenen kullanım ve saptama zamanını görmek istiyorum; böylece bildirimin dayanağı izlenebilir olur.
3. Bir kullanıcı olarak bildirimin değişmez kalmasını istiyorum; böylece risk tespiti hangi hak revizyonu ve zamanda yapıldığıyla korunur.
4. Bir kullanıcı olarak yeni Teslimat Hedefini güncel Hak Kanıtı Politikasıyla yeniden değerlendirmek istiyorum; böylece ileriye dönük karar en güncel kayda dayanır.
5. Bir kullanıcı olarak geçmiş Teslimat Gerçekleşmesi ve Dışa Aktarım Paketinin sabitlediği içeriğin değişmemesini istiyorum; böylece yeni risk eski kaydı yeniden yazmaz.
6. Bir kullanıcı olarak bildirimi hukuki karar veya otomatik geri çağırma gibi sunmamayı istiyorum; böylece ürün yalnız kayıtlı kısıt riskini gösterir.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Tarihsel Teslimat Hak Riskini Bildirme:** Yeni bir Hak Kaydı geçmiş teslimatın sabitlediği hak politikasıyla uyuşmazsa kullanıcı etkilenen tarihsel kullanımı görür. Bildirim geçmiş Teslim Edildi sonucunu veya paket kanıtını değiştirmeden yeni kullanım kararını bilgilendirir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Hak riskini ürün hukuken hükme bağlamaz; geçmiş teslimat kendiliğinden geri alınmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Değişmez Tarihsel Risk Bildirimi riskli kaynağı, yeni hak sürümünü, etkilenen kullanımı ve saptama zamanını gösterir; yeni hedef güncel politikayla değerlendirilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Hak riskini ürün hukuken hükme bağlamaz; geçmiş teslimat kendiliğinden geri alınmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Hak riskini ürün hukuken hükme bağlamaz; geçmiş teslimat kendiliğinden geri alınmaz.

## Further Notes

- Tek faz kaynağı: [`43-historical-rights-risk/phase-context.md`](../../workflow/43-historical-rights-risk/phase-context.md).
- Kanonik teknik adlar: Historical Risk Notice. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0016](../../adr/0016-use-target-specific-rights-evidence-without-legal-judgment.md)
- [ADR 0015](../../adr/0015-separate-delivery-planning-export-and-fulfilment.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
