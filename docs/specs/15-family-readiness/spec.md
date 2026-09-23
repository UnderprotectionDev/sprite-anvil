# Varlık Ailesi Tamamlanmasını Yönetme

## Problem Statement

Kullanıcı bir ailenin hangi yön, animasyon, durum, varyant ve kullanım testlerini gerektirdiğini sürümlü listede belirler. Gerekli Öğeler Listesi yalnız aile içindeki tamamlanmayı belirler; aileler arası hedef koşulları teslimat planındadır.

## Solution

Kullanıcı bir ailenin hangi yön, animasyon, durum, varyant ve kullanım testlerini gerektirdiğini sürümlü listede belirler.

Gerekli Öğeler Listesi yalnız aile içindeki tamamlanmayı belirler; aileler arası hedef koşulları teslimat planındadır.

Tamamlanma kanıtı: Kullanıcının etkinleştirdiği liste sürümündeki tüm gerekli öğeler Bağlama Uygun ve Dışa Aktarıma Hazır olduğunda aile tamamlanır; eski kanıt ve paketler korunur.

## User Stories

1. Bir kullanıcı olarak her Varlık Ailesi için yön, animasyon, durum, varyant ve kullanım testlerini içeren Gerekli Öğeler Listesi hazırlamak istiyorum; böylece aile içi tamamlanma ölçütü belirgin olur.
2. Bir kullanıcı olarak her öğeyi gerekli, isteğe bağlı veya uygulanamaz olarak tanımlamak istiyorum; böylece farklı kullanım kapsamları aynı zorunluluk sayılmaz.
3. Bir kullanıcı olarak liste değişikliklerini yeni sürümde hazırlayıp açıkça etkinleştirmek istiyorum; böylece taslak değişiklik mevcut aile ölçütünü erken değiştirmez.
4. Bir kullanıcı olarak etkin listedeki gerekli öğe eksikse aile tamamlanmış görünmesin istiyorum; böylece kalite istisnası eksik işi tamamlanmış saymaz.
5. Bir kullanıcı olarak gerekli öğelerin Bağlama Uygun ve Dışa Aktarıma Hazır olmasına göre aile tamamlanmasını görmek istiyorum; böylece tamamlanma kanıtı sürüm ve kalite koşullarına dayanır.
6. Bir kullanıcı olarak eski liste sürümlerini ve onları kullanan paketleri korumak istiyorum; böylece yeni aile ölçütü geçmiş kanıtı değiştirmez.
7. Bir kullanıcı olarak aile içi listeyi çok aileli Teslimat Hedefinden ayrı tutmak istiyorum; böylece aile kapsamı teslimat gereksiniminin yerine geçmez.

## Normatif gereksinimler

- **AST-07 — Aile tamamlanması:** Her Varlık Ailesinin sürümlenen bir Gerekli Öğeler Listesi vardır. Liste yalnız o ailenin hangi yönlerinin, animasyonlarının, durumlarının, varyantlarının ve kullanım testlerinin gerekli, isteğe bağlı veya uygulanamaz olduğunu belirtir.


## Implementation Decisions

- **Varlık Ailesi Tamamlanmasını Yönetme:** Kullanıcı bir ailenin hangi yön, animasyon, durum, varyant ve kullanım testlerini gerektirdiğini sürümlü listede belirler. Gerekli Öğeler Listesi yalnız aile içindeki tamamlanmayı belirler; aileler arası hedef koşulları teslimat planındadır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Eksik zorunlu öğe kalite istisnasıyla geçilmez; öneri kullanıcı etkinleştirmesi olmadan geçerli olmaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1, YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcının etkinleştirdiği liste sürümündeki tüm gerekli öğeler Bağlama Uygun ve Dışa Aktarıma Hazır olduğunda aile tamamlanır; eski kanıt ve paketler korunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Eksik zorunlu öğe kalite istisnasıyla geçilmez; öneri kullanıcı etkinleştirmesi olmadan geçerli olmaz.
- Kabul örnekleri: 8.1, YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Eksik zorunlu öğe kalite istisnasıyla geçilmez; öneri kullanıcı etkinleştirmesi olmadan geçerli olmaz.

## Further Notes

- Tek faz kaynağı: [`15-family-readiness/phase-context.md`](../../workflow/15-family-readiness/phase-context.md).
- Kanonik teknik adlar: Required Set. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-07`](../../prd/04-ingestion-lifecycle-and-quality.md) — Aile tamamlanması.

**İlgili mimari sınırlar**

- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
