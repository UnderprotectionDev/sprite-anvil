# Teslimat Hazırlık Planı Oluşturma

## Problem Statement

Kullanıcı etkin Teslimat Hedefinin engellerini ve bir düzeltmenin açacağı işleri açıklanabilir biçimde görür. Hedef Hazırlığı sistem tarafından kabul koşullarından hesaplanır; Hazır olmak teslim edilmiş olmak değildir.

## Solution

Kullanıcı etkin Teslimat Hedefinin engellerini ve bir düzeltmenin açacağı işleri açıklanabilir biçimde görür.

Hedef Hazırlığı sistem tarafından kabul koşullarından hesaplanır; Hazır olmak teslim edilmiş olmak değildir.

Tamamlanma kanıtı: Hedefin kabul koşullarından Hazır veya Engelli sonucu hesaplanır; engel, bağımlı iş, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçelerle gösterilir. Kullanıcı sıralamayı değiştirebilir.

## User Stories

1. Bir kullanıcı olarak etkin Teslimat Hedefinin Hazır veya Engelli durumunu kabul koşullarından hesaplanmış görmek istiyorum; böylece hazırlık öznel tek puana dayanmaz.
2. Bir kullanıcı olarak her engelin hangi koşuldan geldiğini ve hangi kesin kanıtın eksik olduğunu görmek istiyorum; böylece düzeltilecek iş anlaşılır olur.
3. Bir kullanıcı olarak bir düzeltmenin açacağı bağımlı işleri görmek istiyorum; böylece hazır olma yolunun sonraki adımlarını planlayabilirim.
4. Bir kullanıcı olarak hedef zorunluluğunu, kullanıcı önceliğini ve yeniden doğrulama etkisini ayrı gerekçelerle görmek istiyorum; böylece farklı engel türleri karışmaz.
5. Bir kullanıcı olarak bağımlı işlerin sırasını değiştirmek istiyorum; böylece kendi çalışma önceliğimi uygulayabilirim.
6. Bir kullanıcı olarak Hazır durumunun Teslim Edildi anlamına gelmemesini istiyorum; böylece kabul koşulu ile gerçekleşmiş teslim ayrı tutulur.
7. Bir kullanıcı olarak planın otomatik üretim veya kullanıcı kararı başlatmamasını istiyorum; böylece hazırlık değerlendirmesi yetki devrine dönüşmez.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Teslimat Hazırlık Planı Oluşturma:** Kullanıcı etkin Teslimat Hedefinin engellerini ve bir düzeltmenin açacağı işleri açıklanabilir biçimde görür. Hedef Hazırlığı sistem tarafından kabul koşullarından hesaplanır; Hazır olmak teslim edilmiş olmak değildir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Plan gizli tek puan veya otomatik üretim kuyruğu değildir; kullanıcı kararını kendiliğinden başlatmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Hedefin kabul koşullarından Hazır veya Engelli sonucu hesaplanır; engel, bağımlı iş, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçelerle gösterilir. Kullanıcı sıralamayı değiştirebilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Plan gizli tek puan veya otomatik üretim kuyruğu değildir; kullanıcı kararını kendiliğinden başlatmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Plan gizli tek puan veya otomatik üretim kuyruğu değildir; kullanıcı kararını kendiliğinden başlatmaz.

## Further Notes

- Tek faz kaynağı: [`36-delivery-readiness/phase-context.md`](../../workflow/36-delivery-readiness/phase-context.md).
- Kanonik teknik adlar: Readiness Plan. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0015](../../adr/0015-separate-delivery-planning-export-and-fulfilment.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
