# Referans Aktarım Kurallarını Yönetme

## Problem Statement

Kullanıcı bir referansın kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema için neyi aktarabileceğini ve hangi özelliklerden kaçınacağını açıkça belirler. Referans panosu yapıştırma, sürükleyip bırakma, yan yana düzenleme ve not eklemeyi destekler.

## Solution

Kullanıcı bir referansın kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema için neyi aktarabileceğini ve hangi özelliklerden kaçınacağını açıkça belirler.

Referans panosu yapıştırma, sürükleyip bırakma, yan yana düzenleme ve not eklemeyi destekler. Hazır amaçlar yanında özel amaç ve aktarım sınırı tanımlanabilir. Açık yasak genel izni geçer; Ana Tasarımın kimlik sınırı ancak açık Bağlam Kuralı İstisnasıyla aşılır.

Tamamlanma kanıtı: Her referansın amacı ve izinli veya yasak aktarımı üretim geçmişinde izlenir; eş ayrıntı düzeyindeki çözülmemiş çatışma kullanıcıya gösterilir.

## User Stories

1. Bir kullanıcı olarak görseli referans panosuna yapıştırmak veya sürükleyip bırakmak istiyorum; böylece dışarıdaki örnekleri üretim bağlamında toplayabilirim.
2. Bir kullanıcı olarak referansları yan yana düzenleyip not eklemek istiyorum; böylece görsel kararlarımı karşılaştırma ve açıklamayla ilişkilendirebilirim.
3. Bir kullanıcı olarak her referansa kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema gibi kullanım amacı vermek istiyorum; böylece hangi özelliğin aktarılacağını belirtirim.
4. Bir kullanıcı olarak hazır amaçların dışında özel amaç ve açık aktarım ya da yasak sınırı tanımlamak istiyorum; böylece referansın gerçek kullanımını tarif edebilirim.
5. Bir kullanıcı olarak açık yasağın genel izinden üstün olmasını istiyorum; böylece yasakladığım özellik üretim girdisinden aktarılmaz.
6. Bir kullanıcı olarak Ana Tasarımın kimlik sınırını aşmayı ancak açık Bağlam Kuralı İstisnasıyla kaydetmek istiyorum; böylece kimlik aktarımı örtük kalmaz.
7. Bir kullanıcı olarak eş ayrıntı düzeyindeki referanslar arasındaki çözülmemiş çelişkiyi görüp çözmek istiyorum; böylece ekleme sırası çatışmaya kendiliğinden öncelik vermez.
8. Bir kullanıcı olarak referans amaç ve aktarım kurallarının üretim geçmişinde korunmasını istiyorum; böylece sonradan hangi sınırların verildiğini inceleyebilirim.

## Normatif gereksinimler

- **IMP-01 — Referans rolü:** Referans panosu görsel yapıştırmayı, sürükleyip bırakmayı, görselleri yan yana düzenlemeyi ve not eklemeyi destekler. Her referansa kullanım amacı atanır.


## Implementation Decisions

- **Referans Aktarım Kurallarını Yönetme:** Kullanıcı bir referansın kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema için neyi aktarabileceğini ve hangi özelliklerden kaçınacağını açıkça belirler. Referans panosu yapıştırma, sürükleyip bırakma, yan yana düzenleme ve not eklemeyi destekler. Hazır amaçlar yanında özel amaç ve aktarım sınırı tanımlanabilir. Açık yasak genel izni geçer; Ana Tasarımın kimlik sınırı ancak açık Bağlam Kuralı İstisnasıyla aşılır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Referansın eklenme sırası veya üretim modelinin yorumu çatışmaya kendiliğinden öncelik vermez; aktarım kurallarını kaydetmek tek başına Üretim Paketi oluşturmaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Her referansın amacı ve izinli veya yasak aktarımı üretim geçmişinde izlenir; eş ayrıntı düzeyindeki çözülmemiş çatışma kullanıcıya gösterilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Referansın eklenme sırası veya üretim modelinin yorumu çatışmaya kendiliğinden öncelik vermez; aktarım kurallarını kaydetmek tek başına Üretim Paketi oluşturmaz.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Referansın eklenme sırası veya üretim modelinin yorumu çatışmaya kendiliğinden öncelik vermez; aktarım kurallarını kaydetmek tek başına Üretim Paketi oluşturmaz.

## Further Notes

- Tek faz kaynağı: [`10-reference-production/phase-context.md`](../../workflow/10-reference-production/phase-context.md).
- Kanonik teknik adlar: Reference Role, Reference Transfer Constraint. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Referans rolü.

**İlgili mimari sınırlar**

- [ADR 0013](../../adr/0013-make-reference-transfer-boundaries-deterministic.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
