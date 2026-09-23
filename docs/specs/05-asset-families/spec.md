# Varlık Kimliğini ve Aile Soyunu Yönetme

## Problem Statement

Kullanıcı aynı konunun farklı kullanımlarını ortak Varlık Kimliğinde bulur, ayrı Ana Tasarım gerektiren temsilleri ayrı ailelerde sürdürür. Her Varlık Ailesi tek Görsel Dünya, kullanım bağlamı ve Ana Tasarım soyuna bağlıdır.

## Solution

Kullanıcı aynı konunun farklı kullanımlarını ortak Varlık Kimliğinde bulur, ayrı Ana Tasarım gerektiren temsilleri ayrı ailelerde sürdürür.

Her Varlık Ailesi tek Görsel Dünya, kullanım bağlamı ve Ana Tasarım soyuna bağlıdır.

Tamamlanma kanıtı: Aynı konu için farklı dünyalarda ayrı aile ve Ana Tasarım seçilir; her Türetilmiş Varlığın kesin tasarım soyu bulunur.

## User Stories

1. Bir kullanıcı olarak aynı karakter, obje veya konunun farklı temsillerini ortak Varlık Kimliğiyle ilişkilendirmek istiyorum; böylece temsiller arasındaki konu bağı bulunabilir.
2. Bir kullanıcı olarak farklı Görsel Dünya veya kullanım bağlamında ayrı Ana Tasarım gereken temsilleri ayrı Varlık Ailelerinde tutmak istiyorum; böylece ayrı tasarım soyları zorla birleştirilmez.
3. Bir kullanıcı olarak her Varlık Ailesini tek Görsel Dünya, kullanım bağlamı ve Ana Tasarım soyuyla sınırlamak istiyorum; böylece aile içi kuralların kapsamı belirgin olur.
4. Bir kullanıcı olarak aile içinde aynı Ana Tasarımdan türeyen yön, animasyon, varyant ve ekipmanları ilişkilendirmek istiyorum; böylece ilgili üretimleri ortak soy içinde inceleyebilirim.
5. Bir kullanıcı olarak her Türetilmiş Varlığın hangi kesin Ana Tasarımdan geldiğini kaydetmek istiyorum; böylece kimlik ve bağlam kaynağı izlenebilir kalır.
6. Bir kullanıcı olarak ayrı ailelerdeki temsiller arasında Varlık Kimliği üzerinden geçiş yapmak istiyorum; böylece aile sınırları korunurken aynı konuya bağlı kayıtları bulabilirim.
7. Bir kullanıcı olarak Ana Tasarım seçimini ve aile ilişkisini kendim kesinleştirmek istiyorum; böylece araç önerisi kimlik veya soy kararı vermez.
8. Bir kullanıcı olarak yalnız teknik dosya bölünmesinin yeni Varlık Kaydı ya da aile yaratmamasını istiyorum; böylece dosya yapısı ürün kimliğini belirlemez.

## Normatif gereksinimler

- **DIM-02 — Kimlik ve aile sınırı:** Aynı karakter, obje veya konu farklı Görsel Dünyalarda ve farklı amaçlarla kullanılabilir. Temsiller ortak bir Varlık Kimliği ile ilişkilendirilir; farklı Görsel Dünya veya kullanım bağlamında ayrı Ana Tasarım gereken temsiller ayrı Varlık Ailelerine aittir.
- **AST-04 — Varlık Ailesi:** Aynı Ana Tasarım soyundaki karakter yönleri, animasyonları, varyantları ve ekipmanları aynı Varlık Ailesinde ilişkilendirilebilir. Farklı Görsel Dünya veya kullanım bağlamındaki portre ve ikon gibi temsiller ayrı ailelerde tutulur ve Varlık Kimliği üzerinden bağlanır.
- **AUT-01 — Hazırlık ve kesinleştirme:** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir.


## Implementation Decisions

- **Temsilleri Ailelere Bağlama:** Sprite, portre ve ikon gibi temsiller ortak kimliğe bağlanırken aile sınırları korunur. Aynı konunun farklı Görsel Dünya veya kullanım bağlamındaki temsili yeni aile olur; yön, animasyon, durum ve Türetilmiş Varlık ilişkileri yalnız doğru aile içinde kurulur.
- **Ana Tasarımı Seçme ve Türetilmiş Varlıkları Bağlama:** Kullanıcının seçtiği onaylı Ana Tasarım her Türetilmiş Varlığın kimlik kaynağı olarak açıkça kaydedilir. Ana Tasarım onaylanmadan keşif Aday olarak kalabilir; Türetilmiş Varlık hangi kesin Ana Tasarımdan geldiğini saklar ve kullanıcı kararı olmadan üretim için onaylı sayılmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Teknik dosya bölünmesi ayrı Varlık Kaydı veya aile oluşturmaz; farklı kullanımın tasarım soyu zorla birleştirilmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-08 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Aynı konu için farklı dünyalarda ayrı aile ve Ana Tasarım seçilir; her Türetilmiş Varlığın kesin tasarım soyu bulunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Teknik dosya bölünmesi ayrı Varlık Kaydı veya aile oluşturmaz; farklı kullanımın tasarım soyu zorla birleştirilmez.
- Kabul örnekleri: RAS-01, RAS-08. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Teknik dosya bölünmesi ayrı Varlık Kaydı veya aile oluşturmaz; farklı kullanımın tasarım soyu zorla birleştirilmez.

## Further Notes

- Tek faz kaynağı: [`05-asset-families/phase-context.md`](../../workflow/05-asset-families/phase-context.md).
- Kanonik teknik adlar: Subject Identity, Asset Family, Canonical Design. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`DIM-02`](../../prd/03-project-and-asset-foundations.md) — Kimlik ve aile sınırı.
- [`AST-04`](../../prd/03-project-and-asset-foundations.md) — Varlık Ailesi.
- [`AUT-01`](../../prd/03-project-and-asset-foundations.md) — Hazırlık ve kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0014](../../adr/0014-scope-canonical-designs-by-visual-world.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-08](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
