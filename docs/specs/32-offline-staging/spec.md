# Çevrimdışı Hazırlık ve Çakışma Çözümü

## Problem Statement

Kullanıcı çevrimdışıyken önbelleğe alınmış projeyi görür, dosya ve kurtarılabilir taslak hazırlar; yeniden bağlantıda bulut kaydı sessizce ezilmez. Bulut kayıtları yetkili kalırken bağlantısız hazırlık kurtarılabilir yerel taslak sağlar.

## Solution

Kullanıcı çevrimdışıyken önbelleğe alınmış projeyi görür, dosya ve kurtarılabilir taslak hazırlar; yeniden bağlantıda bulut kaydı sessizce ezilmez.

Bulut kayıtları yetkili kalırken bağlantısız hazırlık kurtarılabilir yerel taslak sağlar. Yeniden bağlantı güncel tabanla açık karşılaştırma yapar.

Tamamlanma kanıtı: Bağlantı kesilip geri geldiğinde taslak kaybolmaz veya bulut sürümünü sessizce ezmez; kullanıcı seçimi yeni ve idempotent sonuç oluşturur.

## User Stories

1. Bir kullanıcı olarak çevrimdışıyken önbelleğe alınmış projeyi görüntülemek istiyorum; böylece bağlantı kesilmesi mevcut çalışma bağlamını kaybettirmez.
2. Bir kullanıcı olarak çevrimdışıyken dosya alıp kurtarılabilir çalışma taslağı hazırlamak istiyorum; böylece hazırlığa devam edebilirim.
3. Bir kullanıcı olarak her taslağın başladığı bulut kayıt sürümünü taban sürüm olarak sabitlemek istiyorum; böylece yeniden bağlantıdaki karşılaştırma bilinen girdiye dayanır.
4. Bir kullanıcı olarak bağlantı döndüğünde taban hâlâ güncelse taslağı normal kesinleştirme akışına almak istiyorum; böylece geçerli tabanla çalışma sürer.
5. Bir kullanıcı olarak bulut değişmişse taban sürümü, güncel bulut kaydını ve yerel taslağı Çakışma Kaydında karşılaştırmak istiyorum; böylece iki tarafın içeriği kaybolmaz.
6. Bir kullanıcı olarak çakışmada otomatik alan birleştirme, son yazan kazanır veya sessiz taslak silme olmamasını istiyorum; böylece çözüm kararını ben verebilirim.
7. Bir kullanıcı olarak yerel taslaktan ayrı Aday Sürüm oluşturma, bulutu koruyup taslağı saklama veya taslağı açıkça bırakma seçeneklerini seçmek istiyorum; böylece bulut kaydı yetkili kalır.
8. Bir kullanıcı olarak çözüm yeniden denendiğinde aynı idempotency anahtarının ikinci sürümü önlemesini istiyorum; böylece ağ kesintisi yinelenen kayıt oluşturmaz.
9. Bir kullanıcı olarak çevrimdışı hazırlığın onay, bağlam etkinleştirme veya doğrulanmış dışa aktarıma dönüşmemesini istiyorum; böylece çevrimdışı taslak kesin karar sanılmaz.

## Normatif gereksinimler

- **PLT-02 — Çevrimdışı çakışma:** Her çevrimdışı taslak, başladığı bulut kayıt sürümünü `taban sürüm` olarak sabitler. Bağlantı yeniden kurulduğunda taban sürüm hâlâ güncelse taslak normal kesinleştirme akışına alınabilir.


## Implementation Decisions

- **Çevrimdışı Hazırlık Yapma:** Görüntüleme, dosya içe aktarma ve Çalışma Taslağı bulut yetkisi kazanmadan kurtarılabilir biçimde saklanır. Önbelleğe alınmış proje görüntülenir, dosya alınır ve Çalışma Taslağı yerel olarak kurtarılabilir biçimde tutulur. Bağlam etkinleştirme, inceleme kararı ve doğrulanmış paket eşitlenmeden yetkili bulut sonucu sayılmaz.
- **Çakışma Kaydını Çözme:** Taban, güncel bulut ve yerel taslak karşılaştırılır; kullanıcı yeni Aday Sürüm, taslağı koruma veya açık bırakma kararı verir. Yeniden bağlanınca taban sürüm güncelse normal kesinleştirme yürür; bulut ilerlediyse üç sürümlü Çakışma Kaydı açılır. Kullanıcı yeni aday yaratır, taslağı korur veya açıkça bırakır; tekrar eden çözüm isteği ikinci kayıt yaratmaz. Çakışma Kaydı kendi tam sözleşme sürümünü taşır. Bilinmeyen zorunlu alan veya ana sürüm çözümü durdurur; uyumlu isteğe bağlı alan ve taslak korunur. Kesin karar kayıtları alan bazında otomatik birleşmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tam çevrimdışı onay, bağlam etkinleştirme veya doğrulanmış dışa aktarım bu özelliğin kapsamı değildir.

## Testing Decisions

- **Birincil test seam’i:** YAS-04 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Bağlantı kesilip geri geldiğinde taslak kaybolmaz veya bulut sürümünü sessizce ezmez; kullanıcı seçimi yeni ve idempotent sonuç oluşturur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tam çevrimdışı onay, bağlam etkinleştirme veya doğrulanmış dışa aktarım bu özelliğin kapsamı değildir.
- Kabul örnekleri: YAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tam çevrimdışı onay, bağlam etkinleştirme veya doğrulanmış dışa aktarım bu özelliğin kapsamı değildir.

## Further Notes

- Tek faz kaynağı: [`32-offline-staging/phase-context.md`](../../workflow/32-offline-staging/phase-context.md).
- Kanonik teknik adlar: Offline Staged Work, Offline Conflict Record. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`PLT-02`](../../prd/08-platform-and-operations.md) — Çevrimdışı çakışma.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [YAS-04](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
