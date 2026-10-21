# Karo Seti, Arazi ve Doku Profilini Uygulama

## Problem Statement

Karo ve doku aileleri komşuluk, köşe, koridor, dolgu, tekrar ve kesin kenar eşleşmesi senaryolarında sorunlu birime kadar izlenebilir biçimde sınanır. Bu profil karo kimliği ve komşuluk kuralını gerçek boyanabilir örnek üzerinde sınar; dokunun tekrarı ayrı kullanım davranışıdır.

## Solution

Karo ve doku aileleri komşuluk, köşe, koridor, dolgu, tekrar ve kesin kenar eşleşmesi senaryolarında sorunlu birime kadar izlenebilir biçimde sınanır.

Bu profil karo kimliği ve komşuluk kuralını gerçek boyanabilir örnek üzerinde sınar; dokunun tekrarı ayrı kullanım davranışıdır.

Tamamlanma kanıtı: Zor komşuluk ve tekrar senaryoları sorunlu birime bağlanır; atlas alanı, terrain bağlantısı ve tekrar ayarı pakette korunur.

## User Stories

1. Bir kullanıcı olarak karo ailesini sabit sayıya veya tek atlas düzenine zorlanmadan tanımlamak istiyorum; böylece farklı set yapıları kendi düzenleriyle incelenebilir.
2. Bir kullanıcı olarak iç/dış köşe, kenar, koridor ve dolgu gibi zor komşulukları boyanabilir test haritasında sınamak istiyorum; böylece bağlantı hatası kullanım içinde görünür olur.
3. Bir kullanıcı olarak tekrar eden yüzey dokusunu karo komşuluğundan ayrı test etmek istiyorum; böylece iki farklı kullanım davranışı karıştırılmaz.
4. Bir kullanıcı olarak dokuyu 2×2, 3×3 ve kaydırmalı tekrarlarla incelemek istiyorum; böylece görünür birleşim ve tekrar izi bulunur.
5. Bir kullanıcı olarak matematiksel kenar eşleşmesini otomatik denetleyip göze çarpan tekrarları insan incelemesine sunmak istiyorum; böylece ölçülebilir ve görsel kanıt ayrılır.
6. Bir kullanıcı olarak sorunlu bağımsız karo veya bağlantı durumunu belirlemek istiyorum; böylece düzeltme tüm seti değiştirmeden hedeflenebilir.
7. Bir kullanıcı olarak atlas alanı, komşuluk eşlemesi ve doku tekrar ayarını pakette korumak istiyorum; böylece doğrulanan kullanım dışa aktarımda aynı anlamı taşır.
8. Bir kullanıcı olarak test haritasının tam seviye düzenleyicisi olmamasını istiyorum; böylece profil testi kapsamı olduğundan geniş sunulmaz.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Karo Komşuluklarını Test Haritasında Sınama:** İç ve dış köşe, dar koridor, dolgu, keskin geçiş ve rastgele yerleşim sorunlu karo veya bağlantıya kadar izlenir. Atlas yanında boyanabilir test haritası köşe, kenar, dar koridor, tek arazi dolgusu ve rastgele kombinasyonları gösterir. Hatalı komşuluk veya geçiş ilgili karo kimliğine bağlanır; kesin kenar eşleşmesi otomatik denetlenebilir.
- **Karo Komşuluğu İncelemesi:** Yeni kayıtların kanıt biçimi `tileset-adjacency-review/1.1.0` olarak saklanır; `1.0.0` geçmişi yeniden yorumlanmadan okunur ve aynı işlem kimliğiyle tekrar denetlenebilir. Yeni kayıt oluşturmak güncel kanıt kurallarını yeniden uygular. Araziye bağlı olmayan bağımsız karolarda arazi kimliği `null` kalabilir; başarılı tek arazi dolgusu ve keskin geçiş, beyan edilmiş arazi kimlikleri gerektirir. Başarısız sonuç, kullanıcı tarafından hedeflenmiş bir karo/bağlantı sorununu veya o senaryodaki somut bağlantı etiketi uyuşmazlığını taşır; yalnız bilinmeyen etiket yeterli değildir.
- **Senaryo temsil kanıtı:** Başarılı iç/dış köşe, bir 2×2 bölgede aynı arazi veya bağımsız karo kimliğinin üç hücresiyle farklı/boş dördüncü hücrenin oluşturduğu dönüşü içerir; iç/dış köşe yorumu kullanıcıda kalır. Kenar, bir 2×2 bölgede aynı kimliğin bitişik iki hücresi ve farklı/boş karşı tarafıyla düz sınır gösterir. Dar koridor, aynı kimlikle üç hücrelik düz geçiş ve orta hücrenin iki yanında farklı/boş hücreler içerir. Keskin geçişte farklı arazi kimlikleri bitişik boyanır. Dolgu bütün hücreleri aynı beyan edilmiş araziyle doldurur. Rastgele yerleşimde en az üç boyanmış hücre ve farklı karo veya boş hücre yerleşimi vardır. Bu yerel asgari kanıtlar sabit harita şablonu veya karo seti sayısı tanımlamaz; temsil edilmeyen kullanım `Inconclusive` kalır. Görsel kalite kararı otomatik verilmez.
- **Birleşim önizlemesi:** Test haritası ortak tam sayı gösterim ölçeği kullanır. Eş ölçülü dikdörtgen veya kare karolar kırpılmadan ve araya kenarlık konmadan bitişir; farklı kaynak ölçüleri ayrı ayrı aynı hücreye esnetilmez. Hücre alanı seçili setin en büyük karo ölçülerinden türetilir, küçük karonun gerçek ölçü farkı görünür kalır. Klavye odak işareti yerleşimi değiştirmeyen üst çizimdir.
- **Kesintisiz Doku Tekrarını İnceleme:** Dokular 2×2, 3×3 ve kaydırmalı tekrarda kesin kenar eşleşmesi ve göze çarpan tekrar açısından değerlendirilir. Doku ikiye iki, üçe üç ve kaydırmalı tekrar düzeninde incelenir. Matematiksel kenar eşleşmesi ayrı sonuç verir; hâlâ göze çarpan tekrar insan incelemesine kalır ve doku tekrar ayarı pakete taşınır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.

## Testing Decisions

- **Birincil test seam’i:** RAS-05 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Kesintisiz doku incelemesi `textureRepetitionReviews.inspect/save/list` oRPC yolunda sınanır. Kaydetme kesin karo Birim Sürümünü, Özel Profil Sözleşmesi revizyonunu, atlas alanını (sol üst köşe, px), bildirilen arazi kimliğini (yoksa `Bilinmiyor`), tekrar eksenlerini ve üç düzenin insan gözlemlerini sabitler. Eski yükleme yollarında ölçüsü saklanmamış Birim Sürümlerinin atlas ölçüleri önizlemede dosyadan okunur; sınır kontrolü her durumda sunucudaki doğrulanmış dosyaya aittir. Sunucu doğrulanmış kaynak dosyadan kırpılan sRGB RGBA karşı kenarlarını eşitlik ve ilk uyuşmazlık konumuyla denetler; bu sonuç görünür tekrar hakkında sanatsal karar vermez. Kaydırma etkin eksenlerden birinde sıfırdan farklı olmalıdır; yalnız 1 px eksenlerde sıfır kaydırma eşdeğerdir.
- API başarısız/eksik kanıtı: yetkisiz erişim, yanlış aile/birim/tür, eski veya etkin olmayan sözleşme, sınır dışı atlas alanı, eksik/tekrarlanan düzen, bozuk kaynak, kimlik çakışması ve başarısız yeniden okuma. Geçici PostgreSQL testi aynı girdiyi iki bağlantıyla kalıcı kayıttan okur; silinmiş varlıkların kanıtı erişime açılmaz. UI testi kullanıcı gözlemini, kaydırma değişince yeniden incelemeyi, ilk Birim Sürümü eklenince seçimi ve belirsiz yazma sonucunda aynı kaydı uzlaştırıp aynı işlem kimliğiyle yeniden denemeyi doğrular. `bun run test:e2e:texture-repetition` gerçek web arayüzünde kaynak yükleme, karo Birim Sürümü, üç tekrar görünümü, kaydetme, yenileme ve indirilen metadata’yı geçici PostgreSQL üzerinde sınar. Ardından Tauri WebDriver aynı hesap, etkin sözleşme ve kesin Birim Sürümünde aynı atlas alanı, terrain kimliği, eksenler, kaydırma ve gözlemlerle incelemeyi kaydeder; üç görünümün yüklenmesini, görünür ölçülerini, tekrar ve kaydırma sunumunu web sonucuyla karşılaştırır; yenilemeden sonra gerçek masaüstü metadata dosyasını okur. İki paketin tamamı, yalnız yeni incelemenin işlem kimliği ve oluşturulma zamanı dışında eşit olmalıdır. API ve bellek içi dosya deposu iki yüzey boyunca açık tutulur. WKWebView geçici HTTP sunucusunun Secure çerezlerini saklamadığından yalnız bu testin yerel bağlantısı, gerçek auth yanıtının verdiği çerezleri native isteklere aktarır; sunucu oturumu ve yetki kontrolleri gerçektir, üretim HTTPS girişinin çerez davranışı bu senaryonun kanıtı değildir; masaüstü yolu atlanırsa birleşik kabul komutu başarılı sayılmaz.
- Doku metadata paketi `tileset.tiles.id`, `tileset.tiles.atlas_region`, `tileset.terrain_id` ve `texture.repeat_axes` alanlarını kesin incelemeyle yeniden okur. Uyuşmayan alan ve başarısız kesin kenar sonucu reddedilir. Paket, bu adımın metadata kanıtıdır; tam Dışa Aktarım Paketi veya tüm RAS-05 teslimi değildir. Komşuluk haritası ayrı ilk issue kapsamındadır.
- Doku alt adımının önceki sunucu ve yüzey test örnekleri: [`project-routes.test.ts`](../../../apps/server/src/project-routes.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Karo komşuluğu alt adımı `packages/api/src/tileset-adjacency-reviews.ts` ve `packages/api/src/routers/tileset-adjacency-reviews.ts` ile etkin Özel Profil Sözleşmesine ve kesin Birleşik/Birim Sürümlerine bağlanır. Yedi senaryonun haritaları, atlas alanları, arazi kimlikleri, kullanıcı gözlemleri ve sorun hücreleri değişmez bir inceleme kaydı olarak saklanır. Dört kenardaki bağlantı etiketleri karşılaştırılır; bu kontrol piksel düzeyinde kesin kenar eşleşmesi veya insan görsel hükmü değildir. Komşuluk alt adımı doku tekrarını veya tam paket dışa aktarımını teslim etmez; doku tekrarı ayrı alt adımda sınanır.
- Birincil API kanıtı [`tileset-adjacency-review.test.ts`](../../../apps/server/src/features/tileset-texture-profile/server/tests/tileset-adjacency-review.test.ts); PostgreSQL kalıcılık kanıtı [`tileset-adjacency-review.integration.test.ts`](../../../apps/server/src/features/tileset-texture-profile/server/tests/tileset-adjacency-review.integration.test.ts), yalnız açıkça belirtilen geçici loopback veritabanında çalışır. `bun run --cwd packages/db test:tileset-adjacency` kendi geçici PostgreSQL kümesini hazırlayıp bu testi koşar. İkinci bağlantıdan yeniden okuma, üç karolu setin alan/bağlantı korunması, yetkisiz erişim, etkin olmayan/eski sözleşme, bozuk içerik, alan sınırı, eksik senaryo, boyanmış komşuluğu olmayan başarılı sonuç, eksik tek arazi dolgusu ve kimliği değiştirilen tekrar ayrıca sınanır.
- Paylaşılan web/masaüstü React yüzeyinin davranış kanıtı [`tileset-adjacency-review-manager.test.tsx`](../../../apps/web/src/features/tileset-texture-profile/ui/components/tileset-adjacency-review-manager.test.tsx): boyama, sorun hedefi, yeniden açılan kayıtta fırça ve önizleme sıfırlaması, kesin redden sonra düzenleme ve belirsiz yazmayı aynı işlem kimliğiyle tekrar deneme. Bu bileşen testleri gerçek tarayıcı veya Tauri kabul koşumunun yerine geçmez.
- İnceleme düzeltmelerinin API seam'i, bağımsız karoyu arazi uydurmadan kaydetme/yeniden okuma, hedefsiz başarısız sonucu reddetme, iki hücreyle köşe/koridor/geçiş/rastgele başarıyı reddetme, farklı yönlerde geçerli düzenleri kabul etme, arazi kimliği olmayan dolguyu reddetme ve `1.0.0` geçmişini yeniden yorumlamadan okuma/aynı işlemle tekrar denetlemeyi kapsar. React seam'i boş `Terrain ID`, hedefsiz `Failed` ve temsil edilmeyen `Passed` sonucunda düzenlemenin açık kalmasını sınar.
- [`tileset-map.test.tsx`](../../../apps/web/src/features/tileset-texture-profile/ui/components/tileset-map.test.tsx), gerçek React harita çıktısını kurulu Tailwind CSS ile Chromium'da ölçer: kare/dikdörtgen atlas bölgeleri hücreye tam sığar, yatay/dikey komşular boşluksuz bitişir ve klavye odağı görünür kalır. Bu yalıtılmış tarayıcı testi oturumlu web veya Tauri uçtan uca kabul koşumu değildir.
- Önceki sunucu ve yüzey test örnekleri: [`project-routes.test.ts`](../../../apps/server/src/project-routes.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Zor komşuluk ve tekrar senaryoları sorunlu birime bağlanır; atlas alanı, terrain bağlantısı ve tekrar ayarı pakette korunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.
- Kabul örnekleri: RAS-05. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.

## Further Notes

- Tek faz kaynağı: [`24-tileset-texture-profile/phase-context.md`](../../workflow/24-tileset-texture-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile, Unit Version. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-05](../../prd/10-acceptance-scenarios.md)
- Bu issue karo komşuluğu inceleme kaydını ve paylaşılan arayüzünü uygular; fazın doku tekrar, kesin piksel kenarı ve tam dışa aktarım kabul kapsamının tamamlandığı iddia edilmez. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
