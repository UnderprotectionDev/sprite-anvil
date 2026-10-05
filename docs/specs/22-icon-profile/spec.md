# İkon Profilini Uygulama

## Problem Statement

İkonlar gerçek kullanım boyutlarında, açık ve koyu arka planlarda siluet, okunurluk, iç boşluk, renk ve aile içi nesne ölçeğiyle sınanır. İkonun kaynağı ile oyunda veya arayüzde görüleceği gerçek boyut farklı olabilir.

## Solution

İkonlar gerçek kullanım boyutlarında, açık ve koyu arka planlarda siluet, okunurluk, iç boşluk, renk ve aile içi nesne ölçeğiyle sınanır.

İkonun kaynağı ile oyunda veya arayüzde görüleceği gerçek boyut farklı olabilir. Aile incelemesi bu boyut ve arka plan koşullarını birlikte tutar; nesne ölçeği, ışık yönü, kontur, ayrıntı yoğunluğu ve durum veya nadirlik renginin kimliği koruyup korumadığına dair kullanıcı değerlendirmesini kaydeder.

Bu issue'ın teslim kapsamı, kalıcı `Icon Family Review` kaydı ve indirilebilir `Icon Family Review Archive` JSON dosyasıdır. Arşiv; `schemaVersion`, kayıt verisi, etkin Özel Profil Sözleşmesi kopyası, kesin Varlık Sürümü kimlikleri ve sürüm özetlerini taşır. Görsel baytlarını taşımaz; genel Oyun Motorundan Bağımsız Paket, Dışa Aktarım Paketi veya Proje Arşivi değildir.

Bu teslimat, RAS-03'ün aile incelemesi ve inceleme kaydı bölümünü kanıtlar. PRD'deki tam Dışa Aktarım Paketi ve web/masaüstü kabul kapsamının yerine geçmez.

## User Stories

1. Bir kullanıcı olarak ikonları kaynak boyutları yanında gerçek kullanım boyutlarında görmek istiyorum; böylece küçültüldüğünde kaybolan ayrıntıyı değerlendirebilirim.
2. Bir kullanıcı olarak ikon ailesini açık ve koyu arka planlarda yan yana karşılaştırmak istiyorum; böylece kontrast ve arka plan bağımlılığı görünür olur.
3. Bir kullanıcı olarak siluet, gri tonlama, iç boşluk, kontur ve renk ilişkisini incelemek istiyorum; böylece nesnenin okunurluğunu farklı kanıtlarla değerlendirebilirim.
4. Bir kullanıcı olarak ailedeki ikonların nesne ölçeği ve ayrıntı yoğunluğunu karşılaştırmak istiyorum; böylece bir ikon diğerlerine göre orantısız görünmez.
5. Bir kullanıcı olarak nadirlik veya durum renginin nesne kimliğini sessizce değiştirmemesini istiyorum; böylece renk çeşidi yeni varlık kimliği sanılmaz.
6. Bir kullanıcı olarak mantıksal boyutu, kullanım çeşidini ve kesin ikon sürümünü pakette taşımak istiyorum; böylece oyunda hangi temsilin kullanıldığı korunur.
7. Bir kullanıcı olarak ikon kullanım testini etkin Özel Profil Sözleşmesi altında kaydetmek istiyorum; böylece ölçüm ve inceleme kesin profil sürümüne bağlanır.
8. Bir kullanıcı olarak aile incelemesini şema sürümü, kesin Varlık Sürümü kimlikleri ve sürüm özetleriyle JSON olarak indirmek istiyorum; böylece değerlendirme kaydı görsel dosyaları taşımadan incelenebilir.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **İkonu Kullanım Boyutunda Önizleme:** İkon kaynak ve mantıksal ölçülerinde, açık ve koyu arka planlarda siluet, okunurluk ve iç boşlukla gösterilir. Kaynak ve mantıksal ölçü ile gerçek kullanım çeşidi ayrı kayıtlanır; ikon hedef ölçüde ve gri tonlamada da görülebilir. Açık veya koyu arka planda siluet ve iç boşluk kaybı insan incelemesine sunulur.
- **İkon Ailesi Tutarlılığını İnceleme:** Nesne ölçeği, ışık, kontur, ayrıntı yoğunluğu ve durum ya da nadirlik renginin kimliği bozup bozmadığı karşılaştırılır. Aynı ailede nesne ölçeği, ışık yönü, kontur ve ayrıntı yoğunluğu yan yana izlenir. Nadirlik veya durum rengi nesne kimliğini sessizce değiştiremez; seçilen ikonun kesin sürümü dışa aktarım eşlemesine girer.
- **Icon Family Review kaydı:** Kullanıcının karşılaştırma sonuçları, gerekçesi, kullanım çeşidi, mantıksal ölçü, açık/koyu arka plan ve gri tonlama denetimleri; etkin ikon sözleşmesi kopyasıyla ve karşılaştırılan kesin Varlık Sürümleriyle değişmez bir kayda bağlanır.
- **Icon Family Review Archive:** İndirilen JSON, `archiveType`, `schemaVersion`, dışa aktarım zamanı ve tam `Icon Family Review` kaydını içerir. Her kesin Varlık Sürümü için kayıt kimliği ve adı, sürüm kimliği ve numarası, içerik türü, bayt uzunluğu ve SHA-256 özeti bulunur. Önizleme URL'leri, kimlik bilgileri ve görsel baytları arşive girmez. Bu dosya, genel dışa aktarım veya geri yükleme paketi değildir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.

## Testing Decisions

- **#99 — İkonu Kullanım Boyutunda Önizleme test seam’i:** API entegrasyon testi ve görünür web sonucu. API testi kullanıcı eylemiyle kanıtı kaydeder, ardından yeni DB bağlantısından kesin `Asset Version` üzerindeki `sourceImageDimensions` alanını, `Asset Record` üzerindeki doğrulanmış `measurements.logicalResolution.confirmed` alanını ve `Readiness Evidence` üzerindeki `usageVariant`, `targetDimensions` ve `grayscaleReviewed` alanlarını ayrı ayrı okur; kanıtın kesin sürüm bağlantısını da doğrular. Web testi kaynak, mantıksal ve hedef boyut önizlemelerini açık/koyu zeminlerde, hedef gri tonlamasını ve form gönderimini görünür biçimde doğrular.
- `Icon Usage Variant` kullanıcı tarafından girilen serbest metindir; API ve kalıcılık sınırında trim ve 1–120 karakter sınırı uygulanır. Mantıksal ölçü kaynak ölçüden türetilmez.
- #99 için masaüstü otomasyon testi onaylı seam’e dahil değildir. RAS-03’ün tam kabul senaryosu ve ADR 0002/0003’ün web ile masaüstü yüzeyi şartı daha geniş ürün kabul kapsamı olarak kalır. En yüksek kullanıcı yolunu sınamak için aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu da sınama; iç yardımcıların çağrılma sırasını test etme.
- #99 kanıtları [`family-readiness.integration.test.ts`](../../../apps/server/src/family-readiness.integration.test.ts) ve [`family-readiness-manager.test.tsx`](../../../apps/web/src/features/family-readiness/ui/components/family-readiness-manager.test.tsx) içindedir. Hedef boyut, okunurluk, renk ve aile ölçeği kesin ikon sürümünde değerlendirilir. Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz; bu kapsam sınırı Out of Scope bölümünde durur ve #99 kanıtlarında ayrıca test edilmez.
- **#100 — İkon Ailesi Tutarlılığını İnceleme test seam’i:** Korumalı oRPC `save` ve `list` işlemleriyle gerçek PostgreSQL kaydı ve farklı bir bağlantıdan yeniden okuma; web `IconFamilyReviewManager` görünümünde incelemeyi kaydetme, kayıtlı sonucu görme ve JSON arşivini indirme.
- #100 kalıcılık testi aynı ailedeki en az iki kesin ikon sürümünü, birden fazla mantıksal ölçüyü, kullanım çeşidini, etkin sözleşme kopyasını ve özetlenmiş sürüm kimliklerini doğrular. Geçersiz veya aileye ait olmayan bir sürümün reddedilip kayda dönüşmediğini de sınar. Web testi arşiv şemasını, kimlikleri/özetleri ve görsel baytları ya da önizleme URL’lerinin dışarıda kalmasını doğrular. Bu entegrasyon yalnız geçici loopback PostgreSQL kullanır.
- #100 kanıtları [`icon-family-review.integration.test.ts`](../../../apps/server/src/icon-family-review.integration.test.ts) ve [`icon-family-review-manager.test.tsx`](../../../apps/web/src/features/icon-profile/ui/components/icon-family-review-manager.test.tsx) içindedir. JSON arşivi tam RAS-03 dışa aktarım kanıtı veya görsel dosya paketi sayılmaz.
- Kabul örnekleri: RAS-03. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.

Icon Family Review Archive dışında genel Engine-Neutral Bundle, görsel baytlarını içeren paket, Project Archive round-trip ve bu issue için ayrı masaüstü kabul testi.

## Further Notes

- Tek faz kaynağı: [`22-icon-profile/phase-context.md`](../../workflow/22-icon-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-03](../../prd/10-acceptance-scenarios.md)
- Bu issue kapsamında kayıt, mevcut sunucu/API/PostgreSQL yığınıyla kalıcılaştırılır; web görünümü mevcut Varlık Aileleri ekranına bağlanır. Yeni bağımlılık veya platform sınırı eklenmez. Arşiv kapsamı Icon Family Review kaydıyla sınırlıdır.
