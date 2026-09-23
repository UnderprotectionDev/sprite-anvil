# Üretim Tariflerini Yeniden Kullanma

## Problem Statement

Kullanıcı seçtiği Üretim Deneyinden sürümlü talimat ve referans iskeleti oluşturur; tarifi güncel bağlamla yeniden kullanarak yeni Üretim Paketi hazırlar.

## Solution

Kullanıcı seçtiği Üretim Deneyinden sürümlü talimat ve referans iskeleti oluşturur; tarifi güncel bağlamla yeniden kullanarak yeni Üretim Paketi hazırlar.

Tamamlanma kanıtı: Sürümlü tarif yeni kullanımda güncel bağlamı tüketen ayrı Üretim Paketi üretir; başka projedeki kopya kaynak tarif değiştiğinde değişmez.

## User Stories

1. Bir kullanıcı olarak seçtiğim Üretim Deneyinden sürümlü Üretim Tarifi oluşturmak istiyorum; böylece yararlı talimat yapısını sonraki üretime taşıyabilirim.
2. Bir kullanıcı olarak tarifte doğal dil talimat iskeletini, referans rollerini ve beklenen çıktı yapısını düzenlemek istiyorum; böylece yeniden kullanım amacıma uygun olur.
3. Bir kullanıcı olarak sabitlenecek alanları ve her kullanımda dolduracağım alanları ayırmak istiyorum; böylece tarif değişmeyen talep ile yeni girdiyi karıştırmaz.
4. Bir kullanıcı olarak tarifi kullandığımda güncel Proje Bağlamıyla yeni ve değişmez Üretim Paketi hazırlamak istiyorum; böylece eski deney girdileri yeni üretime sessizce kopyalanmaz.
5. Bir kullanıcı olarak tarif ile etkin kurallar arasındaki çatışmayı çözmeden paketin oluşmamasını istiyorum; böylece yeniden kullanım bağlamı ihlal etmez.
6. Bir kullanıcı olarak tarifi başka projeye bağımsız kopya olarak taşımak istiyorum; böylece kaynak tarifteki sonraki düzenleme kopyayı değiştirmez.
7. Bir kullanıcı olarak proje bağlamı, varlık sürümü, referans dosyası ve hak kaydının kopyaya otomatik taşınmamasını istiyorum; böylece alıcı projede girdileri yeniden seçer ve doğrularım.

## Normatif gereksinimler

- **IMP-03 — Üretim kaynakları:** ChatGPT’yi elle kullanma yolu her zaman geçerli bir üretim yoludur. Kullanıcı sonucu kopyalayıp yapıştırabilir, sürükleyebilir veya dosya olarak yükleyebilir.


## Implementation Decisions

- **Üretim Tarifi Oluşturma:** Seçilen deneme düzenlenebilir doğal dil talimatı iskeletine, referans rollerine, beklenen çıktı yapısına ve sabit veya doldurulacak alanlara dönüştürülür. Tarif ait olduğu projede sürümlenir. Sanatsal kabul veya Proje Bağlamı kuralı değildir; kendiliğinden üretim başlatmaz.
- **Tarifi Kopyalama ve Kullanma:** Kullanıcı tarifi aynı projede yeniden kullanır veya başka projeye bağımsız kopya olarak taşır; güncel kurallarla yeni ve değişmez Üretim Paketi hazırlanır. Kaynak projeyle canlı eşitlenme olmaz. Bağlam kuralları, Varlık Sürümleri, referans dosyaları ve Hak Kayıtları tarif değeri gibi kopyalanmaz; alıcı projede eksik girdiler yeniden seçilir. Tarifle etkin kuralların çatışması çözülmeden paket oluşmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tarif kendiliğinden uygulanmaz, seçilen denemenin inceleme kararı veya başka projenin hak kanıtı yerine geçmez.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- YAS-01 adım 2’de başka projeye kopyalanan tarif için hedefli kanıt: kaynak tarif yeni bir sürüm aldığında hedef projedeki kopyanın değişmediğini, hedef bağlamın ve eksik girdilerin ayrıca çözüldüğünü doğrula.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Sürümlü tarif yeni kullanımda güncel bağlamı tüketen ayrı Üretim Paketi üretir; başka projedeki kopya kaynak tarif değiştiğinde değişmez. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tarif kendiliğinden uygulanmaz, seçilen denemenin inceleme kararı veya başka projenin hak kanıtı yerine geçmez.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tarif kendiliğinden uygulanmaz, seçilen denemenin inceleme kararı veya başka projenin hak kanıtı yerine geçmez.

## Further Notes

- Tek faz kaynağı: [`31-production-recipes/phase-context.md`](../../workflow/31-production-recipes/phase-context.md).
- Kanonik teknik adlar: Production Recipe. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-03`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim kaynakları.
- [`PRD §4.5`](../../prd/04-ingestion-lifecycle-and-quality.md) — Seçilen denemeden tarif oluşturma, bağımsız kopyalama ve kullanım davranışı.

**İlgili mimari sınırlar**

- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
