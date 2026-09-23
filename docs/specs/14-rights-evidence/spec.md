# Hak Kanıtını ve Hak Geçmişini Yönetme

## Problem Statement

Kullanıcı referans ve sonuçların beyan edilen hak durumunu, kısıtlarını ve kanıt ilişkilerini hukuki hüküm üretilmeden hedefe özgü değerlendirir. Hak beyanları hem doğrudan sonuç hem de kaynak zinciri için görünürdür.

## Solution

Kullanıcı referans ve sonuçların beyan edilen hak durumunu, kısıtlarını ve kanıt ilişkilerini hukuki hüküm üretilmeden hedefe özgü değerlendirir.

Hak beyanları hem doğrudan sonuç hem de kaynak zinciri için görünürdür. Bir Teslimat Hedefinin hangi kanıt durumunu kabul ettiği ayrıca hedef politikasında belirlenir.

Tamamlanma kanıtı: Kullanıcı her kaynağın sürümlü beyanını ve bir sonuçla ilişkisini görebilir; değişen risk geçmiş paketi yazmadan yeni değerlendirmeye taşınır.

## User Stories

1. Bir kullanıcı olarak her kaynağın kaynak, hak sahibi veya sağlayıcı, beyan edilen izin kapsamı, kısıt ve belirsizliğini Hak Kaydında tutmak istiyorum; böylece hak bilgisi sonuçla izlenebilir olur.
2. Bir kullanıcı olarak Hak Kaydına destekleyici kanıt bağlamak istiyorum; böylece beyan ile belgeye dayalı bilgi ayrılır.
3. Bir kullanıcı olarak kaydı Belgelendi, Yalnız Beyan, Bilinmiyor veya Kısıtlı olarak sınıflandırmak istiyorum; böylece mevcut bilgi düzeyi ve kullanım sınırı açık kalır.
4. Bir kullanıcı olarak Hak Geçmişinde sonuçla birlikte kullanılan referansların, Ana Tasarımın ve bağlı kaynakların kayıtlarını ayrı görmek istiyorum; böylece kaynağın beyanı Türetilmiş Varlığa otomatik hak aktarmaz.
5. Bir kullanıcı olarak Teslimat Hedefinin kabul ettiği hak kanıtı düzeyini hedef politikasında belirlemek istiyorum; böylece değerlendirme kullanım amacına göre yapılır.
6. Bir kullanıcı olarak ürünün lisans geçerliliği hakkında hukuki hüküm vermemesini istiyorum; böylece kayıt izlenebilirlik sağlar ama hukuk kararı taklidi yapmaz.
7. Bir kullanıcı olarak Hak Kaydı değişince yeni kayıt sürümü oluşturup gelecekteki hedefleri yeniden değerlendirmek istiyorum; böylece geçmiş paketler sabitledikleri eski beyanı korur.

## Normatif gereksinimler

- **IMP-03 — Üretim kaynakları:** ChatGPT’yi elle kullanma yolu her zaman geçerli bir üretim yoludur. Kullanıcı sonucu kopyalayıp yapıştırabilir, sürükleyebilir veya dosya olarak yükleyebilir.
- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.


## Implementation Decisions

- **Hak Kayıtlarını Sürümleme:** Kaynak, beyan, kanıt, kısıt ve belirsizlik her değişiklikte yeni, değişmez Hak Kaydı olarak korunur. Referans veya sonuca bağlı kaynak, beyan edilen hak durumu, kısıt ve belirsizlik değiştiğinde yeni Hak Kaydı sürümü oluşur. Geçmiş paket ve teslimatlar kullandıkları kesin sürümü korur; kayıt hukuki yeterlilik hükmü vermez.
- **Hak Geçmişini İzleme:** Sonucun kendi kaydı ile Ana Tasarım, referans ve bağımlı kaynak kayıtları ayrı gösterilir; haklar otomatik aktarılmaz. Sonucun kendi Hak Kaydı, Ana Tasarımın, referansların ve bağımlı kaynakların ayrı kayıtlarıyla birlikte izlenir. Bir kaynaktaki beyan Türetilmiş Varlığa otomatik hak aktarmadığı için eksik ya da Kısıtlı durum hedef politikasında görünür olur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Uygulama lisans geçerliliği hakkında hukuki karar vermez ve kaynağın beyanını Türetilmiş Varlığa otomatik aktarmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı her kaynağın sürümlü beyanını ve bir sonuçla ilişkisini görebilir; değişen risk geçmiş paketi yazmadan yeni değerlendirmeye taşınır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Uygulama lisans geçerliliği hakkında hukuki karar vermez ve kaynağın beyanını Türetilmiş Varlığa otomatik aktarmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Uygulama lisans geçerliliği hakkında hukuki karar vermez ve kaynağın beyanını Türetilmiş Varlığa otomatik aktarmaz.

## Further Notes

- Tek faz kaynağı: [`14-rights-evidence/phase-context.md`](../../workflow/14-rights-evidence/phase-context.md).
- Kanonik teknik adlar: Rights Record, Rights Lineage. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-03`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim kaynakları.
- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.

**İlgili mimari sınırlar**

- [ADR 0016](../../adr/0016-use-target-specific-rights-evidence-without-legal-judgment.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
