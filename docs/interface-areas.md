# Sprite Anvil — Arayüz Tasarım Planı

Bu belge, Paper'da hangi ekranların çizileceğini ve her ekranın hangi düzen şablonunu kullanacağını tanımlar. Davranışın kaynağı [PRD](prd/README.md)'dir; görsel kararların kaynağı aynı Paper dosyasındaki `Design Language` ve `Layout Templates` sayfalarıdır. Kaynaklar arasında çelişki varsa uygulamadan önce ilgili kaynaklarla birlikte açıklanır. Tasarıma başlamadan önce [Start Here](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY/p-8-0) sayfasındaki görev adımlarını ve mekanik denetimi okuyun.

## Paper'da üretim kuralları

1. **Bir satır, bir artboard.** Alan tablolarındaki her satır bir ekran artboard'udur. Artboard adı satırın kimliğiyle başlar ve artboard, bölümün Paper sayfasında durur. Açıklamalar artboard'un içine değil, yanındaki not artboard'una yazılır. Durumlar için ayrı dosya veya Paper sayfası açılmaz.
2. **Düzen sütunu.** Satırın şablonunu `Layout Templates` sayfasından verir. `A + B`, A şablonunun yuvasına B'nin yerleşiminin girdiğini gösterir. Kompakt (960) varyant yalnız satırda `+960` yazıyorsa ayrıca çizilir.
3. **Alt alanlar.** Alt numara bağlılığı gösterir (03.4.1, 03.4'ün içindedir); zorunlu işlem sırası değildir. Panel, sekme veya pencere olarak açılan alt alan, üst ekranın üzerinde açık hâliyle kendi artboard'unda çizilir. Aynı şablonu paylaşan kardeş alanlar (ör. 03.1, 03.2, 03.3) aynı şablondan ayrı artboard'lar olarak türetilir.
4. **Ekran aileleri.** Aynı bölümde, aynı şablonla aynı ekranı farklı içerik veya durumla üreten alanlar tek satır ve tek artboard'dur. Satır kimliği ardışık kardeşlerde aralık (`08.2.10–08.2.14`), üst ve alt alanda liste (`01.1, 01.1.1`) olarak yazılır. `Ortak` kısmı bir kez çizilir; her üye artboard içinde kendi kimliğiyle etiketlenir ve yalnız farklı olan kısmıyla gösterilir. Üyeye özgü kısıtlar ailede kaybolmaz. Şablonu veya bölümü farklı benzer alan aileye alınmaz; ortak tasarımı kendi satırından anar.
5. **Kimlikler.** Kimlikler yeniden numaralanmaz, silinmez ve başka alana devredilmez. Çapraz anmalar üye kimliğini kullanır.
6. **Ortak tasarımlar.** 00, 07 ve 08 bir kez tasarlanır ve 01–06'da kendi içerikleriyle kullanılır; ana arayüzler için ayrı silme, kurtarma, durum veya onay penceresi çizilmez. Aynı çerçeveyi tekrar eden hata, odak ve bekleme durumları, gerekli bağlam korunarak kompakt bileşen örnekleriyle gösterilebilir.
7. **Tokenlar ve bileşenler.** Ortak tokenlar dosya genelinde kullanılır. Aynı işi yapan bileşenler `Design Language` içinde tek specimen'dir; yeni specimen, PRD gereksinimi veya alan kimliği belirtilmeden eklenmez. Çoğaltılmış geometri canlı bağlantı değildir: ortak bir kontrol değişince önce kaynak örnek, sonra etkilenen ekranlar güncellenip karşılaştırılır.
8. **Dil.** Ürün ekranlarındaki etiketler [sözlükteki](CONTEXT.md) eşleşmiş Türkçe adlardır; ürün ekranlarında karışık dil kullanılmaz ve İngilizce yalnız kod, sözleşme ve test adlarında kalır. `Design Language` specimen etiketleri sözlüğün kanonik İngilizce adlarıyla yazılabilir; proje verisi (dünya, tema, kural adları) olduğu gibi kalır.
9. **Kod aktarımı.** Alanın artboard'u ve kullandığı ortak örnekler birlikte okunur. Yinelenen çerçeve ve kontroller kodda ortak bileşenlere ayrılır; Paper'daki her kopya ayrı uygulama bileşeni sayılmaz.
10. **Kapsam tamamlanma değildir.** Tablolar planlanan kapsamdır. Paper'da bir sayfanın veya alan haritasının bulunması, ekranların tasarlandığı, onaylandığı veya kodlandığı anlamına gelmez; mevcut artboard'lar ilgili görevde ayrıca kontrol edilir.

### Bütün ekranlarda uygulanacak kurallar

| Konu | Tasarımda gösterilecek |
| --- | --- |
| Erişilebilirlik | Klavye kullanımı, görünür odak, ekran okuyucu adları ve durum bildirimleri; yalnız renkle anlatılmayan durumlar, durdurulabilir animasyon ve azaltılmış hareket. |
| Web / masaüstü | Aynı iş sonucu; webde yükleme/indirme yolu. |
| Güvenli hata açıklaması | Beklenmeyen sunucu hatasında genel açıklama ve Destek Referansı; sunucuya ulaşmayan bağlantı hatasında üretilmiş gibi bir referans gösterilmez. Ham hata ayrıntıları ve sırlar gösterilmez. |

## Paper sayfaları

Aktif tasarım kaynağı, Paper'daki `Sprite Anvil` klasöründe bulunan [Sprite Anvil · Product](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY) dosyasıdır. Aşağıdakiler bu dosyanın sayfalarıdır; ayrı dosyalar veya uygulama route'ları değildir. Eski bağımsız `Design Language` ve `00 · Shared Shell` dosyaları yalnız arşivdir. `Archive · Before Consolidation` tasarım dosyalarının arşividir; üründeki 01.4 Proje Arşivi ile ilişkili değildir.

| Paper sayfası | Sahip olduğu tasarım |
| --- | --- |
| Start Here | Kaynak önceliği, görev adımları, Paper kılavuzu geçersiz kılmaları, mekanik denetim ve sayfa dizini. |
| Design Language | Ortak tokenlar, tipografi, kontrol hiyerarşisi, piksel kuralları ve bileşen specimen'leri. |
| Layout Templates | `T` önekli sayfa iskeletleri (yuvalar ve 1440/1280/960 varyantları). `T00`'ın kaynağı `00.0 · Master Screen Template` ortak çerçeve örneğidir; bu örnek ürün gereksinimi değildir. |
| 00 · Shared Shell | **00 Ortak çerçeve:** proje değiştirme, ana alanlar arasında gezinme ve işlem durumuna erişim. |
| 01 · Accounts & Projects | **01 Hesap ve Projeler:** giriş, proje seçme/oluşturma, arşivleme ve geri yükleme. |
| 02 · Project Context & Management | **02 Proje Bağlamı ve Yönetimi:** görsel kurallar, Temalar ve erişim izinleri. |
| 03 · Asset Library | **03 Varlık Kütüphanesi:** varlıkları bulma, aileleri ve ayrıntıları yönetme. |
| 04 · Production & Import | **04 Üretim ve İçe Aktarma:** üretim girdilerini hazırlama, dosyaları alma, denemeleri karşılaştırma. |
| 05 · Review & Quality Control | **05 İnceleme ve Kalite Kontrolü:** varlıkları sınama, düzeltme ve onay/ret kararı. |
| 06 · Delivery | **06 Teslimat:** hedef planlama, paket oluşturma, oyunda doğrulama ve teslimatı kaydetme. |
| 07 · Shared Operations | **07 Ortak işlemler:** çevrimdışı taslak, çakışma, işlem kurtarma ve kalıcı silme akışları. |
| 08 · Shared Pages & States | **08 Ortak sayfalar ve ekran durumları:** bulunamayan sayfa, erişim sorunu, yükleme, boş içerik, hata durumları ve ortak onay pencereleri. |

## 00. Ortak çerçeve

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 00.1 | Proje ve gezinme | Seçili projenin adı, proje değiştirme kontrolü ve 01.2 Projeler listesine dönüş. Proje Bağlamı, Kütüphane, Üretim, İnceleme ve Teslimat geçişleri; açık alanın seçili görünümü. | T00 |
| 00.2 | İçerik alanı | Ekran başlığı, seçili kaydın adı ve açık alanın konum yolu. Ana içerik, o kayda ait işlem kontrolleri ve bağlı alt alanlara geçişler. Alt görünümden üst kayda veya açıldığı listeye dönüş kontrolü. | T00 |
| 00.3 | Durum alanı | Bağlantı durumu (çevrimdışıyken 08.2.7) ve devam eden işlemlerin durumu (08.2.15); bir işlem seçildiğinde 07.2 ayrıntısı açılır. | T00 |
| 00.4 | Destek ve sınır bilgileri | Desteklenen tarayıcı, masaüstü, motor sürümü ve proje boyutu bilgileri. Yayımlanmış işlem/depolama sınırları ve destek değişikliği duyuruları; ilgili işlemde bu bilgilere erişim. | T09 |
| 00.4.1 | Destek kaldırma duyurusu ve dışa aktarma | Desteği kaldırılacak platform veya sürüm için önceden yapılan duyuru ve verilerin dışa aktarılacağı yol. | T08 |
| 00.5 | Hesap menüsü | Oturum açmış kullanıcının adı ve e-postası; oturumu kapatma kontrolü. Çıkış tamamlandığında 01.1 Giriş görünümü açılır. | T00 |

## 01. Hesap ve Projeler

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 01.1, 01.1.1 | Giriş ve hesap oluşturma | **Ortak:** Kimlik bilgisi formu, gönderim bekleme durumu ve başarısız gönderim açıklaması; başarılı gönderimden sonra 01.2 Projeler ekranı açılır.<br>**01.1 Giriş:** E-posta ve parola alanları, giriş kontrolü ve 01.1.1 görünümüne geçiş.<br>**01.1.1 Hesap oluşturma:** Ad, e-posta ve parola alanları; alan doğrulama ve kayıt hatası durumları; hesap oluşturma ve 01.1 görünümüne dönme kontrolleri. | T01 |
| 01.2 | Projeler | Proje adları ve her projeyi açma kontrolü. Yeni proje oluşturma ve Proje Arşivine geçiş; proje yoksa oluşturmayı yönlendiren 08.2.2 boş görünümü. | T00 (proje öncesi) + T02 |
| 01.3 | Yeni proje | Proje adı ve genel sanat yaklaşımı için giriş alanları. Projeyi oluşturma kontrolü, eksik/geçersiz alan açıklamaları ve oluşturulan projeye geçiş. | T01 + T04 |
| 01.4 | Proje Arşivi | Arşiv listesi, seçili arşivin içerik özeti ve indirme kontrolü. Bağlam, varlık, üretim, inceleme ve teslimat geçmişini kapsayan içerik seçimi; seçili çalışma dosyaları ve dışarıda kalan kanıtlar. Arşiv oluşturma, sonucunu izleme ve geri yüklemeye geçiş. | T00 (proje öncesi) + T02 |
| 01.4.1 | Bağımsız projeye geri yükleme | Geri yüklenecek arşivi seçme kontrolü, dosya/ilişki bütünlüğü sonucu ve eksik kanıt açıklamaları. Bağımsız proje oluşturma, işlem ilerlemesi ve tamamlanan yeni projeyi açma; mevcut proje üzerine yazılmaz. | T08 |
| 01.5 | Proje yönetimi | Açık projenin yönetim görünümü: 01.4 Proje Arşivine geçiş ve kalıcı silmeyi başlatma (07.3). | T04 |

## 02. Proje Bağlamı ve Yönetimi

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 02.1 | Proje Bağlamı | Etkin Bağlam Sürümü ve kapsamlarına göre gruplanmış kurallar. Seçili kapsamda devralınan ve geçerli olan kuralları görme; yeni öneri hazırlama, bekleyen önerileri açma, 02.1.3 sürüm geçmişine ve Stil Modüllerine geçiş. | T02 |
| 02.1.1 | Kural önerisi | Kural, kapsam, değer ve dayanak girilen yapılandırılmış öneri kontrolleri. Mevcut/önerilen kuralların farkları, taban sürüm, ajan/model veya kontrol kaynağı ve doğrulama sonucu. Aynı kuraldaki çakışmayı çözme; geçerli öneriyi inceleyip etkinleştirme. | T04 + T05 |
| 02.1.1.1 | Bağlam Kuralı İstisnası | Devralınan kural, yerine geçecek daha dar kapsamlı değer ve gerekçe. Kaynak kural zincirini ve etkilenen kapsamı görme; istisnayı Bağlam Önerisine dahil etme. Kalite İstisnası ayrı 05.1.2 alanındadır. | T04 |
| 02.1.2 | Stil Modülleri | Stil Modülleri, her modülün kuralları ve sürümleri. Palet, kontur gibi kuralları modülde gruplama; yeni modül sürümü hazırlama ve 08.3.4 ile başka projeye bağımsız kopyalama. Kopyayı alıcı projede Bağlam Önerisi olarak inceleme. | T02 |
| 02.1.3 | Bağlam sürüm geçmişi | Bağlam Sürümleri, etkin sürüm işareti ve seçili sürümün kuralları/istisnaları. Sürümler arasındaki değişiklikleri ve kaynak öneriyi açma; bu sürümü kullanan üretim kayıtlarına geçiş. | T02 + T05 |
| 02.2 | Görsel Dünyalar ve Temalar | Görsel Dünyalar ve her dünyaya bağlı Temalar. Oluşturma/düzenleme kontrolleri; seçili dünya veya Temanın kuralları ve bu kapsamın Proje Bağlamındaki karşılığı. | T02 |
| 02.3 | Bağlantılar ve izinler | Araç/ajan için izin durumu, amaç ve proje/veri kapsamı. İzin verme/geri alma; başlangıçta kapalı olan Harici Görsel Analizi için kategori, sağlayıcı, aktarılacak veri ve bilinen saklama koşulları. Henüz desteklenmeyen bağlantılar kullanılamaz olarak gösterilir. | T04 |
| 02.3.1 | Harici Görsel Analizi gönderim bildirimi | 08.3.1–08.3.4 ortak pencere yapısıyla, her gönderimden hemen önce 02.3'teki kategori, sağlayıcı, aktarılacak veri ve saklama bilgileri. Gönderme veya vazgeçme kontrolleri. | T10 |
| 02.4 | Ürün ölçümleri | Süre, başarı, koruma ve yarım kalan akış sonuçları; ölçüm kapsamı ve zaman aralığı. Farklı tanım sürümleri ayrı gösterilir; kullanılan Ölçüm Tanımını açma. | T09 |
| 02.4.1 | Ölçüm Tanımları | Tanımın kapsamı, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman aralığı ve saklama süresi. Yeni tanım sürümünü hazırlama, farklarını inceleme ve etkinleştirme. | T04 + T05 |

## 03. Varlık Kütüphanesi

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 03.1 | Kütüphane | Varlık önizlemeleri, adları, türleri ve Kayıt Durumları. Ad, tür, Tema, Görsel Dünya, ölçü, etiket ve Etkin/Arşivlenmiş filtreleri; ölçüyle eşleşen sürümü gösterme. 03.1.1 ile kayıt oluşturma, varlık seçildiğinde 03.4 ayrıntısını açma. | T02 |
| 03.1.1 | Yeni Varlık Kaydı | Ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Bağımsız Varlık Kaydı oluşturma; varsa aile bağlantısını 03.3.2 ile kurma. Görsel sonucu 04.2 içe aktarma akışıyla yeni Aday Sürüm olarak ekleme. | T04 + T10 |
| 03.2 | Koleksiyonlar | Koleksiyon listesi ve seçili koleksiyonun varlıkları. Koleksiyon oluşturma, üye ekleme/çıkarma ve bir üyeden aynı 03.4 Varlık ayrıntısına geçiş. | T02 |
| 03.3 | Varlık Ailesi | Aile listesi ve seçili ailenin üyeleri, Onaylı Ana Tasarımı, Türetilmiş Varlıkları ve eksik öğeleri. 03.3.2 ile aile/temsil ilişkisini kurma; aynı Varlık Kimliğindeki ayrı aileleri açma, bir üyeden 03.4 Varlık ayrıntısına ve Gerekli Öğeler Listesine geçiş. | T02 |
| 03.3.1 | Gerekli Öğeler Listesi | Gerekli yön, animasyon, durum, varyant ve kullanım testleri; her öğenin tamamlanma durumu. Öğe ekleme/düzenleme, gerekli/isteğe bağlı/uygulanamaz seçimi ve yeni liste sürümünü etkinleştirme. Eski liste sürümleri ile onları kullanan paketleri açma. | T04 |
| 03.3.2 | Aile ve temsil ilişkileri | Varlık Kimliği, Görsel Dünya ve kullanım bağlamı seçimleri; aile oluşturma ve üyeleri ilişkilendirme. Onaylı kesin Ana Tasarımı seçme, her Türetilmiş Varlığın kaynağını belirtme; farklı dünyadaki temsili ayrı aileye bağlama. | T04 |
| 03.4 | Varlık ayrıntısı | Büyük varlık önizlemesi; ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Geçerli görsel kurallar, perspektif, ölçüler, kesin Ana Tasarım, referans amaçları ve mevcut üretim hedefinin özeti; bu kayıt ve hedefle 04.1 paket hazırlığına geçiş. Onaylı Sürüm ve alternatifler; İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu ve Kayıt Durumu 08.2.16 rozetleriyle. Alt alanları açma, kaydı arşivleme veya yeniden etkinleştirme; kalıcı silmeyi 07.3 ile başlatma. | T03 |
| 03.4.1 | Oyun İçi Bilgiler | Seçili kare/görsel üzerinde pivot, zemin, sıralama, bağlantı noktaları (`mount point`) ve efekt başlangıç noktaları; vuruş, hasar alma ve çarpışma alanları ile olaylar. Katmanları gösterme/gizleme, noktaların koordinatlarını ve diğer değerleri düzenleme, kesin sürüm ve kare bağlantısını inceleme; bilinmeyen alanlar açıkça belirtilir. | T03 + T06 |
| 03.4.1.1 | Metadata paketi indirme | Seçili sürümün Oyun İçi Bilgiler ve animasyon metadata JSON paketini indirme; indirilen dosyayı yeniden okuyup doğrulama. | T08 |
| 03.4.2 | Sürümler ve dosyalar | Birim ve Birleşik Sürüm listeleri; her sürümün önizlemesi, inceleme durumu, kesin bileşim üyeleri ve dosyaları. Dosyaları inceleme; 03.4.2.3 ile iki sürümü karşılaştırma, seçili sürümü 05.1 incelemeye veya 05.3 düzenleyiciye açma. Yeni bileşim ve harici çalışma dosyasına geçiş. | T03 + T02 |
| 03.4.2.1 | Yeni bileşim oluşturma | Kaynak bileşimin birimleri ve seçilebilecek kesin Birim Sürümleri. Değişecek/korunacak birimleri karşılaştırma, üyeleri seçme ve eski bileşimi koruyarak yeni Birleşik Sürüm oluşturma. | T05 |
| 03.4.2.2 | Harici çalışma dosyası | Yönetilen Kopya ve masaüstündeki Canlı Dosya Bağlantısı durumu; dosyayı harici düzenleyicide açma. Algılanan değişikliği inceleyip PNG/WebP sonucunu yeni Aday Sürüme bağlama. Dosya bulunamaz veya erişilemezse yeniden seçme; webde dosya yükleme yolu. | T03 + T04 |
| 03.4.2.3 | Sürüm karşılaştırması | Aynı varlığın karşılaştırılacak iki kesin sürümü ve yan yana önizlemeleri. Ortak yakınlaştırma ve çok kareli içerikte kare seçimi; görsel, ölçü, Oyun İçi Bilgiler ve Bileşim Üyeliği farkları. Kaynak sürümleri veya seçilen sürümün 05.1 incelemesini açma. | T05 |
| 03.4.3 | Üretim kanıtları | Kaynak türü ve mevcut/eksik üretim kanıtları; bilinmeyen geçmiş açıkça belirtilir. Elle İçe Aktarma Kanıtında paket, gerçek talimat, kaynak yüzeyi ve sonuç dosyası; Sağlayıcı Üretim Kaydında mevcut ayrıntılar. Sağlayıcı, arayüz, model/sürüm, istenen/gerçekleşen ölçüler, tohum ve diğer üretim parametrelerini elle girme formu. Elle girilen değerleri Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları olarak bağlantı verisinden ayrı gösterme; boş sağlayıcı alanları Bilinmiyor kalır ve kullanıcı bildirimi tek başına onayı engellemez. Eski varlık için Geçmiş Varlık Beyanı girme. | T03 + T04 |
| 03.4.4 | Hak Kayıtları | Seçili varlık veya referansın Hak Kaydı: kaynak, hak sahibi/sağlayıcı, izin kapsamı, kısıt ve belirsizlik. Metin/URL ve dosya kanıtı ekleme; Belgelendi/Yalnız Beyan/Bilinmiyor/Kısıtlı seçimi. Önceki kaydı koruyarak yeni sürüm oluşturma; Ana Tasarım, referans ve bağımlı kaynakların ayrı hak geçmişlerini açma. | T03 + T02 |
| 03.4.5 | Bağımlılık bağlantıları | Varlığın kaynak Ana Tasarımı ve bağımlı olduğu kesin kayıtlar; kimlik, siluet, ekipman, palet, Tema, perspektif veya zamanlama türleri. Bağlantı ekleme/düzenleme, eksik bağımlılıkları görme ve 05.5 değişiklik etkisine geçiş. | T03 + T02 |
| 03.4.6 | Görsel ölçüler | Dosyadan doğrulanan Kaynak Görsel Ölçüsü; mantıksal çözünürlük, hücre, görünür içerik sınırı, gösterim ölçeği ve atlas ölçüleri için ayrı alanlar. Sınırın koordinat temeli ve önerilen/doğrulanmış değerler. Hazır veya özel kare/dikdörtgen ölçü girme; tam sayı olmayan gösterim ölçeğinde keskinlik uyarısı. | T03 + T04 |

## 04. Üretim ve İçe Aktarma

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 04.1 | Üretim Paketi | Hedef, etkin bağlam kopyası, kesin Ana Tasarım, ölçüler ve beklenen çıktı alanları. Korunacak/değişecek/kaçınılacak özellikleri ve sabit birimleri belirleme; referansları inceleyip Üretim Paketi oluşturma. Kesinleşen paketi 04.1.2 içinde açma. | T04 |
| 04.1.1 | Referans panosu | Yan yana referans görselleri, notlar ve her görselin hazır/özel kullanım amacı. Görsel ekleme, izinli/yasak aktarımı düzenleme ve çakışmayı çözme. Referansın 03.4.4 Hak Kaydını açma; kimlik sınırı değişecekse 02.1.1.1 istisnasına geçiş. | T06 |
| 04.1.2 | Üretim paketi ayrıntısı ve geçmişi | Değişmez Üretim Paketleri ve seçili denemenin sabitlenmiş bağlam, Ana Tasarım, referans, ölçü ve çıktı özeti. Paketi harici üretimde kullanmak üzere inceleme; paket özetini kopyalama, pakete bağlı Ana Tasarım ve referans görsellerini indirme kontrolleri. Doğal dil talimatını harici üretim yüzeyinde kullanıcı yazar. İlişkili sonucu 04.2 ile içe aktarma ve bağlı Aday Sürümün kanıtlarını açma. | T02 |
| 04.2 | İçe Aktarma Gelen Kutusu | Yapıştırma, sürükleme veya yükleme alanı; dosya önizlemeleri, kaynak türü ve her dosyanın aktarım sonucu. Desteklenmeyen/okunamayan dosya ve eksik kanıt açıklamaları. Mevcut dosyalar Üretim Paketi hazırlanmadan da içe alınabilir. Hedefsiz girdileri bekletme; 04.2.2 ilişkilendirmesine, metadata eşlemeye ve eksik kanıt için 03.4.3 üretim kanıtına geçiş. | T02 |
| 04.2.1 | Metadata eşleme | Görsel ve JSON sidecar için kare, süre, tag, slice, pivot, dokuz parça ve palet alanlarının kaynak/hedef karşılaştırması. Alan bazında tanılama ve çakışma çözümü; isteğe bağlı Bilinmiyor değerleri koruma. Yeni öneriyi önceki kullanıcı kararından ayrı kesinleştirme. | T05 |
| 04.2.2 | Hedef ilişkilendirme | Seçili girdinin görseli ve kaynak bilgisi yanında hedef Varlık Kaydı, yön/animasyon/durum veya birim seçimleri. Yeni kayıt gerekiyorsa aynı 03.1.1 formunu açma. Kullanıcı ilişkiyi kesinleştirince oluşan Aday Sürümü açma; onay için 05.1 kullanılır. | T04 |
| 04.3 | Üretim Deneyleri | Deney listesi; ortak üretim amacı belirleme ve her denemeye ayrı paket/Aday Sürüm ekleme. Sonuçları ve bağlam, Ana Tasarım, referans, talimat, ölçü, çıktı yapısı ve varsa üretim parametresi farklarını karşılaştırma. Seçim/sonuçsuzluk/bırakma kararı; deney seçimi varlığı onaylamaz. Öğrenimi 02.1.1 önerisine aktarma, ayrıştırılamayan nedenleri belirtme. | T02 + T05 |
| 04.4 | Üretim Tarifleri | Tarif listesi ve sürümler; seçilen deneyden tarif oluşturma. Talimat iskeleti, referans rolleri, çıktı yapısı ve sabit/doldurulacak alanları düzenleme. Güncel girdilerle paket hazırlama veya 08.3.4 ile başka projeye bağımsız kopyalama; eksik girdileri alıcı projede yeniden seçme ve kural çatışmalarını çözme. | T02 + T04 |

## 05. İnceleme ve Kalite Kontrolü

Kütüphane, aile ve teslimat engelleri bu bölümdeki aynı test ve inceleme ekranlarını açar.

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 05.1 | Sürüm incelemesi | Seçili kesin sürümün önizlemesi, kalite kanıtları, onay engelleri ve karar geçmişi. Önceki sürümle karşılaştırmak için aynı 03.4.2.3 görünümünü açma. Onay/ret/yeniden Aday seçimi ve gerekçe alanı; kullanıcı kararıyla yeni İnceleme Kaydı oluşturma. İnceleme, bağlama uygunluk, kalite ve kayıt durumları 08.2.16 rozetleriyle. | T03 |
| 05.1.1 | Toplu inceleme | Seçili sürümlerin yan yana önizlemeleri ve her öğenin kendi kanıtları/engelleri. Her uygun öğe için ayrı karar; engelli öğelerin nedenleri görünür kalır. | T05 |
| 05.1.2 | Kalite İstisnası | İstisnaya izin veren kural, gözlenen değer, kesin sürüm, kullanım kapsamı, Bağlam Sürümü ve Ana Tasarım. Gerekçe girme ve istisnayı kesinleştirme; bütünlük, zorunlu inceleme ve test kanıtı eksikliği istisnayla aşılmaz. | T10 + T04 |
| 05.2 | Profil testleri | Seçili sürümün türü, etkin profil sözleşmesi ve değerlendirme sonuçları. Uygun test alanını açma, kesin test girdilerini seçme ve kanıtları inceleme; özel profili olmayan tür için Genel Varlık Desteğine geçiş. | T02 |
| 05.3 | Son Dokunuş Piksel Düzenleyicisi | Üstte kaynak sürüm/aile ve taslak durumu; solda araçlar, ortada tuval, sağda sayısal ayarlar ve çok kareli içerikte altta kare şeridi. 1×/tam sayı yakınlaştırma ve şeffaflık zeminleri. Tuval yakınlaştırmasından bağımsız, sürekli görülebilen gerçek kullanım boyutu önizlemesi; 1×, 2× veya seçili tam sayı Gösterim Ölçeği. Geri al/yinele, yerel taslak kaydı ve “Bitir ve yeni Aday Sürüm oluştur” kontrolü. Piksel, karo ve sahne düzenlemesi için klavyeyle kullanılabilen eşdeğer görevler veya erişilebilir özellik paneli. | T07 |
| 05.3.1 | Piksel ve palet araçları | Kalem, silgi, renk seçici, çizgi ve kesin renk doldurma; seçim, kes/kopyala/yapıştır, piksele oturan taşıma, çevirme ve 90° döndürme. Kırpma, tuval ölçüsü ve tam sayı ölçekleme; palet kilidi, yabancı renkler ve toplu değişimde etkilenecek piksel sayısı. | T07 |
| 05.3.2 | Görsel sayfasını dilimleme | Hücre genişliği/yüksekliği, satır/sütun, başlangıç ofseti, boşluk ve okuma sırası alanları. Numaralı hücre sınırları ve oynatılabilir kare önizlemesi; kaynak görseli koruyarak dilimlemeyi çalışma taslağına uygulama. | T07 |
| 05.3.3 | Kare ve animasyon düzenleme | Kare şeridi; ekleme, çoğaltma, silme, dosyayla değiştirme ve sıralama kontrolleri. Kare süresi, X/Y ofseti, pivot ve koru işareti; oynat/durdur, döngü ve önceki/sonraki soluk kareler. Zemin hizasını karşılaştırma. | T07 |
| 05.3.4 | Fark ve seçici düzeltme | Orijinal/taslak farkını yan yana, üst üste veya durdurulabilir geçişle görme; değişen piksel/kare listesi, değişen piksel sayısı ve değişiklik sınır kutusu. Görsele yazılmayan ok, bölge ve notlar; sorunlu/korunacak birimleri 04.1 paketine aktarma. Dönen seçeneği taslağı ezmeden karşılaştırma. | T07 |
| 05.4 | Sahne Kalite Kontrol Alanı | Karo, arka plan, karakter, obje, gölge ve efekt için kesin sürüm seçip yerleştirilen sahne. Karakter hareketi, bekleme/yürüme/saldırı geçişleri, olay anı, katman/Y sırası ve kamera kontrolleri. Metadata katmanlarını gösterme; sonucu 05.2.1.2 ile kanıta bağlama. | T06 |
| 05.5 | Yeniden doğrulama | Değişen kural veya Ana Tasarım; doğrudan/dolaylı etkilenen varlıklar ve etki nedenleri. 05.5.2 ile değişiklik kapsamını belirtme; etkilenen sürümü yeniden incelemeye veya düzeltmeye açma. Yeniden Doğrulama Gerekli 08.2.16 rozetiyle gösterilir. | T02 |
| 05.5.1 | Tarihsel bileşim | Geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtı seçimleri. Kesin tarihsel bileşim için uyumluluk raporu ve çözülemeyen engeller; bu seçim güncel yeniden doğrulama ihtiyacını kaldırmaz. | T04 |
| 05.5.2 | Değişiklik kapsamı | Değişen Bağlam Sürümleri veya eski/yeni Ana Tasarım; etkilenen kimlik, siluet, ekipman, palet, Tema, perspektif ve zamanlama seçimleri. Kullanıcının Değişiklik Tanımını kaydetmesi; eşleşen doğrudan/dolaylı bağımlılıkları 05.5 listesinde görme. | T04 |

### 05.2 değerlendirme alanları

05.2.1 ortak test çerçevesi bir kez tasarlanır; 05.2.2–05.2.10 bu çerçeveyi türe göre uyarlar ve yalnız türe özgü farklarını tanımlar.

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 05.2.1 | Ortak test çerçevesi | Bütünlük, ölçülebilir gereksinim, uyarı, insan incelemesi ve kullanım testi sonuçları ayrı gruplar. Her sonuçtan kural, şüpheli kare/bölge ve kanıta geçiş. 05.2.1.1 sözleşmesini açma; 05.2.1.2 ile test ve kullanıcı değerlendirmesini kaydetme. | T06 |
| 05.2.1.1 | Özel Profil Sözleşmesi | Sözleşme sürümleri; metadata alanları, kural sınıfları, zorunlu insan incelemesi/kullanım testleri, istisna izni ve dışa aktarım eşlemeleri. Geçerli sürümü inceleyip etkinleştirme; yeni kurallardan etkilenen kanıtları görme. | T02 |
| 05.2.1.2 | Değerlendirme ve test kanıtı | Kesin varlık/birim/bileşim, profil sürümü, test ortamı ve kanıtlar. Otomatik sonuçları inceleme; zorunlu insan değerlendirmesi ile Geçti/Başarısız/Sonuçsuz kullanım testi sonucunu kaydetme. Tutarlılık/yanlış uyarı geri bildirimi ve önceki değerlendirmeler. | T04 |
| 05.2.2 | Karakter ve animasyon | Ana Tasarım ve yön önizlemeleri, zaman çizgisi ve kareye bağlı bilgiler. Eşzamanlı oynatma, 1× görünüm, soluk kareler ve değişken süre kontrolleri; döngü/geçiş, pivot, zemin, bağlantı noktası ve olay zamanlarını karşılaştırma. | T06 |
| 05.2.3, 05.2.3.1 | Obje ve ekipman | **Ortak:** Obje/ekipmanın test görünümü; ölçek, pivot, zemin ve sıralamayı karşılaştırma.<br>**05.2.3 Obje ve ekipman:** Durum ve yön önizlemeleri; durum geçişlerini oynatma ve bağlantı noktalarını karşılaştırma.<br>**05.2.3.1 Nesne yerleşim sahnesi:** Nesnenin onaylı karakterin yanında, proje ızgarasında ve farklı zeminlerde yerleştirildiği kullanım sahnesi. | T06 |
| 05.2.4 | İkon | İkonun kaynak, mantıksal ve gerçek kullanım ölçülerindeki önizlemeleri; aile üyeleri yan yana. Açık/koyu zemin ve gri tonlama seçenekleri; siluet, iç boşluk, ışık, kontur ve durum/nadirlik renklerini karşılaştırma. | T06 |
| 05.2.5 | Efekt | Efektin tek başına ve sahibiyle birlikte önizlemesi; hücre sınırı ve zaman çizgisi. Zemin, şeffaflık, süre/döngü, başlangıç noktası ve katman kontrolleri; taşmayı ve oyun olayıyla eşzamanlamayı inceleme. | T06 |
| 05.2.6 | Karo ve doku | Karo testi ve doku tekrarı için ayrı görünümler. Karo atlası ve boyanabilir haritada köşe/kenar/koridor/dolgu/rastgele yerleşim; sorunlu karoyu seçme. Dokuda 2×2, 3×3 ve kaydırmalı tekrar; kesin kenar eşleşmesi ile görünür tekrar izini ayrı inceleme. | T06 |
| 05.2.7 | Arka plan | Arka plan katmanları, hedef görüntü oranı, kırpma ve oyuncu güvenli alanı. Katman sırası, göreli hız ve kaydırma kontrolleri; döngü birleşimi, kontrast ve oyuncu görünürlüğünü hareket halinde inceleme. | T06 |
| 05.2.8 | Oyun arayüzü varlıkları | Aynı ailede ekran, panel ve bileşenler; normal, üzerine gelme, basılı, devre dışı, seçili, açık/kapalı durumlar. Durum ve hedef ölçü seçimi; paneli farklı boyutlarda germe, dokuz parça paylarını ve metin güvenli alanını görme. Düzeltilen bileşeni ekran yerleşiminde sınama. | T06 |
| 05.2.9 | Portre, logo ve tanıtım | Portre ve logo/tanıtım için ayrı kullanım görünümleri. Portrede ifade, Ana Tasarım bağı ve diyalog/arayüz kırpması; logo/tanıtımda hedef ölçü, güvenli alan, açık/koyu zemin ve şeffaf/opak kullanım. Kimlik ve küçük boyut okunurluğunu karşılaştırma. | T06 |
| 05.2.10 | Genel Varlık Desteği | Özel profili olmayan yazı tipi, imleç ve yardımcı görsellerin kayıt/dosya bilgileri ve uygun önizlemesi. Temel bütünlük sonuçlarını ve kullanıcı incelemesini açma; türe özgü test kanıtı iddia edilmez. | T03 |

## 06. Teslimat

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 06.1 | Hedef ve Hazırlık Planı | Teslimat Hedefleri ve her hedefin etkin sürümü, amacı, kapsamı ve Hazır/Engelli durumu. Hedef oluşturma veya seçme; 06.1.1 hedef tanımını ve 06.1.2 Hazırlık Planını açma. Hazır/Engelli ve Teslim Edildi 08.2.16 rozetleriyle. | T02 |
| 06.1.1 | Teslimat Hedefi tanımı | Amaç, gerekli aileler/liste sürümleri, Bağlam Sürümü, kullanım testleri ve kabul koşulları. Üretim Kanıtı/Hak Kanıtı Politikaları ile gerekli çalışma zamanı ortamlarını seçme. Yeni tabana geçerken kapsam, kural ve tamamlanma farklarını inceleme; taslağı yeni hedef sürümü olarak etkinleştirme ve geçmiş sürümleri açma. | T04 + T05 |
| 06.1.2 | Hazırlık Planı | Etkin hedefin engelleri, eksik kanıtları ve bir düzeltmeyle açılacak işler. Hedef zorunluluğu, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçeler; iş sırasını değiştirme ve her engelden ilgili düzeltme alanına geçiş: eksik varlık 03'e, kalite engeli 05'e, hak kaydı 03.4.4'e. | T02 |
| 06.2 | Profil ve paket | Paket girdilerinden önce 06.2.2'de seçilen Dışa Aktarım Profili sürümü, kesin varlık/birim/bileşim girdileri ve paket içerik özeti. Bağlam, gerekli liste, üretim/hak/kalite kanıtı ve istisna seçimlerini inceleme; engelleri çözme ve paket oluşturma. Sonucu 06.2.3 paket ayrıntısında açma. | T03 |
| 06.2.1 | Paket doğrulama | Doğrulanacak paketi seçme ve Paket Doğrulama Kitinin şema, dosya özetleri, README ve sürümünü görme. Ağ olmadan doğrulamayı başlatma; eksik/uyuşmayan dosya, yinelenen yol ve bozuk kayıt bağlantısı sonuçlarını inceleme. | T08 |
| 06.2.2 | Dışa Aktarım Profili | Profil sürümleri; yerleşim, padding, trim, ölçek, biçim ve adlandırma alanları. Metadata eşlemelerinde alan kimliği, birim ve koordinat sistemi; bilinmeyen/eksik alan davranışı. Ayarları yeni profil sürümü olarak kaydetme ve pakette kullanılacak sürümü seçme. | T04 |
| 06.2.3 | Paket ayrıntısı ve geçmişi | Değişmez paket listesi; seçili paketin manifesti, dosya yolları/özetleri, sabitlenmiş sürümleri, kanıtları ve istisnaları. Paketi ve Doğrulama Kitini indirme; 06.2.1 doğrulamasına, Godot çıktısına, oyun testine veya teslimat konumuna geçiş. | T02 |
| 06.3 | Godot çıktısı | Kaynak Dışa Aktarım Paketi, desteklenen Godot ve bağdaştırıcı sürümü, üretilecek dosyalar. Motor çıktısını oluşturma/indirme; kare, pivot, zamanlama, olay ve geçerli karo/arayüz eşlemelerini inceleme. Gerçek oyun testine 06.4 ile geçiş. | T03 + T08 |
| 06.4 | Oyunda doğrulama | Kesin paket, oyun yapısı, motor/bağdaştırıcı sürümü ve doğrulama geçmişi. Görüntü, video, test sonucu veya gözlem ekleme; elle/izinli araç kaynaklarını ayırma. Geçti/Başarısız/Sonuçsuz sonucunu, başarısızlık kaynağını ve etkilenen kapsamı kesinleştirme. | T03 + T04 |
| 06.5 | Güvenli yenileme | Seçili konum, paket ve Teslimat Yenileme Kilidi. İlk teslimat için 06.5.1; sonraki yenilemede değişmemiş/güncellenecek/bayat/eksik/ayrışmış yollar. Farkı inceleyip koruma, başka konum veya açık değiştirme kararı; uygulanan ve durdurulan yolları ayrı görme. Webde değişiklik paketini, kilidi ve ayrışma raporunu indirme; masaüstünde izinli klasöre yenilemeyi uygulama kontrolleri. | T05 |
| 06.5.1 | İlk teslimat ve konum seçimi | Uygulanacak kesin paket ve teslimat konumu; masaüstünde klasör seçimi/erişim izni, webde indirilecek paket ve elle uygulama yolu. İlk uygulamayı başlatma; yazılan göreli yolları, oluşan Teslimat Yenileme Kilidini ve varsa kısmi başarısızlığı görme. | T08 |
| 06.6 | Teslimatı kesinleştirme | Hazır hedefin gereksinimleri ve her birini karşılayan kesin paket/sürümler ile gerekli kullanım/çalışma zamanı kanıtları. Eksik veya örtüşen eşlemeleri çözme; geçerli seçimlerle Teslimat Gerçekleşmesini kesinleştirme. | T05 |
| 06.6.1 | Teslimat geçmişi | Teslimat Gerçekleşmesi listesi; kayıt ayrıntısını veya karşılaştırılacak iki kaydı seçme. Eklenen/çıkarılan/değişen varlıklar, bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemeleri ayrı fark grupları. İlgili kesin kayıtları açma. | T02 + T05 |
| 06.6.2 | Tarihsel Risk Bildirimleri | Etkilenen geçmiş teslimatlar, riskli kaynak, yeni Hak Kaydı sürümü, sabitlenmiş politikayla uyuşmazlık ve saptama zamanı. Kaynak hak kaydını veya teslimat ayrıntısını açma; geçmiş Teslim Edildi sonucu korunur. | T02 |

## 07. Ortak işlemler

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 07.1 | Çevrimdışı çalışma ve çakışma | Cihazdaki yerel taslaklar, bağlı oldukları proje/kaynak sürüm ve kayıt durumları. Taslağı yeniden açıp çalışmaya devam etme; bağlantı dönünce güncel tabanı kontrol etme. Bulut ilerlemişse 07.1.1 Çakışma çözümünü açma; çevrimdışı taslak bulut kararı sayılmaz. | T02 |
| 07.1.1 | Çakışma çözümü | Taban sürüm, güncel bulut ve yerel taslağın üçlü karşılaştırması. Yeni Aday Sürüm oluşturma, bulutu koruyup taslağı saklama veya 08.3.2 ile açıkça bırakma seçenekleri. Bağlam, inceleme ve teslimat gibi kesin kararlar için güncel bulut tabanında yeni karar oluşturma; seçilen çözümün kesin sonucu. | T05 |
| 07.2 | İşlem durumu ve kurtarma | Arşivleme, geri yükleme, paket oluşturma, doğrulama ve silme için ortak işlem listesi; kimlik, tür, kapsam, durum, ilerleme, denemeler ve kesin sonuç. Bağlantı döndüğünde güncel sonucu bulma; başarısız işte güvenli yeniden deneme ve uygun işte iptal isteme. İptal isteği ile kesin iptal sonucu ayrı gösterilir. | T02 + T08 |
| 07.3 | Kalıcı silme | Varlık ve arşiv silme için aynı akış, farklı kapsamla. Silinecek kayıtlar, Yönetilen Kopyalar, bütün paket/arşivler ve etkilenen teslimatların kapsamı/sayıları. Kapsam dışı kopyalar, geri alınamaz sonuç ve yedek saklama takvimi; içeriksiz Silme Kaydı bırakma seçimi. Kesin dökümü 08.3.3 ile onaylama; başladıktan sonra 07.3.1 sonucunu açma. | T08 |
| 07.3.1 | Silme sonucu ve makbuz | 07.2 ortak işlem görünümüyle silme ilerlemesi; etkin depo temizliği ve yedeklerden kaldırma takvimi. İçeriksiz Silme Makbuzunu açma, kapsam dışında kalan kopyaları ve varsa oluşturulan içeriksiz Silme Kaydını görme. | T08 |

## 08. Ortak sayfalar ve ekran durumları

08.1 **sayfalar** bütün içerik alanını kaplar; 08.2 **ekran durumları** mevcut ekranın veya panelin yuvasını doldurur; 08.3 **onay pencereleri** ekranın üzerinde açılır. Çakışma çözümü, işlem kurtarma ve silmenin ayrıntılı akışları 07'ye, işlem durumuna giriş kontrolü 00.3'e aittir; 08 yalnız bunların ortak görünümünü verir.

| Alan | Tasarım | Ekranda ne bulunacak? | Düzen |
| --- | --- | --- | --- |
| 08.1.1–08.1.4 | Ortak durum sayfaları | **Ortak:** İçerik alanını kaplayan durum başlığı, açıklama ve güvenli çıkış kontrolü.<br>**08.1.1 404 — Sayfa bulunamadı:** Geçersiz adres açıklaması ve Projeler ekranına dönüş.<br>**08.1.2 Erişim reddedildi:** Erişim reddi açıklaması ve erişilebilir projelere dönüş; korunan proje bilgisi, içerik veya önizleme gösterilmez.<br>**08.1.3 Oturum sona erdi:** Yeniden giriş gerektiği açıklaması ve 01.1 Giriş'e geçiş; varsa yerel taslağın kayıt durumu görünür kalır.<br>**08.1.4 Sayfa yüklenemedi:** Güvenli yeniden yükleme ve Projeler ekranına dönüş; beklenmeyen sunucu hatasında Destek Referansı gösterilir. | T00 (durum dolgusu) |
| 08.2.1 | Loading — Yükleniyor | Liste, ayrıntı veya önizleme alanında yükleme göstergesi ve içeriğin yerini koruyan yer tutucular. Yüklenen bölüm ile kullanılabilir içerik ayırt edilir. | Yuva dolgusu |
| 08.2.2–08.2.3 | Boş içerik ve sonuçsuz arama | **Ortak:** Gösterilecek kayıt olmadığını açıklayan mesaj ve sonraki adım kontrolü.<br>**08.2.2 Boş içerik:** Henüz içerik olmadığı; ekranın bağlamına göre proje/koleksiyon oluşturma, varlık içe aktarma veya teslimat hazırlama işlemine geçiş.<br>**08.2.3 Arama sonucu bulunamadı:** Arama/filtrelerle eşleşen kayıt olmadığı; mevcut arama ve filtreler görünür kalır, aramayı değiştirme veya filtreleri temizleme kontrolleri. | Yuva dolgusu |
| 08.2.4–08.2.6 | İçerik gösterilemedi | **Ortak:** Gösterilemeyen içeriğin yuvasında açıklama ve güvenli sonraki adım.<br>**08.2.4 Kayıt bulunamadı:** Seçilen proje, varlık veya sürümün görüntülenemediği açıklaması ve ilgili listeye dönüş; yetkisiz kişiye özel kaydın bilgileri verilmez.<br>**08.2.5 Önizleme yüklenemedi:** Görselin yerinde önizleme hatası ve güvenli yeniden deneme; erişilebilir kayıt bilgileri ve diğer kullanılabilir alanlar görünür kalır.<br>**08.2.6 Veri yükleme hatası:** Başarısız liste/panel içinde aynı okumayı yeniden çalıştıran kontrol; beklenmeyen sunucu hatasında Destek Referansı gösterilir, diğer bölümler kullanılabilir kalır. | Yuva dolgusu |
| 08.2.7 | Bağlantı kesildi / çevrimdışı | Bağlantı kesintisi bildirimi, yerel taslağın 08.2.11 durumu ve kullanılabilir çevrimdışı işlemler. Taslak/çakışma yönetimi için 07.1 geçişi; bulutta kesinleşmeyen sonuç açıkça belirtilir. | Yuva dolgusu |
| 08.2.8 | Form doğrulama hatası | Eksik veya geçersiz alanın yanında düzeltme açıklaması. Girilmiş değerler korunur; kullanıcı sorunlu alanı düzelterek işlemi tekrar gönderebilir. | Yuva dolgusu |
| 08.2.9 | İşlem engellendi | İşlemi engelleyen koşul ve düzeltme yolu. Eksik kanıt, kalite engeli ve bilinmeyen sözleşme sürümü ayrı belirtilir. Desteklenmeyen platform/biçim veya kapasite sınırında ilgili sınır ve 00.4 bilgilerine geçiş gösterilir. | Yuva dolgusu |
| 08.2.10–08.2.14 | Kayıt durumu bildirimi | **Ortak:** İlgili kaydın adıyla yazma durumunu bildiren tek bildirim yeri; üyeler bu bildirimin durumlarıdır.<br>**08.2.10 Kaydediliyor:** Devam eden kayıt; kesin sonuç alınana kadar başarı mesajı gösterilmez.<br>**08.2.11 Yerel taslak kaydedildi:** Taslağın bu cihazda saklandığı; bulut kaydının henüz kesinleşmediği açıkça gösterilir, taslağı incelemeye erişim.<br>**08.2.12 Bulut kaydı tamamlandı:** Bulut kaydının tamamlandığı ve güncel kayıt durumu; kesinleşen sonucu ilgili kayıtta görme.<br>**08.2.13 Kaydedilemedi:** Yalnız yazmanın gerçekleşmediği doğrulanmışsa hata açıklaması ve güvenli sonraki adım; taslak ve girilmiş içerik korunur.<br>**08.2.14 İşlem sonucu belirsiz:** Sonucun henüz doğrulanamadığı açıklaması ve güncel durumu sorgulama eylemi; başarı/başarısızlık ilan edilmez, aynı yazmayı tekrar gönderen işlem sunulmaz. | Yuva dolgusu |
| 08.2.15 | İşlem ilerlemesi ve sonucu | Bekliyor, çalışıyor, tamamlandı, başarısız, iptal istendi ve iptal edildi bildirimleri. İlerleme veya kesin sonuç özeti; seçildiğinde 07.2 işlem ayrıntısı açılır. | Yuva dolgusu |
| 08.2.16 | Durum rozetleri | İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu, Kayıt Durumu, Yeniden Doğrulama Gerekli, Hazır/Engelli ve Teslim Edildi için ortak rozet; her rozet ikon, etiket ve renkle verilir. Durumlar birbirinden ayrı gösterilir: Hazır, Teslim Edildi sonucundan; Yeniden Doğrulama Gerekli, geçmiş onaydan ayrıdır. Değerler sözlükteki tanımlardan gelir (İnceleme Kararı: Aday/Onaylı/Reddedildi; Kalite Kontrol Durumu: Değerlendirilmedi/Engelli/İstisnalarla Hazır/Dışa Aktarıma Hazır; Kayıt Durumu: Etkin/Arşivlenmiş/Silinmiş). | Yuva dolgusu |
| 08.3.1–08.3.4 | Onay ve seçim penceresi | **Ortak:** İşlemin kapsamını ve sonucunu açıklayan pencere; açık kesinleştirme ve vazgeçme kontrolleri.<br>**08.3.1 Kullanıcı kararını onaylama:** Onay, istisna veya değişiklik kararının kapsamı, gerekçesi ve beklenen sonucu.<br>**08.3.2 Taslağı bırakma:** Bırakılacak yerel taslağın içeriği ve geri alınamayan sonuç; taslağı koruma veya açıkça bırakma.<br>**08.3.3 Kalıcı silme onayı:** 07.3'teki kesin dökümün kapsamı ve etkilenen içerik sayılarıyla onaylama; döküm değişirse yeni kapsam için yeniden onay gerekir.<br>**08.3.4 Hedef proje seçici:** Stil Modülünü (02.1.2) veya Üretim Tarifini (04.4) başka projeye bağımsız kopyalarken hedef proje seçimi; kopyanın alıcı projede sahibi alanın tanımladığı şekilde ele alındığı açıklaması. | T10 |
