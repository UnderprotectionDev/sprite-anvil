# Görsel Efekt ve Yüzey İşareti Profilini Uygulama

## Problem Statement

Efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri şeffaflık, taşma, zamanlama, başlangıç noktası ve sahibiyle eşzamanlı kullanım açısından doğrulanır. Efekt, fırlatılan nesne, gölge ve yüzey işareti aynı kullanım ailesindeki zaman ve sahip ilişkileriyle ele alınır.

## Solution

Efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri şeffaflık, taşma, zamanlama, başlangıç noktası ve sahibiyle eşzamanlı kullanım açısından doğrulanır.

Efekt, fırlatılan nesne, gölge ve yüzey işareti aynı kullanım ailesindeki zaman ve sahip ilişkileriyle ele alınır. Hücre taşması kontrollü bir profil kararıdır.

Tamamlanma kanıtı: Görünüm ve sahibine bağlı oynatma farklı zeminlerde çalışır; başlangıç, katman, olay ve istisna kanıtı kesin sürümle dışa aktarılır.

## User Stories

1. Bir kullanıcı olarak görsel efekt, fırlatılan nesne, gölge ve yüzey işaretini kullanım ailesi içinde değerlendirmek istiyorum; böylece sahip ve zaman ilişkileri birlikte görünür.
2. Bir kullanıcı olarak efekti şeffaf, açık, koyu ve gerçek sahne arka planlarında izlemek istiyorum; böylece görünürlük ve alpha sorunları ortaya çıkar.
3. Bir kullanıcı olarak efekti tek başına ve sahibi karakterle eşzamanlı oynatmak istiyorum; böylece olay anındaki zaman ve yerleşim uyumu değerlendirilir.
4. Bir kullanıcı olarak başlangıç noktası, kare süresi, döngü, katman ve olay bilgisini kesin sürümle korumak istiyorum; böylece oynatma anlamı dışa aktarımda kaybolmaz.
5. Bir kullanıcı olarak hücre dışına bilinçli taşmayı profil gereksinimi olarak değerlendirmek istiyorum; böylece kontrollü taşma açıkça sınanır.
6. Bir kullanıcı olarak yalnız izin verilen taşma gereksinimine sürüme özgü Kalite İstisnası vermek istiyorum; böylece okunamayan veya bozuk şeffaflık Bütünlük Denetimini aşamaz.
7. Bir kullanıcı olarak olay zamanı, başlangıç noktası ve istisna kanıtını Dışa Aktarım Paketinde taşımak istiyorum; böylece kullanımda seçilen kesin efekt sürümü izlenebilir olur.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Efekt Görünümünü ve Taşmasını Sınama:** Efekt açık, koyu, şeffaf ve gerçek sahne arka planlarında süre, döngü, şeffaflık ve izinli hücre taşmasıyla oynatılır. Hücre sınırını aşma kuralı karakter görseliyle aynı yorumlanmaz; profil izin verdiğinde açık istisna uygulanabilir. Bozuk dosya, okunamayan şeffaflık veya kopuk kare verisi bütünlük hatası olarak kalır.
- **Efekti Sahibi ve Olayıyla Eşzamanlama:** Başlangıç noktası, katman ve oyun olayı kesin karakter veya obje animasyonuyla aynı zaman çizgisinde doğrulanır. Efekt tek başına ve onu başlatan karakter animasyonuyla eşzamanlı oynatılır. Kare süresi, başlangıç noktası, katman ve oyun olayı aynı kesin sürümlere bağlanır; seçici kare düzeltmesi olay zamanını korur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Bilinçli taşma bozuk bileşim veya okunamayan şeffaflık için genel af yaratmaz.

## Testing Decisions

- **Birincil test seam’i:** RAS-04 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- [`vfx-synchronization.test.ts`](../../../apps/server/src/vfx-synchronization.test.ts), korumalı API üzerinden kesin Kare Birim Sürümü bağlantılarını, değişken süreleri, başlangıç noktalarını, katmanı, olay zamanını, dört zemindeki kullanıcı sonuçlarını ve sözleşme eşlemeli dışa aktarım/yeniden okumayı sınar. Yetkisiz erişim, eski sözleşme, kopuk kare, görsel dışı alan, okunamayan alpha ve sahte istisna reddedilir. Seçici düzeltme olay zamanını korur; sahip döngüsü sınırında devam eden efekt kesilmez.
- Olay kimliği ve klip başlangıcına göre zamanı kullanıcı tarafından seçilen kesin sahip kareleri için tanımlanır; dış bir oyun olay kataloğu varsayılmaz. Sahip klibinin dışındaki zaman reddedilir. Profil manifesti aynı kullanıcı kaynaklı olayı hem sahip hem efekt bağı altında korur.
- [`vfx-image-decode.test.ts`](../../../apps/server/src/features/vfx-profile/server/vfx-image-decode.test.ts) orijinal alpha kanalını, RGB kaynağını ve kesilmiş dosyayı ayırır. Efekt için alpha kanalı gerekir; sahip ve sahne görselleri opak olabilir. Yeni bir alpha kanalı üreterek kaynak bütünlüğü iddiası verilmez.
- [`vfx-synchronization.integration.test.ts`](../../../apps/server/src/vfx-synchronization.integration.test.ts) ayrı PostgreSQL bağlantılarında gerçek kalıcı depo ile kayıt/yeniden okuma, tekrar gönderim, dışa aktarım, yetki ve silinmiş varlık filtrelemesini sınar. Görsel depolama/decode sınırı bu testte ikame edilir; opt-in yerel `vfx_test` veritabanı gerekir.
- [`vfx-synchronization-preview.spec.ts`](../../../apps/web/e2e/vfx-synchronization-preview.spec.ts) gerçek React/PixiJS düzenleyicisini tarayıcı fixture’ında sınar: olay öncesi/sonrası tuval, dört zemin, yalnız/eşzamanlı oynatma, duraklatma, sıfırlama, yakınlaştırma, geçersiz süre ve kullanıcının gönderdiği kesin değerler. Sonraki sahip olayları boyunca döngülü oynatma devam eder; yalnız oynatılan tek seferlik efekt kendi süresinde durur. Büyük karelerin dört köşesi tüm zeminlerde görünür kalır; ortak başlangıç noktasına göre yerleşim korunur. Bu fixture sunucu kayıt akışını sınamaz. Masaüstü aynı React bileşenini kullanır; yerel masaüstü doğrulaması ayrıca yapılmalıdır.
- [`vfx-synchronization-manager.test.tsx`](../../../apps/web/src/features/vfx-profile/ui/components/vfx-synchronization-manager.test.tsx), belirsiz kayıttan sonra başarılı boş yeniden okumada aynı taslak ve işlem kimliğiyle yeniden denemeyi, okumada hata varken kilidin korunmasını ve geç tamamlanan kaydın tekrar gönderilmeden açılmasını sınar.
- Dışa aktarım JSON kanıtı, değişmez kayıt, kesin görsel digest/alpha referansları, sözleşme snapshot’ı ve `effect.owner_event_sync` profil manifestini taşır. Tam Dışa Aktarım Paketinin görsel dosyalarını derleme ve proje genelindeki hazır olma kapıları bu eşzamanlama adımının dışında kalır.
- #114 görünüm ve taşma diliminin API başarı/red, idempotency ve yeniden okuma kanıtı [`vfx-appearance-review.test.ts`](../../../apps/server/src/vfx-appearance-review.test.ts); gerçek PostgreSQL kalıcılık ve yetki kanıtı [`vfx-appearance-review.integration.test.ts`](../../../apps/server/src/vfx-appearance-review.integration.test.ts); görünür form ve oynatma kontrolü kanıtı [`vfx-appearance-editor.test.tsx`](../../../apps/web/src/features/vfx-profile/ui/components/vfx-appearance-editor.test.tsx) üzerinden sınanır. Dört zemin aynı zaman çizgisini ve kesin kaynak kırpımlarını kullanır. Taşma kaynak kare alanının hücre dışına uzaklığıyla ölçülür; dolu alpha piksellerinin estetik değerlendirmesi kullanıcıda kalır. İzin/istisna kaynak alanı, dosya bütünlüğü veya alpha çözümleme denetimini gevşetmez.
- #114 görünüm ve taşma dilimi sahip/olay eşzamanlama veya dışa aktarım kanıtı oluşturmaz; bu yollar yukarıdaki #115 eşzamanlama testlerinde ayrı sınanır. Web/masaüstü uçtan uca eşdeğerliği ayrıca doğrulanmalıdır.
- Fazın özgül başarı ve red kanıtı: Görünüm ve sahibine bağlı oynatma farklı zeminlerde çalışır; başlangıç, katman, olay ve istisna kanıtı kesin sürümle dışa aktarılır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Bilinçli taşma bozuk bileşim veya okunamayan şeffaflık için genel af yaratmaz.
- Kabul örnekleri: RAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.
- PNG/alpha çözümleme sınırı `apps/server/src/vfx-frame-decoder.test.ts`; belirsiz kaydetmenin kilitlenmesi ve aynı kaydın geri okunması `apps/web/src/features/vfx-profile/ui/components/vfx-appearance-review-manager.test.tsx` ile doğrulanır. Gerçek sahnenin görüntü verisi de sunucuda çözülür; yalnız okunabilir efekt kareleri yeterli değildir.
- #114 görünüm incelemesinin OPS-05/OPS-06 görünür geri bildirimi aynı manager test seam’inde sınanır: bekleyen kaydetme erişilebilir ilerleme durumunu gösterir; beklenmeyen okuma/yazma hataları sunucunun doğrulanmış Destek Referansını korur, ham istisnayı göstermez ve bağlantı hatasında referans üretmez. Kalıcı kayıt geri okunduğunda belirsizlik ve önceki hata referansı temizlenir; belirsiz yazım yeniden gönderilemez.

## Out of Scope

Bilinçli taşma bozuk bileşim veya okunamayan şeffaflık için genel af yaratmaz.

## Further Notes

- Tek faz kaynağı: [`23-vfx-profile/phase-context.md`](../../workflow/23-vfx-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile, Quality Waiver. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0011](../../adr/0011-quality-waivers-are-version-specific.md)

**Kabul izlenebilirliği**

- [RAS-04](../../prd/10-acceptance-scenarios.md)
- Sahip/olay eşzamanlama adımı kesin sürümlere bağlı kayıt ve kanıt dışa aktarımı sağlar. Bu kayıt tek başına profil veya proje tamamlanması kararı vermez. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
