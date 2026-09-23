# Karakter ve Animasyon Profilini Uygulama

## Problem Statement

Karakter, yaratık ve animasyon sürümleri kimlik, yön, zamanlama, zemin, olay ve kareye bağlı oyun bilgileriyle birlikte karşılaştırılır ve kullanımda sınanır. Bu ilk özel profil karakter ve animasyon ailesinin üretimden kullanım kanıtına kadar yürütülmesini sağlar.

## Solution

Karakter, yaratık ve animasyon sürümleri kimlik, yön, zamanlama, zemin, olay ve kareye bağlı oyun bilgileriyle birlikte karşılaştırılır ve kullanımda sınanır.

Bu ilk özel profil karakter ve animasyon ailesinin üretimden kullanım kanıtına kadar yürütülmesini sağlar. Kesin Profil Sözleşmesi metadata, kural ve dışa aktarım eşlemesini belirler.

Tamamlanma kanıtı: Farklı süreli yön ve kareler, olay ve bağlantı bilgileriyle incelenir; sorunlu tek kare düzeltilip eski bileşim korunarak paketlenebilir.

## User Stories

1. Bir kullanıcı olarak karakter ve yaratık için Ana Tasarım, gerekli yönler, varyantlar, ekipman ve animasyonları tek Varlık Ailesi içinde incelemek istiyorum; böylece karakterin kendi üretim kapsamı birlikte görünür.
2. Bir kullanıcı olarak farklı Görsel Dünya veya kullanıma ait portre ve ikon ailelerine Varlık Kimliğiyle geçmek istiyorum; böylece ilişkili temsil bulunurken ayrı aile sınırı korunur.
3. Bir kullanıcı olarak dört veya sekiz yönü eşzamanlı gösterip oynatmak istiyorum; böylece siluet, oran, ekipman tarafı ve perspektif farklarını karşılaştırabilirim.
4. Bir kullanıcı olarak kare sırası, farklı kare süreleri, oynatma hızı ve döngü davranışını incelemek istiyorum; böylece animasyon sabit kare hızına zorlanmaz.
5. Bir kullanıcı olarak hareket evrelerini ve olay zamanlamasını yönler arasında karşılaştırmak istiyorum; böylece temas, isabet veya diğer olayların konumu anlaşılır olur.
6. Bir kullanıcı olarak dönüş noktası, zemin çizgisi, mount point ve çarpışma alanlarını kareye bağlı metadata ile incelemek istiyorum; böylece yapısal eşleme kaybı fark edilir.
7. Bir kullanıcı olarak siluet, zemine temas ve loop sapmasını profil sınıfına göre değerlendirmek istiyorum; böylece her görsel fark evrensel otomatik engel sayılmaz.
8. Bir kullanıcı olarak farklı yönler için zemin ve zamanlama kanıtını kesin Profil Sözleşmesiyle ilişkilendirmek istiyorum; böylece profil kuralı ve değerlendirme sürümü izlenebilir olur.
9. Bir kullanıcı olarak bilerek hatalı tek kareyi seçici biçimde düzeltip yeni Birim Sürümü oluşturmak istiyorum; böylece ilgisiz yönler ve eski Birleşik Sürüm korunur.
10. Bir kullanıcı olarak profilin gerekli ve isteğe bağlı öğelerini aile listesi ve pakette korumak istiyorum; böylece karakter kapsamı kullanım testinden dışa aktarıma kadar izlenir.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Kimlik ve Yön Tutarlılığını İnceleme:** Yönler Ana Tasarıma göre siluet, oran, ekipman tarafı, palet, perspektif, ölçek ve zemine temas açısından eşzamanlı karşılaştırılır. Dört veya sekiz yön birlikte gösterilip eşzamanlı oynatılabilir; dönüş arası farklar ve doğal 1× görünüm incelenir. Öznel kimlik kararı kullanıcı incelemesidir, kesin kare kimliği ve bozuk bağlantı ise bütünlük kuralıdır.
- **Animasyon Zamanlamasını ve Geçişlerini İnceleme:** Kare sırası, değişken süreler, hareket evreleri, döngü sınırı ve yönler arası oynatma gerçek hızda karşılaştırılır. Her karenin süresi bağımsızdır; yürüyüş veya saldırı tek hız ya da zorunlu evre şablonuna sıkıştırılmaz. Önceki ve sonraki kare, soluk kareler, loop geçişi ve yönler arası olay zamanı aynı oynatma konumunda karşılaştırılır.
- **Animasyon Metadata Bütünlüğünü Doğrulama:** Pivot, zemin noktası, mount point, çarpışma alanı ve olay bağlantıları kare kimlikleriyle roundtrip kaybı olmadan korunur. Kareye bağlı pivot, zemin çizgisi, mount point, çarpışma alanı ve olay bilgisi içe aktarma, düzenleme, paketleme ve yeniden okumada aynı kimliği korur. Kopuk kare bağlantısı bütünlük engelidir; zemin veya loop sapması sözleşmedeki tolerans ve inceleme sınıfına göre ele alınır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.

## Testing Decisions

- **Birincil test seam’i:** RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Farklı süreli yön ve kareler, olay ve bağlantı bilgileriyle incelenir; sorunlu tek kare düzeltilip eski bileşim korunarak paketlenebilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.
- Kabul örnekleri: RAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.

## Further Notes

- Tek faz kaynağı: [`20-character-animation-profile/phase-context.md`](../../workflow/20-character-animation-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile, Unit Version. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
