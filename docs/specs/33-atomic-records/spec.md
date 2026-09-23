# Yetkili Kayıtları Atomik Kesinleştirme

## Problem Statement

Kullanıcıya başarılı görünen kayıt kaybolmaz; yinelenen veya yarım kalan işlem ikinci kesin sonuç ya da sahte başarı üretmez. Bağlam, varlık, inceleme, istisna, hedef, paket, arşiv ve silme gibi kesin kayıtlar içerik veya paket özetiyle birlikte tamamlanır.

## Solution

Kullanıcıya başarılı görünen kayıt kaybolmaz; yinelenen veya yarım kalan işlem ikinci kesin sonuç ya da sahte başarı üretmez.

Bağlam, varlık, inceleme, istisna, hedef, paket, arşiv ve silme gibi kesin kayıtlar içerik veya paket özetiyle birlikte tamamlanır. Yarım kalan yükleme, içe aktarma, dışa aktarma, arşiv veya geri yükleme kısmi başarı sayılmaz; bulut yazımı tamamlanmadıysa arayüz geçerli bulut durumunu ayrı gösterir.

Aynı idempotency anahtarıyla yinelenen kesinleştirme aynı kayıt kimliği ve sonucu verir; ikinci inceleme, istisna, paket, arşiv veya silme sonucu oluşturmaz. Açıklanamayan özet veya ilişki farkı başarı olarak yayımlanmaz.

Tamamlanma kanıtı: Kesinti ve tekrar fixture’larında kesin kayıt tek kez oluşur; yarım işlem görünür başarısız veya yeniden denenebilir durumda kalır.

## User Stories

1. Bir kullanıcı olarak bağlam, varlık, inceleme, istisna, hedef, paket, arşiv veya silme gibi kesin kayıtların tam içerik ya da paket özetiyle doğrulanmasını istiyorum; böylece yetkili sonuç bütünlüğü gösterir.
2. Bir kullanıcı olarak kesinleştirme ya tamamen tamamlansın ya da açıkça başarısız ve yeniden denenebilir kalsın istiyorum; böylece kısmi işlem başarılı görünmez.
3. Bir kullanıcı olarak aynı idempotency anahtarıyla tekrar gönderdiğim isteğin aynı kayıt kimliğini ve sonucunu döndürmesini istiyorum; böylece tekrar ikinci kesin kayıt üretmez.
4. Bir kullanıcı olarak yarım kalan yükleme, içe aktarma, dışa aktarma, arşivleme veya geri yüklemenin tamamlanmış gibi sunulmamasını istiyorum; böylece kısmi kanıt nihai sonuç sayılmaz.
5. Bir kullanıcı olarak açıklanamayan özet veya ilişki farkında başarının yayımlanmamasını istiyorum; böylece bütünlüğü doğrulanmayan kayıt kullanılmaz.
6. Bir kullanıcı olarak bulut yazımı tamamlanmadığında arayüzün buluttaki geçerli durumu ayrı göstermesini istiyorum; böylece bana görünen başarı kaybolmuş bir yazımı gizlemez.
7. Bir kullanıcı olarak tekrar denemede ikinci İnceleme Kaydı, Kalite İstisnası, paket veya silme sonucu oluşmadığını görmek istiyorum; böylece kesin işlem güvenle yinelenebilir.
8. Bir kullanıcı olarak taşıma mesajının yetkili kayıt yerine geçmemesini istiyorum; böylece iş kuyruğu durumu ile kalıcı ürün sonucu ayrıdır.

## Normatif gereksinimler

- **OPS-02 — Atomik ve idempotent kesinleştirme:** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.


## Implementation Decisions

- **Kesin kaydı atomik yayımlama:** Bağlam, varlık, inceleme, hedef veya paket kesinleştirmesi içerik özeti ve ilişki bütünlüğüyle tek sonuç üretir. Yarım iş kullanıcıya başarı olarak gösterilmez.
- **Yinelenen isteği aynı sonuca bağlama:** Aynı idempotency anahtarıyla yinelenen kesinleştirme aynı kayıt kimliğini verir. Kesinti ve özet uyuşmazlığı ikinci sonuç veya sahte başarı üretmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Arka plan taşıma mesajı yetkili kayıt yerine geçmez; işin yürütülmesi ayrı uzun işlem akışıdır.

## Testing Decisions

- **Birincil test seam’i:** YAS-04 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kesinti ve tekrar fixture’larında kesin kayıt tek kez oluşur; yarım işlem görünür başarısız veya yeniden denenebilir durumda kalır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Arka plan taşıma mesajı yetkili kayıt yerine geçmez; işin yürütülmesi ayrı uzun işlem akışıdır.
- Kabul örnekleri: YAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Arka plan taşıma mesajı yetkili kayıt yerine geçmez; işin yürütülmesi ayrı uzun işlem akışıdır.

## Further Notes

- Tek faz kaynağı: [`33-atomic-records/phase-context.md`](../../workflow/33-atomic-records/phase-context.md).
- Kanonik teknik adlar: Asset Version, Review Event, Export Bundle. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [YAS-04](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
