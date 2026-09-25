# Varlıkları Arama ve Filtreleme

## Problem Statement

Kullanıcı proje kütüphanesinde aradığı Varlık Kaydını ada, türe, Temaya, Görsel Dünyaya, ölçüye, etikete ve kayıt durumuna göre bulur. Sonuç ilgili sürüm ve geçmişe götürür.

## Solution

Kullanıcı proje kütüphanesinde aradığı Varlık Kaydını ada, türe, Temaya, Görsel Dünyaya, ölçüye, etikete ve kayıt durumuna göre bulur.

Sonuç ilgili sürüm ve geçmişe götürür. Boş sonuç, arşivlenmiş kayıt veya erişilemeyen içerik yanlış varlık ilişkisi oluşturmaz.

Tamamlanma kanıtı: Kullanıcı belirtilen alanlarla aradığı kaydı ve ilişkili geçmişi bulur; boş ve erişim dışı sonuçlar açıkça ayırt edilir.

## User Stories

1. Bir kullanıcı olarak Varlık Kayıtlarını ada ve türe göre aramak istiyorum; böylece kütüphanede hedef kayda ulaşabilirim.
2. Bir kullanıcı olarak Tema, Görsel Dünya, ölçü, etiket ve Kayıt Durumu filtrelerini birlikte kullanmak istiyorum; böylece aramayı kayıt özelliklerine göre daraltabilirim.
3. Bir kullanıcı olarak sonuçtan ilgili Varlık Sürümüne ve üretim geçmişine geçmek istiyorum; böylece bulduğum kaydın hangi kanıt ve kararları taşıdığını görebilirim.
4. Bir kullanıcı olarak boş arama sonucunu arşivlenmiş kayıttan ayırt etmek istiyorum; böylece bulunmayan içerik mevcut sanılmaz.
5. Bir kullanıcı olarak erişim dışı içeriğin arama sonucunda erişilebilir varlık gibi görünmemesini istiyorum; böylece sonuçlar yetki sınırına uyar.
6. Bir kullanıcı olarak aramanın Varlık Ailesi soyunu, Koleksiyon üyeliğini veya teslimat zorunluluğunu değiştirmemesini istiyorum; böylece keşif eylemi kayıt ilişkilerine karar vermez.
7. Bir kullanıcı olarak arama yerel veya bulut yanıtı bir saniyeyi aşacaksa ilerleme durumu görmek istiyorum; böylece yanıt beklerken işlemin sürdüğünü anlayabilirim.

## Normatif gereksinimler

- **AST-03 — Varlık Kaydı:** Varlık kütüphanesi yalnızca dosyaları gösteren bir galeri değildir. Bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği taşıyan öğe Varlık Kaydıdır; yalnız teknik olarak değiştirilebilir olması ayrı kayıt olmasını gerektirmez.
- **AST-05 — Koleksiyon:** Kullanıcı varlıkları ada, türe, Temaya, Görsel Dünya’ya, ölçüye, etikete ve yaşam döngüsü durumuna göre arayıp filtreleyebilir. Koleksiyon üyeliği soy, kural aktarımı, tamamlanma koşulu, bağımlılık veya teslimat zorunluluğu oluşturmaz.
- **OPS-05 — Ölçülebilir performans:** Harici ChatGPT ve üçüncü taraf analiz süreleri ürün performansından ayrı ölçülür. Yerel veya bulut işlemi kullanıcı eylemine bir saniye içinde yanıt veremiyorsa ilerleme durumu gösterilir.


## Implementation Decisions

- **Varlıkları Arama ve Filtreleme:** Kullanıcı proje kütüphanesinde aradığı Varlık Kaydını ada, türe, Temaya, Görsel Dünyaya, ölçüye, etikete ve kayıt durumuna göre bulur. Sonuç ilgili sürüm ve geçmişe götürür. Boş sonuç, arşivlenmiş kayıt veya erişilemeyen içerik yanlış varlık ilişkisi oluşturmaz.
- **Aranabilir kayıt bilgileri:** Asset Category, mevcut sekiz Özel Varlık Profili grubunu ve diğer kategorileri tanımlar; kategori tek başına Özel Varlık Profili kanıtı değildir. Kullanıcı Asset Category ve etiketleri Varlık Kaydı metadata’sında düzenler. Görsel Dünya ve Tema Proje Bağlamı kapsam kataloğundan seçilir; aileye bağlı kaydın Görsel Dünyası ailesiyle uyuşur.
- **Kaynak Görsel Ölçüsü:** Ölçü, yüklenen görselden doğrulanarak o değişmez Varlık Sürümüne kaydedilir. Ölçü filtresi herhangi bir eşleşen sürüme sahip Varlık Kaydını döndürür ve eşleşen sürümü sonuçta gösterir; Tema, Görsel Dünya, kategori, etiket ve Kayıt Durumu aynı kayda ait metadata filtreleridir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Arama sonucu Varlık Ailesi soyunu, Koleksiyon üyeliğini veya teslimat zorunluluğunu değiştirmez.

## Testing Decisions

- **Birincil test seam’i:** Asset Discovery arama API’si ve Neon/Drizzle store üzerinden kesin filtre girdisini, proje erişim sınırını ve eşleşen Varlık Sürümünün yeniden okunmasını sınama. Web ile masaüstü aynı `AssetRecordsView` bileşenini kullandığından görünür filtre ve sonuç davranışı bu ortak bileşenin görünüm testinde sınanır; kalıcılık API entegrasyon testinde sınanır.
- **Eski sürüm uyumluluğu:** Kaynak Görsel Ölçüsü bilinmeyen eski sürümlerin ölçü filtresinde eşleşme üretmediğini; bu sürümlerin arama ve izleme yanıtlarında dosya adı olmadan da sürüm numarasıyla sunulabildiğini sınama. Bu durum için Drizzle migration uyumluluk testi ve API sözleşme testi kullanılır.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Mevcut yakın örnekler: [`asset-records.test.ts`](../../../apps/server/src/asset-records.test.ts), [`asset-records.integration.test.ts`](../../../apps/server/src/asset-records.integration.test.ts), [`asset-records-view.test.tsx`](../../../apps/web/src/features/asset-records/ui/views/asset-records-view.test.tsx), [`asset-records.spec.ts` (web)](../../../apps/web/e2e/asset-records.spec.ts) ve [`asset-records.spec.ts` (desktop)](../../../apps/web/desktop-e2e/asset-records.spec.ts). Bunlar keşif filtrelerinin kanıtı yerine geçmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı belirtilen alanlarla aradığı kaydı ve ilişkili geçmişi bulur; boş ve erişim dışı sonuçlar açıkça ayırt edilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Arama sonucu Varlık Ailesi soyunu, Koleksiyon üyeliğini veya teslimat zorunluluğunu değiştirmez.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Arama sonucu Varlık Ailesi soyunu, Koleksiyon üyeliğini veya teslimat zorunluluğunu değiştirmez.

## Further Notes

- Tek faz kaynağı: [`07-asset-discovery/phase-context.md`](../../workflow/07-asset-discovery/phase-context.md).
- Kanonik teknik adlar: Asset Record. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-03`](../../prd/03-project-and-asset-foundations.md) — Varlık Kaydı.
- [`AST-05`](../../prd/03-project-and-asset-foundations.md) — Koleksiyon ve arama/filtreleme.
- [`OPS-05`](../../prd/08-platform-and-operations.md) — Ölçülebilir performans.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
