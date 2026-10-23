# Sprite Anvil — Arayüz Tasarım Planı

Paper'da hangi artboard'ların çizileceğinin listesi. Ekranın içinde ne olacağını bu belge değil, [PRD](prd/README.md) ve ilgili [iş akışı aşaması](workflow/) belirler; tablolardaki **İş akışı** sütunu o aşamanın numarasıdır.

- **Paper dosyası:** [Sprite Anvil · Product](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY). Başlamadan önce `Start Here` sayfasını okuyun.
- **Görsel kararlar:** `Design Language` (renk, yazı, boşluk, bileşenler) sayfası. Ortak ekran kabuğu `00 · Shared Shell` sayfasındaki `00.0 · Shared screen template` bölümüdür; ekranın yerleşimi kabuğun içerik alanında, içeriğine göre kurulur.
- Kaynaklar çelişirse uygulamadan önce açıklanır.

## Kurallar

1. **Artboard adı** `Kimlik · Screen name` biçiminde İngilizcedir (ör. `03.2 · Asset detail`) ve bölümün Paper sayfasına çizilir. Tablolardaki Türkçe ekran adı bu belgenin etiketidir; artboard ile eşleşme kimlik üzerinden yapılır.
2. **Alt ekran** (`03.2.1`), üst ekranın içinden açılan sekme, panel veya penceredir; üst ekranın üzerinde açık hâliyle kendi artboard'unda çizilir.
3. **Görünüm**, aynı ekranın içerik veya durum farkıdır; numara almaz ve `08.2.7 › Kaydediliyor` gibi anılır. Aynı artboard'da etiketlenir; yerleşim belirgin değişiyorsa `Kimlik · Ekran — Görünüm` adlı ayrı artboard açılır.
4. **Ortak parçalar bir kez çizilir.** 00, 07 ve 08 diğer bölümlerde yeniden kullanılır; bölümlere ayrı silme, durum veya onay penceresi çizilmez. Aynı işi yapan bileşen `Design Language` içinde tek örnektir.
5. **Açıklamalar** ekranın yanındaki not artboard'una yazılır.
6. **Arayüz metni İngilizcedir.** Ürün etiketleri [sözlükteki](CONTEXT.md) İngilizce adlardır; Türkçe adlar PRD ve Türkçe ürün belgelerinde kullanılır.
7. **Her ekranda:** klavye ve görünür odak, ekran okuyucu adları ve durum duyuruları, yalnız renge dayanmayan durumlar, durdurulabilir animasyon ve azaltılmış hareket tercihine uyum, webde yükleme/indirme yolu, ham hata yerine güvenli açıklama ve sunucu hatasında Destek Referansı.
8. **Liste tamamlanma değildir.** Paper'da artboard bulunması, ekranın onaylandığı veya kodlandığı anlamına gelmez; onay durumu Paper yorumlarında tutulur.
9. **Kimlik değişirse** bu belge, Paper artboard adı ve artboard içindeki kimlik etiketi birlikte güncellenir.
10. **Genişlik:** Ekran görüntü alanı 1440 px genişliğindedir; artboard bunun dışında yalnız kimlik başlığı şeridi taşıyabilir. Panel veya pencere artboard'ları kendi içeriği kadar geniştir. Dar pencere düzeni ürün kararı bekler; karar verilene kadar ayrı genişlik artboard'u çizilmez.
11. **İçerik sütunu** ekranda görünenleri ve geçişleri listeler. Ürün kuralları, sınırlar ve izinler PRD'de kalır; bu belgede tekrarlanmaz.

## 00 · Ortak çerçeve

Paper sayfası: `00 · Shared Shell`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 00.0 | Ortak ekran şablonu | 00.1–00.5'in bir arada görünen kabuğu: solda proje rayı ve alan sütunu, ortada içerik alanı, sağda etkinlik şeridi. Diğer bölümlerin ekranları bu kabuğun 00.2 İçerik alanına çizilir. | — |
| 00.1 | Proje ve gezinme | Proje rayı: projeler, seçili proje, 01.2 Projeler'e dönüş ve 00.5 hesap menüsü girişi. Alan sütunu: seçili proje adı ve proje değiştirme; Kütüphane (03.1), Teslimat (06.1) ve Proje Bağlamı (02.1) geçişleri, açık alanın seçili görünümü; proje ayarlarına giriş proje değiştirici menüsündeki Proje ayarları bölümündedir; bölümde Proje Arşivi (01.4), Bağlantılar ve izinler (02.3) ve Proje ayrıntıları (01.5) bulunur. Proje açılınca Kütüphane (03.1) Varlıklar görünümüyle açılır ve proje için son açık kayıt sekmeleri geri yüklenir; ayrı bir proje özet ekranı yoktur. Üretim, etkinlik şeridindeki (00.3) Üretim düğmesinden 00.3.1 özetiyle açılır; tam sayfa 04.2'dir. İnceleme ekranları sürümden açılır (03.2.2, 03.2.2.3). | 01 |
| 00.1.1 | Komut paleti | Ctrl K ile açılır; proje, alan, kayıt ve komut arama; sonuçları klavyeyle seçip açma; Esc ile kapanır. | 01 |
| 00.2 | İçerik alanı | Açık kayıt sekmeleri (kapatılabilir); ekran başlığı, seçili kaydın adı ve konum yolu; ana içerik; kayda ait işlem kontrolleri; alt ekran geçişleri; üst kayda veya listeye dönüş; kaydın süreç adımları için yuva (adımları kaydı sahiplenen bölüm belirler). | — |
| 00.3 | Durum alanı | Etkinlik şeridi: Üretim, İşlem ve Destek düğmeleri ile bağlantı durumu (çevrimdışıyken 08.2.4). İşlem düğmesi devam eden işlemleri sağ panelde açar (08.2.7 › İşlem ilerlemesi); işlem seçilince 07.2 açılır. Üretim düğmesi 00.3.1'i, Destek düğmesi 00.4'ü açar. Görünümler: Şerit · İşlemler paneli. | 32, 34 |
| 00.3.1 | Üretim özeti | Üretim kuyruğu özeti: hazırlanan paketler, girdisi eksik ve sırada bekleyen varlıklar, bekleyen girdi sayısı; tam sayfa için 04.2 İçe Aktarma Gelen Kutusu geçişi. | 12 |
| 00.4 | Destek ve sınır bilgileri | Desteklenen tarayıcı, masaüstü, motor sürümü ve proje boyutu; yayımlanmış işlem/depolama sınırları ve destek değişikliği duyuruları; duyurudan 00.4.1 geçişi. Desteklenmeyen tarayıcıyla girişte 08.1 yerine 00.4 açılır. Görünümler: Yayımlanmış · Henüz yayımlanmamış (değeri yayımlanmamış parametrede “destek iddiası kapalı”, sınırsız anlamına gelmez). Yeni duyuru Destek düğmesinde yalnız işaretle belirir, çalışmayı kesmez. | 48 |
| 00.4.1 | Destek kaldırma duyurusu ve dışa aktarma | Desteği kaldırılacak platform veya sürüm için önceden duyuru ve verileri dışa aktarma yolu (Verileri dışa aktar → 01.4 Proje Arşivi › Arşiv oluşturma); 00.4'e dönüş. | 48 |
| 00.5 | Hesap menüsü | Kullanıcının adı ve e-postası, Hesap ayarları (01.6) girişi, oturumu kapatma; çıkıştan sonra 01.1 Giriş açılır. | 01 |

## 01 · Hesap ve Projeler

Paper sayfası: `01 · Accounts & Projects`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 01.1 | Giriş | Kimlik bilgisi formu; gönderim 08.2.7, alan hataları 08.2.5 ile; başarılı girişte 01.2 açılır. Giriş: e-posta, parola. Hesap oluşturma: ad, e-posta, parola. Görünümler: Giriş · Hesap oluşturma. Hesap oluşturma ve giriş gereksinimi PRD'de henüz yazılı değildir. | 01 |
| 01.2 | Projeler | Proje adları ve projeyi açma; 01.3 Yeni proje ve 01.4 Proje Arşivi geçişleri; her projeden 01.5 Proje ayrıntıları geçişi; proje yoksa 08.2.2 › Henüz içerik yok. Görünümler: Izgara · Liste. | 01 |
| 01.3 | Yeni proje | Proje adı ve genel sanat yaklaşımı alanları; oluşturma kontrolü, alan hataları 08.2.5 ile, oluşan projeye geçiş. | 03 |
| 01.4 | Proje Arşivi | Arşiv listesi, seçili arşivin içerik özeti, indirme ve 01.4.1 geri yüklemeye geçiş. Arşiv oluşturmada taşınacak içeriğin özeti (bağlam, varlık, üretim, inceleme ve teslimat geçmişi); isteğe bağlı çalışma dosyaları ve büyük ikili çalışma zamanı kanıtları seçimi; dışarıda kalan kanıtların kimliği ve özeti; sonucu 07.2'de izleme. Görünümler: Arşiv listesi · Arşiv oluşturma. | 44 |
| 01.4.1 | Geri yükleme | Geri yüklemenin bağımsız yeni proje oluşturduğu açıklaması; dosya/ilişki bütünlüğü sonucu, eksik kanıtlar, 08.2.7 › İşlem ilerlemesi ve yeni projeyi açma. Görünümler: Arşiv seçimi (listeden veya başka ortamda indirilmiş arşiv dosyasını yükleyerek) · Bütünlük kontrolü · Yeni projeyi açma. Geçersiz arşivde 07.2 › Başarısız ve kısmi proje kalmadığı bilgisi. | 44 |
| 01.5 | Proje ayrıntıları | Proje adını yeniden adlandırma ve genel sanat yaklaşımını düzenleme; genel sanat yaklaşımı proje metadata'sıdır, Proje Bağlamı kuralı değildir ve bağlama ancak 02.1.1 önerisiyle girer; alan hataları 08.2.5 ile; projeyi silme 07.3 Kalıcı silme akışını proje kapsamıyla başlatır (bu satırda ayrı silme akışı çizilmez); silinen projeden sonra 01.2 açılır. Proje yeniden adlandırma ve silme gereksinimi PRD'de henüz yazılı değildir. | 01, 45 |
| 01.6 | Hesap ayarları | Kullanıcının adını ve e-postasını düzenleme, parola değiştirme; alan hataları 08.2.5 ile, başarısızlıkta 08.2.7; 00.5 hesap menüsünden açılır, 00.5'e dönüş. Hesap kurtarma (parola sıfırlama, e-posta doğrulama) ürün kapsamı dışındadır. Hesap ayarları gereksinimi PRD'de henüz yazılı değildir. | 01 |

## 02 · Proje Bağlamı ve Ayarlar

Paper sayfası: `02 · Project Context & Management`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 02.1 | Proje Bağlamı | Etkin Bağlam Sürümü ve kapsamlara göre gruplanmış kurallar; seçili kapsamda devralınan ve geçerli kurallar; 02.1.1 yeni öneri ve bekleyen öneriler, 02.1.3 sürüm geçmişi, 02.1.2 Stil Modülleri ve 02.2 Görsel Dünyalar geçişleri. Etkin kural yoksa 08.2.2 › Henüz içerik yok ve 02.1.1'e yönlendirme (yeni proje). | 03 |
| 02.1.1 | Bağlam Önerisi | Mevcut ve önerilen kural farkları, taban sürüm, ajan/model, kontrol veya kaynak deney, doğrulama sonucu; Bağlam Ajanından öneri isteme ve serbest talimat verme. Görünümler: Hazırlama · Bekleyen öneriler · Öneri çakışması · İnceleme ve etkinleştirme · Ajan kullanılamıyor (bkz. **02.1.1 görünümleri**). | 03 |
| 02.1.1.1 | Bağlam Kuralı İstisnası | Devralınan kural, yerine geçecek dar kapsamlı değer ve gerekçe; kaynak kural zinciri ve etkilenen kapsam; istisnayı Bağlam Önerisine ekleme. | 03 |
| 02.1.2 | Stil Modülleri | Stil Modülleri, kuralları ve sürümleri; palet, kontur gibi kuralları gruplama; 08.3 › Hedef proje seçici ile başka projeye kopyalama. Görünümler: Modül listesi · Sürüm hazırlama · Sürüm inceleme. | 03 |
| 02.1.3 | Bağlam sürüm geçmişi | Bağlam Sürümleri, etkin sürüm işareti, seçili sürümün kural ve istisnaları; sürüm farkları, kaynak öneri ve bu sürümü kullanan üretim kayıtları. | 03 |
| 02.2 | Görsel Dünyalar ve Temalar | Görsel Dünyalar ve bağlı Temalar; oluşturma/düzenleme; seçili dünya veya Temanın kuralları ve Proje Bağlamındaki karşılığı. Aynı Görsel Dünya içinde yinelenen Tema adı 08.2.5 ile reddedilir; aynı ad farklı dünyalar altında ayrı görünür. 02.1'den ayrı bir düzenleme alanıdır; 02.1 üzerinden açılır. | 04 |
| 02.3 | Bağlantılar ve izinler | Araç/ajan başına izin durumu, amaç ve proje/veri kapsamı; izin verme/geri alma; reddedilen veya başarısız izin değişikliği 08.2.6 ve 08.2.7 ile gösterilir. Proje izni ile analiz kategorisi izni ayrı kontrollerdir (satır başına açık/kapalı; biri diğerine yayılmaz). Harici Görsel Analizinin varsayılan kapalı açık/kapalı durumu, kategori, sağlayıcı, amaç, aktarılan veri ve saklama koşulları; desteklenmeyen bağlantılar kullanılamaz görünür. | 02 |
| 02.3.1 | Harici Görsel Analizi gönderim bildirimi | 05.1 veya 05.2.1'deki analiz isteğinden 08.3 › Harici gönderim bildirimi ile açılır: kategori, sağlayıcı, amaç, aktarılacak veri ve saklama bilgisi; gönder veya vazgeç. Proje veya kategori izni kapalıysa gönderim sunulmaz; 02.3'e yönlendirme (izin ver). | 02 |
| 02.4 | Ürün ölçümleri | Ürün ekibine ait iç ekran; proje kullanıcısının gezinmesinde yer almaz. Takma adlı olaylardan süre, başarı, koruma ve yarım kalan akış sonuçları; ölçüm kapsamı ve zaman aralığı; tanım sürümüne göre ayrı sonuçlar, kullanılan Ölçüm Tanımını 02.4.1'de açma. Baseline ve hedef durumu; baseline yoksa yüzde yerine baseline eksik durumu. | 46 |
| 02.4.1 | Ölçüm Tanımları | 02.4 gibi ürün ekibine ait iç ekran. Tanımın kapsamı, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman aralığı, saklama süresi ve ölçümün hangi ürün kararında kullanılacağı; yeni sürüm hazırlama, fark inceleme, etkinleştirme. | 46 |

**02.1.1 görünümleri**

- **Hazırlama:** kural, kapsam, değer ve dayanak alanları; devralınan kural için 02.1.1.1 istisna geçişi. 04.3'ten gelen öneride kaynak deney, karşılaştırılan denemeler, kapsam seçimi ve etkilenen üretimlerle kural çakışmalarının önizlemesi.
- **Bekleyen öneriler:** taban sürümü ve kaynağıyla bekleyen öneriler.
- **Öneri çakışması:** çakışan kapsam veya referans çatışması ve çözümü; taban sürümü eskimiş ama anlamı korunarak uzlaştırılabilen öneride uzlaştırılmış sonucun gösterilmesi. Başka projeden kopyalanan Stil Modülü burada bağımsız bekleyen öneri olarak düşer.
- **İnceleme ve etkinleştirme:** fark ve doğrulama sonucuyla etkinleştirme; sözleşme geçişinden gelen sürüm de burada bekler. Veri yapısı hatası veya bilinmeyen zorunlu alan ya da ana sürüm etkinleştirmeyi engeller (08.2.6).
- **Ajan kullanılamıyor:** yapılandırılmış kontroller açık, serbest talimat devre dışı ve açıklamalı; neden ayrı gösterilir (izin geri alınmış → 02.3 geçişi · ajan yok).

## 03 · Varlık Kütüphanesi

Paper sayfası: `03 · Asset Library`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 03.1 | Kütüphane | Varlık önizlemeleri, adları, Varlık Kategorileri ve 08.2.8 › Kayıt Durumu rozetleri; seçilen varlık 03.2'de açılır; 03.1.1 Yeni Varlık Kaydı geçişi. Görünümler: Varlıklar · Koleksiyonlar · Varlık Aileleri (bkz. **03.1 görünümleri**). | 05, 07, 08 |
| 03.1.1 | Yeni Varlık Kaydı | Ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları; bağımsız kayıt oluşturma, aile bağlantısı için 03.1.3, görseli 04.2 ile Aday Sürüm olarak ekleme. | 06 |
| 03.1.2 | Gerekli Öğeler Listesi | Gerekli yön, animasyon, durum, varyant ve kullanım testleri ile tamamlanma durumları; gerekli/isteğe bağlı/uygulanamaz seçimi, yeni liste sürümü, eski sürümler ve onları kullanan paketler. Ajan veya profil varsayımından gelen liste taslağını etkin sürümün yanında inceleme ve etkinleştirme. | 15 |
| 03.1.3 | Aile ve temsil ilişkileri | Varlık Kimliği, Görsel Dünya ve kullanım bağlamı; aile oluşturma ve üye ilişkilendirme; Ana Tasarımı ve Türetilmiş Varlık kaynaklarını seçme; farklı dünyadaki temsili ayrı aileye bağlama. | 05 |
| 03.2 | Varlık ayrıntısı | Büyük önizleme ve kayıt alanlarını düzenleme (03.1.1 ile aynı alanlar; aileye bağlı kayıtta Görsel Dünya uyuşmazlığı 08.2.5 ile); geçerli kurallar, Görsel Dünya, Tema, perspektif, ölçü özeti (düzenleme 03.2.6), Ana Tasarım, kayda bağlı referans görselleri ve Referans Kullanım Amaçları (düzenleme 04.1.1) ve üretim hedefi özeti; aynı Varlık Kimliğindeki diğer ailelere (portre, ikon) geçiş, aileler birleşmez; bilinmeyen dosya adı, içerik özeti veya Ana Tasarım açıkça Bilinmiyor görünür; Onaylı Sürüm, alternatifler ve Türetilmiş Varlıklar, 08.2.8 durum rozetleri; 03.2.1–03.2.6 sekmeleri, 04.1'e geçiş, arşivleme ve arşivden etkinleştirme, 07.3 kalıcı silme. | 06, 45 |
| 03.2.1 | Oyun İçi Bilgiler | Seçili kare üzerinde pivot, zemin, sıralama, bağlantı ve efekt noktaları; vuruş, hasar ve çarpışma alanları, olaylar; katman göster/gizle, koordinat düzenleme; bilinmeyen alanlar açıkça belirtilir (eksik karar Bilinmiyor kalır); kullanım bağlamı yazma ve projedeki etkin Özel Profil Sözleşmesi revizyonunu seçme, sözleşmenin desteklediği alanlar, dışa aktarım hedefi ve eksik değer davranışı; etkin revizyon değişmişse yeni kayıt 08.2.6 çakışması olarak reddedilir; dönüş noktası gibi değerleri tamamlanmış kaynak metadata eşlemesinden aday olarak seçme ve her alanda kullanıcı girdisi ile kaynak referansı ayrımı; İncelemeyi kaydet (yalnız görsel yüklenmiş ve bağlantılar doğrulanmışsa açık), Bilgileri düzenle (yeni incelenmemiş kayıt üretir) ve Düzenlemeyi iptal et; kaydın incelenmiş/incelenmemiş durumu; düzenlemede veya paket yeniden okunurken kaybolan bağlantılar ve kayıp kare ya da kaynak kimliği bütünlük hatası olarak görünür, otomatik taşıma yapılmaz; 03.2.1.1 geçişi. Profil alanları için bkz. **03.2.1 profil alanları**; karakter/animasyon, obje, ikon, efekt ve karo için Oyun İçi Bilgiler bu ekranın ortak alanlarında düzenlenir; 05.2.1 profil görünümleri aynı değerleri yalnız inceler. | 19, 20–27 |
| 03.2.1.1 | Metadata paketi indirme | Seçili Birleşik Sürümün Oyun İçi Bilgileri içeren Animasyon Metadata Paketini (JSON) indirme; indirilen dosyayı yeniden okuyup doğrulama: en fazla 512 KiB dosya seçme kontrolü, yeniden okuma kayıtları değiştirmez, kayıp veya değişen bağlantılar bütünlük hatası olarak gösterilir. | 19, 20 |
| 03.2.2 | Sürümler ve dosyalar | Birim ve Birleşik Sürüm listeleri; önizleme, İnceleme Kararı, bileşim üyeleri ve dosyalar; 03.2.2.3 karşılaştırma, 05.1 inceleme, 05.3 düzenleyici, 03.2.2.1 ve 03.2.2.2 geçişleri. | 09 |
| 03.2.2.1 | Yeni bileşim oluşturma | Kaynak Birleşik Sürümün birimleri ve seçilebilir kesin Birim Sürümleri; değişecek/korunacak birimleri karşılaştırma; eski bileşimi koruyarak yeni Birleşik Sürüm oluşturma. | 09 |
| 03.2.2.2 | Harici çalışma dosyası | Yönetilen Kopya ve masaüstündeki Canlı Dosya Bağlantısı durumu; harici düzenleyicide açma, algılanan değişikliği PNG/WebP Aday Sürüme bağlama; dosya kaybolursa yeniden seçme, webde yükleme yolu. | 13, 48 |
| 03.2.2.3 | Sürüm karşılaştırması | Aynı varlığın iki kesin sürümü yan yana; ortak yakınlaştırma, kare seçimi; görsel, ölçü, Oyun İçi Bilgiler ve Bileşim Üyeliği farkları; 05.1 incelemesine geçiş. | 09, 17 |
| 03.2.3 | Üretim kanıtları | Üretim Kaynağı Türü, mevcut/eksik kanıtlar, bilinmeyen geçmiş; Elle İçe Aktarma Kanıtı ve Sağlayıcı Üretim Kaydı ayrıntıları; sağlayıcı, model, ölçü, tohum gibi değerleri elle girme (Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları, doğrulanmamış işaretiyle; boşlar Bilinmiyor); Geçmiş Varlık Beyanı: bilinen kaynak, kullanıcıyla ilişkisi, eksik geçmiş ve destekleyici kanıt. Elle İçe Aktarma Kanıtını tamamlama: paket, gerçek üretim talimatı ve kaynak yüzeyi girişi; eksik alanlar görünür. | 13 |
| 03.2.4 | Hak Kayıtları | Hak Kaydı: kaynak, hak sahibi/sağlayıcı, izin kapsamı, kısıt ve belirsizlik; metin/URL ve dosya kanıtı; Belgelendi/Yalnız Beyan/Bilinmiyor/Kısıtlı seçimi; eskisini koruyarak yeni sürüm ve Hak Kaydı sürüm geçmişi; sonuç, Ana Tasarım, referanslar ve bağımlı kaynaklar için ayrı Hak Geçmişi; 06.6.2 Tarihsel Risk Bildirimleri geçişi. | 14 |
| 03.2.5 | Bağımlılık bağlantıları | Kaynak Ana Tasarım ve bağımlı kesin kayıtlar; kimlik, siluet, ekipman, palet, Tema, perspektif, zamanlama türleri; bağlantı ekleme/düzenleme, eksik bağımlılıklar, 05.5'e geçiş. | 18 |
| 03.2.6 | Görsel ölçüler | Dosyadan doğrulanan Kaynak Görsel Ölçüsü; Mantıksal Çözünürlük, Hücre Ölçüsü, Görünür İçerik Sınırı (tanımlandığı alanla), Gösterim Ölçeği ve Atlas Ölçüsü için ayrı alanlar; önerilen ve doğrulanmış değerler ayrı işaretli, öneriyi onaylama; hazır/özel ölçü girme, tam sayı olmayan ölçekte keskinlik uyarısı. | 06 |

**03.1 görünümleri**

- **Varlıklar:** ad, Varlık Kategorisi, Tema, Görsel Dünya, ölçü, etiket ve Etkin/Arşivlenmiş/Silinmiş filtreleri (Silinmiş yalnız içeriksiz Silme Kayıtlarını gösterir); ölçü filtresinde eşleşen Varlık Sürümü satırda görünür.
- **Koleksiyonlar:** koleksiyon listesi, oluşturma ve adlandırma, üyeler; üye ekleme/çıkarma.
- **Varlık Aileleri:** üyeler, Ana Tasarım, Türetilmiş Varlıklar, eksik öğeler; 03.1.2 Gerekli Öğeler Listesi ve 03.1.3 aile ilişkileri geçişleri.

**03.2.1 profil alanları**

- **Arka plan:** katman sırası, doğal ölçü, hedef oran, göreli hız, döngü/kırpma ve güvenli alan.
- **Arayüz:** durum kimliği, doğal ölçü, germe payları ve metin güvenli alanı.
- **Portre ve tanıtım:** kullanım amacı, kırpma, güvenli alan ve arka plan çeşidi.

## 04 · Üretim ve İçe Aktarma

Paper sayfası: `04 · Production & Import`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 04.1 | Üretim Paketi | Hedef, Üretim Bağlamı Kopyası, kesin Ana Tasarım, ölçüler ve beklenen çıktı; korunacak/değişecek/kaçınılacak özellikler ve sabit birimler; referansları 04.1.1'de inceleyip paketi oluşturma, sonucu 04.1.2'de açma; çözülmemiş referans çakışmasında oluşturma 08.2.6 ile engelli ve 04.1.1'e dönüş; 04.3 deney ve 04.4 tarif geçişleri. | 11 |
| 04.1.1 | Referans panosu | Yapıştırma, sürükleme veya yüklemeyle referans ekleme; yan yana referans görselleri, notlar ve hazır/özel Referans Kullanım Amacı; izinli/yasak Referans Aktarım Kuralları, çakışma çözümü; referansın Hak Kaydı (03.2.4 ile aynı alanlar, referansa bağlı) ve kimlik sınırı değişirse 02.1.1.1 geçişi. | 10, 14 |
| 04.1.2 | Üretim Paketi ayrıntısı ve geçmişi | Değişmez Üretim Paketleri ve sabitlenmiş bağlam, Ana Tasarım, referans, ölçü, çıktı özeti; özeti kopyalama, görselleri indirme; sonucu 04.2 ile içe aktarma. | 11 |
| 04.2 | İçe Aktarma Gelen Kutusu | Yapıştırma, sürükleme veya yükleme alanı; dosya önizlemesi, Üretim Kaynağı Türü, aktarım sonucu; desteklenmeyen dosyada 08.2.6; eksik kanıt uyarısı ve tamamlanana kadar onaylanamaz işareti; paket olmadan da içe alma; bekleyen girdiler listesi: girdi, kaynak, öneri durumu ve ilişkilendirilmemiş işareti; 04.2.1, 04.2.2, 03.2.3, 04.1.2 paket geçmişi, 04.3 deney ve 04.4 tarif geçişleri. Görsel sayfası içe aktarılırken dilimleme kontrolleri 05.3 › Görsel sayfasını dilimleme ile aynıdır. Hedef açıkça seçiliyse (ör. 05.3 veya 03.2'den) girdi Gelen Kutusu girdisi oluşturmadan doğrudan o hedefin Aday Sürümü olur; 05.3'ten gönderilen düzeltme paketinin dönen sonucu burada alınır, karşılaştırma ve kabul 05.3 › Fark ve seçici düzeltme'dedir. Elle İçe Aktarma Kanıtı ve eksik kanıt uyarısı 03.2.3'te tamamlanır. Görünümler: Bırakma alanı · Hedefli içe aktarma · Bekleyen girdiler. | 12, 13 |
| 04.2.1 | Metadata eşleme | Görsel ve JSON sidecar için kare, süre, tag, slice, pivot, dokuz parça ve palet alanlarının kaynak/hedef karşılaştırması; alan bazında tanılama ve çakışma çözümü, Bilinmiyor değerleri koruma (Oyun İçi Bilgiler pivot veya tag'den türetilmez, Bilinmiyor kalır); eşlemeyi kesinleştirme kontrolü: sonucunda Aday Sürüm oluşur ve ilişki 04.2.2'de bağlanır. Kaynak biçim ve sürümü, kaynak ve sidecar özetleri; önerilen Varlık Ailesi ve Gerekli Öğeler bağları; tanınmayan alanlar korunmuş görünür; değişen sidecar yeniden alınınca önceki öneriyle görünür fark. | 12 |
| 04.2.2 | Hedef ilişkilendirme | Girdinin görseli ve kaynağı yanında hedef Varlık Kaydı, yön/animasyon/durum veya birim seçimi; hedef kayıt yoksa 03.1.1 formu; kesinleşince oluşan Aday Sürümü açma. | 12 |
| 04.3 | Üretim Deneyleri | Deney listesi, ortak amaç ve her denemeye ayrı Üretim Paketi/Aday Sürüm; sonuçları ve girdi farklarını karşılaştırma; birden çok girdi değiştiyse nedenin ayrılamadığı açıklaması; Seçim Yapıldı · Sonuçsuz · Bırakıldı kararı; öğrenimi kapsam ve yorumla 02.1.1 önerisine aktarma. | 30 |
| 04.4 | Üretim Tarifleri | Tarif listesi ve sürümleri; deneyden tarif oluşturma; talimat iskeleti, Referans Kullanım Amaçları, çıktı yapısı, sabit/doldurulacak alanlar; paket hazırlama veya 08.3 › Hedef proje seçici ile kopyalama; alıcı projede eksik girdileri yeniden seçme ve tarif ile etkin kural çakışmasını çözme, çözülene kadar paket 08.2.6 ile engelli. Görünümler: Tarif listesi · Alıcı projede yeniden çözme. | 31 |

## 05 · İnceleme ve Kalite Kontrolü

Paper sayfası: `05 · Review & Quality Control`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 05.1 | Sürüm incelemesi | Kesin sürümün önizlemesi, kalite kanıtları, onay engelleri ve karar geçmişi; güncel türetilmiş varlığı yeniden incelerken etkin Bağlam Sürümü, güncel Ana Tasarım ve kullanıcının gördüğü tüm Değişiklik Etkisi kayıtları sabitlenir, içerik düzeltmesi kararı Aday kaydıdır ve Yeniden Doğrulama Gerekli korunur, düzeltme 05.3 ve 03.2.2.1'e yönlendirilir; 03.2.2.3 ile karşılaştırma; onay/ret/yeniden Aday ve gerekçe; 08.2.8 durum rozetleri; 05.1.1 toplu inceleme, 05.1.2 Kalite İstisnası, 05.2 profil testleri ve 02.3.1 analiz isteği geçişleri. | 17 |
| 05.1.1 | Toplu inceleme | Seçili sürümler yan yana, her birinin kanıt ve engelleri; Onayla/Reddet/Aday yap kararı ve gerekçe için önizleme. Engeller iki grupta: bütünlük/eksik kanıt ve İstisna Verilebilir Gereksinim; engelli seçimde 08.2.6. Bütünlük grubundaki öğe düzeltilir veya seçimden çıkarılır; istisna verilebilir öğede 05.1.2 geçişi. Seçim değişince yeniden hesaplanmış önizleme; önizlemeden beri inceleme kararı değiştiyse işlem çakışmayla durur (08.2.6) ve önizleme yenilenir. | 17 |
| 05.1.2 | Kalite İstisnası | İzin veren kural, gözlenen değer, kesin sürüm, kullanım kapsamı, Bağlam Sürümü ve Ana Tasarım; gerekçe ve kesinleştirme. Mevcut ve tarihsel istisnalar kaydeden kullanıcı ve zamanla geçmişte görünür; sürümsüz eski istisnalar hazır olma hesabına katılmaz. | 16 |
| 05.2 | Profil testleri | Sürümün Varlık Kategorisi, etkin Özel Profil Sözleşmesi ve değerlendirme sonuçları; 05.2.1 test alanı, 05.2.3 Özel Profil Sözleşmesi, 05.4 sahne ve kesin test girdileri; özel profil yoksa 05.2.2'ye geçiş. | 16 |
| 05.2.1 | Test alanı | Bütünlük Denetimi, İstisna Verilebilir Gereksinim, Kalite Uyarısı, insan incelemesi ve kullanım testi sonuçları ayrı gruplar; her kuralın kimliği, sınıfı, kanıtı ve dışa aktarım etkisi; her sonuçtan kural, şüpheli kare/bölge ve kanıt; sözleşmede izin verilir işaretli İstisna Verilebilir Gereksinim sonuçlarından 05.1.2 Kalite İstisnasına geçiş (ölçümden önce veya eski ölçüm için istisna seçeneği sunulmaz); 05.2.1.1 geçişi; 02.3.1 analiz isteği, analiz kapalıyken yerel denetimler ve elle karşılaştırma; hareketli önizlemelerde durdurma. Her profil görünümü yalnız profile özgü kısmı gösterir (bkz. **05.2.1 profil görünümleri**). Görünümler: Karakter ve animasyon · Obje ve ekipman · Obje yerleşim sahnesi · İkon · Efekt · Karo ve doku · Arka plan · Arayüz varlıkları · Portre, logo ve tanıtım. | 02, 16, 20–27, 47 |
| 05.2.1.1 | Değerlendirme ve test kanıtı | Kesin Varlık Sürümü/Birim Sürümü/Birleşik Sürüm, profil sürümü, test ortamı ve kanıtlar; otomatik sonuçlar, insan değerlendirmesi, Geçti/Başarısız/Sonuçsuz kullanım testi; yanlış uyarı geri bildirimi ve önceki değerlendirmeler. | 16 |
| 05.2.2 | Genel Varlık Desteği | Yazı tipi, imleç ve yardımcı görseller için kayıt/dosya bilgisi ve önizleme; temel bütünlük ve kullanıcı incelemesi. | 06, 16 |
| 05.2.3 | Özel Profil Sözleşmesi | Sözleşme sürümleri; metadata alanları, kural kimliği, girdi, gözlenebilir sonuç, kanıt ve kapsam, kural sınıfları, zorunlu inceleme/testler, istisna izni ve dışa aktarım eşlemeleri; etkinleştirme ve etkilenen kanıtlar. Sürümü henüz olmayan kategori için de proje düzeyindeki Özel Profil Sözleşmeleri listesinden açılır (03.1 Varlık Aileleri görünümü ve aile ekranından yönetim bağlantısı). | 16 |
| 05.3 | Son Dokunuş Piksel Düzenleyicisi | Üstte kaynak sürüm/aile, durum/yön/animasyon adı, mantıksal ve hücre ölçüsü, taslak durumu; solda araçlar, ortada tuval, sağda ayarlar, altta kare şeridi; 1×/tam sayı yakınlaştırma, piksel ızgarası, şeffaflık zemini, pivot ve zemin çizgisi katmanları, sürekli gerçek boyut önizlemesi; geri al/yinele, yerel Çalışma Taslağı, yeniden oluşturulacak Birim Sürümleri ve yeni Birleşik Sürüm özetiyle “Bitir ve yeni Aday Sürüm oluştur”; piksel düzenlemesi için klavyeyle eşdeğer görevler. Görünümler: Piksel ve palet araçları · Görsel sayfasını dilimleme · Kare ve animasyon düzenleme · Fark ve seçici düzeltme. | 29, 32, 47 |
| 05.4 | Sahne Kalite Kontrol Alanı | Karo, arka plan, karakter, obje, gölge ve efekt için kesin sürüm seçilen sahne; ölçek ve okunurluk, hareket, bekleme/yürüme/saldırı geçişleri, olay anı, katman/Y sırası, kamera, oynatmayı durdurma; metadata katmanları; sonucu 05.2.1.1 kanıtına bağlama. Karo boyama ve sahne düzenlemesi için klavyeyle eşdeğer görevler veya erişilebilir özellik paneli. | 28, 47 |
| 05.5 | Yeniden doğrulama | Değişen kural veya Ana Tasarım; doğrudan/dolaylı etkilenen varlıklar ve nedenleri; 05.5.2 kapsam ve 05.5.1 tarihsel bileşim geçişleri; yeniden incelemeye (05.1) veya düzeltmeye (03.2.2.1, 05.3) açma; 08.2.8 › Bağlama Uygunluk Durumu rozeti. | 18 |
| 05.5.1 | Tarihsel bileşim | Geçmiş Bağlam Sürümü, kaynak Birleşik Sürüm, Özel Profil Sözleşmesi sürümleri, Ana Tasarım, bağımlılık ve kalite kanıtı seçimi; önceden kaydedilmiş değişmez uyumluluk raporlarını listeleme ve hazır/engelli durumu; uyumluluk raporu ve çözülemeyen engeller; seçimleri sabitleyip 06.2 paketlemeye geçiş, Yeniden Doğrulama Gerekli rozeti görünür kalır. | 18 |
| 05.5.2 | Değişiklik kapsamı | Değişen Bağlam Sürümleri veya eski/yeni Ana Tasarım; etkilenen kimlik, siluet, ekipman, palet, Tema, perspektif, zamanlama seçimi; Değişiklik Tanımını kaydetme. | 18 |

**05.2.1 profil görünümleri**

- **Karakter ve animasyon:** Ana Tasarım ve yön önizlemeleri, zaman çizgisi; eşzamanlı oynatma, 1×, soluk kareler, değişken süre, genel oynatma hızı, kareye hareket evresi işaretleme; döngü, pivot, zemin, bağlantı noktası ve olay zamanları; Kimlik ve Yön Tutarlılığı İncelemesini ve Animasyon Zamanlaması ve Geçişleri İncelemesini kaydetme (sonuç ön seçimsiz, gerekçeli); çarpışma alanı kontrolü, dönüş sırasındaki farklar, yönler arası zemin çizgisi sapması ve döngü başı/sonu karşılaştırması.
- **Obje ve ekipman:** En az iki Varlık Kaydı seçerek durum ve yön önizlemeleri, durum geçişlerini oynatma; bağlantı noktası, ölçek, pivot, zemin, sıralama; perspektif, malzeme dili ve durum/yön ayrışması gözlemleri.
- **Obje yerleşim sahnesi:** Obje onaylı karakterin yanında, proje ızgarasında ve farklı zeminlerde; ölçek, pivot, zemin, sıralama.
- **İkon:** Kaynak, mantıksal ve gerçek kullanım ölçüleri, aile üyeleri yan yana; açık/koyu zemin, gri tonlama; siluet, iç boşluk, ışık, kontur, ayrıntı yoğunluğu, arka plan/çerçeve yaklaşımı, durum/nadirlik renkleri; kullanım çeşidini kaydetme ve İkon Ailesi İnceleme Arşivini (JSON) indirme.
- **Efekt:** Fırlatılan nesne, gölge ve yüzey işaretleri dahil; tek başına ve sahibiyle önizleme, hücre sınırı, zaman çizgisi; açık, koyu, şeffaf ve gerçek oyun arka planı, şeffaflık, süre/döngü, başlangıç noktası, katman; taşma ve oyun olayıyla eşzamanlama.
- **Karo ve doku:** Atlas bölgeleri, arazi kimlikleri ve kenar bağlayıcılarını tanımlama; karo atlası ve boyanabilir haritada iç/dış köşe, kenar, koridor, dolgu, keskin geçiş ve rastgele yerleşim; karo boyama için klavye eşdeğeri; dokuda 2×2, 3×3 ve kaydırmalı tekrar; kenar eşleşmesi ile görünür tekrar izi ayrı; sorunlu karo veya bağlantıyı işaretleme ve kenar eşleşmesi sonucunu (Geçti/Başarısız/Sonuçsuz) ilgili karoya bağlama; pakete taşınan doku tekrar ayarı.
- **Arka plan:** Katmanlar, hedef oran, kırpma, oyuncu güvenli alanı; katman sırası, göreli hız, kaydırma; döngü birleşimi, kontrast ve oyuncu görünürlüğü hareket hâlinde; katman düzenini kaydetme, oyuncu silueti olarak kesin karakter sürümü seçme, başlat/duraklat/başa dön; döngü, birleşim izi, kırpma, kontrast ve oyuncu görünürlüğü için ayrı Geçti/Başarısız/Sonuçsuz sonucu (oynatılmadan kayıt yapılamaz); belirsiz yazma sonrası aynı kaydırma testini yeniden deneme.
- **Arayüz varlıkları:** Ekran, panel ve bileşenlerin normal/üzerine gelme/basılı/devre dışı/seçili/açık-kapalı durumları; doğal ölçü ve seçili hedef ölçüler, paneli germe, dokuz parça payları, metin güvenli alanı; ekran yerleşiminde sınama; hedef ve durum başına Geçti/Başarısız/Sonuçsuz sonucu ve gözlem kaydı, germe sınaması metadata dosyasını indirme.
- **Portre, logo ve tanıtım:** Portrede gerçek kullanım ölçüsünde ifade, Ana Tasarım bağı, diyalog/arayüz kırpması; logo/tanıtımda açılış ve mağaza gibi kullanımlar, kullanım amacına göre kırpma, hedef ölçü, güvenli alan, açık/koyu zemin, şeffaf/opak kullanım; küçük boyut okunurluğu.

**05.3 görünümleri**

- **Piksel ve palet araçları:** 1 piksel ve küçük tam sayı boyutlarında kalem ve silgi, renk seçici, çizgi, kesin doldurma; seçim, kes/kopyala/yapıştır, taşıma, çevirme, 90° döndürme; kırpma, tuval ölçüsü, tam sayı ölçekleme; palet kilidi, yabancı renkler, toplu değişimde etkilenecek piksel sayısı.
- **Görsel sayfasını dilimleme:** Hücre ölçüsü, satır/sütun, ofset, boşluk, okuma sırası; numaralı hücre sınırları ve oynatılabilir önizleme; kareleri yeniden birleştirme ve boşluk değiştirme; kaynak görsel korunur.
- **Kare ve animasyon düzenleme:** Kare şeridinde ekleme, çoğaltma, silme, dosyayla değiştirme, sıralama; kare süresi, X/Y ofseti, pivot; koru, değiştirilmiş ve sorunlu işaretleri; oynat/durdur, döngü, saydamlığı ayarlanabilir soluk kareler, zemin hizası.
- **Fark ve seçici düzeltme:** Orijinal/taslak farkı yan yana, üst üste veya geçişle; değişen piksel/kare listesi, sayısı ve sınır kutusu; görsele yazılmayan ok, bölge ve notlar; birimleri ve komşu kareleri 04.1 Üretim Paketine aktarma (sorun notu, işaretler, hedef Birim Sürümü ve komşu kareler pakette görünür); 04.2'den dönen harici sonucu mevcut taslağın üstüne yazmadan karşılaştırılabilir seçenek olarak alma, kabul veya ret ve kabulle yeni Birim/Birleşik Sürüm hazırlama.

## 06 · Teslimat

Paper sayfası: `06 · Delivery`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 06.1 | Hedef ve Hazırlık Planı | Teslimat Hedefleri, etkin sürüm, amaç, kapsam ve Hedef Hazırlığı; hedef oluşturma/seçme; 06.1.1, 06.1.2, 06.2 ve 06.6 geçişleri; 08.2.8 › Hedef Hazırlığı ve › Teslim Durumu rozetleri. | 35, 36, 41 |
| 06.1.1 | Teslimat Hedefi tanımı | Amaç, gerekli aileler/liste sürümleri, Bağlam Sürümü, kullanım testleri ve kabul koşulları; Üretim/Hak Kanıtı Politikaları ve çalışma zamanı ortamları; taban değişikliği farkları, yeni hedef sürümü ve geçmiş sürümler. Ajan veya kurallı sistemin hazırladığı hedef taslağını inceleme ve etkinleştirme; politika seçimleri ve çalışma zamanı kanıtının güncellik koşulları. | 35 |
| 06.1.2 | Hazırlık Planı | Engeller, eksik kanıtlar ve açılacak işler; zorunluluk, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçe; iş sırasını değiştirme; engelden düzeltme ekranına geçiş (03.2.3, 03.2.4, 05.1, 05.2, eksik veya bayat çalışma zamanı kanıtı için 06.4, Yeniden Doğrulama Gerekli için 05.5, Kalite İstisnası için 05.1.2, Gerekli Öğeler için 03.1.2). | 36 |
| 06.2 | Profil ve paket | 06.2.2'de seçilen profil sürümü, varsa Doğrulanmış Motor Bağdaştırıcısı sürümü seçimi ve pakete sabitlenmesi, kesin Varlık Sürümü/Birim Sürümü/Birleşik Sürüm girdilerini seçme ve içerik özeti; kullanıcı tarafından incelenmiş Oyun İçi Bilgileri (03.2.1) isteğe bağlı dahil etme; bağlam, liste, kanıt ve istisna seçimlerini inceleme, engelleri çözme, Dışa Aktarım Paketi oluşturma, sonucu 06.2.3'te açma; hedeflenen Teslimat Hedefi sürümü. Teslimat Hedefi olmadan başlatılan genel paket yolu: 03.2 ve 05.1'den “Pakete ekle” girişi 06.2'yi hedefsiz açar. | 37 |
| 06.2.1 | Paket doğrulama | Paket seçimi; Paket Doğrulama Kitinin şeması, dosya özetleri, README ve sürümü; ağsız doğrulama; eksik/uyuşmayan dosya, yinelenen yol, bozuk kayıt bağlantısı, çelişen README, bilinmeyen ana sürüm veya zorunlu alan sonuçları; çalıştırılamayan örnek eşlemeler. | 37 |
| 06.2.2 | Dışa Aktarım Profili | Profil sürümleri; yerleşim, padding, trim, ölçek, biçim ve adlandırma; metadata eşlemelerinde alan kimliği, birim, koordinat sistemi, bilinmeyen alan davranışı; yeni sürüm kaydetme ve seçme. | 37 |
| 06.2.3 | Paket ayrıntısı ve geçmişi | Değişmez paket listesi; manifest, dosya yolları/özetleri, sabitlenmiş sürümler, kanıtlar, istisnalar; paketi ve Paket Doğrulama Kitini indirme; 06.2.1, 06.3, 06.4, 06.5 geçişleri. Son dışa aktarım işaretini ve gösterdiği değişmez paketi görme, değiştirme. | 37 |
| 06.3 | Godot çıktısı | Kaynak Dışa Aktarım Paketi, desteklenen Godot ve bağdaştırıcı sürümü, üretilecek dosyalar; çıktıyı oluşturma/indirme; kare, pivot, zamanlama, olay, doku ayarları, karo/arayüz eşlemelerini inceleme; 06.4'e geçiş. | 38 |
| 06.4 | Oyunda doğrulama | Kesin paket, oyun yapısı, motor/bağdaştırıcı sürümü ve doğrulama geçmişi; görüntü, video, test sonucu veya gözlem ekleme, elle/izinli araç kaynağını ayırma; Geçti/Başarısız/Sonuçsuz, başarısızlık kaynağı (Kaynak Belirsiz dahil) ve kapsamı; düzeltmeyi yeni kayıt olarak ekleme; sistemin önerdiği kaynak ve bağdaştırıcı taslağı ile kullanıcının kesinleştirdiği kaynak sınıfı ayrı görünür. | 39 |
| 06.5 | Güvenli yenileme | Konum, paket ve Teslimat Yenileme Kilidi; değişmemiş/güncellenecek/bayat/eksik/ayrışmış yollar; koru, başka konum veya fark görünümünden sonra açık değiştir kararı; webde değişiklik paketi, kilit ve ayrışma raporunu indirme, masaüstünde izinli klasöre uygulama; uygulanan yollar ile durdurulan ayrışmaları ayıran sonuç raporu, kısmi uygulama tamamlanmış görünmez; ilk teslimatta 06.5.1. | 40, 48 |
| 06.5.1 | İlk teslimat ve konum seçimi | Kesin paket ve konum; masaüstünde klasör seçimi/izin, webde indirme ve elle uygulama; ilk uygulamayı başlatma; yazılan yollar, oluşan kilit ve kısmi başarısızlık sonuç raporunda. | 40, 48 |
| 06.6 | Teslimatı kesinleştirme | Hazır hedefin gereksinimleri ve karşılayan kesin paket/sürümler, kullanım ve çalışma zamanı kanıtları; eksik/örtüşen eşlemeleri çözme; Teslimat Gerçekleşmesini kesinleştirme. Sistemin hazırladığı eşleme taslağı; eksik ve çakışan kapsam vurgulu; 06.6.1 Teslimat geçmişi geçişi. | 41 |
| 06.6.1 | Teslimat geçmişi | Teslimat Gerçekleşmesi listesi; varlık, bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemelerinde ayrı fark grupları; eklenen, çıkarılan ve değişen Varlık Sürümleri ayrı; 06.6.2 geçişi. Paketi silinmiş gerçekleşme içeriksiz tarihsel kayıt olarak görünür. Görünümler: Kayıt ayrıntısı · Teslimat Farkı. | 42, 45 |
| 06.6.2 | Tarihsel Risk Bildirimleri | Etkilenen geçmiş teslimatlar ve kullanımları, riskli kaynak, yeni Hak Kaydı sürümü, politika uyuşmazlığı ve saptama zamanı; geçmiş Teslim Edildi sonucu yanında; hak kaydını veya teslimatı açma. | 43 |

## 07 · Ortak işlemler

Paper sayfası: `07 · Shared Operations`

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 07.1 | Çevrimdışı çalışma ve çakışma | Cihazdaki yerel Çalışma Taslakları, bağlı proje/kaynak sürüm ve eşitleme durumları; taslağa devam etme; bağlantı dönünce tabanı kontrol, bulut ilerlemişse 07.1.1; taban hâlâ güncelse taslağı normal kesinleştirme akışına alma. | 32 |
| 07.1.1 | Çakışma çözümü | Taban, güncel bulut ve yerel taslak üçlü karşılaştırması; yeni Aday Sürüm, bulutu koruyup taslağı saklama veya 08.3 › Taslağı bırakma; bilinmeyen zorunlu alan veya ana sürümde 08.2.6. Çözülmüş çakışmanın kaydı: seçim, zaman, kullanıcı ve oluşan Aday Sürüm kimliği; yeniden denemede aynı sonuç gösterilir. | 32 |
| 07.2 | İşlem durumu ve kurtarma | Arşiv, geri yükleme, paket, doğrulama ve silme için ortak işlem listesi: kimlik, tür, kapsam, durum, ilerleme, denemeler, kesin sonuç; iptal isteği ile kesin iptal ayrı; geri dönülmez aşamadan sonra iptal edilemeyip tamamlanan iş ayrı sonuç olarak görünür; Başarısız'da yeniden deneme uygunluğu ve kontrolü. Görünümler: Bekliyor · Çalışıyor · Tamamlandı · Başarısız · İptal İstendi · İptal Edildi · Teknik bilgi. Teknik bilgide tetikleyici ve durum geçişi geçmişi. | 34 |
| 07.3 | Kalıcı silme | 03.2'den Varlık Kaydı için veya 01.5'ten proje için başlatılır (proje silmede silinecek varlık, paket, arşiv ve teslimat sayıları dökümde); silinecek kayıtlar, Yönetilen Kopyalar, paket/arşivler ve etkilenen teslimat sayıları; kapsam dışı kopyalar, geri alınamazlık, yedek takvimi, içeriksiz Silme Kaydı seçimi; 08.3 › Kalıcı silme onayı, ardından 07.3.1. Silinecek içeriği gömen paket/arşivi kapsama ekleme veya iptal seçimi; yalnız seçili kopyalar silinirken kapsamlı temizleme olmadığı bilgisi. | 45 |
| 07.3.1 | Silme sonucu ve makbuz | 07.2 › Çalışıyor ile silme ilerlemesi; depo temizliği ve yedek takvimi; içeriksiz Silme Makbuzu, kapsam dışı kopyalar ve bağımlılıklar, varsa Silme Kaydı. | 45 |

## 08 · Ortak sayfalar ve ekran durumları

Paper sayfası: `08 · Shared Pages & States`. 08.1 bütün içerik alanını kaplar, 08.2 durumları ekranın ilgili bölümünü doldurur, 08.3 ekranın üzerinde açılır.

| Kimlik | Ekran | İçerik | İş akışı |
| --- | --- | --- | --- |
| 08.1 | Durum sayfası | İçerik alanını kaplayan başlık, açıklama ve güvenli çıkış. Erişim reddinde kayıt bilgisi içermeyen açıklama; oturum bitince yerel Çalışma Taslağı durumu görünür kalır; sunucu hatasında Destek Referansı. Görünümler: Sayfa bulunamadı (404) · Erişim reddedildi · Oturum sona erdi · Sayfa yüklenemedi. | 01, 47 |
| 08.2.1 | Yükleniyor | Liste, ayrıntı veya önizleme bölümünde yükleme göstergesi ve yer tutucular; yüklenen bölüm kullanılabilir içerikten ayırt edilir. | 47 |
| 08.2.2 | Boş içerik | Kayıt olmadığını açıklayan mesaj ve sonraki adım; arama sonucunda mevcut arama/filtreler görünür, değiştirme veya temizleme kontrolü. Görünümler: Henüz içerik yok · Arama sonucu yok. | 07, 47 |
| 08.2.3 | İçerik gösterilemedi | İlgili bölümde açıklama, Yeniden dene ve güvenli sonraki adım; diğer bölümler kullanılabilir kalır; sunucu hatasında Destek Referansı. Erişim yok görünümü boş sonuçtan ayırt edilir ve kayıt bilgisi içermez. Çevrimiçiyken sunucuya ulaşılamayan hatada bağlantı durumu ve güvenli sonraki adım gösterilir, Destek Referansı gösterilmez. Görünümler: Kayıt bulunamadı · Erişim yok · Önizleme yüklenemedi · Veri yüklenemedi · Sunucuya ulaşılamadı. | 07, 47 |
| 08.2.4 | Bağlantı kesildi | Kesinti bildirimi, yerel Çalışma Taslağı durumu ve kullanılabilir çevrimdışı işlemler; 07.1 geçişi; bulutta kesinleşmeyen sonuç açıkça belirtilir. | 32 |
| 08.2.5 | Form doğrulama hatası | Sorunlu alanın yanında düzeltme açıklaması; girilen değerler korunur ve yeniden gönderilebilir. | 47 |
| 08.2.6 | İşlem engellendi | Engelleyen koşul ve düzeltme yolu; eksik kanıt, kalite engeli, çözülmemiş referans çakışması ve bilinmeyen sözleşme sürümü ayrı; platform/biçim veya kapasite sınırında 00.4'e geçiş. | 47, 48 |
| 08.2.7 | Kayıt ve işlem bildirimi | Tek bildirim yeri, kayıt veya işlemin adıyla; Kaydedilemedi'de yeniden deneme; Sonuç belirsiz'de yeniden gönderme yerine güncel durumu kontrol etme yolu; İşlem ilerlemesi seçilince 07.2 açılır. Görünümler: Kaydediliyor · Yerel taslak kaydedildi · Bulut kaydı tamamlandı · Kaydedilemedi · Sonuç belirsiz · İşlem ilerlemesi. | 32, 33, 34, 47 |
| 08.2.8 | Durum rozetleri | Her rozet ikon, etiket ve renkle; durumlar birbirinden ayrı (Hazır ≠ Teslim Edildi, Yeniden Doğrulama Gerekli ≠ geçmiş onay). Değerler için bkz. **08.2.8 rozet değerleri**. Görünümler: İnceleme Kararı · Bağlama Uygunluk Durumu · Kalite Kontrol Durumu · Kayıt Durumu · Hedef Hazırlığı · Teslim Durumu. Durum değerleri tutan diğer ekranlar (06.4 doğrulama sonucu, 06.5 yol sınıfları, 07.2 işlem durumu) aynı rozet bileşenini kullanır; değerleri kendi satırlarında kalır, burada tekrarlanmaz. | 06, 16, 17, 18, 36, 41, 47 |
| 08.3 | Onay penceresi | İşlemin kapsamı ve sonucu, açık kesinleştirme ve vazgeçme; kalıcı silmede döküm değiştiyse yeniden onay adımı; hedef proje seçicide kopyanın alıcı projede nasıl ele alındığı; harici gönderim bildiriminin içeriği 02.3.1'dedir. Görünümler: Kullanıcı kararını onaylama · Taslağı bırakma · Kalıcı silme onayı · Hedef proje seçici · Harici gönderim bildirimi. | 02, 03, 31, 32, 45 |

**08.2.8 rozet değerleri**

- **İnceleme Kararı:** Aday · Onaylı · Reddedildi.
- **Bağlama Uygunluk Durumu:** Bağlama Uygun · Yeniden Doğrulama Gerekli.
- **Kalite Kontrol Durumu:** Değerlendirilmedi · Engel Var · İstisnalarla Hazır · Dışa Aktarıma Hazır.
- **Kayıt Durumu:** Etkin · Arşivlenmiş · Silinmiş.
- **Hedef Hazırlığı:** Hazır · Engelli.
- **Teslim Durumu:** Teslim Edildi · Teslim edilmedi (Teslimat Gerçekleşmesi yok; Hazır hedefte de bu değer görünür).
