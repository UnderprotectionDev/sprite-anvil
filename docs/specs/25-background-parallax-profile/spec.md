# Arka Plan ve Katmanlı Kaydırma Profilini Uygulama

## Problem Statement

Arka plan katmanları hedef oran, güvenli alan, göreli hareket, döngü, kırpma, kontrast ve oyuncu görünürlüğüyle gerçek kaydırma davranışında incelenir. Hedef görüntü oranı ve güvenli oyun alanı arka planın gerçek kullanımını belirler.

## Solution

Arka plan katmanları hedef oran, güvenli alan, göreli hareket, döngü, kırpma, kontrast ve oyuncu görünürlüğüyle gerçek kaydırma davranışında incelenir.

Hedef görüntü oranı ve güvenli oyun alanı arka planın gerçek kullanımını belirler. Katmanlar tek tek değil, göreli hareketleriyle beraber görülür.

Tamamlanma kanıtı: Katman sırası, hız, kırpma ve döngü ayarlarıyla kullanıcıya gerçek kaydırma sunulur; kontrast ve oyuncu görünürlüğü kayda bağlanır.

## User Stories

1. Bir kullanıcı olarak arka plan için hedef görüntü oranını ve güvenli oyun alanını belirlemek istiyorum; böylece inceleme gerçek hedef çerçevesine dayanır.
2. Bir kullanıcı olarak katmanları sıraları ve göreli hızlarıyla birlikte oynatmak istiyorum; böylece parallax davranışını tek tek durağan görsellerden ayrı değerlendirebilirim.
3. Bir kullanıcı olarak döngü ve birleşim izlerini gerçek kaydırma sırasında incelemek istiyorum; böylece süreklilik yalnız statik karede varsayılmaz.
4. Bir kullanıcı olarak hedef oranda kırpma ve güvenli alanı değerlendirmek istiyorum; böylece oyun alanı dışında kalan içerik görünür olur.
5. Bir kullanıcı olarak arka plan kontrastını ve oyuncunun görünürlüğünü kayda bağlamak istiyorum; böylece oynanış okunurluğu aile kanıtına eklenir.
6. Bir kullanıcı olarak katman sırası, göreli hareket, kırpma ve döngü ayarlarını kesin profil sürümüyle dışa aktarmak istiyorum; böylece teslim edilen sahne aynı arka plan davranışını korur.
7. Bir kullanıcı olarak durağan temas sayfasının arka planı tamamlanmış saymamasını istiyorum; böylece katmanlı kaydırma gerçek kullanım testinden geçer.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Katman Düzenini ve Güvenli Alanı Kurma:** Katman sırası, doğal ölçü, hedef görüntü oranı, kırpma ve oyuncu için güvenli alan kesin sürümlerle tanımlanır. Her katman kimlik, sıra, doğal ölçü, hedef oran, kırpma ve güvenli alan bilgisi taşır. Bu bilgiler arka planın kendi Görsel Dünyası ve kesin sürümleriyle ilişkilidir; oyuncunun görünmesi için ayrılan alan kaybolmaz.
- **Gerçek Kaydırma Davranışını Sınama:** Göreli hız, döngü, birleşim izi, kontrast ve oyuncu görünürlüğü katmanlar birlikte hareket ederken incelenir. Katmanlar göreli hızlarıyla birlikte hareket eder; döngü başlangıcı, birleşim izi, kırpma, kontrast ve oyuncu silueti hedef oranlarda sınanır. Kullanım testi sonucu oynatılan kesin katman sürümlerini sabitler.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.

## Testing Decisions

- **Birincil test seam’i:** RAS-06 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Katman sırası, hız, kırpma ve döngü ayarlarıyla kullanıcıya gerçek kaydırma sunulur; kontrast ve oyuncu görünürlüğü kayda bağlanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.
- Kabul örnekleri: RAS-06. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.

## Further Notes

- Tek faz kaynağı: [`25-background-parallax-profile/phase-context.md`](../../workflow/25-background-parallax-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-06](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
