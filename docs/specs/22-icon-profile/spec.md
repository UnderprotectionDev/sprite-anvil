# İkon Profilini Uygulama

## Problem Statement

İkonlar gerçek kullanım boyutlarında, açık ve koyu arka planlarda siluet, okunurluk, iç boşluk, renk ve aile içi nesne ölçeğiyle sınanır. İkonun kaynağı ile oyunda veya arayüzde görüleceği gerçek boyut farklı olabilir.

## Solution

İkonlar gerçek kullanım boyutlarında, açık ve koyu arka planlarda siluet, okunurluk, iç boşluk, renk ve aile içi nesne ölçeğiyle sınanır.

İkonun kaynağı ile oyunda veya arayüzde görüleceği gerçek boyut farklı olabilir. Aile incelemesi bu boyut ve arka plan koşullarını birlikte tutar.

Tamamlanma kanıtı: Hedef boyut, okunurluk, renk ve aile ölçeği kesin ikon sürümünde değerlendirilir; kullanım çeşidi ile mantıksal ölçü paketlenir.

## User Stories

1. Bir kullanıcı olarak ikonları kaynak boyutları yanında gerçek kullanım boyutlarında görmek istiyorum; böylece küçültüldüğünde kaybolan ayrıntıyı değerlendirebilirim.
2. Bir kullanıcı olarak ikon ailesini açık ve koyu arka planlarda yan yana karşılaştırmak istiyorum; böylece kontrast ve arka plan bağımlılığı görünür olur.
3. Bir kullanıcı olarak siluet, gri tonlama, iç boşluk, kontur ve renk ilişkisini incelemek istiyorum; böylece nesnenin okunurluğunu farklı kanıtlarla değerlendirebilirim.
4. Bir kullanıcı olarak ailedeki ikonların nesne ölçeği ve ayrıntı yoğunluğunu karşılaştırmak istiyorum; böylece bir ikon diğerlerine göre orantısız görünmez.
5. Bir kullanıcı olarak nadirlik veya durum renginin nesne kimliğini sessizce değiştirmemesini istiyorum; böylece renk çeşidi yeni varlık kimliği sanılmaz.
6. Bir kullanıcı olarak mantıksal boyutu, kullanım çeşidini ve kesin ikon sürümünü pakette taşımak istiyorum; böylece oyunda hangi temsilin kullanıldığı korunur.
7. Bir kullanıcı olarak ikon kullanım testini etkin Özel Profil Sözleşmesi altında kaydetmek istiyorum; böylece ölçüm ve inceleme kesin profil sürümüne bağlanır.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **İkonu Kullanım Boyutunda Önizleme:** İkon kaynak ve mantıksal ölçülerinde, açık ve koyu arka planlarda siluet, okunurluk ve iç boşlukla gösterilir. Kaynak ve mantıksal ölçü ile gerçek kullanım çeşidi ayrı kayıtlanır; ikon hedef ölçüde ve gri tonlamada da görülebilir. Açık veya koyu arka planda siluet ve iç boşluk kaybı insan incelemesine sunulur.
- **İkon Ailesi Tutarlılığını İnceleme:** Nesne ölçeği, ışık, kontur, ayrıntı yoğunluğu ve durum ya da nadirlik renginin kimliği bozup bozmadığı karşılaştırılır. Aynı ailede nesne ölçeği, ışık yönü, kontur ve ayrıntı yoğunluğu yan yana izlenir. Nadirlik veya durum rengi nesne kimliğini sessizce değiştiremez; seçilen ikonun kesin sürümü dışa aktarım eşlemesine girer.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.

## Testing Decisions

- **Birincil test seam’i:** RAS-03 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Hedef boyut, okunurluk, renk ve aile ölçeği kesin ikon sürümünde değerlendirilir; kullanım çeşidi ile mantıksal ölçü paketlenir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.
- Kabul örnekleri: RAS-03. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.

## Further Notes

- Tek faz kaynağı: [`22-icon-profile/phase-context.md`](../../workflow/22-icon-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-03](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
