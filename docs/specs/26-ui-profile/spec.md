# Arayüz Ekranı ve Bileşen Profilini Uygulama

## Problem Statement

Arayüz ekranları ve bileşen durumları aile stili, doğal ölçü, dokuz parçalı germe, metin güvenli alanı ve hedef boyut davranışıyla sınanır. Arayüz ekranı ile panel ve düğme gibi Türetilmiş Varlık niteliğindeki bileşenler kendi Görsel Dünyasında bir aile olur.

## Solution

Arayüz ekranları ve bileşen durumları aile stili, doğal ölçü, dokuz parçalı germe, metin güvenli alanı ve hedef boyut davranışıyla sınanır.

Arayüz ekranı ile panel ve düğme gibi Türetilmiş Varlık niteliğindeki bileşenler kendi Görsel Dünyasında bir aile olur. Durum kimliği ve germe alanı kesin metadata olarak taşınır.

Tamamlanma kanıtı: Bileşen durumları tutarlı görünür, panel hedef ölçülerde ve metin güvenli alanını koruyarak genişler; aynı sonuç dışa aktarımda okunur.

## User Stories

1. Bir kullanıcı olarak arayüz ekranını ve ondan türeyen panel, düğme veya benzeri bileşenleri kendi Görsel Dünyasında ilişkilendirmek istiyorum; böylece arayüz kuralları oyun içi sanattan ayrılır.
2. Bir kullanıcı olarak normal, seçili, basılı, devre dışı, açık veya kapalı bileşen durumlarını birlikte incelemek istiyorum; böylece durumlar aile stiliyle karşılaştırılır.
3. Bir kullanıcı olarak doğal ölçü ve dokuz parçalı germe paylarını kaydetmek istiyorum; böylece panel farklı hedef boyutlara uyarlanırken köşeler korunur.
4. Bir kullanıcı olarak paneli hedef ölçülerde ve metin güvenli alanı görünürken denemek istiyorum; böylece metin veya içerik germe alanına taşmaz.
5. Bir kullanıcı olarak durum kimliğini, germe alanını ve ekran-bileşen bağlantısını kesin metadata olarak korumak istiyorum; böylece dışa aktarım eşlemesi yeniden okunabilir.
6. Bir kullanıcı olarak düzeltilen bileşen durumunu yeni ekran düzeninde sınamak istiyorum; böylece tekil düzeltmenin aile ve yerleşime etkisini görebilirim.
7. Bir kullanıcı olarak bu profilin görsel bileşenleri değerlendirmesini, oyun etkileşim kodu veya genel arayüz çatısı üretmemesini istiyorum; böylece kullanım sınırı belirgin kalır.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Ekran ve Bileşen Durumlarını Karşılaştırma:** Ekran tasarımıyla normal, üzerine gelme, basılı, devre dışı, seçili, açık ve kapalı durumlar aynı aile stilinde incelenir. Ekran ve panel, düğme, eşya gözü gibi bileşenler aynı aile sınırında görünür. Normal, üzerine gelme, basılı, devre dışı ve seçili durumları karışmadan karşılaştırılır; durum kimlikleri dışa aktarımda korunur.
- **Germe ve Metin Alanını Sınama:** Doğal ölçü, dokuz parçalı germe payları ve metin güvenli alanı belirtilen hedef boyutlarda bozulmadan çalışır. Panelin dokuz parçalı germe payları köşeleri bozmadan farklı hedef ölçülerde uygulanır. Metin güvenli alanı ve doğal ölçü birlikte görülür; geçersiz pay veya sınır sözleşmedeki sınıfına göre değerlendirilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-07 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Bileşen durumları tutarlı görünür, panel hedef ölçülerde ve metin güvenli alanını koruyarak genişler; aynı sonuç dışa aktarımda okunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.
- Kabul örnekleri: RAS-07. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Bu profil oyunun etkileşim kodunu veya genel arayüz uygulama çatısını üretmez.

## Further Notes

- Tek faz kaynağı: [`26-ui-profile/phase-context.md`](../../workflow/26-ui-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-07](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
