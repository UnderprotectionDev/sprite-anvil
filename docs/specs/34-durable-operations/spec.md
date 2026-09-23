# Uzun İşlem Durumunu ve Kurtarmayı Yönetme

## Problem Statement

Arşivleme, geri yükleme, dışa aktarım, doğrulama ve silme gibi uzun işlemler kesinti veya yinelenen teslimde kaybolmadan, kullanıcının görebildiği yetkili durumla ilerler. Etkileşimli istek içinde güvenle bitmeyen dışa aktarım, arşiv, geri yükleme, doğrulama ve silme işleri bu görünür işlem yaşam döngüsünü kullanır.

## Solution

Arşivleme, geri yükleme, dışa aktarım, doğrulama ve silme gibi uzun işlemler kesinti veya yinelenen teslimde kaybolmadan, kullanıcının görebildiği yetkili durumla ilerler.

Etkileşimli istek içinde güvenle bitmeyen dışa aktarım, arşiv, geri yükleme, doğrulama ve silme işleri bu görünür işlem yaşam döngüsünü kullanır.

Tamamlanma kanıtı: Kesinti ve yinelenen teslim altında her iş tek kesin sonuç üretir; kullanıcı ilerleme, hata, yeniden deneme ve güvenli iptal sonucunu görebilir.

## User Stories

1. Bir kullanıcı olarak etkileşim isteğinde güvenle tamamlanamayan arşiv, geri yükleme, dışa aktarım koordinasyonu, doğrulama veya silmenin kalıcı Arka Plan İşlemi kaydıyla yürütülmesini istiyorum; böylece uzun iş kaybolmaz.
2. Bir kullanıcı olarak işlem kimliği, türü, kapsamı, durumu, deneme sayısı ve sonuç özetini yetkili kayıtta görmek istiyorum; böylece taşıma mesajından bağımsız güncel durumu bulabilirim.
3. Bir kullanıcı olarak işlem Bekliyor, Çalışıyor, Tamamlandı, Başarısız, İptal İstendi veya İptal Edildi durumlarını ayırt etmek istiyorum; böylece işin ilerleyişini anlayabilirim.
4. Bir kullanıcı olarak yerel veya bulut işlemi eylemime bir saniyede yanıt veremediğinde ilerleme görmek istiyorum; böylece yanıt beklerken işlem durdu sanmam.
5. Bir kullanıcı olarak geçici hatada işin yeniden denenmesini, deneme sınırı aşılınca başarısız olarak gösterilmesini istiyorum; böylece sorun ve kurtarma yolu gizlenmez.
6. Bir kullanıcı olarak bağlantı kesilse de yeniden bağlandığımda yetkili işlem kaydından durumu görmeyi istiyorum; böylece uzun işlem istemci oturumuna bağlı kalmaz.
7. Bir kullanıcı olarak geri döndürülemez sınırdan önce güvenle iptal isteyebilmek istiyorum; böylece hâlâ durdurulabilir iş üzerinde kontrolüm olur.
8. Bir kullanıcı olarak iptal güvenli değilse işin tamamlanıp gerçek sonucunun bildirilmesini istiyorum; böylece işlem durdu diye sahte sonuç gösterilmez.
9. Bir kullanıcı olarak aynı iş yeniden teslim edildiğinde ikinci çıktı veya kesin kayıt oluşmamasını istiyorum; böylece tekrar yürütme tek sonuç üretir.

## Normatif gereksinimler

- **OPS-01 — Yetkili işlem kaydı:** Etkileşimli istek süresinde güvenle tamamlanamayan arşivleme, geri yükleme, dışa aktarım koordinasyonu, doğrulama ve kalıcı silme işlemleri dayanıklı bir arka plan yürütücüsüyle işlenir. Kullanılan kuyruk, worker, barındırma ve depolama sağlayıcısı teknik tasarım ve ADR konusudur; bu PRD gözlemlenebilir dayanıklılık sözleşmesini tanımlar.
- **OPS-05 — Ölçülebilir performans:** Harici ChatGPT ve üçüncü taraf analiz süreleri ürün performansından ayrı ölçülür. Yerel veya bulut işlemi kullanıcı eylemine bir saniye içinde yanıt veremiyorsa ilerleme durumu gösterilir.


## Implementation Decisions

- **Yetkili İşlem Yaşam Döngüsü:** Bekleyen, çalışan, tamamlanan, başarısız ve iptal durumları taşıma altyapısından bağımsız kalıcı kayıtta izlenir. Her uzun iş için yetkili kayıt tetikleyiciyi, durum geçişini, ilerlemeyi ve kesin sonucu gösterir. İstek yanıtı kesilse bile iş ve kullanıcının görebildiği durum taşıma mesajına indirgenmez. Kullanıcı eylemine bir saniye içinde sonuç verilemiyorsa ilerleme durumu gösterilir. Güvenle durmayan işlem bağlantı kesilse de sürer; yeniden bağlanınca yetkili kayıttan görülebilir. Yinelenen mesaj ikinci sonuç oluşturmaz. Yayımlanmamış outbox kaydı yeniden teslim edilir; uzlaştırma ilerlemeyen işi bulur. Deneme sınırı aşılırsa iş başarısız işler alanına alınır ve kullanıcı başarısız sonucu görür.
- **Güvenli İptal:** Kullanıcı geri döndürülemez sınırdan önce iptal isteyebilir; güvenle durmayan iş tamamlanıp sonucu dürüstçe bildirilir. Kullanıcı geri döndürülemez sınırdan önce iptal ister ve kesin iptal sonucunu görür. İş güvenle durdurulamıyorsa sistem tamamlanan sonucu saklar; iptal isteğini başarılı iptal gibi göstermez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.

## Testing Decisions

- **Birincil test seam’i:** YAS-03, YAS-04 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kesinti ve yinelenen teslim altında her iş tek kesin sonuç üretir; kullanıcı ilerleme, hata, yeniden deneme ve güvenli iptal sonucunu görebilir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.
- Kabul örnekleri: YAS-03, YAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.

## Further Notes

- Tek faz kaynağı: [`34-durable-operations/phase-context.md`](../../workflow/34-durable-operations/phase-context.md).
- Kanonik teknik adlar: Deletion Job. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-01`](../../prd/08-platform-and-operations.md) — Yetkili işlem kaydı.
- [`OPS-05`](../../prd/08-platform-and-operations.md) — Ölçülebilir performans.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [YAS-03](../../prd/10-acceptance-scenarios.md)
- [YAS-04](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
