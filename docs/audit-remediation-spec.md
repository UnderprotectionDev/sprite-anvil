# Denetim Bulgularını Giderme

## Problem Statement

Sprite Anvil'in 48 uygulama spec'i tamamlandı olarak ele alınsa da bazı yetenekler yalnız sunucu sözleşmesi ve test düzeyinde kalıyor. Kullanıcı ürün içinden Üretim Deneyi, Üretim Tarifi, Dışa Aktarım Paketi, Proje Arşivi ve Kalıcı Silme akışlarını tamamlayamıyor; uzun işlemler üretim yürütücüsüne bağlı değil. Teslimat hazırlığı ve farkı gerçek kanıtı bütünüyle değerlendirmiyor. Form hata açıklamaları, dosya publication temizliği, ortak tasarım ve modül sınırlarında ayrıca açıklar var. Mevcut yeşil testler bu eksikleri görünür kılmıyor.

## Solution

İki denetimde doğrulanan bütün bulguları, bağlı PRD/spec/ADR davranışını koruyarak tek tek gidermek. Mevcut sözleşmeleri gerçek ekran, kalıcı kayıt, dosya ve worker yollarına bağlamak; başarısızlık ve tekrar yollarını kullanıcı seviyesinde doğrulamak. Aynı zamanda ortak Paper tasarımını uygulamak, mevcut stack sorumluluklarını tamamlamak ve CI'nın gerçek başarısızlıkları engellemesini sağlamak. Her bulgu kendi test kanıtıyla izlenir; canlı kabul kanıtı bulunmayan madde açık kalır.

## User Stories

1. Bir kullanıcı olarak geçersiz dilimleme girdisinin neden kabul edilmediğini görmek istiyorum; böylece önizlemeyi düzeltebilirim.
2. Bir kullanıcı olarak geçersiz kare süresinin nasıl düzeltileceğini görmek istiyorum; böylece kaydetmenin neden çalışmadığını anlayabilirim.
3. Bir kullanıcı olarak geçersiz açıklama koordinatında alanla ilişkili hata görmek istiyorum; böylece kaydı düzeltebilirim.
4. Bir kullanıcı olarak çakışan yön adlarının hangi kaydı engellediğini görmek istiyorum; böylece incelemeyi tamamlayabilirim.
5. Bir kullanıcı olarak tek başarısız işlem için tutarlı hata geri bildirimi almak istiyorum; böylece yinelenen bildirimler işi belirsizleştirmez.
6. Bir proje sahibi olarak reddedilmiş aday kaydının yönetilmeyen dosya bırakmamasını istiyorum; böylece depolama ile üretim kaydı tutarlı kalır.
7. Bir kullanıcı olarak Üretim Deneyi ve denemelerini oluşturup karşılaştırmak istiyorum; böylece üretim seçeneklerini inceleyebilirim.
8. Bir kullanıcı olarak Üretim Deneyini açık kararımla sonuçlandırmak istiyorum; böylece seçimi otomasyon yapmaz.
9. Bir kullanıcı olarak deney öğrenimini bağımsız Bağlam Önerisine aktarmak istiyorum; böylece etkin kurallar kendiliğinden değişmez.
10. Bir kullanıcı olarak Üretim Tarifi oluşturup yeniden kullanmak istiyorum; böylece kesin üretim bağlamını tekrar kurabilirim.
11. Bir kullanıcı olarak başka projeye bağımsız Üretim Tarifi kopyalamak istiyorum; böylece kaynak proje sonradan değişiklikten etkilenmez.
12. Bir kullanıcı olarak Dışa Aktarım Profilini oluşturup yeni sürümünü yazmak istiyorum; böylece eski paketlerin tanımı değişmez.
13. Bir kullanıcı olarak kesin seçimlerden değişmez Dışa Aktarım Paketi oluşturmak istiyorum; böylece teslimat çıktısını üründen alabilirim.
14. Bir kullanıcı olarak paketi ve doğrulama kitini indirmek istiyorum; böylece uygulama dışında doğrulayabilirim.
15. Bir kullanıcı olarak uzun işlemin yetkili durumunu yeniden bağlandıktan sonra görmek istiyorum; böylece istemci kesintisi işi kaybettirmez.
16. Bir kullanıcı olarak yinelenen mesajın ikinci kesin sonuç oluşturmamasını istiyorum; böylece iş tekrarında kayıtlar çoğalmaz.
17. Bir kullanıcı olarak güvenli iptal, retry ve kurtarma sonucunu görmek istiyorum; böylece işlem durumuna güvenebilirim.
18. Bir kullanıcı olarak üretim ve hak kanıtı koşullarının gerçek kayıtlardan hesaplanmasını istiyorum; böylece geçerli hedef sürekli engelli kalmaz.
19. Bir kullanıcı olarak eksik veya yetersiz kanıtın açık gerekçesini görmek istiyorum; böylece teslimat hazırlığını düzeltebilirim.
20. Bir kullanıcı olarak iki teslimatın kalite, istisna, hak ve çalışma zamanı kanıt farklarını ayrı görmek istiyorum; böylece tarihsel değişikliği anlayabilirim.
21. Bir kullanıcı olarak teslimat karşılaştırmasına uygulama içinden ulaşmak istiyorum; böylece route adresini bilmem gerekmez.
22. Bir proje sahibi olarak taşınabilir Proje Arşivi oluşturup indirmek istiyorum; böylece üretim belleğini taşıyabilirim.
23. Bir proje sahibi olarak arşivi bağımsız projeye geri yüklemek istiyorum; böylece mevcut proje üzerine yazılmaz.
24. Bir kullanıcı olarak bozuk veya yarım arşivde tamamlanmış proje gösterilmemesini istiyorum; böylece kurtarma güvenilir kalır.
25. Bir proje sahibi olarak silmeden önce bütün yönetilen kopyalara etkisini görmek istiyorum; böylece kararı bilerek veririm.
26. Bir proje sahibi olarak yalnız güncel etkiye verdiğim onayla Kalıcı Silme başlatmak istiyorum; böylece eski onay genişleyen kapsama uygulanmaz.
27. Bir proje sahibi olarak Silme İşinin ilerlemesini ve içeriksiz sonucunu görmek istiyorum; böylece silme sonucu doğrulanabilir olur.
28. Bir kullanıcı olarak etkin Ölçüm Tanımını ve gerçek ürün olaylarından hesaplanan sonucu görmek istiyorum; böylece sentetik veri gerçek kullanım sanılmaz.
29. Bir kullanıcı olarak ölçüm olaylarının içeriğimi veya dosya adlarımı taşımamasını istiyorum; böylece kullanım ölçümü gizliliği korur.
30. Bir masaüstü kullanıcısı olarak açık dosya iznimle sahipli teslimat yollarını uygulamak istiyorum; böylece dosyaları elle kopyalamam gerekmez.
31. Bir masaüstü kullanıcısı olarak ayrışan hedef dosyada durdurulmak ve açık seçim yapmak istiyorum; böylece yerel değişikliğim sessizce kaybolmaz.
32. Bir kullanıcı olarak aynı animasyon incelemesinde kareye bağlı pivot, zemin, mount point, collision ve event bilgilerini görmek istiyorum; böylece ilişkili kanıtı birlikte değerlendirebilirim.
33. Bir kullanıcı olarak eksik mekânsal metadata'nın uydurulmamasını istiyorum; böylece görsel inceleme sahte kesinlik sunmaz.
34. Bir kullanıcı olarak ortak çalışma kabuğunda proje, kayıt, arama ve ilgili alanları tutarlı bulmak istiyorum; böylece ekranlar arasında bağlamı kaybetmem.
35. Bir kullanıcı olarak bütün ürün ekranlarında aynı renk, typography ve kontrol dilini görmek istiyorum; böylece tasarım parçalanmaz.
36. Bir kullanıcı olarak uzun kataloglarda bütün sonuçların aynı anda çizilmemesini istiyorum; böylece kayıt sayısı arttığında gezinme kullanılabilir kalır.
37. Bir kullanıcı olarak arayüz kontrollerinin kanonik English etiketlerini görmek istiyorum; böylece karışık dil ve isimler oluşmaz.
38. Bir bakımcı olarak feature'ların birbirlerinin iç uygulamasına bağlanmamasını istiyorum; böylece bağımsız değişikliklerin etkisi sınırlı kalır.
39. Bir bakımcı olarak API sözleşme testlerinin ana test komutunda çalışmasını istiyorum; böylece test dışı paket başarısızlığı gizlenmez.
40. Bir bakımcı olarak gerçek production-driver entegrasyon hatasının CI'yı durdurmasını istiyorum; böylece yeşil sonuç eksik kanıtı maskelemez.
41. Bir bakımcı olarak spec'lerin mevcut sözleşme ve test sınırlarını doğru tarif etmesini istiyorum; böylece eski yokluk cümleleri teslim izini bozmaz.
42. Bir kullanıcı olarak desteklenen platform iddiasının çalıştırılmış kabul kanıtına dayanmasını istiyorum; böylece çalıştırılmamış native, Godot veya yardımcı teknoloji yolları tamamlanmış sayılmaz.

## Implementation Decisions

- Bu çalışma mevcut ürün davranışını tamamlar; yeni motor sağlayıcısı, kimlik sistemi, kuyruk sağlayıcısı, storage sağlayıcısı veya sync modeli seçmez. Kanonik sözlük adları ve mevcut ADR sınırları korunur.
- Form state, doğrulama ve submission TanStack Form/Zod üzerinden yürütülür. Önizleme gibi yan işlemler de aynı form hata durumunu kullanır. Kullanıcı girdisi düzeltilebilir, alanla ilişkili açıklama ve erişilebilir durum üretir.
- Query hata sunumu tek metadata sözleşmesine bağlanır. Inline hata gösteren yol global bildirimi bilinçli bastırır; retry ve sonucu belirsiz mutation davranışları korunur.
- Dosya publication geri alma, nesnenin gerçekten bu girişime ait olduğu ve yayınlanmış kaydın kullanmadığı doğrulandıktan sonra yapılır. Deterministic key, replay veya sonucu belirsiz commit altında kör delete uygulanmaz.
- Üretim Deneyi, Üretim Tarifi, profil/paket oluşturma, arşiv, silme ve ölçüm ekranları mevcut typed API'lara bağlanır. Kullanıcı ham API payload veya iç şema JSON'u yazmak zorunda bırakılmaz.
- Uzun işlem wiring'i mevcut yetkili kayıt, outbox, claim/lease, retry, cancel ve reconcile davranışını gerçek worker'a bağlar. Taşıma mesajı tek başına işin sonucu olmaz.
- Readiness gerçek hedef revizyonu, kesin sürüm ve üretim/hak kanıtı politikasını değerlendirir. Hazır sonucu teslim edilmiş anlamına gelmez; eksik kanıt otomatik onaylanmaz.
- Delivery Diff teslim anına sabitlenmiş veriden hesaplanır. Eski kayıt gerçekten kanıt taşımıyorsa dürüst eksik veri sonucu korunur; bütün eski kayıtlar uydurma snapshot ile doldurulmaz.
- Project Archive kaynak projeyi değiştirmeden taşınabilir indirme ve bağımsız restore sağlar. Bozuk girdi ve publication hatası yarım projeyi kesin sonuç olarak göstermemelidir.
- Permanent Erasure açık güncel etki onayı ister. Yönetilen bütün kapsayıcılar ve içeriksiz receipt ele alınır. Gerçek backup purge kanıtı olmadan anlık tam silme iddiası üretilmez.
- Measurement kullanıcı içeriğini toplamadan gerçek eylem sınırlarından olay üretir. Eksik başlangıç/bitiş veri yokluğudur; sahte süre veya başarı değildir.
- Masaüstü folder uygulaması açık filesystem izni, sahipli yol kısıtı, ayrışma kontrolü, güvenli hata ve readback kullanır. Web manuel change package yolunu korur; sürekli veya çift yönlü sync eklenmez.
- Animasyon incelemesi mevcut kesin kare metadata'sını kullanır; aynı yüzeyde mekânsal overlay ve ground/loop incelemesi sağlar. Profilin kullanıcı kararı otomatik verilmez.
- Shared Shell ve tema mevcut Paper kaynaklarına göre uygulanır. Yeni ekranlar aynı kabuğu ve ortak primitive'leri kullanır; navigasyon erişilebilir, responsive ve mevcut route'larla uyumlu kalır.
- Uzun liste DOM maliyeti TanStack Virtual ile sınırlandırılır. Veri hacmi için mevcut arama/filtre sözleşmesi incelenip gerekiyorsa geriye uyumlu pagination eklenir; bütün listeyi başka yerde tekrar çizerek virtual kullanım görüntüsü verilmez.
- Feature composition uygulama seviyesinde, birden fazla feature'ın kullandığı sözleşme/server kodu owning ortak modülde konumlandırılır. Taşınan dosyaların import, test, route ve config bağları güncellenir. Baseline artırılmaz ve çözülmüş kayıtlar silinir; kuralı gevşeterek kontrol geçirilmez.
- API testleri ana test komutuna alınır. Eski başarısız beklenti normatif sözleşmeyle uzlaştırılır. Production-driver CI hataları gerekli sonuçları koruyarak blocking hale getirilir.
- Schema değişikliği gerekirse owning değişiklikle expansion-only SQL ve snapshot hazırlanır. Shared DB DDL, repository'nin yayımlanmış kaynak ve lease kurallarını izler. Yayın kuralı nedeniyle agent push veya PR açmaz.
- İlk inceleme bulgularının tamamı kabul edilmiş değildir: geri çekilen preview yarışı yeniden hata gibi uygulanmaz. Kullanılmayan Pixelarticons paketi veya sırf disabled zorunlu alan tek başına ürün kusuru sayılmaz.

## Testing Decisions

Test yaklaşımı kullanıcı tarafından 2026-11-16 tarihinde onaylandı: mevcut bileşen/Playwright, API/servis, storage ve gerekli migration sınırları korunacak.

- Dış davranış sınanır: gerçek kullanıcı girdisi/eylemi, görünür hata veya sonuç, kalıcı kayıttan yeniden okuma ve başarısızlıkta kesin sonuç oluşmaması. İç helper çağrı sırası veya implementation kopyası test edilmez.
- **UI seam:** mevcut gerçek bileşen testleri ve gerekli ana akışlar için Playwright. Formlarda geçersiz girdi, açıklayıcı hata, düzeltme sonrası başarılı işlem, kaydetme kilidi ve server hatası sınanır. Aynı seam yeni ekranların loading/error/empty/success ve erişim sınırlarını kapsar.
- **API/servis seam:** mevcut router testlerinde yetkili proje, kesin revizyon, idempotent replay, conflict, yabancı proje, sonuç belirsizliği ve yeniden okuma. Worker testlerinde gerçek composition'a en yakın public entry, yinelenen teslim, outbox recovery, retry/cancel ve tek sonuç sınanır.
- **Storage seam:** gerçek publication fonksiyonu ve mevcut SDK adaptörü testlerinde PUT sonrası ret, commit belirsizliği, replay ve sahiplik ayrımı doğrulanır. Mock storage başarısı gerçek bucket kabulü olarak sunulmaz.
- **Native seam:** mevcut desktop adapter/test altyapısı kullanılır. Sahipli/sahipsiz yol, path traversal, ayrışma, yazma hatası ve readback dış davranışı sınanır. Çalıştırılmayan native ortam skip olarak raporlanır.
- **Regression:** conventions baseline büyümeden geçer; lint/types ve ana test komutu API paketini de kapsar. Dokunulan route/generated çıktılar araçla üretilir.
- **Kabul:** ilgili RAS/YAS senaryoları uygulanır. Godot sürüm matrisi, gerçek R2/DB, native, screen reader ve operasyon retention/performance sonuçları yalnız gerçek koşumla kapanır. Yeni eşik veya veri sonucu uydurulmaz.
- Prior art: owning 20/29 form ve animasyon testleri; 30/31 router testleri; 33/34 publication/lifecycle testleri; 36 readiness; 37 profil/paket ve bağımsız verifier; 40 refresh divergence; 42 diff; 44 archive restore; 45 erasure; 46 measurement; ortak query error ve app-shell testleri.

## Out of Scope

- Yeni PRD davranışı, yeni engine/provider seçimi, çift yönlü sync, otomatik kullanıcı onayı, onaysız etkin Context Revision veya hukuki hak kararı.
- Canlı kanıt üretilmeden platform desteği, erişilebilirlik, backup purge veya operasyon eşiklerini tamamlandı ilan etmek.
- Başka bir kullanıcının gerçek projesinde kalıcı silme işlemi; akışın uygulanması gerçek verinin silinmesi talimatı değildir.
- Geri çekilmiş veya yeterli kanıt bulunmamış adayları doğrulanmış kusur gibi düzeltmek.

## Further Notes

### Bulgular ve kabul izleri

| İş | Kaynak | Tamamlanma koşulu | Bağımlılık |
|---|---|---|---|
| R01 · Form hata geri bildirimi | A01; spec 20/29 | Beş yüzeyde açıklamalı doğrulama ve düzeltme sonrası işlem | none |
| R02 · Query hata sözleşmesi | A02 | Inline hata tekrar bildirim üretmez; global retry/uncertain korunur | none |
| R03 · R2 publication sahipliği | A03; spec 12/33 | Ret nesne bırakmaz; replay/unknown outcome geçerli nesneyi silmez | none |
| R04 · API test kapsamı | S01 | API ana testte; başarısız reference beklentisi normatif sözleşmeyle uzlaşır | none |
| R05 · Worker lifecycle | F04; spec 34 | Gerçek composition'da outbox/worker/reconcile ve tek kesin sonuç | none |
| R06 · Readiness policy | F05; spec 36 | Gerçek üretim/hak kanıtında geçiş ve açık red | none |
| R07 · Export oluşturma/indirme | F03; spec 37 | Profil sürümleme → immutable paket → download → verifier | none |
| R08 · Delivery Diff | F06/F06b; spec 42 | Dört kanıt ailesinin gerçek farkı ve uygulama içi erişim | R07 |
| R09 · Production Experiments UI | F01; spec 30 | Deneme/karşılaştırma/sonuç/bağımsız proposal akışı | none |
| R10 · Production Recipes UI | F02; spec 31 | Oluşturma/kullanma/bağımsız copy | none |
| R11 · Archive UI ve restore | F07; spec 44 | Oluşturma/portable download/bağımsız durable restore | R05 |
| R12 · Erasure UI ve executor | F08; spec 45 | Impact/onay/job/receipt ve yönetilen object removal | R05 |
| R13 · Measurement akışı | F09; spec 46 | Gerçek olay, definition activation ve sonuç UI; çevrimdışı doğrulamada yalnız bağlantılı koşular sunucu başlangıç/bitiş zamanı ile ölçülür, tamamen çevrimdışı koşu ölçülmez ve telemetri yokluğu doğrulamayı bozmaz | Ürün eylemleriyle birlikte |
| R14 · Native delivery yazma | F10; spec 40 | İzinli, divergence-safe yazma ve readback | R07 |
| R15 · Animation metadata | F11; spec 20 | Aynı kare yüzeyinde mekânsal metadata/ground/loop | R01 |
| R16 · Shared Shell | A04 | Paper kabuğu ve gerçek navigasyon bağlantıları | Yeni UI ile birlikte |
| R17 · Design System | A05 | Ortak token/font/control/media yaklaşımı | R16 ile birlikte |
| R18 · Uzun katalog listeleri | A06; spec 07 | Virtual rendering ve veri hacmi sınırı | none |
| R19 · Modül sahipliği | A07 | Feature iç import borcu çözülür, baseline yalnız küçülür | Taşınan ürün yüzeyleriyle birlikte |
| R20 · English UI | S02 | Dokunulan ve mevcut ürün kontrolleri kanonik English | R09–R17 ile birlikte |
| R21 · Production-driver CI | S03 | Gerçek hata blocking; bilinen hatalar gizlenmez | R04 |
| R22 · Güncel kaynak belgeler | S04 ve deployment/Paper sapmaları | Testing Decisions, stale yokluk, deployment ve kaynak linkleri güncel | Owning teslimlerle birlikte |
| R23 · Godot kabul kanıtı | K38 | Gerçek belirtilen sürüm matrisi; çalıştırılamayan açık | R07 |
| R24 · Erişilebilirlik kanıtı | K47 | Gerçek reader/OS/build/sonuç; çalıştırılamayan açık | UI tamamlandıktan sonra |
| R25 · Platform/operasyon kapısı | K48 | Kanıtlı Supported Platform Matrix, RAS/YAS ve OV sonuçları | R05–R24 |
| R26 · Style Module kapsamı | Y03 | “Gruplanabilir/copy” mevcut normatif davranışla uzlaştırılır; kararsız seçim görünür | Karar gerekirse kullanıcı |
| R30 · Etiket normalizasyonu | Gerçek DB arama testinde bulundu; spec 07 | Inventory kaydı inventory aramasında bulunur; API/client/server locale bağımsız aynı normalizasyonu uygular | R18/R21 |
| R29 · Project Archive gerçek kayıt geri yüklemesi | R11 entegrasyonunda bulundu; spec 44, ADR 0007 | Kaynak verisi eksiksiz sürümlü arşiv ve normal servislerden okunabilir, atomik bağımsız restore; eksik tarihsel arşivler açık red | R11 |
| R28 · Kesin sürüm kalite kanıtı | Entegrasyon regresyonunda bulundu; spec 16 | Daha yeni başka sürümün kanıtı eski sürümün geçerli kalite kanıtını gölgelemez | R06/R21 |
| R27 · Tileset kenar kapsamı | Y24 | Connector ve exact-pixel kapsamı normatif davranışla uzlaştırılır | Karar gerekirse kullanıcı |

### R29 · Restore envanteri ile canlı kayıtlar arasındaki boşluk

[Restore transaction](../apps/server/src/features/project-archives/server/database-project-archive-restore-storage.ts) yalnız Project, Project Context revisions ve restore envanterini yazar; [Asset Record](../apps/server/src/features/asset-records/server/asset-record-store.ts) ve [Asset Version](../apps/server/src/features/asset-versions/server/asset-version-store.ts) normal okumaları kendi tablolarını kullanır ve restore envanterini okumaz. Bu yüzden bu envanterin başarılı yazılması, uygulamada kullanılabilir bağımsız proje kanıtı değildir. ZIP upload bu sınır çözülmeden başarı olarak sunulmamalıdır.

Mevcut [arşiv sözleşmesi](../packages/api/src/project-archives.ts) Visual World veya Theme kayıtlarını taşımaz; oysa [şema](../packages/db/src/schema/asset-records.ts) Asset Family için Visual World FK ister ve [Visual World/Theme](../packages/db/src/schema/context-scopes.ts) adları zorunludur. [Kaynak okuyucu](../apps/server/src/features/project-archives/server/project-archive-source-reader.ts) ayrıca Family bağı olmayan Asset Record kayıtlarını atlar. Eski arşivlerde bulunmayan isimleri veya kayıtları uydurmadan eksiksiz restore mümkün değildir. Yeni formatın kaynak kapsamı, mevcut arşiv sürümüyle uyumluluk ve eksik veri durumunda açık red ele alınmalıdır.

Canlı tablolara geri kurma, transaction ve FK sırasıyla şu kayıt ailelerini kapsar: foundation (`assetFamilies`, `assetRecords`, `assetVersions`, `canonicalDesigns`, `compositeVersions`, `compositionMemberships`, `contextRevisions`, `referenceHistory`, `references`, `relationships`, `subjectIdentities`, `unitVersions`); history (`contractRevisions`, `experimentTrials`, `experiments`, `gameplayMetadata`, `generationPackages`, `legacyAttestations`, `manualImportEvidence`, `metadataDecisions`, `metadataProposals`, `providerGenerationRecords`, `recipeVersions`, `recipes`, `reviews`, `rightsRecords`); delivery (`deliveryDiffs`, `deliveryFulfilments`, `deliveryRefreshLocks`, `deliveryTargetDrafts`, `deliveryTargetRevisions`, `deliveryTargets`, `exportBundles`, `exportProfileRevisions`, `exportProfiles`, `historicalRiskNotices`, `runtimeValidations`). Kayıt sözleşmesinde eksik bağımlılıklar da ayrıca kapsanmalıdır.

**Test seam:** Kaynak proje ve nesneleri kaldırıldıktan sonra indirilen arşivi restore et; normal Project Context, Asset Record/Version, ilişki, history ve delivery servislerinden yeni projeyi yeniden okuyup kimlik/ilişki/dosya özetlerini karşılaştır. Eksik/eski sürüm, bozuk içerik, yetkisiz giriş, publication hatası ve aynı anahtarla tekrar yolunda hiçbir yarım veya ikinci proje oluşmadığını doğrula. ZIP doğrulama ve uzun işlem kabulü spec 44 ile OPS-01/02 sınırlarını izler.

### Sahiplik ve yönelim

- Kanonik adlar: [repository glossary](CONTEXT.md). İlgili teknik adlar: Candidate Version, Production Experiment, Production Recipe, Export Profile, Export Bundle, Background Operation, Readiness Plan, Delivery Diff, Project Archive, Deletion Job, Measurement Definition ve Gameplay Metadata.
- Ürün davranışı owning PRD ve aşağıdaki uygulama spec'lerinde kalır; bu belge bu gereksinimleri değiştirmez. Test seam'i owning spec'in Testing Decisions bölümüdür.
- [Stack](tech-stack.md), [placement/boundaries](../structure.md), [interface areas](interface-areas.md), [migration/issue workflow](agents/issue-tracker.md), [acceptance scenarios](prd/10-acceptance-scenarios.md) bağlayıcıdır.
- Denetim kaynakları workspace'in `.context/spec-audit/REPORT.md` ve `.context/architecture-audit/REPORT.md` çıktılarıdır; yayımlanmış issue'nun kapsamı bu belgedeki R01–R31 kayıtlarıdır, ignored dosyalara bağımlı değildir.
- Yayımlama öncesi açık/kapalı GitHub kayıtları kontrol edildi; mevcut teslim ticket'ları kapalı. Bu çalışma eski ticket'ı teslim edilmiş varsaymaz; ayrı audit remediation kapsamıdır. Seçili issue veya canonical attachment sağlanmadı.
- Test seam'i kullanıcı tarafından onaylandı. Gerçek dış ortam kısıtları bağımsız uygulama işini durdurmaz.

### Orient kaynakları

| Owning spec | PRD gereksinimi ve dosyası | Spec yolu | Workflow | Etkilenen ADR sınırı |
|---|---|---|---|---|
| 03 | CTX-01, CTX-02, CTX-03, AUT-01 · [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md), [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md), [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md), [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md) | [03-project-context](specs/03-project-context/spec.md) | [phase-context](workflow/03-project-context/phase-context.md) | [0001-agent-maintained-project-context-is-authoritative.md](adr/0001-agent-maintained-project-context-is-authoritative.md), [0012-reserve-consequential-decisions-for-the-user.md](adr/0012-reserve-consequential-decisions-for-the-user.md) |
| 07 | AST-03, AST-05, OPS-05 · [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md), [03-project-and-asset-foundations.md](prd/03-project-and-asset-foundations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [07-asset-discovery](specs/07-asset-discovery/spec.md) | [phase-context](workflow/07-asset-discovery/phase-context.md) | [0002-use-extensible-asset-support-levels.md](adr/0002-use-extensible-asset-support-levels.md) |
| 12 | IMP-04 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md) | [12-import-mapping](specs/12-import-mapping/spec.md) | [phase-context](workflow/12-import-mapping/phase-context.md) | [0009-managed-snapshots-are-provenance.md](adr/0009-managed-snapshots-are-provenance.md), [0012-reserve-consequential-decisions-for-the-user.md](adr/0012-reserve-consequential-decisions-for-the-user.md) |
| 20 | QLT-02, QLT-03 · [05-asset-profiles.md](prd/05-asset-profiles.md), [05-asset-profiles.md](prd/05-asset-profiles.md) | [20-character-animation-profile](specs/20-character-animation-profile/spec.md) | [phase-context](workflow/20-character-animation-profile/phase-context.md) | [0002-use-extensible-asset-support-levels.md](adr/0002-use-extensible-asset-support-levels.md), [0003-require-web-and-desktop-product-surfaces.md](adr/0003-require-web-and-desktop-product-surfaces.md), [0004-engine-neutral-export-with-godot-first.md](adr/0004-engine-neutral-export-with-godot-first.md), [0006-version-replaceable-units-and-compositions.md](adr/0006-version-replaceable-units-and-compositions.md) |
| 24 | QLT-02, QLT-03 · [05-asset-profiles.md](prd/05-asset-profiles.md), [05-asset-profiles.md](prd/05-asset-profiles.md) | [24-tileset-texture-profile](specs/24-tileset-texture-profile/spec.md) | [phase-context](workflow/24-tileset-texture-profile/phase-context.md) | [0002-use-extensible-asset-support-levels.md](adr/0002-use-extensible-asset-support-levels.md), [0006-version-replaceable-units-and-compositions.md](adr/0006-version-replaceable-units-and-compositions.md) |
| 29 | VER-01 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md), [06-scene-quality-and-pixel-editor.md](prd/06-scene-quality-and-pixel-editor.md) | [29-pixel-editor](specs/29-pixel-editor/spec.md) | [phase-context](workflow/29-pixel-editor/phase-context.md) | [0006-version-replaceable-units-and-compositions.md](adr/0006-version-replaceable-units-and-compositions.md) |
| 30 | IMP-02, IMP-03 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md), [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md) | [30-production-experiments](specs/30-production-experiments/spec.md) | [phase-context](workflow/30-production-experiments/phase-context.md) | [0012-reserve-consequential-decisions-for-the-user.md](adr/0012-reserve-consequential-decisions-for-the-user.md) |
| 31 | IMP-03 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md), [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md) | [31-production-recipes](specs/31-production-recipes/spec.md) | [phase-context](workflow/31-production-recipes/phase-context.md) | [0012-reserve-consequential-decisions-for-the-user.md](adr/0012-reserve-consequential-decisions-for-the-user.md) |
| 33 | OPS-02 · [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [33-atomic-records](specs/33-atomic-records/spec.md) | [phase-context](workflow/33-atomic-records/phase-context.md) | none (kontrol edildi) |
| 34 | OPS-01, OPS-05 · [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [34-durable-operations](specs/34-durable-operations/spec.md) | [phase-context](workflow/34-durable-operations/phase-context.md) | none (kontrol edildi) |
| 36 | EXP-01 · [07-export.md](prd/07-export.md) | [36-delivery-readiness](specs/36-delivery-readiness/spec.md) | [phase-context](workflow/36-delivery-readiness/phase-context.md) | [0015-separate-delivery-planning-export-and-fulfilment.md](adr/0015-separate-delivery-planning-export-and-fulfilment.md) |
| 37 | EXP-02, OPS-02 · [07-export.md](prd/07-export.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [37-export-bundles](specs/37-export-bundles/spec.md) | [phase-context](workflow/37-export-bundles/phase-context.md) | [0004-engine-neutral-export-with-godot-first.md](adr/0004-engine-neutral-export-with-godot-first.md), [0011-quality-waivers-are-version-specific.md](adr/0011-quality-waivers-are-version-specific.md), [0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md](adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md) |
| 38 | EXP-02 · [07-export.md](prd/07-export.md) | [38-godot-output](specs/38-godot-output/spec.md) | [phase-context](workflow/38-godot-output/phase-context.md) | [0004-engine-neutral-export-with-godot-first.md](adr/0004-engine-neutral-export-with-godot-first.md) |
| 40 | EXP-03, OPS-02 · [07-export.md](prd/07-export.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [40-delivery-refresh](specs/40-delivery-refresh/spec.md) | [phase-context](workflow/40-delivery-refresh/phase-context.md) | [0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md](adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md) |
| 42 | EXP-01 · [07-export.md](prd/07-export.md) | [42-delivery-diff](specs/42-delivery-diff/spec.md) | [phase-context](workflow/42-delivery-diff/phase-context.md) | [0015-separate-delivery-planning-export-and-fulfilment.md](adr/0015-separate-delivery-planning-export-and-fulfilment.md) |
| 44 | VER-01, OPS-01, OPS-02 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [44-project-archive](specs/44-project-archive/spec.md) | [phase-context](workflow/44-project-archive/phase-context.md) | [0007-provide-portable-restorable-project-archives.md](adr/0007-provide-portable-restorable-project-archives.md) |
| 45 | VER-01, OPS-01, OPS-02, OPS-03, OPS-05 · [04-ingestion-lifecycle-and-quality.md](prd/04-ingestion-lifecycle-and-quality.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [45-permanent-erasure](specs/45-permanent-erasure/spec.md) | [phase-context](workflow/45-permanent-erasure/phase-context.md) | [0008-use-dependency-aware-erasure-with-tombstones.md](adr/0008-use-dependency-aware-erasure-with-tombstones.md) |
| 46 | OPS-03 · [08-platform-and-operations.md](prd/08-platform-and-operations.md), [09-success-measurement.md](prd/09-success-measurement.md) | [46-product-measurement](specs/46-product-measurement/spec.md) | [phase-context](workflow/46-product-measurement/phase-context.md) | none (kontrol edildi) |
| 47 | OPS-04 · [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [47-accessible-workflow](specs/47-accessible-workflow/spec.md) | [phase-context](workflow/47-accessible-workflow/phase-context.md) | [0003-require-web-and-desktop-product-surfaces.md](adr/0003-require-web-and-desktop-product-surfaces.md) |
| 48 | PLT-01, OPS-04, OPS-05 · [14-validation-phases.md](prd/14-validation-phases.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md), [08-platform-and-operations.md](prd/08-platform-and-operations.md) | [48-platform-equivalence](specs/48-platform-equivalence/spec.md) | [phase-context](workflow/48-platform-equivalence/phase-context.md) | [0003-require-web-and-desktop-product-surfaces.md](adr/0003-require-web-and-desktop-product-surfaces.md), [0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md](adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md) |

Ortak form/tema/shell ve CI işleri ayrıca stack/structure/AGENTS kurallarına dayanır; bu mekanik düzeltmeler için yeni PRD davranışı veya ADR yoktur (`none`). Authentication/private data alanlarında OPS-03 ve ilgili owning privacy/permission hükümleri uygulanır.

### R31 · Native build capability isolation

R14/R25 gerçek masaüstü derleme kontrolünde normal derlemenin test-only `wdio:default` iznini doğrulamaya çalıştığı ve isteğe bağlı WebDriver eklentisi olmadan başarısız olduğu görüldü. Normal derleme yalnız `default` capability kaynağını işler; `webdriver` feature etkinse test capability dosyası da işlenir. Owning gereksinim PLT-01/OPS-03/OPS-04 ([platform PRD](prd/08-platform-and-operations.md)), [spec 48](specs/48-platform-equivalence/spec.md), [workflow](workflow/48-platform-equivalence/phase-context.md), [ADR 0003](adr/0003-require-web-and-desktop-product-surfaces.md) sınırı korunur. Kanonik terim Supported Platform Matrix ([sözlük](CONTEXT.md)); yeni domain terimi yoktur. Test seam'i gerçek `cargo check` normal ve WebDriver feature derlemeleridir; bu derleme kanıtı gerçek reader veya native dosya akışı kabulü sayılmaz.
