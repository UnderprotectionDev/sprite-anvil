# Teslimat Hedefini Planlama

## Problem Statement

Kullanıcı aileler arası kapsamı ve kabul politikalarını sürümlü bir Teslimat Hedefinde tanımlar. Hedef, aile içi Gerekli Öğeler Listelerinin üstünde çok aileli bir kabul amacı tanımlar; kesin varlık sürümleri paket oluşturulunca sabitlenir.

## Solution

Kullanıcı aileler arası kapsamı ve kabul politikalarını sürümlü bir Teslimat Hedefinde tanımlar.

Hedef, aile içi Gerekli Öğeler Listelerinin üstünde çok aileli bir kabul amacı tanımlar; kesin varlık sürümleri paket oluşturulunca sabitlenir.

Hedef birden fazla aile için bağlamı, gerekli liste sürümlerini, kullanım testlerini ve üretim ile hak kanıtı politikalarını sabitler. Taslağı sistem hazırlayabilir, kullanıcı etkinleştirir; yeni kurallara geçiş geçmiş hedefi değiştirmeyen yeni sürüm ve fark oluşturur.

Tamamlanma kanıtı: Kullanıcı hedef ve kanıt politikası sürümünü etkinleştirir; taban değişikliği eski hedefi değiştirmeyen yeni sürüm ve kapsam farkı üretir.

## User Stories

1. Bir kullanıcı olarak demo, bölüm veya güncelleme gibi amaç için birden çok Varlık Ailesini kapsayan Teslimat Hedefi tanımlamak istiyorum; böylece teslimatın aileler arası kapsamı sürümlenir.
2. Bir kullanıcı olarak hedefte gerekli aileleri, her ailenin Gerekli Öğeler Listesi sürümünü ve kullanım testlerini belirtmek istiyorum; böylece teslimat koşulları açık olur.
3. Bir kullanıcı olarak hedefin kabul koşullarını, üretim kanıtı ve hak kanıtı politikalarını seçmek istiyorum; böylece hedef hangi kanıtla karşılanacağını belirler.
4. Bir kullanıcı olarak hedef taslağı hazırlatıp yalnız inceledikten sonra sürümünü etkinleştirmek istiyorum; böylece hazırlık resmî hedef durumunu değiştirmez.
5. Bir kullanıcı olarak hedefin dayandığı bağlam ve gerekli liste sürümlerini sabitlemek istiyorum; böylece kapsamın hangi kurallara göre değerlendirildiği belli olur.
6. Bir kullanıcı olarak taban koşulları değişince eski hedefi koruyup yeni sürüm ve görünür kapsam farkı oluşturmak istiyorum; böylece geçmiş hedef yeniden yazılmaz.
7. Bir kullanıcı olarak hedefin kesin Varlık Sürümlerini planlama sırasında sabitlememesini istiyorum; böylece sürüm seçimi paket oluşturulurken yapılır.
8. Bir kullanıcı olarak çok aileli hedefi aile içi Gerekli Öğeler Listesinden ayrı tutmak istiyorum; böylece teslimat kabulü aile içi kapsamı ezmez.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Teslimat Hedefi taslağını etkinleştirme:** Kullanıcı birden çok Varlık Ailesi için Bağlam Sürümü, Gerekli Öğeler Listesi ve kullanım testlerini kapsayan hedef taslağını inceler ve sürümünü etkinleştirir.
- **Kanıt politikasıyla hedefi yeniden sürümleme:** Üretim Kanıtı Politikası ve Hak Kanıtı Politikası hedefe sabitlenir. Yeni tabana geçiş geçmiş hedefi değiştirmeyen yeni sürüm ve görünür kapsam farkı oluşturur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Hedef taslağı etkinleştirilmeden resmî Hedef Hazırlığını değiştirmez; aile içi Gerekli Öğeler Listesinin yerini almaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı hedef ve kanıt politikası sürümünü etkinleştirir; taban değişikliği eski hedefi değiştirmeyen yeni sürüm ve kapsam farkı üretir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Hedef taslağı etkinleştirilmeden resmî Hedef Hazırlığını değiştirmez; aile içi Gerekli Öğeler Listesinin yerini almaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Hedef taslağı etkinleştirilmeden resmî Hedef Hazırlığını değiştirmez; aile içi Gerekli Öğeler Listesinin yerini almaz.

## Further Notes

- Tek faz kaynağı: [`35-delivery-planning/phase-context.md`](../../workflow/35-delivery-planning/phase-context.md).
- Kanonik teknik adlar: Delivery Target, Rights Evidence Policy. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0015](../../adr/0015-separate-delivery-planning-export-and-fulfilment.md)
- [ADR 0016](../../adr/0016-use-target-specific-rights-evidence-without-legal-judgment.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
