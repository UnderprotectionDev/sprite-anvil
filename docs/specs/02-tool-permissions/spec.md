# Dış Araç Erişim İzinlerini Yönetme

## Problem Statement

Kullanıcı bağlantı, Bağlam Ajanı ve Harici Görsel Analizinin proje içeriğine hangi amaç ve kapsamda erişebileceğini belirler. İzin geri alındığında yeni erişim durur.

## Solution

Kullanıcı bağlantı, Bağlam Ajanı ve Harici Görsel Analizinin proje içeriğine hangi amaç ve kapsamda erişebileceğini belirler. İzin geri alındığında yeni erişim durur.

Harici görsel gönderimi varsayılan olarak kapalıdır. Kullanıcı proje ve analiz kategorisini ayrı seçer; aktarılacak veri, amaç, sağlayıcı ve bilinen saklama koşullarını görmeden aktarım başlamaz. Bir kategoriye verilen izin diğerine yayılmaz.

Tamamlanma kanıtı: İzinli araç yalnız açıklanan amaç ve kapsamda erişir; geri alınan veya verilmeyen izin yeni görsel aktarımını engeller.

## User Stories

1. Bir proje kullanıcısı olarak Bağlam Ajanı, bağlantı ve Harici Görsel Analizi için izinleri ayrı ayrı yönetmek istiyorum; böylece her araç yalnız seçtiğim erişime sahip olur.
2. Bir kullanıcı olarak Harici Görsel Analizinin varsayılan olarak kapalı olmasını istiyorum; böylece açık karar vermeden proje görseli dış sağlayıcıya gönderilmez.
3. Bir kullanıcı olarak izin vermeden önce aktarılacak veriyi, amacı, sağlayıcıyı ve bilinen saklama koşullarını görmek istiyorum; böylece erişim kararımı açıklanan kullanıma göre verebilirim.
4. Bir kullanıcı olarak proje izni ile analiz kategorisi iznini ayrı seçmek istiyorum; böylece bir kategoriye verdiğim izin başka veriye veya amaca kendiliğinden yayılmaz.
5. Bir kullanıcı olarak her izinli aracın yalnız belirtilen amaç ve kapsamda çalışmasını istiyorum; böylece araç erişimi proje içeriğinin tamamı için genel yetki oluşturmaz.
6. Bir kullanıcı olarak izni geri aldığımda yeni erişimin durmasını istiyorum; böylece kararım sonraki araç çağrılarını sınırlar.
7. Bir kullanıcı olarak araç izninin bağlam etkinleştirme, İnceleme Kaydı, Kalite İstisnası veya silme kararı vermemesini istiyorum; böylece hazırlık yetkisi kesinleştirme yetkisine dönüşmez.
8. Bir kullanıcı olarak harici analiz kapalıyken yerel denetim ve elle karşılaştırma akışını sürdürebilmek istiyorum; böylece isteğe bağlı entegrasyon olmadan da üretim incelemesi yapabilirim.

## Normatif gereksinimler

- **OPS-03 — Gizlilik ve en az yetki:** Proje içeriği varsayılan olarak gizlidir; kullanıcı içeriği veya sırlar yalnız açık amaç, kapsam ve gerekli en az yetkiyle işlenir.
- **AUT-01 — Hazırlık ve kesinleştirme:** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir.


## Implementation Decisions

- **Dış araç erişimini amaç ve kapsamla yönetme:** Kullanıcı bağlantı ve Bağlam Ajanı için proje, amaç ve erişim kapsamını görüp izin verir; geri alınan izin yeni erişimi durdurur.
- **Harici Görsel Analizine ayrı izin verme:** Görsel gönderimi proje ve analiz kategorisi için varsayılan olarak kapalıdır. Sağlayıcı, aktarılacak veri ve saklama koşulları gösterilmeden gönderim başlamaz; bir kategorinin izni diğerine geçmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Teknik araç izni bağlam sürümünü etkinleştirme, İnceleme Kaydı oluşturma, Kalite İstisnası verme veya kalıcı silme kararı değildir. Harici analiz kapalıyken yerel denetim ve elle karşılaştırma sürer.

## Testing Decisions

- **Birincil test seam’i:** İzin ver, görsel aktar, izni geri al ve yeniden aktarımı reddet yolunu yetkili sunucu isteği ile görünür kullanıcı akışında sınama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: İzinli araç yalnız açıklanan amaç ve kapsamda erişir; geri alınan veya verilmeyen izin yeni görsel aktarımını engeller. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Teknik araç izni bağlam sürümünü etkinleştirme, İnceleme Kaydı oluşturma, Kalite İstisnası verme veya kalıcı silme kararı değildir. Harici analiz kapalıyken yerel denetim ve elle karşılaştırma sürer.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Teknik araç izni bağlam sürümünü etkinleştirme, İnceleme Kaydı oluşturma, Kalite İstisnası verme veya kalıcı silme kararı değildir. Harici analiz kapalıyken yerel denetim ve elle karşılaştırma sürer.

## Further Notes

- Tek faz kaynağı: [`02-tool-permissions/phase-context.md`](../../workflow/02-tool-permissions/phase-context.md).
- Kanonik teknik adlar: Context Agent, External Visual Analysis. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-03`](../../prd/08-platform-and-operations.md) — Gizlilik ve en az yetki.
- [`AUT-01`](../../prd/03-project-and-asset-foundations.md) — Hazırlık ve kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0010](../../adr/0010-external-visual-analysis-is-explicit-opt-in.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
