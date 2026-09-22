# Rekabet ve komşu araç incelemesi

**Araştırma tarihi:** 2026-09-22  
**Ürün dayanağı:** [`prd.md`](prd.md), [`CONTEXT.md`](CONTEXT.md) ve geçerli ADR'ler  
**Amaç:** Rakip özelliğini kopyalanacak gereksinim saymadan, Workbench'in kullanıcı işleri ve sınırları karşısında güncel ürün davranışını ve fırsatları değerlendirmek.

## 1. Yöntem ve kanıt dili

Bu inceleme yalnız ürün adlarını sıralamaz. Bir aracın uygunluğu aşağıdaki kullanıcı işlerine göre değerlendirilir:

1. Bir oyun projesinin görsel bağlamını, referansların aktarım sınırlarını ve kabul edilmiş kimlik kaynaklarını yeniden anlatmadan kullanmak.
2. Karakter, obje, animasyon, karo, arayüz ve diğer varlıkları tek dosyalar yerine ilişkili aileler ve kesin sürümler olarak yönetmek.
3. Adayları kullanım bağlamında incelemek, sorunlu birimi seçici biçimde düzeltmek ve kabul edilmiş işi kaybetmemek.
4. ChatGPT veya başka bir dış üretim yüzeyi için incelenebilir üretim paketi hazırlamak ve dönen sonucun gerçek kaynak geçmişini korumak.
5. Motor bağımsız, yeniden doğrulanabilir bir paket üretmek; Godot ile başlayan doğrulanmış bağdaştırıcı ve çalışma zamanı kanıtı üzerinden teslimatı tamamlamak.
6. Hak, kalite, onay, yeniden doğrulama, arşiv ve teslimat kanıtlarını geçmişi yeniden yazmadan korumak.

Bir ürün **doğrudan rakip** sayılmak için 2D oyun varlığı üretimini açıkça hedeflemeli ve yukarıdaki işlerden en az üçünü, proje/kimlik bağlamından üretim veya düzenlemeye ve kullanılabilir çıktıya uzanan bağlı bir akışta karşılamalıdır. Tek bir aşamayı derinlemesine çözen veya genel yaratıcı üretim sunup bu işlerle anlamlı ölçüde örtüşen ürünler **komşu araç** sayılır.

Kanıt işaretleri:

- **D — Belgelenmiş davranış:** Güncel resmî yardım, API veya kullanım belgesi davranışı ve girdileri açıklar.
- **Ü — Ürün beyanı:** Güncel birinci taraf ürün veya pazarlama sayfası yeteneği söyler; bu taramada hesap açılarak uçtan uca sınanmamıştır.
- **Ç — Çıkarım:** Kaynaktaki davranıştan Workbench için çıkarılan sonuçtur; rakibin kendi iddiası değildir.
- **? — Doğrulanamadı:** Sayfa erişilemedi, belge bulunamadı veya yalnız arama izi görüldü. Mevcut özellik olarak karşılaştırmaya alınmaz.

Bu taramada bağımsız çıktı kalitesi, tutarlılık yüzdesi, gecikme, fiyat/credit verimliliği veya motor paketlerinin gerçekten açıldığı sınanmadı. “Game-ready”, “consistent”, “production-ready” ve benzeri ifadeler, davranış belgesiyle desteklenmediğinde yalnız **Ü** olarak kaydedildi.

## 2. Ürün sınırından gelen eleme ölçütleri

Bir rakipte bulunması tek başına şu konuları fırsata dönüştürmez:

- Workbench'in kendi görsel üretim modelini sunması veya belirli bir üretim API'sine bağımlı olması
- İnsan onayı gereken sanat, bağlam, istisna, teslimat veya silme kararlarının ajana devredilmesi
- Ekip rolleri, yorum zincirleri ve gerçek zamanlı ortak çalışma
- Tam çizim paketi, kapsamlı katman düzenleyici, iskelet animasyon aracı, oyun motoru veya seviye düzenleyicisi olma
- Godot-first kararını atlayarak çok sayıda motoru ilk ürünün zorunlu kapsamına alma
- Oyun motorunu yetkili kayıt yapmak veya sürekli çift yönlü eşitleme kurmak
- Projeler arasında canlı ve yetkili ortak stil kütüphanesi tutmak
- Harici görsel analizi varsayılan olarak açmak

Bu sınırlar; [`ADR-0002`](adr/0002-use-extensible-asset-support-levels.md), [`ADR-0003`](adr/0003-require-web-and-desktop-product-surfaces.md), [`ADR-0004`](adr/0004-engine-neutral-export-with-godot-first.md), [`ADR-0010`](adr/0010-external-visual-analysis-is-explicit-opt-in.md), [`ADR-0012`](adr/0012-reserve-consequential-decisions-for-the-user.md) ve [`ADR-0017`](adr/0017-treat-runtime-validation-as-one-way-user-finalized-evidence.md) ile uyumludur.

## 3. Güncel rakip envanteri

### 3.1 Doğrudan rakipler: davranışı resmî belgelerle izlenebilenler

| Ürün | Uygunluk özeti | Güncel ve ayrıştırılmış kanıt | Kanıt düzeyi |
| --- | --- | --- | --- |
| **PixelLab** | Kalıcı karakter ve obje kimlikleri, dört/sekiz yön, animasyon, durum, karo seti, kütüphane ve sprite-sheet çıktısı aynı oyun-varlığı akışında birleşir. | API, karakteri sunucuda kimlikle saklamayı; animasyon/durum eklemeyi; etiketleme, ZIP ve sprite-sheet dışa aktarımını açıklar. Kalite ve tutarlılık sonucu ayrıca sınanmadı. [API](https://api.pixellab.ai/v2/docs), [karakter seçenekleri](https://www.pixellab.ai/docs/options/character), [karo seti](https://www.pixellab.ai/docs/tools/create-tileset) | D |
| **SpriteCook** | Proje, referans, revizyon, karakter animasyon seti, varlık içe aktarma ve API/MCP yolunu birleştirir. | Karakter akışı prompt → gözden geçir/düzelt → hareket seti → dışa aktarım adımlarını; API ise proje, referans/edit varlık kimliği, model, ölçü, palet, iş ve iptal alanlarını belgeler. “Production-ready” kalite iddiası sınanmadı. [karakter akışı](https://www.spritecook.ai/docs/guide-create-character), [referans](https://www.spritecook.ai/docs/use-reference), [API](https://www.spritecook.ai/api-docs) | D + Ü |
| **Gamelabs Studio** | Bir oyun projesindeki varlıkları, klasörleri, paleti, üretim geçmişini, animasyonu, sprite sheet'i, düzenlemeyi ve ajan/API akışını bağlar. | Resmî belgeler Asset Project, ortak/özel palet, varlık ve generation history; MCP sayfası kaynak iş kimlikleriyle görsel → animasyon → sprite sheet zincirini açıklar. [belgeler](https://gamelabstudio.co/docs/), [Asset Projects](https://gamelabstudio.co/docs/projects/asset-projects), [MCP](https://gamelabstudio.co/mcp) | D |
| **MagicPixel** | Stil referansı, gerçek piksel ızgarası ve katmanlar, palet kilidi, yön/animasyon, Aseprite içe aktarma ve CLI ile proje klasörüne eşitlemeyi bir araya getirir. | Resmî kılavuz yön ve clip adlarını; ürün belgesi `.aseprite` kare/katman/tag korumasını ve CLI sync davranışını açıklar. “Silhouette/palette tam korunur” gibi kalite ifadeleri sınanmış sonuç değil ürün iddiasıdır. [ürün](https://magicpixel.art/), [üretim kılavuzu](https://magicpixel.art/guides/generating-sprites), [editör](https://magicpixel.art/pixel-art-editor) | D + Ü |
| **StudioSprite** | Projeye bağlı “Sprite DNA”, ileriye dönük stil kilidi, klasörler, referans, animatör, tek kare düzenleme ve atlas/JSON dışa aktarımı sunar. | Proje belgesi mevcut sprite'ların kural değişince geriye dönük değişmediğini ve style lock sınırını; animatör belgesi kare inceleme/düzenleme ve çıktı biçimlerini açıklar. Sayısal “style match” pazarlama gösterimi doğrulanmış ölçüm değildir. [projeler](https://studiosprite.com/guides/creating-and-managing-projects), [animatör](https://studiosprite.com/guides/tool-animator), [araçlar](https://studiosprite.com/tools) | D + Ü |
| **Ludo.ai** | Oyun fikrinden 2D görsel, sprite animasyonu ve Animation Pack çıktısına uzanan geniş bir üretim hattı kurar; sonuç geçmişi sonraki araçlara girdi olur. | Belgeler, güvenilen tek görselin sonraki sprite/animasyon işlerine girdi olmasını, animasyon paketinde hizalama/yeniden boyutlandırmayı ve PNG/JSON/ZIP çıktılarını açıklar; her düzenlemede yeniden işleme bağlı sürüklenme olabileceğini de belirtir. [oyun varlığı üretimi](https://ludo.ai/docs/game-asset-generation) | D |
| **Scenario** | Oyun odaklı özel stil/karakter modelleri, proje ve koleksiyonlar, katmanlı/maskeli seçici düzenleme, sprite-sheet iş akışı ve API sağlar. | Resmî yardım, projelerin içerik izolasyonunu; koleksiyonların varlık/model gruplamasını; Canvas'ın tahribatsız katman ve maskeyle düzenlemesini; sprite-sheet kılavuzunun ise dış bir paketleyici gerekebildiğini belgeler. Workbench düzeyinde onay/teslimat yaşam döngüsü gösterilmez. [projeler](https://help.scenario.com/articles/5853216947-projects), [koleksiyonlar](https://help.scenario.com/articles/9230394463-collections), [Canvas](https://help.scenario.com/articles/2815682247-canvas-retouching-workflows), [sprite sheet](https://help.scenario.com/articles/9088582240-create-spritesheets-with-scenario) | D |

### 3.2 Doğrudan rakip iddiası güçlü, fakat kanıtı ağırlıkla birinci taraf ürün sayfası olanlar

| Ürün | Birinci tarafın güncel iddiası | Bu incelemenin sınırı | Kanıt düzeyi |
| --- | --- | --- | --- |
| **SpriteShip** | Proje sanat yönü, karakter/animasyon/karo/arka plan, seçici animasyon yenileme, Godot/Unity/Phaser/GameMaker/Tiled çıktısı; ajanlar için kapsamlı anahtar, harcama önizlemesi, lockfile ve kendini açıklayan paket. | Ajan sayfası ayrıntılı örnek ve sözleşme gösterse de bu taramada hesap/API kullanımı ve üretilen motor paketi sınanmadı. [ürün](https://spriteship.com/), [ajan/API akışı](https://spriteship.com/agents), [Codex akışı](https://spriteship.com/agents/codex) | Ü |
| **Volts** | Beta üründe proje stili, karakter/yön/kıyafet/animasyon, karo ve harita, sürüm geçmişi, tek kare düzeltme ve Unity/Godot/Tiled çıktısı. | Güncel sayfa ayrıntılı demo beyanı sunuyor; ayrı davranış/API belgesi ve gerçek çıktı testi bulunmadı. [ürün](https://volts.gg/) | Ü |
| **Sprite Fusion** | Tam piksel boyutunda üretim, stil referansı, edit/animasyon, API ve çok motorlu tilemap dışa aktarımı. | Üretim ve API yetenekleri ürün sayfasında; tilemap içe/dışa aktarımı ayrı sayfada açıklanıyor. Proje çapı yaşam döngüsü ve sürüm kanıtı doğrulanmadı. [üretici](https://www.spritefusion.com/pixel-art-generator), [tilemap ürünü](https://www.spritefusion.com/) | Ü + D |
| **Sprixen** | Proje paleti/sanat yönü, sprite/animasyon/tileset/arka plan ve motor hedefleri olan geniş oyun stüdyosu. | Bu taramada ayrıntılı yardım veya API sözleşmesi yerine ürün sayfası bulundu; karşılaştırma hücrelerinde doğrulanmış davranış sayılmadı. [ürün](https://sprixen.com/) | Ü |
| **Spritefy** | Çalışma alanlarında karakter, eşya, karo, arka plan, UI, animasyon ve VFX üretimi. | Ayrıntılı davranış belgesi ve yaşam döngüsü kanıtı bulunmadan izleme listesinde tutulur. [ürün](https://spritefy.com/) | Ü |
| **GameKit Gen** | 2D oyun varlığı, sprite sheet ve metadata içeren proje ZIP'i. | Yalnız güncel ürün sayfası bulundu; kimlik, sürüm, inceleme ve dışa aktarım sözleşmesi ayrıca doğrulanmadı. [ürün](https://www.gamekitgen.com/) | Ü |
| **PIXAI Studio** | Sprite, animasyon, karo, paralaks, prop ve motor paketleri sunan AI varlık stüdyosu. | Birinci taraf sayfa Solana/ödeme ve üretim iddialarını birlikte sunuyor; belgelenmiş proje yaşam döngüsü ve çıktı testi yok. [ürün](https://pixai.studio/) | Ü |

### 3.3 Anlamlı komşu araçlar

| Araç | Örtüşen iş | Workbench'e etkisi | Kaynak ve düzey |
| --- | --- | --- | --- |
| **Layer** | Proje çapı talimat, referans seti, varlık kütüphanesi ve çok adımlı workflow. | Görsel bağlamın tekrar yazılmaması ve referans seti güçlü örtüşmedir; çok kullanıcılı/genel üretim alanı ve yerleşik model yaklaşımı ürün sınırından farklıdır. | [projeler](https://help.layer.ai/en/articles/15524389-working-with-projects), [ürün tanımı](https://help.layer.ai/en/articles/15511102-what-is-layer) — D |
| **Aimagica** | Ortak sanat yönü, varyant karşılaştırma, kısa liste ve metadata/prompt içeren proje paketi. | Bağlam → gözden geçirme → taşınabilir paket akışını destekler; sayfa ağırlıkla konsept varlığı anlatır ve motor paketi sunmadığını söyler. | [ürün](https://www.aimagica.ai/) — Ü |
| **Unity AI Sprite Generator** | Unity Editörü içinde prompt/referansla sprite, post-process ve 4×4 animasyon sayfası üretir; çıktıyı proje klasöründe AI metadata etiketiyle tutar. | Motor içi düşük sürtünme ve “yer tutucu, sonra değiştir” niyeti önemlidir; Unity'ye bağlıdır, beta/prototip içindir ve motoru kaynak yapan yaklaşım Workbench sınırıyla uyuşmaz. | [Sprite Generator](https://unity.com/blog/unity-ai-sprite-generator), [AI ilkeleri ve metadata](https://unity.com/legal/unityai-guiding-principles) — D |
| **AnimGen** | Görsel/video → hareket önizlemesi → aralık seçimi → kare/sprite sheet/motor paketi; doğru kare süresi ve manifest. | Animasyon denemesini dışa aktarımdan ayırması ve seçili aralığı kanıtlaması, animasyon profili için güçlü komşu davranıştır. Proje çapı görsel bağlam ve aile yaşam döngüsü sunmaz. | [belgeler](https://animgen.com/docs/en), [iş akışı](https://animgen.com/docs/en/getting-started/overview), [çıktılar](https://animgen.com/docs/en/editing-and-export/output-formats) — D |
| **Aseprite** | Kare/katman/tag/slice/pivot bilgisi, sprite-sheet içe/dışa aktarımı ve CLI otomasyonu. | Son Dokunuş Piksel Düzenleyicisi'nin yerine geçmemeli; mevcut çalışma dosyasından deterministik sidecar metadata okuma ve kullanıcı-onaylı eşleme için güçlü kanıt sağlar. | [CLI](https://www.aseprite.org/docs/cli/), [sprite sheet](https://www.aseprite.org/docs/sprite-sheet/), [dosya modeli](https://www.aseprite.org/docs/files/) — D |
| **Pixelorama** | Web/masaüstünde piksel düzenleme, animasyon tag'leri, tilemap katmanları ve sprite-sheet dışa aktarımı. | Web+masaüstü düzenleyici beklentisinin maliyetini gösterir; Workbench'in tam editör olmama sınırını değiştirmez. | [ürün](https://pixelorama.org/), [dışa aktarım](https://pixelorama.org/user_manual/save_and_export/) — D |
| **TexturePacker** | Atlas paketleme, trim, pivot, nine-patch, çoklu paket, çok motorlu/custom metadata. | Dışa Aktarım Paketi'nin profil ve tüketici sözleşmesini derinleştirebilir; görsel üretim bağlamı, insan onayı veya sürüm yaşam döngüsü sunmaz. | [belgeler](https://www.codeandweb.com/texturepacker/documentation), [ayarlar](https://www.codeandweb.com/texturepacker/documentation/texture-settings), [özel dışa aktarım](https://www.codeandweb.com/texturepacker/documentation/custom-exporter) — D |
| **Tilesetter** | Karo ilişkilerinden set üretme, otomatik kaynak yenileme, Godot/Unity/GMS/Defold ve özel format dışa aktarımı. | Karo profilinin motor eşleme ve kaynak-değişikliği akışına kanıt sağlar; harita düzenleyicisini kapsama alma gerekçesi oluşturmaz. | [özellikler](https://www.tilesetter.org/downloads), [dışa aktarım](https://www.tilesetter.org/docs/exporting) — D |
| **Anchorpoint** | Git tabanlı büyük dosya sürümleme, görsel geçmiş, inceleme/approval ve seçici checkout. | Sürüm ve inceleme ihtiyacını doğrular; ekip onayı, dosya kilidi ve Git deposu Workbench'in tek kullanıcı ve ürün-içi kayıt modelinden farklıdır. | [ürün](https://www.anchorpoint.app/), [inceleme](https://www.anchorpoint.app/features/reviews-and-approvals) — D |
| **Spine / PixelOver** | İskelet/rig tabanlı animasyon, çalışma dosyası ve motor/veri dışa aktarımı. | Kaynak ve çıktı ilişkisini koruma ihtiyacını destekler; iskelet animasyonu açıkça kapsam dışıdır. | [Spine dışa aktarım](https://us.esotericsoftware.com/spine-export/), [PixelOver](https://docs.pixelover.io/manual/introduction/), [PixelOver dışa aktarım](https://docs.pixelover.io/manual/export/) — D |
| **OpenAI game-studio sprite-pipeline** | Onaylı seed kare, tam şerit üretimi, ortak ölçek/anchor normalizasyonu ve oyun içi önizleme adımlarını tarif eden ajan iş akışı. | Bir ticari rakip değil, güncel bir iş-akışı sinyalidir. Aileler arası ortak anchor/ölçek normalizasyonunun ayrı ve doğrulanabilir bir işlem olabileceğini gösterir. | [kaynak](https://github.com/openai/plugins/blob/main/plugins/game-studio/skills/sprite-pipeline/SKILL.md) — D |

### 3.4 Mevcut envanterden davranışı doğrulanamayan kayıt

`Game Sprite Studio` için 2026-09-22 taramasında erişim sonucu tutarsızdı: açılış/SSS düzeyinde birinci taraf ürün beyanlarına ulaşılabildi, fakat ayrıntılı ve yeniden üretilebilir bir davranış belgesi bulunamadı; doğrudan sayfa denemelerinden biri de hata verdi. Bu nedenle proje, sürüm, kanonik varlık, drift düzeltme ve motor paketi beyanları **Ü** düzeyinde izleme listesinde tutuldu, **D** düzeyindeki karşılaştırma tablosuna alınmadı. Kaynak yeniden erişilebilir ve davranış belgelenebilir olduğunda aynı uygunluk ölçütleriyle tekrar değerlendirilmelidir.

## 4. Doğrulanmış yetenek karşılaştırması

Bu tablo yalnız **D** düzeyindeki belgelenmiş davranışları olumlu işaretler. `Ü` tek başına yetenek onayı değildir.

| Ürün | Proje/stil bağlamı | Kalıcı kimlik veya referans | Aile/animasyon yapısı | Seçici inceleme/düzeltme | Yapılandırılmış çıktı | Workbench karşısındaki temel boşluk |
| --- | --- | --- | --- | --- | --- | --- |
| PixelLab | Sınırlı | Güçlü: character/object ID | Güçlü | Kısmi | ZIP/sheet + keypoint metadata | İnsan onayı, bağlama uygunluk, kanıt/teslimat yaşam döngüsü belgelenmiyor. |
| SpriteCook | Proje ve theme/style alanları | Referans ve edit asset ID | Karakter + hareket seti | Revizyon ve seçim | API varlıkları, sprite çıktısı | Tarihsel onay, bağımlılık yeniden doğrulaması ve motor-bağımsız teslimat kanıtı belgelenmiyor. |
| Gamelabs Studio | Proje + ortak/özel palet | Kaynak görsel ve iş zinciri | Görsel → animasyon → sheet | Editor + geçmiş | API/MCP artifact | Kullanıcı-gated karar, kalite istisnası ve teslimat gerçekleşmesi modeli belgelenmiyor. |
| MagicPixel | Referans, palette lock ve proje/asset library | Referans sprite, component | Yön, frame, clip, layer/artboard | Piksel editörü ve AI bölge edit'i | PNG sheet/frame + CLI/REST sync | Senkronize dosya deposu, Workbench'in değişmez onay/kanıt/teslimat modelini sağlamıyor. |
| StudioSprite | Project DNA + ileriye dönük lock | Referans + proje DNA'sı | Sprite/animasyon/atlas | Tek kare düzenleme | PNG/GIF/SVG/JSON/ZIP | Değişmez sürüm, kaynak kanıtı, hak ve yeniden doğrulama sözleşmesi belgelenmiyor. |
| Ludo.ai | Game Concept/proje içinde geniş bağlam | Güvenilen görseli yeniden kullanma | Sprite animasyonları ve moveset | Edit/Adjust/Animation Pack | PNG/JSON/ZIP/GLB vb. | Aile onayı ve tam üretim/teslimat kanıtı yerine araç geçmişi esas. |
| Scenario | Proje, koleksiyon, özel model | Stil/karakter modeli ve referans | Genel varlık koleksiyonu; sprite akışı | Maskeli tahribatsız Canvas | PNG/layer ve API varlıkları | Oyun motoru kullanım kanıtı ve varlık-aile yaşam döngüsü ayrı sözleşme değil. |
| AnimGen | Görev/proje düzeyi | Kaynak görsel/video | Tek animasyon görevi | Aralık seçimi, loop preview | Aseprite JSON, sheet, motor ZIP | Proje bağlamı ve aileler arası kimlik/teslimat yönetimi yok. |
| Aseprite | Dosya içi palette/tag/slice | Çalışma dosyası | Kare, layer, tag, slice | Derin yerel düzenleme | PNG + JSON/CLI | Üretim bağlamı, hak, onay ve teslimat Workbench dışındadır. |
| TexturePacker | Exporter ayarı | Kaynak dosya yolu | Atlas/multipack | Teknik önizleme | Motor/custom metadata | Görsel kimliği ve üretim yaşam döngüsü yoktur. |

Rakiplerdeki yaygın kalıp “üret → düzelt → motor dosyasını indir”dir. Workbench'in ayırt edici sözleşmesi ise “bağlamı ve yetkiyi sabitle → dışarıda üret → sonucu kesin sürüm ve kanıtla içe al → kullanım bağlamında doğrula → değişmez teslimat üret” akışıdır. **Ç:** Rekabet baskısı Workbench'i kendi modeline veya tam editöre çevirmekten çok, bu kanıtlı akışın giriş ve çıkış sürtünmesini azaltma yönündedir.

## 5. PRD'de zaten bulunan davranışlar

Aşağıdaki rekabet özellikleri yeni fırsat değildir:

- Proje çapı sanat yönü, palet, perspektif ve stil kuralları → Proje Bağlamı, Görsel Dünya, Tema ve Stil Modülü
- Onaylı bir kimlik/stil çıpası → Ana Tasarım ve Varlık Kimliği
- Referansla belirli özelliği taşıma → Referans Rolü ve Referans Aktarım Kısıtı
- Yön, durum, animasyon ve varyant aileleri → Varlık Ailesi ve Gerekli Öğeler Listesi
- Varyant karşılaştırma ve insan seçimi → Aday Sürüm, İnceleme Kaydı ve Üretim Deneyi
- Sorunlu kareyi/birimi değiştirme → Birim Sürümü, Birleşik Sürüm ve seçici düzeltme
- Piksel/palet/hizalama temizliği → Son Dokunuş Piksel Düzenleyicisi
- Karo, sahne, pivot, olay, hitbox/collision ve kullanım önizlemesi → özel profiller, Sahne Kalite Kontrol Alanı ve Oyun İçi Bilgiler
- Sağlayıcı/model/parametre ve gerçek prompt kaydı → Sağlayıcı Üretim Kaydı ve Elle İçe Aktarma Kanıtı
- Hak ve eksik tarih ayrımı → Hak Kaydı ile Geçmiş Varlık Beyanı
- Motor metadata'sı ve değişmez paket → Oyun Motorundan Bağımsız Paket, Dışa Aktarım Paketi ve doğrulanmış bağdaştırıcı
- Gerçek oyunda sınama → Çalışma Zamanı Doğrulama Kaydı
- Proje/varlık geçmişi ve geri yükleme → Proje Arşivi, değişmez sürümler ve Silme Kaydı

Mount point, ground line, loop seam, alpha, collision ve çoklu arka plan kontrolleri de yeni özellik değildir; mevcut profil ve oyun içi bilgi alanlarının kabul ölçütlerini derinleştirecek örneklerdir.

## 6. Daha önce karara bağlanmış adaylar ve araştırma

PRD'nin Bölüm 11'i aşağıdaki statüleri açıkça korur; rekabet taraması bunları zorunlu kapsam yapmaz:

| Kod | Konu | Mevcut statü | Yeni kanıtın etkisi |
| --- | --- | --- | --- |
| F1 | Oyun içi anlamların ayırt edilebilirliği | Özellik adayı | İkon/UI önizleme araçları ihtiyacın varlığını destekler; kullanım-koşuluna bağlı insan incelemesi sınırını değiştirecek kanıt yok. |
| F2 | Dil ve bölgeye göre görsel seçimi | Özellik adayı | Rakiplerde belirgin bir yerelleştirilmiş görsel teslimat sözleşmesi görülmedi; farklılaştırıcı olabilir, fakat değer varsayımı hâlâ kullanıcı kararıdır. |
| F3 | Aileler arası ekipman uyumluluğu | Özellik adayı | Character state/outfit üretimi yaygınlaştı; buna rağmen bir kombinasyonun gerçekten sınandığını kanıtlama davranışı belgelenmedi. Mevcut dar kapsam kararı korunmalı. |
| F4 | Teslimatın doku kaynak bütçesi | Dar değer araştırması | Atlas/multipack ve ölçek varyantları teknik yapılabilirliği destekler; kullanıcı değerini kanıtlayan gerçek paket deneyi hâlâ yok. Araştırma statüsü değişmez. |

## 7. Net-yeni fırsatlar ve anlamlı iyileştirmeler

Bu bölüm, araştırmada bulunan fırsatları ve 2026-09-22 karar görüşmesinin portföy statülerini kaydeder. İlk ürün kapsamı kararı tek başına ayrıntılı davranış ve kabul sözleşmesini tamamlamaz; bunlar görüşmenin sonraki kararlarıyla PRD'ye işlenecektir. Kodlar ayrıntılı araştırma notundaki kodlarla aynıdır.

### O1 — Kullanıcı onaylı kaynak metadata içe aktarma önerisi

- **Tür:** Mevcut toplu içe aktarmanın anlamlı iyileştirmesi.
- **Çözdüğü iş:** Mevcut Aseprite/PNG atlası ve sidecar bilgisini kare, tag, slice, pivot, 9-slice ve palet anlamlarını yeniden elle yazmadan Workbench'e almak.
- **Mevcut ürüne katkısı:** Tanınan metadata'yı Varlık Ailesi, Gerekli Öğeler Listesi, Oyun İçi Bilgiler ve kalite kontrollerine bağlanmak üzere incelemeye açık bir **eşleme önerisine** dönüştürür. Kullanıcı onaylamadan aile, geçmiş veya onay uydurmaz.
- **Etkilediği kararlar:** Bölüm 2'deki toplu içe aktarma sınırı; 4.4 insan yetkisi; 4.5 içe aktarma kanıtı; 4.11 sprite-sheet ayırma; Managed Snapshot ve Proje Arşivi bütünlüğü.
- **Ödünleşimler:** Format/sürüm parser matrisi, çelişen veya eski sidecar verisi, yanlış eşleme riski ve web/masaüstü eşdeğerliği. Kaynak metadata üretim geçmişi veya onay kanıtı sayılamaz.
- **Değer varsayımı:** Gerçek bir eski projede ilişkilendirme süresini ve metadata yeniden giriş hatasını manuel gelen kutusuna göre anlamlı biçimde azaltır.
- **Karar sınırı:** İlk ürün, PNG/sprite sheet ile belgelenmiş Aseprite/TexturePacker JSON sidecar'larını web ve masaüstünde yorumlar; yerel `.aseprite` ayrıştırma sonraya bırakılır. Zorunlu çakışmalar kullanıcı çözmeden kesinleşmez, isteğe bağlı alanlar açıkça bilinmiyor kalabilir.
- **Statü:** İlk ürün zorunlu kapsamı — 2026-09-22 kullanıcı kararı.

### O2 — Sürümlü dışa aktarım profili ve kullanıcı başlatmalı tek yönlü yenileme kilidi

- **Tür:** Mevcut dışa aktarım ve teslimin anlamlı iyileştirmesi.
- **Çözdüğü iş:** Bilinen iyi yerleşim, padding, trim, ölçek ve biçim ayarlarını tekrar kullanmak; yalnız değişen içeriği, hedefteki yerel düzenlemeleri sessizce ezmeden yeniden teslim etmek.
- **Mevcut ürüne katkısı:** Ayarları sürümlü/sabitlenebilir profil olarak tutar. Kilit manifesti Dışa Aktarım Paketi ve içerik özetlerini hedefe eşler; çalıştırmadan önce değişmiş, bayat veya hedefte ayrışmış dosyaları gösterir. Yenileme yalnız kullanıcı tarafından başlatılır, tek yönlüdür ve yeni paket/sürüm üretir.
- **Etkilediği kararlar:** Oyun Motorundan Bağımsız Paket, Dışa Aktarım Paketi, Teslimat Hedefi, Doğrulanmış Motor Bağdaştırıcısı, Çalışma Zamanı Doğrulama Kaydı ve “sürekli çift yönlü eşitleme yok” sınırı.
- **Ödünleşimler:** Profil şema göçü, hedef dosya sahipliği, yerel çatışma deneyimi ve gizli bir senkron platformuna dönüşme riski. Haricî bir aracın komutuyla yeniden üretim, bu adayın ayrı ve sonradan seçilebilir dalıdır; yerel araç temel akışın önkoşulu olamaz.
- **Değer varsayımı:** Aynı projenin ardışık teslimlerinde kurulum süresini, yanlış export ayarını ve bayat manuel entegrasyonu azaltır.
- **Karar sınırı:** Hedef ayrışması etkilenen yenilemeyi kapalı durumda tutar; kullanıcı hedef dosyayı korur, yeni hedef seçer veya açıkça değiştirmeyi onaylar. Profil, kilit ve ayrışma raporu iki yüzeyde bulunur; web değişiklik paketi indirir, masaüstü açık izinle dosya sistemine uygulayabilir.
- **Statü:** İlk ürün zorunlu kapsamı — 2026-09-22 kullanıcı kararı.

### O3 — Kendini açıklayan paket doğrulama kiti

- **Tür:** Mevcut dışa aktarım bütünlüğünün anlamlı iyileştirmesi.
- **Çözdüğü iş:** Kullanıcının veya yardımcı aracın dosya yerleşimini, schema sürümünü ve animasyon/pivot/event eşlemelerini tahmin etmeden paketi anlayıp bütünlüğünü çevrimdışı doğrulaması.
- **Mevcut ürüne katkısı:** Mevcut manifest ve schema version'a tam eşleşen JSON Schema, kısa insan README'si, deterministik checksum listesi, çevrimdışı doğrulayıcı ve çalıştırılabilir olmayan statik örnek eşleme ekler. Olası bir tüketim makbuzu çalışma zamanı kanıtının yerine geçmez ve ayrı karar gerektirir.
- **Etkilediği kararlar:** Oyun Motorundan Bağımsız Paket, Dışa Aktarım Paketi, arşiv şeması, teslimat bütünlüğü, güvenlik/güven modeli ve tamamlanma koşulları.
- **Ödünleşimler:** Paket boyutu ve sürüm bakımı artar; gömülü belgenin manifestten sapması ve çalıştırılabilir içerik/ajan talimatı eklenirse güvenlik riski doğar. Varsayılan içerik statik ve doğrulanabilir olmalıdır.
- **Değer varsayımı:** Godot referans projesinde temiz ortamdan ilk başarılı doğrulama süresini ve elle eşleme hatalarını mevcut manifest-only pakete göre azaltır.
- **Karar sınırı:** Paket yalnız schema, checksum, README ve çalıştırılabilir olmayan statik örnek taşır; doğrulama Workbench veya ayrı sürümlenmiş doğrulayıcıyla yapılır. Ayrı Tüketim Makbuzu eklenmez; kurulum kanıtı mevcut Teslimat Gerçekleşmesi ve Çalışma Zamanı Doğrulama Kaydı içinde kalır.
- **Statü:** İlk ürün zorunlu kapsamı — 2026-09-22 kullanıcı kararı.

### O4 — Bağlantı kabiliyet yetkileri ve işlem önizlemesi

- **Tür:** Net-yeni araştırma fırsatı; mevcut karar geçmişiyle olası çatışma.
- **Çözdüğü iş:** Ajan veya bağlantının istenmeyen yazma, ücret harcama ya da veri ifşası yapmadan okuma, içe alma veya sağlayıcı işlemi gerçekleştirmesine izin vermek.
- **Mevcut ürüne katkısı:** Okuma/yazma/üretme/harcama gibi ayrı capability scope'ları; mümkünse sağlayıcı yükü ve maliyet önizlemesi; idempotency; bağlantı başına limit/kill switch; İnsan Onayı Gerektiren Eylem ile uyumlu açık onay.
- **Etkilediği kararlar:** 4.4 ajan yetkisi; 4.5 bağlantılar ve Sağlayıcı Üretim Kaydı; güvenlik/gizlilik; OV-01 ve OV-07; birinci taraf sağlayıcı entegrasyonu sınırı.
- **Ödünleşimler:** Sağlayıcıya özgü izin/maliyet semantiği, her sağlayıcıda maliyet verisi olmaması, sır/veri sızıntısı yüzeyi ve ürünün sağlayıcı muhasebesine yaklaşması. Manuel ChatGPT yolu için doğrudan değer üretmez.
- **Değer varsayımı:** Yalnız ücret harcayabilen veya yazabilen en az bir resmî bağlantı kapsama girerse gerçek hata/harcama riskini anlamlı biçimde sınırlar.
- **Karar çatışması:** `2026-09-22-direct-competitor-scan.md`, önceki görüşmede “üretim kredisi veya maliyet takibi eklenmeyecek” kararı alındığını söyler; dayanak görüşme kaydı depoda yoktur. Muhasebe panosu ile işlem öncesi harcama korumasının aynı ret kapsamında olup olmadığı kullanıcı tarafından netleştirilmelidir.
- **Statü:** Araştırma — 2026-09-22 kullanıcı kararı. Üretim kredisi/maliyet muhasebesi panosu kapsam dışıdır; işlem öncesi korumalar ancak ücret harcayabilen veya yazabilen resmî bağlantı seçilirse yeniden açılır.

### O5 — Animasyon ailesi normalizasyon işlemi

- **Tür:** Mevcut Animasyon Profili ve Son Dokunuş Piksel Düzenleyicisi için anlamlı iyileştirme.
- **Çözdüğü iş:** Aynı karakterin idle/walk/attack gibi ayrı animasyonlarında ortak mantıksal ölçek, tuval, zemin çizgisi ve anchor değerini korumak; her animasyonu motorda yeniden hizalamamak.
- **Mevcut ürüne katkısı:** Mevcut kare-içi hizalama ve yön eşzamanlamasını animasyonlar arası bir sete genişletir. Ludo Animation Pack ve OpenAI sprite-pipeline belgeleri ortak ölçek/anchor normalizasyonunun ayrı iş değeri taşıdığını gösterir.
- **Etkilediği kararlar:** Birim/Birleşik Sürüm modeli, Animasyon Kalite Profili, Gerekli Öğeler Listesi, Dışa Aktarım Paketi ve Godot referans projesi.
- **Ödünleşimler:** Otomatik kırpma veya ölçek görsel niyeti bozabilir; kök hareketi ve bilinçli boyut değişimi korunmalıdır. Her dönüşüm yeni sürüm üretmeli, özgün kareleri değiştirmemeli ve kullanıcı tarafından kabul edilmelidir.
- **Değer varsayımı:** Gerçek bir karakter hareket setinde motor sonrası elle pivot/ölçek düzeltmesini azaltır ve hareketler arası geçişte sıçramayı daha erken görünür kılar.
- **Karar sınırı:** Uygulama kapsamına geçmeden önce en az bir animasyon-ağırlıklı referans projede manuel düzeltme süresi ve animasyon geçişi sıçramaları karşılaştırmalı ölçülür.
- **Statü:** Sonraki sürüm — 2026-09-22 kullanıcı kararı; ilk ürünün tamamlanma koşulu değildir.

### E1 — Animasyon ve oyun içi metadata kabul sertleştirmesi

- **Tür:** Mevcut özelliğin kabul/kalite iyileştirmesi; ayrı yeni ürün alanı değil.
- **Çözdüğü iş:** Oyunda zıplama, dikiş atma veya yanlış bağlanma yaratacak kareleri dışa aktarmadan önce görmek.
- **Mevcut ürüne katkısı:** Kalite Profili ve kabul senaryolarında yönler arası zemin çizgisi tutarlılığını, loop seam incelemesini, kare başına mount-point/collision roundtrip'ini ve profile bağlı toleransları açıklaştırır; mevcut kavramları yeniden adlandırmaz.
- **Etkilediği kararlar:** Animasyon QA, Oyun İçi Bilgiler, Kalite Profili/Engeli/İstisnası, çalışma zamanı kanıtı ve export roundtrip.
- **Ödünleşimler:** Yanlış pozitifler, toleransların varlık tipine göre değişmesi ve görsel kalite ile oyun mekaniği sorumluluğunun karışması.
- **Değer varsayımı:** Bu kontroller runtime'a kaçan hizalama, loop ve bağlantı hatalarını genel manuel incelemeden daha erken ve daha düşük maliyetle bulur.
- **Karar sınırı:** Eksik veya bozuk metadata roundtrip'i ve yapısal uyumsuzluk engeldir. Görsel loop seam ve zemin sapması, profil toleransına bağlı gereksinim veya insan incelemesidir; evrensel otomatik engel değildir.
- **Statü:** Mevcut ilk ürün kapsamının zorunlu kabul ölçütlerini güçlendirir — 2026-09-22 kullanıcı kararı; ayrı özellik adayı değildir.

### 7.1 Kararlaştırılan ilk ürün önceliği

| Öncelik | Konular | Anlamı |
| --- | --- | --- |
| P0 | E1 kabul sertleştirmesi; O3 Paket Doğrulama Kiti | Mevcut kalite ve paket bütünlüğü sözleşmesi önce kapanır. |
| P1 | O1 Kaynak Metadata Eşleme Önerisi; O2 Export Profile ve Delivery Refresh Lock | İlk ürünün tamamlanması için zorunludur; P0 sözleşmelerinin üzerine kurulur. |
| Sonraki sürüm | O5 Animasyon Ailesi Normalizasyonu | Değer koşulu karşılanmadan ilk ürün kapsamına taşınmaz. |
| Araştırma | O4 bağlantı işlem korumaları | Ücret harcayan veya yazabilen resmî bağlantı seçilmeden uygulanmaz. |

## 8. İncelendi, fakat yeni aday yapılmadı

| Fikir | Sonuç | Gerekçe |
| --- | --- | --- |
| Yerleşik görsel üretim modeli veya özel model eğitimi | Ürün sınırıyla uyumsuz | Workbench dış üretim bağlamı ve kanıtını yönetir; üreticinin yerini almaz. |
| Phaser/GameMaker/Tiled/çoklu motoru ilk ürün kapsamına alma | Sonraya bırakılmış yön; yeni aday değil | Godot-first ve Unity'nin ayrı doğrulanması kararı geçerlidir. Pazar varlığı kalite sözleşmesini kanıtlamaz. |
| Tam piksel editörü, katman paketi veya iskelet animasyonu | Reddedilen kapsam | Son Dokunuş Piksel Düzenleyicisi bilinçli olarak dardır. |
| Harita/seviye düzenleyicisi | Reddedilen kapsam | Sahne Kalite Kontrol Alanı kullanım testidir, oyun/seviye üretim aracı değildir. |
| Ekip onayı, yorum ve dosya kilidi | Reddedilen hedef kullanıcı | Anchorpoint/Scenario ekip işi çözer; Workbench tek kullanıcı içindir. |
| Sürekli çift yönlü motor eşitlemesi | Reddedilen sınır | Tek yönlü paket ve kullanıcı-finalized runtime evidence korunur. |
| Otomatik AI kalite puanını engel yapmak | Reddedilen yetki modeli | Harici analiz opt-in; görsel şüphe yalnız Kalite Uyarısıdır. |
| AI-üretildi etiketiyle ayrı yaşam döngüsü durumu | Ayrı özellik gerektirmiyor | Sağlayıcı Üretim Kaydı, Hak Kaydı, İnceleme Kararı ve hedef politikaları kaynağı ve kullanım uygunluğunu daha doğru biçimde ayırabilir. Arama filtresi mevcut kitaplığın küçük iyileştirmesidir. |

## 9. Karar geçmişi ve eksik atıflar

PRD Bölüm 11.5 iki dosyaya bağlanıyor, ancak ikisi de 2026-09-22 tarihinde depoda bulunmuyor:

- `docs/research/2026-09-21-tool-capabilities.md`
- `docs/research/2026-09-21-product-opportunities.md`

Bu eksik dosyalar sessizce yeniden oluşturulmadı ve bu araştırma geçmişte yapılmış görüşmenin yerine geçirilmedi. ADR-0018, ADR-0019 ve ADR-0020 kabul edilmiş önceki kararlar olarak; PRD Bölüm 11 ise aday statülerinin güncel kaydı olarak ele alındı. `docs/research/2026-09-22-direct-competitor-scan.md` içinde özetlenen sağlayıcı ve maliyet kararlarının ayrıntılı görüşme dayanağı eksiktir; bu durum O4'te açık karar-provenance boşluğu olarak tutuldu. O2 ve O3 için 2026-09-22’de kabul edilen kalıcı teslimat/güven sınırı [ADR-0021](adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md) içinde kaydedildi.

Yeni araştırmanın ayrıntılı kaynak izi ve tarama sınırlamaları [`research/2026-09-22-competitive-capability-landscape.md`](research/2026-09-22-competitive-capability-landscape.md) içinde korunur. O dosya oluşmadan bu bağlantı tamamlanmış kabul edilmemelidir.

## 10. Araştırmanın ürüne söylediği

Pazar, görsel üretimin kendisini hızla metalaştırıyor: prompt, referans, animasyon, yön, karo ve motor paketi birçok üründe var. Daha az yaygın olan davranış, kabul edilmiş işin tam olarak hangi bağlam, kaynak, kullanıcı kararı ve kullanım kanıtıyla teslim edildiğini korumaktır.

Bu nedenle en güçlü yön, rakip üreticileri özellik sayısıyla yakalamak değildir. **Ç:** İlk kez kullanım ve dışa teslim sürtünmesini azaltırken Workbench'in insan yetkisi, değişmez sürüm, gerçek kaynak geçmişi, motor bağımsızlığı ve geçmiş teslimat bütünlüğünü korumaktır. O1–O3, O5 ve E1 bu ölçüte doğrudan uyar; O4 ise yalnız bağlantı kapsamı genişlerse anlamlıdır.
