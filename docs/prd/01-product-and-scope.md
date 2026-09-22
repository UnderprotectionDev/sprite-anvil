> [PRD içindekiler](README.md)

# Sprite Anvil — 2D Oyun Varlığı Üretim ve Kalite Çalışma Alanı

## 1. Ürün ve hedef kullanıcı

### Vizyon ve çözülen sorun

Sprite Anvil, tek başına çalışan 2D oyun geliştiricisinin görsel varlıkları tek tek dosyalar halinde bırakmak yerine amacı, geçmişi, kalite kanıtı ve teslimat bağlamı belli varlık aileleri olarak geliştirmesini sağlar. Ürün her tür 2D görsel oyun varlığı için kapsamlı üretim, kalite, sürümleme ve teslimat çalışma alanıdır.

ChatGPT birincil üretim yüzeyidir. Sprite Anvil Çalışma Alanı (Workbench) ise üretim bağlamını, referansların ne için kullanıldığını, onaylanan tasarımları, sürümleri, kalite kanıtlarını ve dışa aktarım bilgilerini yönetir. Domain modeli sağlayıcıdan bağımsızdır; insan üretimi görseller, başka üretim yüzeyleri, harici araç çalışma dosyaları, eski proje varlıkları ve lisanslı üçüncü taraf varlıklar da kendi kanıt yollarıyla aynı yaşam döngüsüne katılabilir.

Ürün yalnızca görsel kütüphanesi, üretim talimatı yöneticisi, animasyon önizleyicisi, kalite denetleyicisi veya dışa aktarım aracı değildir. Üretim öncesi bağlamı korur, dışarıdaki üretim için gereken bilgiyi hazırlar, sonuçları incelemeye yardımcı olur ve kabul edilen işleri yeni üretimlere bağlar. Böylece tutarlı varlık aileleri oluşturmak, onaylanmış işi kaybetmeden ilerlemek ve tüm üretimi tekrarlamadan sorunlu birimi düzeltmek kolaylaşır.

Manuel çalışmada kullanıcı karakter kimliğini ve proje kurallarını tekrar tekrar anlatabilir. Referansların ne işe yaradığını konuşma içinde takip etmesi, onaylı sürümü bulması, tek bozuk kare yüzünden tüm sayfayı yenilemesi, mantıksal boyutu kaynak görsel boyutundan ayırması ve oyun motorunda dilimleme, dönüş noktası, süre veya doku ayarlarını yeniden kurması gerekebilir. Ürün bu işleri izlenebilir bir üretim akışına taşır; sanatsal kararları kullanıcı adına vermez.

### Hedef kullanıcı

Birincil kullanıcı, kendi oyun projesi üzerinde çalışan, teknik üretim araçlarını kullanabilen ve programlama, tasarım ve sanat yönetimi kararlarını tek başına üstlenebilen bağımsız 2D oyun geliştiricisidir. Ürün, günlük üretimde kullanılacak kişisel bir çalışma alanıdır. Sanatsal kararları kullanıcı verir; ürün başlangıç seviyesi eğitimi veya ekip iş akışı sözü vermez. Terimler ve iş akışları, benzer ihtiyacı olan diğer tek başına çalışan geliştiricilerin de anlayabileceği kadar açık olmalıdır.

### Ürün ilkeleri

- **Varlık merkezli çalışma:** Kullanıcı tekil bir işlem yerine, varlık kaydı veya varlık ailesi içindeki üretim geçmişi üzerinde çalışır.
- **Onaylı ana tasarımdan türetme:** Türetilen görsellerin kimlik kaynağı, ilgili kullanım ve Görsel Dünya için seçilmiş Ana Tasarım’dır. Ana Tasarım onaylanmadan keşif yapılabilir, ancak sonuç üretim için onaylanmış sayılmaz.
- **Kabul edilen işi koruma:** Her yeni sonuç yeni bir sürüm olur. Kare, yön, karo veya durum gibi bağımsız birimler korunabilir; yalnızca sorunlu birim değiştirilebilir.
- **Referansın amacını koruma:** Her referansın hangi özellikleri aktarabileceği ve hangilerini aktaramayacağı belirtilir.
- **Ölçüleri birbirinden ayırma:** Kaynak görselin ölçüsü, mantıksal çözünürlük, hücre, görünür oyun görseli sınırı, gösterim ölçeği ve atlas ölçüsü farklı bilgilerdir.
- **Varlık türüne uygun değerlendirme:** Sürüm ve bağlam yönetimi ortaktır; kalite kontrolleri ve kullanım testleri varlık profiline göre değişir.
- **İnsan kararını koruma:** Otomasyon kanıt ve öneri sunar. Sanatsal kararlar, bağlamı etkinleştirme ve geri alınamayan işlemler kullanıcı tarafından yapılır.
- **Oyun motorundan bağımsız paket kullanma:** Motorlara özel çıktılar, motordan bağımsız paketten üretilir. Hiçbir oyun motoru verilerin asıl kaynağı olmaz.
- **Tekrarlanabilir ve ayrışma güvenli teslimat:** Dışa aktarım ayarları sürümlenir; tekrar teslim kullanıcı tarafından başlatılır ve hedefteki açıklanamayan değişiklikleri sessizce ezmez.

### Belge sözleşmesi

Bu PRD ürünün sağlaması gereken davranışların kanonik kaynağıdır. [Domain sözlüğü](../CONTEXT.md) kavramların anlamını, ADR’ler geri çevrilmesi zor kararların gerekçesini, teknik tasarım belgeleri ise davranışların hangi altyapı ve modüllerle gerçekleştirileceğini tanımlar. Bu kaynaklar arasında çelişki bulunduğunda biri sessizce üstün sayılmaz; çelişki birlikte çözülmeden değişiklik tamamlanmış sayılmaz.

Bağlayıcı gereksinimler konu bazlı, kararlı kimlik taşır. Kimlikler metin başka bölüme taşındığında değişmez. **Örnek** açıklayıcıdır; **Gerekçe** kararın nedenini açıklar; **Açık Doğrulama** ise ürün iddiasını kapatmak için gereken kanıta [Bölüm 9](11-open-validations.md) üzerinden bağlanır. Bunların hiçbiri kimlikli gereksinimin yerine geçmez.

| Önek | Gereksinim alanı |
| --- | --- |
| `CTX` | Proje Bağlamı ve kural yetkisi |
| `AST` | Varlık kimliği, aile, kayıt ve yaşam döngüsü |
| `DIM` | Görsel Dünya ve ölçü modeli |
| `AUT` | Kullanıcı yetkisi ve insan kapıları |
| `IMP` | Referans, üretim ve içe aktarma |
| `QLT` | Kalite profilleri, kanıt ve kullanım testleri |
| `VER` | Birim, bileşim, çalışma dosyası ve arşiv sürümleri |
| `EXP` | Dışa aktarım, hedef ve teslimat |
| `PLT` | Platform davranışı ve çevrimdışı hazırlık |
| `OPS` | Dayanıklılık, güvenlik, performans ve uyumluluk |

## 2. Kapsam ve ürün sınırları

**AST-01 — Destek seviyeleri.** Ürün her 2D Görsel Varlık türü için **Genel Varlık Desteği** sunar: varlıkları saklar, sürümlerini ve ilişkilerini yönetir, genel inceleme ve dışa aktarma olanağı sağlar. Buna ek olarak [Bölüm 4.9](05-asset-profiles.md#49-varlık-türüne-özel-profiller)’da açıklanan sekiz varlık grubu, türe özgü metadata, kalite kanıtı ve kullanım testleri içeren **Özel Varlık Profilleri** alır. Bütün olası varlık türlerine özel profil sağlamak ürünün tamamlanma koşulu değildir.

**AST-02 — Tam Ürün Kapsamı.** Bu PRD tek ve değişmeyen Tam Ürün Kapsamını tanımlar; MVP, v1 veya v2 adıyla kapsam katmanları oluşturmaz. [Bölüm 12](14-validation-phases.md)’deki Doğrulama Aşamaları yalnız bağımlılık ve kanıt sırasıdır; hiçbir aşama ayrı ürün sürümü veya isteğe bağlı kapsam değildir. [Bölüm 11](13-decision-gates-and-research.md)’deki araştırma ve karar kapıları zorunlu olarak sonuçlandırılır; ancak kanıtın olumsuz olması, özelliği yapmama kararını geçerli sonuç hâline getirebilir. Tetikleyicisi oluşmayan koşullu araştırma uygulanamaz olarak kapatılabilir.

**Temel üretim akışı**, web ve masaüstü uygulamalarında baştan sona tamamlanabilmelidir. Her iki uygulama da bağlamı yönetme, içe aktarma, kalite kontrolü, onay, sürümleme, seçici düzeltme ve dışa aktarma işlerini aynı sonuca ulaştırır. Ekranların ve adımların birebir aynı olması gerekmez.

Ürünün sınırları şunlardır:

- Ürün kendi görsel üretim modelini sunmaz ve belirli bir üretim API’sini zorunlu tutmaz. ChatGPT arayüzünü otomatik olarak taramaz veya kullanıcı aboneliğini gayriresmî API gibi kullanmaz.
- Ürün tek kullanıcı içindir. Ekip rolleri, görev atama, yorum zincirleri, başka bir kişinin onayı, gerçek zamanlı ortak çalışma ve ekip faturalandırması kapsam dışındadır.
- Ürün Aseprite, Photoshop, Illustrator, Spine veya oyun motorunun yerini alan tam kapsamlı bir araç değildir. Son Dokunuş Piksel Düzenleyicisi’nin sınırları [Bölüm 4.11](06-scene-quality-and-pixel-editor.md#411-yapısal-düzenleme-ve-son-dokunuş-piksel-düzenleyicisi)’de açıklanır. Tam çizim, katman birleştirme, iskelet animasyonu veya seviye düzenleme araçları sunulmaz.
- Ürün görsel oyun varlıklarını ve bunlara doğrudan bağlı sunum ya da oyun içi metadata’yı yönetir. Müzik ve ses efektleri, oyun kodu, davranış betikleri, shader geliştirme ortamı, 3D model/rig/animasyon, tam seviye tasarımı ve genel oyun motoru proje yönetimi kapsam dışındadır.
- İlk zorunlu doğrulanmış motor bağdaştırıcısı Godot’tur. Unity, kendi referans proje sözleşmesini geçtiğinde ayrıca doğrulanmış statüsü kazanır; Tam Ürün Kapsamının tamamlanması için gerekli değildir. Açık oyun projesiyle sürekli çift yönlü eşitleme kapsam dışındadır. Kullanıcı tarafından başlatılan, hedef ayrışmasında duran tek yönlü teslimat yenilemesi bu sınırı değiştirmez.
- Mevcut bir oyun projesindeki dosyalar topluca İçe Aktarma Gelen Kutusu’na alınabilir. Desteklenen PNG/görsel sayfası ve belgelenmiş JSON sidecar verisi kullanıcıya bir Kaynak Metadata Eşleme Önerisi hazırlayabilir; ancak ürün klasör yapısından, dosya adlarından, sidecar verisinden veya motor kullanımından kendiliğinden Varlık Ailesi, üretim geçmişi, onay kanıtı ya da yetkili oyun içi anlam kurmaz. Zorunlu ilişkileri kullanıcı kesinleştirir.
- Tam Ürün Kapsamı yerel `.aseprite` dosyasını kayıpsız ayrıştırma veya yeniden yazma sözü vermez. Desteklenen zorunlu yüzey PNG ya da düzenli görsel sayfası ile Aseprite/TexturePacker gibi araçların belgelenmiş JSON sidecar çıktılarıdır. Diğer görsel dosyalar Genel Varlık Desteğiyle saklanabilir; türe özgü ayrıştırma yalnız Desteklenen Platformlar Tablosunda açıkça duyurulduğunda taahhüt edilir.
- Üretim kredisi veya sağlayıcı maliyeti muhasebesi panosu kapsam dışındadır. Ücret harcayabilen ya da yazabilen resmî bir bağlantı seçilmedikçe bağlantı başına harcama koruması ürün taahhüdü değildir.
- Üründeki geçerli ve yetkili kayıt bulutta tutulur. Çevrimdışı çalışma yalnızca çevrimdışı hazırlık çalışması kapsamındadır; ürün tam çevrimdışı kullanım sözü vermez.
- Web ve masaüstü zorunlu platformlardır. Telefon ve tablet desteği ya da bu platformlarda aynı işlevleri sunma şartı yoktur.
- Kendi sunucusunda barındırma kapsam dışındadır. Proje bağlamı dışında sürekli ve yetkili bir projeler arası stil paketi tutulmaz.

## 3. Temel üretim akışı

Kullanıcı üretim amacını ve proje bağlamını belirler, ardından ilgili Varlık Kaydını veya Varlık Ailesini açar. Sprite Anvil Çalışma Alanı bir Üretim Paketi hazırlar; kullanıcı bu bilgiyi ChatGPT’de veya başka bir üretim yüzeyinde kullanır. Manuel ChatGPT yolu her zaman geçerli referans akıştır.

Kullanıcı sonucu içe alıp inceler. Mevcut proje dosyalarında sistem desteklenen sidecar verisinden alan bazlı bir eşleme önerisi hazırlayabilir; kullanıcı zorunlu ilişkileri kesinleştirmeden öneri yetkili kayıt olmaz. Gerekirse kullanıcı seçtiği birim sürümünü düzeltir.

Kabul edilen sürüm, etkin gerekli öğeler listesine ve ilgili kullanım bağlamına göre doğrulanınca kullanıcı sürümlü bir Dışa Aktarım Profili ile oyun motorundan bağımsız paket veya doğrulanmış motor çıktısı oluşturur. Paket statik doğrulama malzemesi taşır. Aynı hedefe sonraki teslim kullanıcı tarafından başlatılır; hedef ayrışması çözülmeden dosya değiştirilmez.

Bu akışın bağlam, yetki, kalite, sürüm ve dışa aktarım gereksinimleri sonraki bölümlerde açıklanır.


