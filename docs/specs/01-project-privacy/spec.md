# Proje İçeriği Erişimini Koruma

## Problem Statement

Kullanıcının proje içeriği varsayılan olarak özel kalır. Kimliği doğrulanmamış kişi proje kaydını, önizlemeyi, dışa aktarımı veya arşivi okuyamaz.

## Solution

Kullanıcının proje içeriği varsayılan olarak özel kalır. Kimliği doğrulanmamış kişi proje kaydını, önizlemeyi, dışa aktarımı veya arşivi okuyamaz.

Yönetilen bulut verisi aktarımda ve depoda korunur. Şifreleme anahtarları, erişim belirteçleri ve sunucu yürütme sırları istemciye, arşive, dışa aktarım paketine, telemetriye veya kullanıcıya gösterilen kaynak geçmişine taşınmaz.

Tamamlanma kanıtı: Yetkisiz proje erişimi reddedilir; korunan içerik ve sırlar istemci ile teslim çıktılarında bulunmaz.

## User Stories

1. Bir yetkili kullanıcı olarak kimliği doğrulanmamış oturumların proje kaydına, önizlemeye, dışa aktarıma ve arşive erişememesini istiyorum; böylece özel proje içeriği yabancılara açılmaz.
2. Bir yetkili kullanıcı olarak başka bir projeye ait oturumun bu projenin kayıt ve önizlemelerini okuyamamasını istiyorum; böylece projeler arası veri sınırı korunur.
3. Bir yetkili kullanıcı olarak yönetilen bulut verisinin aktarım ve depolama sırasında korunmasını istiyorum; böylece yetkisiz erişim içeriği açığa çıkarmaz.
4. Bir kullanıcı olarak istemci, arşiv ve Dışa Aktarım Paketinde şifreleme anahtarı, erişim belirteci veya sunucu yürütme sırrı bulunmamasını istiyorum; böylece teslim edilen içerik gizli erişim bilgisi taşımaz.
5. Bir kullanıcı olarak telemetriye görsel, ham üretim talimatı veya sır yazılmamasını ve bana gösterilen kaynak geçmişinin sır içermemesini istiyorum; böylece ölçüm gizlilik sınırını korurken üretim geçmişi gerekli kanıtı saklayabilir.
6. Bir kullanıcı olarak proje içeriğinin yalnız açık amacı, kapsamı ve gereken en az yetkiyle işlenmesini istiyorum; böylece erişim verilen iş, kendi gizlilik sınırları içinde kalır.

## Normatif gereksinimler

- **OPS-03 — Gizlilik ve en az yetki:** Proje içeriği varsayılan olarak gizlidir; kullanıcı içeriği veya sırlar yalnız açık amaç, kapsam ve gerekli en az yetkiyle işlenir.


## Implementation Decisions

- **Özel proje içeriği erişimini koruma:** Kimliği doğrulanmamış veya başka projeye ait oturumla proje kaydı ve önizleme okunamaz. Geçersiz oturum hiçbir içerik erişimi başlatmaz.
- **Teslim çıktılarında sırları dışlama:** Arşiv, Dışa Aktarım Paketi, telemetri ve kaynak geçmişi şifreleme anahtarı, erişim belirteci veya sunucu yürütme sırrı taşımaz. Yönetilen bulut verisi aktarımda ve depoda korunur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Dış araca amaç ve kapsamla erişim verme, ayrı kullanıcı izin akışıdır; erişim kararı sanatsal onay yetkisi oluşturmaz.

## Testing Decisions

- **Birincil test seam’i:** Hono istek sınırında oturum, proje sahipliği ve nesne erişimini birlikte sınama; eksik, bozuk, süresi dolmuş ve başka kullanıcıya ait erişimlerin hiçbir depolama yan etkisi üretmediğini doğrulama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bu issue diliminin çalıştırılabilir kanıtı: Hono proje/varlık yanıtlarının sahiplik ve secret-safe serileştirme sınırı, RPC kullanıcı yanıtının allowlist’i ve Queue v2 mesajının katı sözleşmesi; başarısız yetkilendirme ve depolama yan etkileri de sunucu testlerinde doğrulanır.
- Proje Arşivi, Dışa Aktarım Paketi, telemetri ve kaynak geçmişi üreticileri repoda bulunmuyor. Bu dilim onları oluşturmaz ve bu çıktılarda sırların dışlandığını teslim iddiası olarak sunmaz.
- YAS-04 çevrimdışı çakışma ve kalıcı silmeyi sınar; secret-safe serileştirmenin kabul kanıtı değildir. Dış araca amaç ve kapsamla erişim verme ayrı kullanıcı izin akışıdır; erişim kararı sanatsal onay yetkisi oluşturmaz.

## Out of Scope

Dış araca amaç ve kapsamla erişim verme, ayrı kullanıcı izin akışıdır; erişim kararı sanatsal onay yetkisi oluşturmaz.

## Further Notes

- Tek faz kaynağı: [`01-project-privacy/phase-context.md`](../../workflow/01-project-privacy/phase-context.md).
- Kanonik teknik adlar: Asset Record, Project Archive, Export Bundle. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-03`](../../prd/08-platform-and-operations.md) — Gizlilik ve en az yetki.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- Bu uygulama diliminin kanıtı: [`project-access.test.ts`](../../../apps/server/src/project-access.test.ts), [`api-output-contracts.test.ts`](../../../apps/server/src/api-output-contracts.test.ts) ve [`cloudflare.test.ts`](../../../apps/server/src/cloudflare.test.ts).
- [YAS-04](../../prd/10-acceptance-scenarios.md) çevrimdışı çakışma ve kalıcı silme senaryosudur; secret-safe serileştirme sözleşmesi için kabul kanıtı sayılmaz.
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
