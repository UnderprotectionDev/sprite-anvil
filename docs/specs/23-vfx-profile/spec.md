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
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Görünüm ve sahibine bağlı oynatma farklı zeminlerde çalışır; başlangıç, katman, olay ve istisna kanıtı kesin sürümle dışa aktarılır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Bilinçli taşma bozuk bileşim veya okunamayan şeffaflık için genel af yaratmaz.
- Kabul örnekleri: RAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

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
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
