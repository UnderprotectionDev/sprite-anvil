# Bağımlılık Bilinçli Kalıcı Silme

## Problem Statement

Kullanıcı bir varlığı silmeden önce tüm yönetilen kopyaları, değişmez kapsayıcıları ve tarihsel etkileri görür; onaylanan kesin kapsam izlenebilir biçimde temizlenir. Kullanıcı silme öncesi yönetilen her kopyanın ve tarihsel bağlantının etkisini görür.

## Solution

Kullanıcı bir varlığı silmeden önce tüm yönetilen kopyaları, değişmez kapsayıcıları ve tarihsel etkileri görür; onaylanan kesin kapsam izlenebilir biçimde temizlenir.

Kullanıcı silme öncesi yönetilen her kopyanın ve tarihsel bağlantının etkisini görür. Seçilen kapsam uzun iş olarak izlenir.

Tamamlanma kanıtı: Onaylanan kopyalar ve seçilen bütün kapsayıcılar etkin depodan ve yayımlanan takvim içinde yedeklerden temizlenir; kapsam dışı içerik açıkça belirtilir ve içeriksiz makbuzla sonuç doğrulanır.

## User Stories

1. Bir kullanıcı olarak silme başlamadan yönetilen kopyaları, bunları içeren paket ve arşivleri, teslim geçmişini ve yedek kapsamını Silme Etki Dökümünde görmek istiyorum; böylece etkilenecek içerik anlaşılır.
2. Bir kullanıcı olarak harici kopyaların geri çağrılamayacağını ve kapsam dışı içeriği ayrı görmek istiyorum; böylece temizleme iddiası erişilemeyen depolara uzanmaz.
3. Bir kullanıcı olarak kesin silme kapsamını inceleyip açıkça yetkilendirmek istiyorum; böylece hangi kapsayıcıların silineceği insan kararıyla belirlenir.
4. Bir kullanıcı olarak değişmez paket veya arşivi seçtiğimde kapsayıcının bütünüyle kaldırılmasını istiyorum; böylece manifest veya checksum listesi kısmi içerikle yeniden yazılmaz.
5. Bir kullanıcı olarak uzun silme işlemini kullanıcıya görünen yetkili işlem kaydından izlemek istiyorum; böylece bağlantı kesilse de durum ve sonuç bulunur.
6. Bir kullanıcı olarak işlem yinelendiğinde aynı idempotency anahtarının ikinci silme sonucu üretmemesini istiyorum; böylece tekrar istek güvenlidir.
7. Bir kullanıcı olarak etkin depodaki seçilmiş kopyaların temizlenmesini ve yedeklerden yayımlanmış saklama takvimine göre kaldırılmasını doğrulamak istiyorum; böylece tamamlanma zamanı ölçülebilir olur.
8. Bir kullanıcı olarak temizleme sonucunu içeriksiz Silme Makbuzunda görmek istiyorum; böylece makbuz denetim bilgisi verir ama silinen görseli saklamaz.
9. Bir kullanıcı olarak gerekiyorsa içeriksiz Silme Kaydının kimlik ve ilişki izini korumasını istiyorum; böylece içerik kalmadan tarihsel çizgi açıklanabilir.
10. Bir kullanıcı olarak seçilen kapsam dışındaki kopyaların kaldığını açıkça görmek istiyorum; böylece kısmi kapsam tam silme gibi sunulmaz.

## Normatif gereksinimler

- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.
- **OPS-01 — Yetkili işlem kaydı:** Etkileşimli istek süresinde güvenle tamamlanamayan kalıcı silme dayanıklı arka plan yürütücüsü ve kullanıcıya görünür yetkili işlem kaydıyla yürütülür.
- **OPS-02 — Atomik ve idempotent kesinleştirme:** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.
- **OPS-03 — Gizlilik ve en az yetki:** Proje içeriği varsayılan olarak gizlidir; kullanıcı içeriği veya sırlar yalnız açık amaç, kapsam ve gerekli en az yetkiyle işlenir.
- **OPS-05 — Ölçülebilir performans:** İşlem güvenle iptal edilemiyorsa dayanıklı yürütücüde sürer; bağlantı kesilse de kullanıcı yetkili işlem kaydından durumunu görebilir.


## Implementation Decisions

- **Silme Etki Dökümü Hazırlama:** Yönetilen kopyalar, arşiv ve paketlerde gömülü içerik, tarihsel teslimler, kapsam dışı kopyalar ve saklama takvimi kesin kapsamla gösterilir. Döküm etkin depodaki kopyaları, içeriği gömen değişmez paket ve arşivleri, etkilenen teslimatları, harici geri çağrılamayan kopyaları ve yedek temizleme süresini ayırır. Kullanıcı hangi bütün kapsayıcıların kapsamda olduğunu görerek işlemi başlatır. Kullanıcı seçilen kayıt, dosya, paket, arşiv ve etkilenen tarihsel gerçekleşme sayılarını; kapsam dışı kopyaları ve geri alınamaz sonucu kesin döküm üzerinden ayrıca onaylar. Döküm değişirse eski onay geçersiz olur.
- **Silme İşlemini Tamamlama:** Değişmez kapsayıcı kısmen yazılmaz; etkin ve yedek depodan temizleme izlenir, içeriksiz makbuz ve gerekiyorsa Silme Kaydı bırakılır. Seçilen paket veya arşiv bütünüyle kaldırılır ya da kapsam dışında kalır; manifest veya checksum listesi kısmen yeniden yazılmaz. Etkin ve yedek depolama temizliği izlenir, içeriksiz makbuz seçimi ve kalan bağımlılıkları saklar. Silme Etki Dökümü ve Makbuzu tam sözleşme sürümünü taşır; bilinmeyen ana sürüm veya zorunlu alanla silme başlatılmaz. Makbuz işlem, kullanıcı, özetler, zamanlar ve uygulanan saklama takvimi sürümünü taşır; silinen içeriği taşımaz.

- **Geçici nesne bariyeri:** Aynı sahibin devam eden veya sonucu belirsiz arşiv import/restore yazımı varken Deletion Job makbuz oluşturmaz; kullanıcıya yeniden denenebilir veya depolama doğrulaması gereken engel gösterilir. Bariyer ile yeni rezervasyon aynı owner satırında atomik ve Serializable işlemle yarışır. Sahip kapsamındaki mevcut projelerin kesin arşiv-import önekleri listelenir; eski kayıtsız anahtarlar belirsiz sahiplik olarak kaydedilir, körlemesine silinmez. Kayıtları silinmiş projelerden veya bu kesin öneğin dışından kalan geçmiş nesneler otomatik eşleştirilemez; dağıtım sırasında eski yazıcılar koordineli durdurulmalı ve bu sınırlama operatör tarafından ayrıca değerlendirilmelidir.
- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Harici kopyalar geri çağrılmış gibi sunulmaz; değişmez paket veya arşiv tek varlık için kısmen yazılmaz.

- **Project kapsamındaki kalıcı silme (Paper · Accounts & Projects):** Project sahibi Details içindeki Danger zone'dan projenin kayıt ve yönetilen dosya sayılarını, başka Project tarafından referanslanan korunacak dosyaları ve yayımlanmamış yedek temizleme takvimini inceleyip kesin adı yazarak onaylar. Değişen içerik özetiyle eski onay reddedilir. Yetkili Deletion Job diğer aktif işlemler/teyitsiz managed-object yazımları varken başlamaz; silme başladıktan sonra geri alınabilir gibi gösterilmez. Project kapsamındaki kayıtlar bağımlılık sırasıyla, seçilen doğrulanmış yönetilen nesneler kendi kesin kapsamıyla kaldırılır. Bağımsız geri yüklenmiş Project'ler ve başka Project tarafından referanslanan nesneler korunur. İçeriksiz iş/makbuz kaynak Project silindikten sonra da yalnız sahibine görünür; yedek temizliği veya indirilen kopyaların geri alınması iddia edilmez.

## Testing Decisions

- **Project silme seam’i:** project-deletion.integration.test.ts disposable loopback PostgreSQL ile sahiplik, yanlış onay, kesin etki dökümü, bağımlı kayıtların kaldırılması, diğer Project korunması ve iş kaydının Project sonrasında yeniden okunmasını, onay ile outbox kaydının birlikte yayımlanmasını, kesintiden sonra aynı iş kimliğiyle bariyerin yeniden alınmasını ve makbuzla bariyerin birlikte serbest bırakılmasını sınar. projects-navigation.spec.ts yanlış proje adıyla onayın engellenmesini ve kapsam çakışmasının formda gösterilmesini doğrular. project-deletion-tables.test.ts kapsamlı tablo envanterinin schema ile ve bağımlılık sırasıyla uyumunu doğrular. Nesne depolama testinde bellek adapteri kullanılır; canlı storage/yedek temizliği kanıtı değildir.

- **Güncel döküm seam’i:** Başarılı hazırlama sonrasında aynı Asset Record için yeni hazırlama yeni bir idempotency anahtarıyla güncel kapsamı ister; başarısız veya belirsiz hazırlamanın tekrarı aynı anahtarı kullanır. Görünüm testi iki yolu ve değişen dökümde onayların sıfırlanmasını doğrular.

- **Import ve silme yarışı seam’i:** Aynı sahibin geçici nesne rezervasyonu ile silme bariyeri atomik karşılıklı dışlama sağlar; farklı sahipler birbirini engellemez. Teyitsiz yazım ve geçmişte bulunmuş kayıtsız nesnede dosya silinmez ve makbuz üretilmez. Silme, depolama hatası veya iptal sonrasında teyitli geçici dosya temizliği yinelenir; teyitsiz yazım ancak yazıcılar durdurulup sonuç ve domain sahipliği operatörce doğrulandıktan sonra güvenle ele alınabilir.
- **Birincil test seam’i:** Silme Etki Dökümü, kullanıcı onayı, bütün kapsayıcı silme ve içeriksiz makbuz yolunu YAS-04 fixture’ında yeniden okuma; değişen dökümle eski onayı reddetme.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Mevcut sözleşme ve ilgili test yolu: [`permanent-erasure.ts`](../../../packages/api/src/permanent-erasure.ts), [`permanent-erasure-view.test.tsx`](../../../apps/web/src/features/permanent-erasure/ui/views/permanent-erasure-view.test.tsx). Bu bağlantılar tüm kabul kapsamının tamamlandığını göstermez.
- Fazın özgül başarı ve red kanıtı: Onaylanan kopyalar ve seçilen bütün kapsayıcılar etkin depodan ve yayımlanan takvim içinde yedeklerden temizlenir; kapsam dışı içerik açıkça belirtilir ve içeriksiz makbuzla sonuç doğrulanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Harici kopyalar geri çağrılmış gibi sunulmaz; değişmez paket veya arşiv tek varlık için kısmen yazılmaz.
- Kabul örnekleri: YAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Harici kopyalar geri çağrılmış gibi sunulmaz; değişmez paket veya arşiv tek varlık için kısmen yazılmaz.

## Further Notes

- Tek faz kaynağı: [`45-permanent-erasure/phase-context.md`](../../workflow/45-permanent-erasure/phase-context.md).
- Kanonik teknik adlar: Erasure Tombstone, Deletion Job. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.
- [`OPS-01`](../../prd/08-platform-and-operations.md) — Uzun süren silme işleminin yetkili kaydı ve dayanıklı yürütümü.
- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.
- [`OPS-03`](../../prd/08-platform-and-operations.md) — Gizlilik ve en az yetki.
- [`OPS-05`](../../prd/08-platform-and-operations.md) — Uzun işlemlerin görünür durumu ve güvenli iptali.

**İlgili mimari sınırlar**

- [ADR 0008](../../adr/0008-use-dependency-aware-erasure-with-tombstones.md)

**Kabul izlenebilirliği**

- [YAS-04](../../prd/10-acceptance-scenarios.md)
- PRD ve bu spec hedef davranışı tanımlar; mevcut sözleşmeler ve testler tek başına tüm kabul senaryolarının tamamlandığını göstermez. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
