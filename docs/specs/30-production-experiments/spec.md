# Üretim Deneylerini Sonuçlandırma

## Problem Statement

Kullanıcı aynı üretim amacına yönelik alternatif denemeleri kayıtlı girdileri ve sonuçlarıyla karşılaştırır; deneyi seçim, sonuçsuzluk veya bırakma kararıyla kapatır.

## Solution

Kullanıcı aynı üretim amacına yönelik alternatif denemeleri kayıtlı girdileri ve sonuçlarıyla karşılaştırır; deneyi seçim, sonuçsuzluk veya bırakma kararıyla kapatır.

Tamamlanma kanıtı: Deney sonucu kesinleşir, deneme kanıtı korunur ve öğrenim yalnız kullanıcıya sunulan öneri olarak taşınır.

## User Stories

1. Bir kullanıcı olarak aynı üretim amacına yönelik alternatif denemeleri Üretim Deneyinde gruplamak istiyorum; böylece her denemenin girdisini ve sonucunu birlikte karşılaştırabilirim.
2. Bir kullanıcı olarak her denemenin kendi değişmez Üretim Paketini ve Aday Sürümünü korumak istiyorum; böylece bir denemenin verisi diğerine yazılmaz.
3. Bir kullanıcı olarak bağlam, Ana Tasarım, referans, talimat, hedef ölçü, çıktı yapısı ve sağlanan üretim parametrelerindeki farkları incelemek istiyorum; böylece karşılaştırma gerçek girdileri gösterir.
4. Bir kullanıcı olarak birden fazla girdi değiştiğinde sonucun nedenini sistemin ayrıştıramadığını görmek istiyorum; böylece korelasyon nedensellik gibi sunulmaz.
5. Bir kullanıcı olarak denemelerden birini Seçim Yapıldı, Sonuçsuz veya Bırakıldı kararıyla kendim kapatmak istiyorum; böylece deney sonucu kullanıcı tarafından kesinleştirilir.
6. Bir kullanıcı olarak seçilen denemenin kendiliğinden Aday Sürümü onaylamamasını istiyorum; böylece tercih kalite ve insan incelemesi yerine geçmez.
7. Bir kullanıcı olarak deney öğrenimini istersem Bağlam Önerisi olarak hazırlamak istiyorum; böylece öğrenim etkin kuralı doğrudan değiştirmez.
8. Bir kullanıcı olarak deneme kanıtını saklayıp önceki ve seçilmemiş denemeleri korumak istiyorum; böylece sonuçsuzluk ve alternatifler geçmişten silinmez.

## Normatif gereksinimler

- **IMP-02 — Üretim Paketi:** Sistem bu bilgileri tek bir harici üretim denemesi için değişmez ve incelenebilir Üretim Paketi içinde toplar. Paket şunları içerir:
- **IMP-03 — Üretim kaynakları:** ChatGPT’yi elle kullanma yolu her zaman geçerli bir üretim yoludur. Kullanıcı sonucu kopyalayıp yapıştırabilir, sürükleyebilir veya dosya olarak yükleyebilir.


## Implementation Decisions

- **Denemeleri Karşılaştırma ve Sonuçlandırma:** Her denemenin değişmez Üretim Paketi ve Aday Sürümü korunur; bağlam, referans, talimat, ölçü ve varsa sağlayıcı parametresi farkları görünür olur. Birden fazla girdi değiştiyse karşılaştırma nedenin ayrıştırılamadığını söyler. Sonucu ve varsa seçilen denemeyi kullanıcı kesinleştirir; seçim Aday Sürümü kendiliğinden onaylamaz ve diğer denemeleri silmez.
- **Deney Öğrenimini Bağlam Önerisine Dönüştürme:** Kullanıcı deney öğrenimini en dar anlamlı kapsamda incelenebilir Bağlam Önerisine aktarır. Öneri kaynak deneyi, karşılaştırılan denemeleri, değişen girdileri, nedenin ayrıştırılıp ayrıştırılamadığını ve kullanıcı yorumunu saklar. Kapsamı genişletme kullanıcı kararıdır; öneri etkin kural olmaz ve bağlam etkinleştirme kapısını ayrıca geçer.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Seçilen deneme otomatik onay veya etkin bağlam kuralı değildir; neden ayrıştırılamıyorsa kesin nedensellik iddiası üretilmez.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Deney sonucu kesinleşir, deneme kanıtı korunur ve öğrenim yalnız kullanıcıya sunulan öneri olarak taşınır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Seçilen deneme otomatik onay veya etkin bağlam kuralı değildir; neden ayrıştırılamıyorsa kesin nedensellik iddiası üretilmez.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Seçilen deneme otomatik onay veya etkin bağlam kuralı değildir; neden ayrıştırılamıyorsa kesin nedensellik iddiası üretilmez.

## Further Notes

- Tek faz kaynağı: [`30-production-experiments/phase-context.md`](../../workflow/30-production-experiments/phase-context.md).
- Kanonik teknik adlar: Production Experiment. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-02`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim Paketi.
- [`IMP-03`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim kaynakları.

**İlgili mimari sınırlar**

- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
