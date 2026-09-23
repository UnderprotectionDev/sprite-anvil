# Koleksiyonları Düzenleme

## Problem Statement

Kullanıcı farklı ailelere ait Varlık Kayıtlarını isteğe bağlı Koleksiyonlarda bir araya getirir ve üyeliği yeniden düzenler. Koleksiyon kullanıcı düzenidir.

## Solution

Kullanıcı farklı ailelere ait Varlık Kayıtlarını isteğe bağlı Koleksiyonlarda bir araya getirir ve üyeliği yeniden düzenler.

Koleksiyon kullanıcı düzenidir. Üye ekleme veya çıkarma kaynak kayıtları, Ana Tasarım soyunu ve mevcut kalite ya da onay geçmişini değiştirmez.

Tamamlanma kanıtı: Kullanıcı ilişkileri farklı kayıtları aynı Koleksiyonda toplar ve üyeliği kaldırır; kaynak kayıtların geçmişi korunur.

## User Stories

1. Bir kullanıcı olarak farklı Varlık Ailelerinden kayıtları isteğe bağlı Koleksiyonda bir araya getirmek istiyorum; böylece kendi çalışma düzenimi kurabilirim.
2. Bir kullanıcı olarak Koleksiyona kayıt ekleyip çıkarabilmek istiyorum; böylece düzenim üretim sürecimle birlikte değişebilir.
3. Bir kullanıcı olarak Koleksiyon üyeliğini değiştirirken kaynak kayıtların sürüm, onay, kalite ve geçmişini korumak istiyorum; böylece düzenleme içerik kararlarını değiştirmez.
4. Bir kullanıcı olarak aynı Koleksiyonda soy ilişkisi bulunmayan kayıtları birlikte tutmak istiyorum; böylece Koleksiyon aile ilişkisi olmak zorunda kalmaz.
5. Bir kullanıcı olarak Koleksiyon üyeliğinin kural aktarımı veya bağımlılık yaratmamasını istiyorum; böylece üyelik görsel davranışı değiştirmez.
6. Bir kullanıcı olarak Koleksiyonun Gerekli Öğeler Listesi veya Teslimat Hedefi sayılmamasını istiyorum; böylece kişisel düzen teslimat yükümlülüğü oluşturmaz.

## Normatif gereksinimler

- **AST-05 — Koleksiyon:** Kullanıcı varlıkları ada, türe, Temaya, Görsel Dünya’ya, ölçüye, etikete ve yaşam döngüsü durumuna göre arayıp filtreleyebilir. İlişkileri farklı olan Varlık Kayıtları isteğe bağlı Koleksiyonlarda bir araya getirilebilir.


## Implementation Decisions

- **Koleksiyonları Düzenleme:** Kullanıcı farklı ailelere ait Varlık Kayıtlarını isteğe bağlı Koleksiyonlarda bir araya getirir ve üyeliği yeniden düzenler. Koleksiyon kullanıcı düzenidir. Üye ekleme veya çıkarma kaynak kayıtları, Ana Tasarım soyunu ve mevcut kalite ya da onay geçmişini değiştirmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Koleksiyon Gerekli Öğeler Listesi veya Teslimat Hedefi değildir; üyelik kural devri, bağımlılık, tamamlanma ya da teslimat zorunluluğu oluşturmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı ilişkileri farklı kayıtları aynı Koleksiyonda toplar ve üyeliği kaldırır; kaynak kayıtların geçmişi korunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Koleksiyon Gerekli Öğeler Listesi veya Teslimat Hedefi değildir; üyelik kural devri, bağımlılık, tamamlanma ya da teslimat zorunluluğu oluşturmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Koleksiyon Gerekli Öğeler Listesi veya Teslimat Hedefi değildir; üyelik kural devri, bağımlılık, tamamlanma ya da teslimat zorunluluğu oluşturmaz.

## Further Notes

- Tek faz kaynağı: [`08-collections/phase-context.md`](../../workflow/08-collections/phase-context.md).
- Kanonik teknik adlar: Collection. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-05`](../../prd/03-project-and-asset-foundations.md) — Koleksiyon.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
