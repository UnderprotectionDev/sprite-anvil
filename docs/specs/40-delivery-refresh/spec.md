# Ayrışma Güvenli Tekrar Teslim

## Problem Statement

Kullanıcı aynı hedefe yeni paketi tek yönlü uygular; Workbench'in önceki teslimde sahiplendiği bir dosya hedefte değişmişse karar verilmeden üzerine yazılmaz. Tekrar teslim yalnız seçili değişmez paketten hedefe doğru kullanıcı tarafından başlatılır.

## Solution

Kullanıcı aynı hedefe yeni paketi tek yönlü uygular; Workbench'in önceki teslimde sahiplendiği bir dosya hedefte değişmişse karar verilmeden üzerine yazılmaz.

Tekrar teslim yalnız seçili değişmez paketten hedefe doğru kullanıcı tarafından başlatılır. Önceki yazımın kilidi hangi dosyanın Workbench sahipliğinde olduğunu gösterir.

Tamamlanma kanıtı: İlk uygulama kesin paketle bağlı kilit üretir; tekrar teslimde hedefte değişen sahipli dosya karar bekler, tanınmayan dosya korunur ve izinli yenileme sonucu web ile masaüstünde aynı anlamı taşır.

## User Stories

1. Bir kullanıcı olarak Dışa Aktarım Paketini seçtiğim teslimat konumuna ilk kez uygulamak istiyorum; böylece teslimat bu kesin paketten başlar.
2. Bir kullanıcı olarak ilk uygulamada Sprite Anvil'in yazdığı göreli yolları, özetleri, paket kimliğini ve profil sürümünü Teslimat Yenileme Kilidinde görmek istiyorum; böylece hangi dosyaların sahipli olduğu izlenir.
3. Bir kullanıcı olarak yeniden teslimi açıkça başlatmak istiyorum; böylece güncelleme kendiliğinden hedefe yazılmaz.
4. Bir kullanıcı olarak kilitle eşleşen ve daha önce Workbench'in yazdığı yolları karşılaştırmak istiyorum; böylece yalnız sahip olunan dosyalardaki değişiklik değerlendirilir.
5. Bir kullanıcı olarak tanınmayan yerel dosyaların değiştirilmemesini veya silinmemesini istiyorum; böylece hedefteki bağımsız içerik korunur.
6. Bir kullanıcı olarak Workbench'in yazdığı dosya hedefte değişmişse ayrışmayı görüp karar verene kadar yenilemenin durmasını istiyorum; böylece elle yapılmış değişiklik üzerine yazılmaz.
7. Bir kullanıcı olarak değişmemiş, güncellenecek ve çatışmalı yolları ayrı incelemek istiyorum; böylece hangi dosyanın ne olacağı anlaşılır.
8. Bir kullanıcı olarak webde indirilebilir değişiklik paketini ve masaüstünde izinli klasöre uygulamayı aynı teslimat anlamıyla kullanmak istiyorum; böylece yüzey seçimi koruma kararını değiştirmez.
9. Bir kullanıcı olarak kısmi uygulamanın başarılı sayılmamasını ve geçmiş paketin değişmeden kalmasını istiyorum; böylece yenileme atomik ve tek yönlü kalır.

## Normatif gereksinimler

- **EXP-03 — Ayrışma güvenli yenileme:** Bir Dışa Aktarım Paketi bir teslimat konumuna uygulandığında **Teslimat Yenileme Kilidi**, Sprite Anvil’in yazdığı göreli yolları, içerik özetlerini, paket kimliğini ve Dışa Aktarım Profili sürümünü hedefle eşler. Kilit yalnız Sprite Anvil’in önceki teslimatta sahiplendiği yollar için karşılaştırma yapar; tanımadığı dosyaları değiştirmez veya silmez.
- **OPS-02 — Atomik ve idempotent kesinleştirme:** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.


## Implementation Decisions

- **İlk Paketi Hedefe Uygulama ve Kilitleme:** Kullanıcının seçtiği kesin paket hedefe uygulanır; yazılan yollar ve içerik özetleri yalnız sahip olunan hedef kapsamı için kaydedilir. Başarılı ilk uygulama, Sprite Anvil tarafından yazılan göreli yolları ve özetleri kesin paket ile profil sürümüne bağlayan Teslimat Yenileme Kilidi üretir. Kısmi uygulama başarılı sayılmaz. Kilit mutlak yerel yol veya erişim sırrı taşımaz; tanınmayan hedef dosyalarını sahiplenmez.
- **Ayrışmayı Çözerek Yenileme:** Değişmemiş, güncellenecek, bayat, eksik ve ayrışmış yollar ayrı gösterilir; kullanıcı kararından sonra izinli yollar yeni paketle yenilenir. Yenilemeden önce yalnız sahip olunan yollar eski kilitle karşılaştırılır. Ayrışmış yol için kullanıcı koruma, başka konum seçme veya farkı gördükten sonra açık değiştirme kararı vermeden etkilenen dosya yazılmaz. Uygulanan yollar ve durdurulan ayrışmalar ayrı raporlanır; kısmi uygulama tamamlanmış teslimat gibi gösterilmez. Kilit kendi tam sözleşme sürümünü taşır; bilinmeyen ana sürüm veya zorunlu alan uygulamayı durdurur. Web indirilebilir değişiklik paketi, kilit ve ayrışma raporu verir; masaüstü yalnız kullanıcının izin verdiği klasöre uygular. İki yüzey aynı yol sınıflarını kullanır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Sürekli çift yönlü motor eşitlemesi ve ayrı Tüketim Makbuzu oluşturulmaz.

## Testing Decisions

- **Birincil test seam’i:** Sahip olunan, tanınmayan ve ayrışmış hedef yollarını aynı Delivery Refresh Lock ile sınıflandırma; web değişiklik paketi ve masaüstü izinli uygulama sonucunu YAS-03 üzerinden karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: İlk uygulama kesin paketle bağlı kilit üretir; tekrar teslimde hedefte değişen sahipli dosya karar bekler, tanınmayan dosya korunur ve izinli yenileme sonucu web ile masaüstünde aynı anlamı taşır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Sürekli çift yönlü motor eşitlemesi ve ayrı Tüketim Makbuzu oluşturulmaz.
- Kabul örnekleri: YAS-03. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Sürekli çift yönlü motor eşitlemesi ve ayrı Tüketim Makbuzu oluşturulmaz.

## Further Notes

- Tek faz kaynağı: [`40-delivery-refresh/phase-context.md`](../../workflow/40-delivery-refresh/phase-context.md).
- Kanonik teknik adlar: Delivery Refresh Lock. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-03`](../../prd/07-export.md) — Ayrışma güvenli yenileme.
- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0021](../../adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md)

**Kabul izlenebilirliği**

- [YAS-03](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
