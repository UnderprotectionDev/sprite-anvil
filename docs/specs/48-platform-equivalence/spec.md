# Web ve Masaüstünde Eşdeğer Üretim Sonucu Sağlama

## Problem Statement

Kullanıcı iki uygulamada temel üretim akışını aynı yetkili kayıt ve teslimat anlamıyla tamamlar. Aşama 3, Çekirdek Üretim Akışı için ara eşdeğerlik kanıtı üretir; PLT-01'in tamamlandığı iddiası değildir. Tam PLT-01 kabulü, Aşama 4'te teslimat senaryoları ve Aşama 5'te tüm RAS/YAS senaryoları ile yayımlanmış destek matrisi doğrulandıktan sonra verilir. Masaüstünün yerel dosya kolaylıkları ve webin elle uygulama yolu farklı olabilir; kullanıcı sonucu eşdeğerdir.

## Solution

Kullanıcı Aşama 3'te aynı Çekirdek Üretim Akışı girdisini web ve masaüstünde işler; yetkili kayıt, kalite kanıtı ve motor bağımsız paket anlamları karşılaştırılır. Bu ara kanıt PLT-01'i veya platform desteğini tamamlamaz.

Tam kabul, Aşama 4 teslimat kapsamını ve Aşama 5'te tüm RAS/YAS senaryolarının web/masaüstü karşılaştırmasını, yayımlanmış destek matrisini ve operasyonel parametreleri kapsar. Masaüstünün yerel dosya kolaylıkları ve webin elle uygulama yolu farklı olabilir; kullanıcı sonucu eşdeğerdir.

Tamamlanma kanıtı: Aşama 3 çekirdek akış karşılaştırması ara kanıt olarak saklanır. Tam kabul için Aşama 4/5 kapsamındaki tüm RAS/YAS senaryoları, erişilebilir temel akış ve Desteklenen Platformlar Tablosundaki her birleşim eşdeğer kayıt, kalite kanıtı, paket, kilit ve ayrışma sonucunu üretir; OV-08–OV-11'in yayımlanmış parametreleri ve kanıtları bulunur. Bu kanıt olmadan PLT-01 veya platform desteği tamamlanmış sayılmaz; destek kaldırılmadan önce duyuru ve veri dışa aktarma yolu sağlanır.

## User Stories

1. Bir kullanıcı olarak aynı temel üretim girdisini web ve masaüstünde işlemek istiyorum; böylece ekran adımları farklı olsa da yetkili sonuçların anlamı eşdeğer olur.
2. Bir kullanıcı olarak Aşama 3 çekirdek akış kanıtını ara kanıt olarak görmek istiyorum; böylece ara karşılaştırma tam PLT-01 kabulü sanılmaz.
3. Bir kullanıcı olarak iki yüzeyin yetkili kayıt, sabitlenmiş sürüm ve kalite kanıtını aynı anlamla üretmesini istiyorum; böylece platform seçimi ürün durumunu değiştirmez.
4. Bir kullanıcı olarak aynı Dışa Aktarım Paketi, Teslimat Yenileme Kilidi ve ayrışma sonucunu webde ve masaüstünde karşılaştırmak istiyorum; böylece teslimat kararları yüzeyler arasında tutarlı kalır.
5. Bir kullanıcı olarak masaüstünün yerel dosya kolaylıklarını ve webin indirilebilir değişiklik paketi ile elle uygulama yolunu kullanmak istiyorum; böylece farklı kullanım adımları eşdeğer sonuca ulaşır.
6. Bir kullanıcı olarak tam kabul için Aşama 4 teslimat kapsamı ile Aşama 5'te tüm RAS/YAS senaryolarının iki yüzeyde karşılaştırılmasını istiyorum; böylece çekirdek ara kanıt tamamlanma yerine geçmez.
7. Bir kullanıcı olarak Desteklenen Platformlar Tablosundaki her tarayıcı, masaüstü, motor ve proje boyutu birleşiminin kanıtını görmek istiyorum; böylece ölçülmemiş destek iddiası yayımlanmaz.
8. Bir kullanıcı olarak erişilebilir temel akış, yayımlanmış performans sınırları ve sözleşme uyumluluğunun tam kabul kapısında doğrulanmasını istiyorum; böylece platform eşdeğerliği kalite ve operasyon koşullarını da kapsar.
9. Bir kullanıcı olarak OV-08–OV-11 parametreleri ve kanıtları yayımlanmadan PLT-01 tamamlandı denmemesini istiyorum; böylece açık kabul kapıları gizlenmez.
10. Bir kullanıcı olarak desteklenen platform kaldırılacaksa önceden bildirim ve veri dışa aktarma yolu görmek istiyorum; böylece desteğin sona ermesi veriye erişimi aniden kesmez.

## Normatif gereksinimler

- **PLT-01 — Anlamsal platform eşdeğerliği:** Web ve masaüstü uygulamaları temel üretim akışını baştan sona tamamlar. Ekran ve adımların aynı olması gerekmez; yetkili kayıt, sabitlenmiş sürüm, kalite kanıtı, paket, kilit ve ayrışma sonucu anlam bakımından eşdeğer olmalıdır.
- **OPS-04 — Erişilebilir temel akış:** Web temel akışta WCAG 2.2 AA'yı; masaüstü aynı akışta eşdeğer klavye, görünür odak, ekran okuyucu adı ve durum bildirimini sağlar.
- **OPS-05 — Ölçülebilir performans:** Harici ChatGPT ve üçüncü taraf analiz süreleri ürün performansından ayrı ölçülür. Yerel veya bulut işlemi kullanıcı eylemine bir saniye içinde yanıt veremiyorsa ilerleme durumu gösterilir.


## Implementation Decisions

- **Aşama 3 çekirdek eşdeğerlik kanıtı:** Aynı Çekirdek Üretim Akışı girdisi web ve masaüstünde yetkili kayıt, kalite kanıtı ve motor bağımsız paket açısından karşılaştırılır. Bu ara kanıt, PLT-01'in veya destek matrisinin tamamlandığı anlamına gelmez.
- **Aşama 4/5 tam platform kabulü:** Teslimat akışları, erişilebilir temel akış ve bütün RAS/YAS senaryoları web ve masaüstünde karşılaştırılır; Desteklenen Platformlar Tablosundaki her birleşim yayımlanmış süre, bellek ve sözleşme sınırlarını geçer. Ölçülmemiş birleşim destekleniyor diye ilan edilmez; destek kaldırma öncesi duyuru ve veri dışa aktarma yolu verilir. OV-08–OV-11 kapanmadan ilgili silme, arşiv boyutu, operasyonel kapasite veya platform desteği kabul edilmiş sayılmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Ekranların birebir aynı olması, telefon/tablet veya tam çevrimdışı çalışma desteği vaat edilmez; ölçülmemiş platform ve proje boyutu destekleniyor diye ilan edilmez. Performans sınırları Operasyonel Kabul Profilinde, sözleşme sürümü ve göç kuralları ise ilgili kayıt akışlarının kabulünde doğrulanır.

## Testing Decisions

- **Aşama 3 test seam’i:** Aynı Çekirdek Üretim Akışı girdisini web ve masaüstünde çalıştırıp yetkili kayıt, kalite kanıtı ve motor bağımsız paket anlamını karşılaştırma; farkları ara kanıt olarak saklama.
- **Aşama 4/5 test seam’i:** Desteklenen Platformlar Tablosundaki web ve masaüstü birleşimlerinde tüm RAS/YAS fixture’larını ve OPS-04 erişilebilir temel akışı koşturup yetkili kayıt, paket, kilit, ayrışma ve senaryo sonuçlarını karşılaştırma. Tam kabul OV-08–OV-11 parametreleri ve kanıtları yayımlanmadan kapatılamaz.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül tam kabul kanıtı: Aşama 4/5 kapsamındaki bütün RAS/YAS senaryoları, OPS-04 erişilebilir temel akışı ve Desteklenen Platformlar Tablosundaki tarayıcı/işletim sistemi birleşimleri eşdeğer kayıt, kalite kanıtı, paket, kilit ve ayrışma sonucuyla geçer. OV-08–OV-11 kapanmadan ilgili tamamlanma ve destek iddiası açılmaz. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Ekranların birebir aynı olması, telefon/tablet veya tam çevrimdışı çalışma desteği vaat edilmez; ölçülmemiş platform ve proje boyutu destekleniyor diye ilan edilmez.
- Aşama 3 ara kanıtı, 8.1 ortak akışındaki yetkili kayıt/kalite/paket anlamını karşılaştırır; RAS/YAS senaryolarının tamamlandığını veya PLT-01'in kapandığını iddia etmez.
- Tam kabul örnekleri: 8.1, RAS-01, RAS-02, RAS-03, RAS-04, RAS-05, RAS-06, RAS-07, RAS-08, YAS-01, YAS-02, YAS-03, YAS-04. Bu karşılaştırma ve destek matrisi Aşama 4/5 kapsamıdır. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Ekranların birebir aynı olması, telefon/tablet veya tam çevrimdışı çalışma desteği vaat edilmez; ölçülmemiş platform ve proje boyutu destekleniyor diye ilan edilmez. Performans sınırları Operasyonel Kabul Profilinde, sözleşme sürümü ve göç kuralları ise ilgili kayıt akışlarının kabulünde doğrulanır.

## Further Notes

- Tek faz kaynağı: [`48-platform-equivalence/phase-context.md`](../../workflow/48-platform-equivalence/phase-context.md).
- Aşama sınırları: [PRD doğrulama aşamaları 3–5](../../prd/14-validation-phases.md); Aşama 3 ara kanıttır, tam PLT-01 kabulü sonraki aşamalardadır.
- Kanonik teknik adlar: Supported Platform Matrix, Core Production Lifecycle. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`PLT-01`](../../prd/08-platform-and-operations.md) — Anlamsal platform eşdeğerliği.
- [`OPS-04`](../../prd/08-platform-and-operations.md) — Erişilebilir temel akış.
- [`OPS-05`](../../prd/08-platform-and-operations.md) — Ölçülebilir performans.

**İlgili mimari sınırlar**

- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)
- [ADR 0021](../../adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-02](../../prd/10-acceptance-scenarios.md)
- [RAS-03](../../prd/10-acceptance-scenarios.md)
- [RAS-04](../../prd/10-acceptance-scenarios.md)
- [RAS-05](../../prd/10-acceptance-scenarios.md)
- [RAS-06](../../prd/10-acceptance-scenarios.md)
- [RAS-07](../../prd/10-acceptance-scenarios.md)
- [RAS-08](../../prd/10-acceptance-scenarios.md)
- [YAS-01](../../prd/10-acceptance-scenarios.md)
- [YAS-02](../../prd/10-acceptance-scenarios.md)
- [YAS-03](../../prd/10-acceptance-scenarios.md)
- [YAS-04](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
