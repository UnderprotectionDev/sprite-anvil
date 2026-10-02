# Bağımlılık Etkisini ve Bileşim Seçimini Yönetme

## Problem Statement

Kullanıcı bağlam veya Ana Tasarım değişikliğinin etkilediği sürümleri görür; güncel Türetilmiş Varlıkları yeniden inceler veya kesin geçmiş bileşimi açıkça seçer. Bağımlılık bağlantıları değişiklik türüyle eşleşir; geçmiş onay ve bileşimler değişmez.

## Solution

Kullanıcı bağlam veya Ana Tasarım değişikliğinin etkilediği sürümleri görür; güncel Türetilmiş Varlıkları yeniden inceler veya kesin geçmiş bileşimi açıkça seçer.

Bağımlılık bağlantıları değişiklik türüyle eşleşir; geçmiş onay ve bileşimler değişmez.

Tamamlanma kanıtı: Etkilenen Türetilmiş Varlıklar güncel kullanım için yeni kanıt ister, etkilenmeyenler korunur; tarihsel bileşim yalnız bütün bağımlılıkları ve kalite kanıtı sabitlenince paketlenir.

## User Stories

1. Bir kullanıcı olarak Türetilmiş Varlığın kimlik, siluet, ekipman, palet, Tema, perspektif veya zamanlama gibi hangi unsura bağlı olduğunu Bağımlılık Bağlantısı olarak kaydetmek istiyorum; böylece değişiklik etkisi eşleştirilebilir.
2. Bir kullanıcı olarak bağlam veya Ana Tasarım değişikliğini etkilenen Değişiklik Tanımı ile belirtmek istiyorum; böylece sistem ilgili bağımlılıklarla karşılaştırma yapabilir.
3. Bir kullanıcı olarak doğrudan ve zincirleme etkilenen Türetilmiş Varlıkları görmek istiyorum; böylece hangi güncel kullanımların yeniden değerlendirme istediğini anlayabilirim.
4. Bir kullanıcı olarak etkilenen onaylı sürümlerin geçmiş İnceleme Kaydını koruyup güncel kullanıma Yeniden Doğrulama Gerekli işareti vermek istiyorum; böylece geçmiş kabul geriye dönük silinmez.
5. Bir kullanıcı olarak değişiklikten etkilenmeyen sürümlerin mevcut kanıtını korumak istiyorum; böylece ilgisiz iş yeniden açılmaz.
6. Bir kullanıcı olarak etkilenen sürümü yeniden inceleyip güncel kullanım için yeni kanıt vermek istiyorum; böylece eski onay güncel uyumluluk yerine kullanılmaz.
7. Bir kullanıcı olarak Kalite İstisnasının Bağlama Uygunluk engelini temizlememesini istiyorum; böylece kalite kabulü soy ve bağlam doğrulamasını atlamaz.
8. Bir kullanıcı olarak gerektiğinde kesin tarihsel bağlam, tasarım ve bağımlılık setini açıkça sabitleyerek geçmiş kullanımı korumak istiyorum; böylece tarihsel paket güncel durumdan ayrı ve açıklanabilir kalır.

## Normatif gereksinimler

- **AST-07 — Aile tamamlanması:** Her Varlık Ailesinin sürümlenen bir Gerekli Öğeler Listesi vardır. Liste yalnız o ailenin hangi yönlerinin, animasyonlarının, durumlarının, varyantlarının ve kullanım testlerinin gerekli, isteğe bağlı veya uygulanamaz olduğunu belirtir.
- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.
- **QLT-01 — Kalite kanıtı ve kullanıcı kararı:** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.


## Implementation Decisions

- **Değişiklik Etkisini Belirleme:** Doğrudan ve dolaylı Türetilmiş Varlıklar ile eksik tanımlanmış bağlantılar Yeniden Doğrulama Gerekli olarak görünür. Yalnız değişiklik tanımıyla eşleşen açık bağımlılıklar etkilenir; eksik bağımlılık güvenli tarafta işaretlenir. Bu durum Kalite Kontrol Durumundan ayrıdır.
- **Güncel Türetilmiş Varlığı Yeniden İnceleme:** Kullanıcı etkilenen sürümü seçili güncel bağlam ve Ana Tasarım için yeniden inceler. Olumlu sonuç yeni İnceleme Kaydı üretir; içerik düzeltmesi gerekiyorsa yeni Birim veya Birleşik Sürüm hazırlanır. Geçmiş onay kaydı yerinde değiştirilmez.
- **Tarihsel Bileşimi Sabitleme:** Kullanıcı geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtlarını tek kesin bileşim için seçer. Uyumluluk raporu tarihsel seçimi ve çözülememiş engelleri gösterir. Bu yol güncel Yeniden Doğrulama Gerekli durumunu temizlemez; bütünlük hatasını veya eksik zorunlu kanıtı aşmaz.
- **Kesin tarihsel kayıt:** `dependencyRevalidation.historicalCompositionOptions`, `pinHistoricalComposition` ve `listHistoricalCompositions` proje sahibine açıktır. Var olan Birleşik Sürümün Bileşim Üyelikleri değiştirilmeden Bağlam Sürümü, geçmiş Ana Tasarım, Bağımlılık Bağlantıları ve bağımlılık sürümleri, Özel Profil Sözleşmesi sürümleri (yalnız Projede etkinleştirilmiş sürümler), İnceleme Kayıtları ve kanıt kimlikleri değişmez bir Uyumluluk Raporuyla kaydedilir. Aynı işlem kimliğiyle aynı istek tekrarlandığında aynı kayıt okunur; farklı istek reddedilir. Girdi veya hesaplanan sürüm listesi sınırı aşılırsa hiçbir kayıt yazılmaz.
- **Tarihsel hazır olma sınırı:** Kesin içerik bütünlüğü, bağımlılık kapanışı, sürüm onayı, seçili bağlam/Ana Tasarım uygunluğu ve sabitlenmiş profilin zorunlu kalite, insan incelemesi ve kullanım testi kanıtları sağlanmadan rapor dışa aktarım uygunluğu vermez. Aynı koşul için seçilen en yeni kanıt geçerlidir. Kalite İstisnası yalnız izin verilen kural ve kesin Birim/Birleşik Sürüm kapsamında kabul edilir; uygunluk veya bütünlük engelini kaldırmaz. Rapor paket üreticisinin önkoşulunu bildirir; bu adım Dışa Aktarım Paketi üretmez.
- **Bağlam kapsamı:** Seçili kesin sürümlerin Varlık Sürümü kaynaklı tüm bağlantıları ve sabitlenmiş Bağlam Sürümünden gelen bağlantılar kapanışa dahildir. Başka bir bağlamın sonradan eklenen bağlantısı geçmiş bağlamı küresel olarak engellemez; kullanıcı o farklı bağlam bağlantısını tarihsel seçime dahil ederse uyumsuz bağımlılık engeli gösterilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1, RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Değişiklik Etkisini Belirleme için ürün sözleşmesi [`dependency-revalidation.ts`](../../../packages/api/src/dependency-revalidation.ts), korumalı API yolu `dependencyRevalidation.createLink`, `determine` ve `list` işlemleridir. Kesin Varlık Sürümü veya Bağlam Sürümü kaynakları ile özellikler kullanıcı tarafından kaydedilir; seçilmiş Ana Tasarım veya Bağlam Sürümü için değişiklik etkisi ayrı, değişmez bir kayda yazılır.
- [`dependency-revalidation.integration.test.ts`](../../../apps/server/src/features/dependency-revalidation/server/dependency-revalidation.integration.test.ts), `DEPENDENCY_TEST_DATABASE_URL` ile ayrılmış PostgreSQL üzerinde gerçek kayıt, ayrı bağlantıdan API yeniden okuma, doğrudan/dolaylı eşleşme, eksik tanımlanmış türev, bağlam etkisi, eşleşmeyen özellik, geçmiş onayın ve kalite durumunun korunması, Aile Tamamlanması uygunluk engeli, artık seçilmemiş Ana Tasarım ile etki yazımının reddi, türev olmayan hedefe Bağımlılık Bağlantısı yazımının reddi ve yetkisiz/geçersiz giriş yollarını sınar. Migration SQL ve snapshot bu adımın şema değişikliğine aittir; ortak geliştirme veritabanına uygulama ayrı migration geçmişi kontrolünü gerektirir.
- [`dependency-revalidation-manager.test.tsx`](../../../apps/web/src/features/dependency-revalidation/ui/components/dependency-revalidation-manager.test.tsx), ortak web/masaüstü React yüzeyindeki özellik seçimi, Bağımlılık Bağlantısı hedefinin Türetilmiş Varlıklarla sınırlanması, kaydedilmiş bağlantıların kaynak ve hedefle birlikte okunması, kaydetme, yeniden açma ve okuma/yazma hatalarını API taşıma sınırında sınar. Bu test gerçek tarayıcı veya Tauri çalıştırıldığını göstermez. Güncel Türetilmiş Varlığı Yeniden İnceleme bu adımın dışında kalır; işaretleri temizlemez.
- [`historical-composition.integration.test.ts`](../../../apps/server/src/features/dependency-revalidation/server/historical-composition.integration.test.ts), aynı ayrılmış PostgreSQL üzerinde korumalı API → değişmez kayıt → ayrı bağlantıdan yeniden okuma seam'inde tarihsel seçim ve hazır/engelli raporu, eksik ve zincirleme bağımlılıkları, eksik kalite kanıtını, yanlış bağlamı ve farklı bağlama sonradan eklenen bağlantının geçmişe etkisini, son seçili uygunluk kanıtını, sürüme bağlı Kalite İstisnasını, gerçek içerik doğrulama sınırının başarısızlığını, ayrı Birleşik Sürüm onayını, proje kapsamıyla sınırlı Özel Profil Sözleşmesi aktivasyonunu, engellerin hedef kayıt etiketiyle raporlanmasını ve özdeş engellerin tekilleştirilmesini, yetkisiz erişimi, sınır aşımını ve eşzamanlı/idempotent yazımı sınar. Yeni Birim Sürümüyle yeni Birleşik Sürüm oluşturulması eski kayıtları değiştirmez. Harici içerik deposu bu seam'de kontrollü doğrulayıcıdır; gerçek depolama entegrasyonu çalıştırılmış sayılmaz.
- [`historical-composition-manager.test.tsx`](../../../apps/web/src/features/dependency-revalidation/ui/components/historical-composition-manager.test.tsx), geçmiş seçim, engellerin görünmesi, yeniden açma, belirsiz yazımda aynı işlem kimliğiyle tekrar deneme, kesin redde seçimlerin düzenlenebilir kalması ve kayıttan sonra rapor okuma hatasını React/API taşıma sınırında sınar. Gerçek tarayıcı ve Tauri karşılaştırması ayrıca yapılmalıdır.
- Fazın özgül başarı ve red kanıtı: Etkilenen Türetilmiş Varlıklar güncel kullanım için yeni kanıt ister, etkilenmeyenler korunur; tarihsel bileşim yalnız bütün bağımlılıkları ve kalite kanıtı sabitlenince paketlenir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.
- Kabul örnekleri: 8.1, RAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.

## Further Notes

- Tek faz kaynağı: [`18-dependency-revalidation/phase-context.md`](../../workflow/18-dependency-revalidation/phase-context.md).
- Kanonik teknik adlar: Dependency Link, Change Facet, Revalidation Required. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-07`](../../prd/04-ingestion-lifecycle-and-quality.md) — Aile tamamlanması.
- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.
- [`QLT-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Kalite kanıtı ve kullanıcı kararı.

**İlgili mimari sınırlar**

- [ADR 0005](../../adr/0005-separate-historical-approval-from-current-applicability.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
