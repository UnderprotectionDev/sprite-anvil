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
- **Kimlik ve Yön Tutarlılığı İncelemesi kaydı (#94):** Kullanıcı dört veya sekiz ayrı yön adı için aynı ailedeki bütünlüğü doğrulanmış Varlık Sürümlerini, kare sırasını, bağımsız milisaniye sürelerini ve isteğe bağlı sprite sheet alanlarını seçer. Önizlemeler aynı geçen milisaniye saatini kullanır; her yön kendi toplam süresinde döner. Ana Tasarım yanında doğal 1× görünüm, yakınlaştırma, duraklatma, konuma gitme ve komşu yönleri vurgulama sunulur. Yedi gözlem, kullanıcı sonucu ve gerekçe; kesin Ana Tasarım, içerik özetleri ve Özel Profil Sözleşmesi kopyasıyla değişmez kayda yazılır ve yeniden okunur. Bu kayıt onay kararını veya Kalite Kontrol Durumunu değiştirmez.
- **Animasyon Zamanlamasını ve Geçişlerini İnceleme (#95):** Kullanıcı dört veya sekiz ayrı yön için kare sırasını, kare başına bağımsız milisaniye sürelerini, serbest metinle isteğe bağlı hareket evrelerini, oynatma hızını ve döngü ayarını belirler. Tüm yönler aynı geçen milisaniye saatinde oynar ve her biri kendi toplam süresinde döner. Gameplay Metadata içindeki `event_links` yalnızca seçili proje, karakter profili, sözleşme revizyonu, Varlık Sürümü ve kare kimliği eşleştiğinde gösterilir. `event_links.time`, klip başlangıcından geçen milisaniyedir; önceki kare süreleri eklenmez ve aynı zaman değeri bütün yönlerde ortak eksende hizalanır. Metadata yüklenme ve okuma hataları boş olay listesi gibi gösterilmez. Önceki ve sonraki kare ile loop sınırı önizlemede karşılaştırılır. Yeni kayıtta sonuç için ön seçim yapılmaz; sonuç kaydedilmeden önce kullanıcı tarafından açıkça seçilir. Sonuç ve gerekçe, tam kare listeleri, içerik özetleri ve Özel Profil Sözleşmesi kopyasıyla değişmez kayda yazılır ve yeniden okunur. Bu kayıt Review Disposition veya QA Readiness değerini değiştirmez; kimlik ya da hareket hakkında otomatik sanatsal hüküm vermez.
- **Animasyon Metadata Bütünlüğünü Doğrulama:** Pivot, zemin noktası, mount point, çarpışma alanı ve olay bağlantıları kare kimlikleriyle roundtrip kaybı olmadan korunur. Kareye bağlı pivot, zemin çizgisi, mount point, çarpışma alanı ve olay bilgisi içe aktarma, düzenleme, paketleme ve yeniden okumada aynı kimliği korur. Kopuk kare bağlantısı bütünlük engelidir; zemin veya loop sapması sözleşmedeki tolerans ve inceleme sınıfına göre ele alınır.
- **Animasyon Metadata Paketi (#96):** JSON paket, seçili değişmez Composite Version'ın Composition Membership, kesin Unit Version ve Asset Version pinlerini, ayrıca paketleme anında seçili karelere bağlı Gameplay Metadata'yı taşır. Aynı tarihsel Composite Version'a karşı yeniden okuma paket özetini, kesin sürüm pinlerini ve paketteki metadata kayıtlarını doğrular; daha sonra aynı kareye eklenen metadata eski anlık görüntüyü geçersiz kılmaz. Directional Review'e bağlı kare süreleri ve atlas bölgeleri, görsel dosyalar ve tam Export Bundle bu pakete dahil değildir. Paket 512 KiB ile sınırlıdır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.

## Testing Decisions

- **Birincil test seam’i:** RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- **#94 test seam’leri:** [`directional-review.test.ts`](../../../apps/server/src/directional-review.test.ts) korumalı API’de kesin girdiyi kaydetme/yeniden okuma, tekrar gönderme, eksik gözlem, yetki ve değişmiş hedef yollarını sınar. [`directional-review.integration.test.ts`](../../../apps/server/src/directional-review.integration.test.ts) ayrı PostgreSQL bağlantılarıyla dört/sekiz yönün kalıcılığını, yazma sırasında Ana Tasarım değişimini ve silinmiş içerik erişimini sınar. [`directional-review-editor.test.tsx`](../../../apps/web/src/features/character-animation-profile/ui/components/directional-review-editor.test.tsx) ortak saat, değişken süre, doğal piksel ölçüsü, kesim alanı, kimlik doğrulamalı API adresinden önizleme yükleme, oynatma/duraklatma ve insan girdisi sınırını doğrular. [`directional-review-manager.test.tsx`](../../../apps/web/src/features/character-animation-profile/ui/components/directional-review-manager.test.tsx) reddedilmiş yazmanın düzeltilebilir kalmasını ve belirsiz yazmanın yalnız aynı işlem kimliği yeniden okununca doğrulanmasını sınar. [`directional-reviews.spec.ts`](../../../apps/web/e2e/directional-reviews.spec.ts) web arayüzünde dört/sekiz yön kaydetme ve yenileyerek yeniden açma yoludur. [`directional-reviews.spec.ts` (desktop)](../../../apps/web/desktop-e2e/directional-reviews.spec.ts) masaüstü yüzeyinde dört yön kaydetme ve yeniden açma yolunu ayrıca sınar; web testi bunun yerine geçmez.
- **#95 test seam’leri:** [`animation-timing-review.test.ts`](../../../apps/server/src/animation-timing-review.test.ts) korumalı API’de bağımsız kare sürelerini ve isteğe bağlı evreleri kaydetme/yeniden okuma, aynı işlem kimliğini güvenle yeniden gönderme, aile erişimi, sözleşme revizyonu, içerik bütünlüğü ve eksik gerekçe yollarını sınar. [`animation-timing-review.integration.test.ts`](../../../apps/server/src/animation-timing-review.integration.test.ts) disposable PostgreSQL üzerinde değişmez inceleme kaydını kalıcı store üzerinden yeniden okumayı sınar. [`animation-timing-review-editor.test.tsx`](../../../apps/web/src/features/character-animation-profile/ui/components/animation-timing-review-editor.test.tsx) bağımsız kare sırası/süreleri, evre şablonunun zorunlu olmaması, yeni incelemede açık sonuç seçimi, ortak milisaniye saati, 2× oynatma hızı, duraklatma/başa dönme, `event_links.time` değerinin klip başlangıcından ortak eksende hizalanması ve metadata yükleme/okuma hatalarının görünürlüğünü; kayıtlı inceleme alanlarının salt okunur olmasını ve oynatma incelemesinin açık kalmasını sınar. [`animation-timing-review-manager.test.tsx`](../../../apps/web/src/features/character-animation-profile/ui/components/animation-timing-review-manager.test.tsx) belirsiz yazma sonucunda eski incelemeyi açıp yeni incelemeye geçerek kilidi aşamamayı, aynı işlem kimliği yeniden okunduğunda kaydı çözmeyi, aile başına benzersiz Asset Record metadata sorgularını ve hata sonrası yeniden yüklemeyi sınar. [`animation-timing-reviews.spec.ts`](../../../apps/web/e2e/animation-timing-reviews.spec.ts) web arayüzünde kare sırası, değişken süreler, boş evre, 2× hız, ortak konum, döngü sınırı ve dört/sekiz yönlü kaydı yenileyerek yeniden açmayı sınar. [`animation-timing-reviews.spec.ts` (desktop)](../../../apps/web/desktop-e2e/animation-timing-reviews.spec.ts) masaüstü yüzeyinde değişken süreleri, kare sırasını, ortak konumu, döngü sınırını ve dört yönlü kalıcı kaydı yeniden okumayı ayrıca sınar.
- **#96 test seam’leri:** [`animation-metadata-package.test.ts`](../../../apps/server/src/features/character-animation-profile/server/animation-metadata-package.test.ts) seçili Composite Version'ın kesin üyelik/sürüm pinleri ve Gameplay Metadata'sını korumasını, 512 KiB sınırını, aynı kareye yeni metadata eklendikten sonra eski anlık görüntünün okunmasını, özet değişikliğinin ve farklı Composite Version pinlerinin reddini korumalı API'de sınar. [`animation-metadata-package-panel.test.tsx`](../../../apps/web/src/features/character-animation-profile/ui/components/animation-metadata-package-panel.test.tsx) seçilen tarihsel sürüm için indirme ve yeniden okuma akışını, ayrıca kapsam metnini doğrular. Web ve masaüstü aynı Varlık Kayıtları görünümünü ve paneli kullanır.
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
- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)
- [ADR 0004](../../adr/0004-engine-neutral-export-with-godot-first.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- #94 yalnız Kimlik ve Yön Tutarlılığını İnceleme adımını uygular. Hareket evreleri, olay zamanlaması, kare metadata roundtrip, seçici kare düzeltme ve paketleme bu teslimata dahil değildir. Bu spec bütün fazın teslim edildiği iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
- #95 yalnız Animasyon Zamanlamasını ve Geçişlerini İnceleme adımını uygular. `event_links.time` klip başlangıcından geçen milisaniye olarak yorumlanır ve aynı değere sahip olaylar yön izleri arasında hizalanır; metadata kaydı değiştirilmez. Kare metadata roundtrip, seçici kare düzeltme ve paketleme #96 kapsamındadır. Bu spec bütün fazın teslim edildiği iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
- #96 yalnız bileşim metadata paketleme ve tarihsel yeniden okuma yolunu uygular; RAS-01'in tüm animasyon inceleme, onarım, zamanlama ve teslimat kanıtlarını tamamlamaz. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
