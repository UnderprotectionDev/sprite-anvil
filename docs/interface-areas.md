# Sprite Anvil — Arayüz Tasarım Planı

Bu belge, Paper'da hangi ekranların çizileceğini ve her ekranın hangi düzen şablonunu kullanacağını tanımlar. Davranışın kaynağı [PRD](prd/README.md)'dir; görsel kararların kaynağı aynı Paper dosyasındaki `Design Language` ve `Layout Templates` sayfalarıdır. Kaynaklar arasında çelişki varsa uygulamadan önce ilgili kaynaklarla birlikte açıklanır. Tasarıma başlamadan önce [Start Here](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY/p-8-0) sayfasındaki görev adımlarını ve mekanik denetimi okuyun.

## Ekranlar nasıl okunur

1. **Ekran.** Her `###` başlığı bir ekrandır ve kimliği ekranın tek adresidir. Ekran, bölümünün Paper sayfasında çizilir; artboard adı `Kimlik · Ekran adı` ile başlar (ör. `03.2 · Varlık ayrıntısı`).
2. **Alt ekran.** Kimliğe eklenen numara, ekranın içinden açılan sekme, panel, pencere veya ayrı akışı gösterir (`03.2.1`, `03.2`'nin içindedir); işlem sırası değildir. Alt ekran, üst ekranın üzerinde açık hâliyle kendi artboard'unda çizilir.
3. **Görünüm.** Aynı ekranın içerik, durum veya mod farkları numara almaz. Ekranın altında önce **Ortak** kısım, sonra adlı görünüm maddeleri yazılır. Ortak kısım bir kez çizilir; görünüm aynı artboard'da adıyla etiketlenir. Yerleşimi belirgin biçimde değişen görünüm `Kimlik · Ekran — Görünüm` adlı ayrı artboard'da çizilir. Görünüme özgü kısıtlar kendi maddesinde kalır.
4. **Ekran mı, görünüm mü?** Aynı şablonla aynı işi farklı içerik veya durumla yapan şey görünümdür. Farklı iş yapan ya da farklı şablon kullanan şey ayrı ekrandır; aynı şablonu paylaşmak tek başına görünüm nedeni değildir.
5. **Anma.** Ekran kimlikle (`05.3`), görünüm kimlik ve adla (`08.2.7 › Yerel taslak kaydedildi`) anılır.
6. **Kimlik değişikliği.** Kimlikler bölüm içinde boşluksuz sıralanır. Bir kimlik değişirse aynı değişiklikte bu belgedeki anmalar, Paper artboard adları ve artboard içindeki kimlik etiketleri birlikte güncellenir.

## Paper'da üretim kuralları

1. **Düzen.** Her ekranın `Düzen` satırı şablonunu `Layout Templates` sayfasından verir. `A + B`, A şablonunun yuvasına B'nin yerleşiminin girdiğini gösterir. `Yuva dolgusu`, durumun bulunduğu ekranın yuvasını doldurduğunu gösterir. Kompakt (960) varyant yalnız düzende `+960` yazıyorsa ayrıca çizilir.
2. **Notlar.** Açıklamalar ekran artboard'una değil, yanındaki not artboard'una yazılır. Görünümler için ayrı dosya veya Paper sayfası açılmaz.
3. **Ortak tasarımlar.** 00, 07 ve 08 bir kez tasarlanır ve 01–06'da kendi içerikleriyle kullanılır; ana arayüzler için ayrı silme, kurtarma, durum veya onay penceresi çizilmez. Aynı çerçeveyi tekrar eden hata, odak ve bekleme durumları, gerekli bağlam korunarak kompakt bileşen örnekleriyle gösterilebilir.
4. **Tokenlar ve bileşenler.** Ortak tokenlar dosya genelinde kullanılır. Aynı işi yapan bileşenler `Design Language` içinde tek specimen'dir; yeni specimen, PRD gereksinimi veya ekran kimliği belirtilmeden eklenmez. Çoğaltılmış geometri canlı bağlantı değildir: ortak bir kontrol değişince önce kaynak örnek, sonra etkilenen ekranlar güncellenip karşılaştırılır.
5. **Dil.** Ürün ekranlarındaki etiketler [sözlükteki](CONTEXT.md) eşleşmiş Türkçe adlardır; ürün ekranlarında karışık dil kullanılmaz ve İngilizce yalnız kod, sözleşme ve test adlarında kalır. `Design Language` specimen etiketleri sözlüğün kanonik İngilizce adlarıyla yazılabilir; proje verisi (dünya, tema, kural adları) olduğu gibi kalır.
6. **Kod aktarımı.** Ekranın artboard'ları ve kullandığı ortak örnekler birlikte okunur. Yinelenen çerçeve ve kontroller kodda ortak bileşenlere ayrılır; Paper'daki her kopya ayrı uygulama bileşeni sayılmaz.
7. **Kapsam tamamlanma değildir.** Bu belge planlanan kapsamdır. Paper'da bir sayfanın, alan haritasının veya artboard'un bulunması, ekranın tasarlandığı, onaylandığı veya kodlandığı anlamına gelmez; mevcut artboard'lar ilgili görevde ayrıca kontrol edilir.

### Bütün ekranlarda uygulanacak kurallar

| Konu | Tasarımda gösterilecek |
| --- | --- |
| Erişilebilirlik | Klavye kullanımı, görünür odak, ekran okuyucu adları ve durum bildirimleri; yalnız renkle anlatılmayan durumlar, durdurulabilir animasyon ve azaltılmış hareket. |
| Web / masaüstü | Aynı iş sonucu; webde yükleme/indirme yolu. |
| Güvenli hata açıklaması | Beklenmeyen sunucu hatasında genel açıklama ve Destek Referansı; sunucuya ulaşmayan bağlantı hatasında üretilmiş gibi bir referans gösterilmez. Ham hata ayrıntıları ve sırlar gösterilmez. |

## Paper sayfaları

Aktif tasarım kaynağı, Paper'daki `Sprite Anvil` klasöründe bulunan [Sprite Anvil · Product](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY) dosyasıdır. Aşağıdakiler bu dosyanın sayfalarıdır; ayrı dosyalar veya uygulama route'ları değildir. Sayfalar bu sırayla okunur ve bu tablo Paper sayfa dizininin tek kaynağıdır. Sayfa adı, sırası veya sahipliği değişirse bu tablo ve Paper birlikte güncellenir. Eski bağımsız `Design Language` ve `00 · Shared Shell` dosyaları yalnız arşivdir. `Archive · Before Consolidation` tasarım dosyalarının arşividir; üründeki 01.4 Proje Arşivi ile ilişkili değildir.

| Paper sayfası | Sahip olduğu içerik |
| --- | --- |
| Start Here | Süreç: okuma sırası, kaynak önceliği, görev adımları, Paper kılavuzu istisnaları ve mekanik denetim (`Start Here · Okuma sırası ve görev adımları`). |
| Design Language | Değerler ve bileşenler: `DL · İçindekiler`, `DL 01 · Color`, `DL 02 · Color in context`, `DL 03 · Typography`, `DL 04 · Spacing`, `DL 05 · Components` ve bileşen düzeyindeki `DL 06 · Flow states`. Genişlik ve kompakt düzen burada tutulmaz. |
| Layout Templates | İskeletler: `T · Dizin` ile `T00`–`T10` ve 1440/1280/960 varyantları. Yuvalar, genişlikler, genişlik token'ları ve kaydırma `T00 · Notes` içindedir. Dizin şablonun amacını verir; şablonu kullanan ekranları bu belgedeki `Düzen` satırları tutar. `T00`'ın kaynağı 00 sayfasındaki `00.0 · Ortak ekran şablonu` örneğidir; bu örnek ürün gereksinimi değildir. |
| 00 · Shared Shell | [00. Ortak çerçeve](#00-ortak-çerçeve) |
| 01 · Accounts & Projects | [01. Hesap ve Projeler](#01-hesap-ve-projeler) |
| 02 · Project Context & Management | [02. Proje Bağlamı ve Yönetimi](#02-proje-bağlamı-ve-yönetimi) |
| 03 · Asset Library | [03. Varlık Kütüphanesi](#03-varlık-kütüphanesi) |
| 04 · Production & Import | [04. Üretim ve İçe Aktarma](#04-üretim-ve-içe-aktarma) |
| 05 · Review & Quality Control | [05. İnceleme ve Kalite Kontrolü](#05-inceleme-ve-kalite-kontrolü) |
| 06 · Delivery | [06. Teslimat](#06-teslimat) |
| 07 · Shared Operations | [07. Ortak işlemler](#07-ortak-işlemler) |
| 08 · Shared Pages & States | [08. Ortak sayfalar ve ekran durumları](#08-ortak-sayfalar-ve-ekran-durumları) |

## 00. Ortak çerçeve

Proje değiştirme, ana alanlar arasında gezinme ve işlem durumuna erişim.

### 00.1 · Proje ve gezinme

Düzen: `T00`

Seçili projenin adı, proje değiştirme kontrolü ve 01.2 Projeler listesine dönüş. Proje Bağlamı, Kütüphane, Üretim, İnceleme ve Teslimat geçişleri; açık alanın seçili görünümü.

### 00.2 · İçerik alanı

Düzen: `T00`

Ekran başlığı, seçili kaydın adı ve açık alanın konum yolu. Ana içerik, o kayda ait işlem kontrolleri ve bağlı alt ekranlara geçişler. Alt ekrandan üst kayda veya açıldığı listeye dönüş kontrolü.

### 00.3 · Durum alanı

Düzen: `T00`

Bağlantı durumu (çevrimdışıyken 08.2.4) ve devam eden işlemlerin durumu (08.2.7 › İşlem ilerlemesi); bir işlem seçildiğinde 07.2 ayrıntısı açılır.

### 00.4 · Destek ve sınır bilgileri

Düzen: `T09`

Desteklenen tarayıcı, masaüstü, motor sürümü ve proje boyutu bilgileri. Yayımlanmış işlem/depolama sınırları ve destek değişikliği duyuruları; ilgili işlemde bu bilgilere erişim.

### 00.4.1 · Destek kaldırma duyurusu ve dışa aktarma

Düzen: `T08`

Desteği kaldırılacak platform veya sürüm için önceden yapılan duyuru ve verilerin dışa aktarılacağı yol.

### 00.5 · Hesap menüsü

Düzen: `T00`

Oturum açmış kullanıcının adı ve e-postası; oturumu kapatma kontrolü. Çıkış tamamlandığında 01.1 Giriş açılır.

## 01. Hesap ve Projeler

Giriş, proje seçme/oluşturma, arşivleme ve geri yükleme.

### 01.1 · Giriş

Düzen: `T01`

**Ortak:** Kimlik bilgisi formu, gönderim bekleme durumu ve başarısız gönderim açıklaması; başarılı gönderimden sonra 01.2 Projeler açılır.

- **Giriş:** E-posta ve parola alanları, giriş kontrolü ve Hesap oluşturma görünümüne geçiş.
- **Hesap oluşturma:** Ad, e-posta ve parola alanları; alan doğrulama ve kayıt hatası durumları; hesap oluşturma ve Giriş görünümüne dönme kontrolleri.

### 01.2 · Projeler

Düzen: `T00 (proje öncesi) + T02`

**Ortak:** Proje adları ve her projeyi açma kontrolü. Yeni proje oluşturma ve Proje Arşivine geçiş; proje yoksa oluşturmayı yönlendiren 08.2.2 › Henüz içerik yok.

- **Izgara görünümü:** Projeler önizlemeli kartlarla.
- **Liste görünümü:** Projeler satırlarla.

### 01.3 · Yeni proje

Düzen: `T01 + T04`

Proje adı ve genel sanat yaklaşımı için giriş alanları. Projeyi oluşturma kontrolü, eksik/geçersiz alan açıklamaları ve oluşturulan projeye geçiş.

### 01.4 · Proje Arşivi

Düzen: `T00 (proje öncesi) + T02`

**Ortak:** Arşiv listesi, seçili arşivin içerik özeti ve indirme kontrolü; geri yüklemeye (01.4.1) geçiş.

- **Arşiv listesi:** Arşivler ve seçili arşivin özeti.
- **Arşiv oluşturma:** Bağlam, varlık, üretim, inceleme ve teslimat geçmişini kapsayan içerik seçimi; seçili çalışma dosyaları ve dışarıda kalan kanıtlar. Arşivi oluşturma ve sonucunu izleme.

### 01.4.1 · Geri yükleme

Düzen: `T08`

**Ortak:** Mevcut proje üzerine yazılmaz; geri yükleme her zaman bağımsız yeni proje oluşturur.

- **Arşiv seçimi:** Geri yüklenecek arşivi seçme kontrolü.
- **Bütünlük kontrolü:** Dosya/ilişki bütünlüğü sonucu ve eksik kanıt açıklamaları.
- **Yeni projeyi açma:** Bağımsız proje oluşturma, işlem ilerlemesi ve tamamlanan yeni projeyi açma.

### 01.5 · Proje yönetimi

Düzen: `T04`

Açık projenin yönetim görünümü: 01.4 Proje Arşivine geçiş ve kalıcı silmeyi başlatma (07.3).

## 02. Proje Bağlamı ve Yönetimi

Görsel kurallar, Temalar ve erişim izinleri.

### 02.1 · Proje Bağlamı

Düzen: `T02`

Etkin Bağlam Sürümü ve kapsamlarına göre gruplanmış kurallar. Seçili kapsamda devralınan ve geçerli olan kuralları görme; yeni öneri hazırlama, bekleyen önerileri açma, 02.1.3 sürüm geçmişine ve 02.1.2 Stil Modüllerine geçiş.

### 02.1.1 · Kural önerisi

Düzen: `T04 + T05`

**Ortak:** Mevcut ve önerilen kuralların farkları, taban sürüm, ajan/model veya kontrol kaynağı ve doğrulama sonucu.

- **Hazırlama:** Kural, kapsam, değer ve dayanak girilen yapılandırılmış öneri kontrolleri.
- **Bekleyen öneriler:** Henüz etkinleşmemiş öneriler ve her birinin doğrulama durumu.
- **Çakışma çözümü:** Aynı kuraldaki çakışan önerileri karşılaştırıp çözme.
- **İnceleme ve etkinleştirme:** Geçerli öneriyi inceleyip etkinleştirme.

### 02.1.1.1 · Bağlam Kuralı İstisnası

Düzen: `T04`

Devralınan kural, yerine geçecek daha dar kapsamlı değer ve gerekçe. Kaynak kural zincirini ve etkilenen kapsamı görme; istisnayı Bağlam Önerisine dahil etme. Kalite İstisnası ayrı 05.1.2 ekranındadır.

### 02.1.2 · Stil Modülleri

Düzen: `T02`

**Ortak:** Stil Modülleri, her modülün kuralları ve sürümleri. Palet, kontur gibi kuralları modülde gruplama.

- **Modül listesi:** Modüller ve seçili modülün kuralları; 08.3 › Hedef proje seçici ile başka projeye bağımsız kopyalama. Kopya alıcı projede Bağlam Önerisi olarak incelenir.
- **Sürüm hazırlama:** Yeni modül sürümünü hazırlama.
- **Sürüm inceleme:** Hazırlanan sürümün farklarını inceleme.

### 02.1.3 · Bağlam sürüm geçmişi

Düzen: `T02 + T05`

Bağlam Sürümleri, etkin sürüm işareti ve seçili sürümün kuralları/istisnaları. Sürümler arasındaki değişiklikleri ve kaynak öneriyi açma; bu sürümü kullanan üretim kayıtlarına geçiş.

### 02.2 · Görsel Dünyalar ve Temalar

Düzen: `T02`

Görsel Dünyalar ve her dünyaya bağlı Temalar. Oluşturma/düzenleme kontrolleri; seçili dünya veya Temanın kuralları ve bu kapsamın Proje Bağlamındaki karşılığı.

### 02.3 · Bağlantılar ve izinler

Düzen: `T04`

Araç/ajan için izin durumu, amaç ve proje/veri kapsamı. İzin verme/geri alma; başlangıçta kapalı olan Harici Görsel Analizi için kategori, sağlayıcı, aktarılacak veri ve bilinen saklama koşulları. Henüz desteklenmeyen bağlantılar kullanılamaz olarak gösterilir.

### 02.3.1 · Harici Görsel Analizi gönderim bildirimi

Düzen: `T10`

08.3 ortak pencere yapısıyla, her gönderimden hemen önce 02.3'teki kategori, sağlayıcı, aktarılacak veri ve saklama bilgileri. Gönderme veya vazgeçme kontrolleri.

### 02.4 · Ürün ölçümleri

Düzen: `T09`

Süre, başarı, koruma ve yarım kalan akış sonuçları; ölçüm kapsamı ve zaman aralığı. Farklı tanım sürümleri ayrı gösterilir; kullanılan Ölçüm Tanımını açma.

### 02.4.1 · Ölçüm Tanımları

Düzen: `T04 + T05`

Tanımın kapsamı, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman aralığı ve saklama süresi. Yeni tanım sürümünü hazırlama, farklarını inceleme ve etkinleştirme.

## 03. Varlık Kütüphanesi

Varlıkları bulma, aileleri ve ayrıntıları yönetme.

### 03.1 · Kütüphane

Düzen: `T02`

**Ortak:** Seçili kapsamın varlık önizlemeleri, adları, türleri ve Kayıt Durumları; bir varlık seçildiğinde 03.2 Varlık ayrıntısı açılır.

- **Varlıklar:** Projenin bütün varlıkları. Ad, tür, Tema, Görsel Dünya, ölçü, etiket ve Etkin/Arşivlenmiş filtreleri; ölçüyle eşleşen sürümü gösterme. 03.1.1 ile kayıt oluşturma.
- **Koleksiyonlar:** Koleksiyon listesi ve seçili koleksiyonun varlıkları. Koleksiyon oluşturma, üye ekleme/çıkarma.
- **Varlık Aileleri:** Aile listesi ve seçili ailenin üyeleri, Onaylı Ana Tasarımı, Türetilmiş Varlıkları ve eksik öğeleri. 03.1.3 ile aile/temsil ilişkisini kurma; aynı Varlık Kimliğindeki ayrı aileleri açma ve 03.1.2 Gerekli Öğeler Listesine geçiş.

### 03.1.1 · Yeni Varlık Kaydı

Düzen: `T04 + T10`

Ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Bağımsız Varlık Kaydı oluşturma; varsa aile bağlantısını 03.1.3 ile kurma. Görsel sonucu 04.2 içe aktarma akışıyla yeni Aday Sürüm olarak ekleme.

### 03.1.2 · Gerekli Öğeler Listesi

Düzen: `T04`

Gerekli yön, animasyon, durum, varyant ve kullanım testleri; her öğenin tamamlanma durumu. Öğe ekleme/düzenleme, gerekli/isteğe bağlı/uygulanamaz seçimi ve yeni liste sürümünü etkinleştirme. Eski liste sürümleri ile onları kullanan paketleri açma.

### 03.1.3 · Aile ve temsil ilişkileri

Düzen: `T04`

Varlık Kimliği, Görsel Dünya ve kullanım bağlamı seçimleri; aile oluşturma ve üyeleri ilişkilendirme. Onaylı kesin Ana Tasarımı seçme, her Türetilmiş Varlığın kaynağını belirtme; farklı dünyadaki temsili ayrı aileye bağlama.

### 03.2 · Varlık ayrıntısı

Düzen: `T03`

Büyük varlık önizlemesi; ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Geçerli görsel kurallar, perspektif, ölçüler, kesin Ana Tasarım, referans amaçları ve mevcut üretim hedefinin özeti; bu kayıt ve hedefle 04.1 paket hazırlığına geçiş. Onaylı Sürüm ve alternatifler; İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu ve Kayıt Durumu 08.2.8 rozetleriyle. Alt ekranları sekme olarak açma, kaydı arşivleme veya yeniden etkinleştirme; kalıcı silmeyi 07.3 ile başlatma.

### 03.2.1 · Oyun İçi Bilgiler

Düzen: `T03 + T06`

Seçili kare/görsel üzerinde pivot, zemin, sıralama, bağlantı noktaları (`mount point`) ve efekt başlangıç noktaları; vuruş, hasar alma ve çarpışma alanları ile olaylar. Katmanları gösterme/gizleme, noktaların koordinatlarını ve diğer değerleri düzenleme, kesin sürüm ve kare bağlantısını inceleme; bilinmeyen alanlar açıkça belirtilir.

### 03.2.1.1 · Metadata paketi indirme

Düzen: `T08`

Seçili sürümün Oyun İçi Bilgiler ve animasyon metadata JSON paketini indirme; indirilen dosyayı yeniden okuyup doğrulama.

### 03.2.2 · Sürümler ve dosyalar

Düzen: `T03 + T02`

Birim ve Birleşik Sürüm listeleri; her sürümün önizlemesi, inceleme durumu, kesin bileşim üyeleri ve dosyaları. Dosyaları inceleme; 03.2.2.3 ile iki sürümü karşılaştırma, seçili sürümü 05.1 incelemeye veya 05.3 düzenleyiciye açma. 03.2.2.1 yeni bileşime ve 03.2.2.2 harici çalışma dosyasına geçiş.

### 03.2.2.1 · Yeni bileşim oluşturma

Düzen: `T05`

Kaynak bileşimin birimleri ve seçilebilecek kesin Birim Sürümleri. Değişecek/korunacak birimleri karşılaştırma, üyeleri seçme ve eski bileşimi koruyarak yeni Birleşik Sürüm oluşturma.

### 03.2.2.2 · Harici çalışma dosyası

Düzen: `T03 + T04`

Yönetilen Kopya ve masaüstündeki Canlı Dosya Bağlantısı durumu; dosyayı harici düzenleyicide açma. Algılanan değişikliği inceleyip PNG/WebP sonucunu yeni Aday Sürüme bağlama. Dosya bulunamaz veya erişilemezse yeniden seçme; webde dosya yükleme yolu.

### 03.2.2.3 · Sürüm karşılaştırması

Düzen: `T05`

Aynı varlığın karşılaştırılacak iki kesin sürümü ve yan yana önizlemeleri. Ortak yakınlaştırma ve çok kareli içerikte kare seçimi; görsel, ölçü, Oyun İçi Bilgiler ve Bileşim Üyeliği farkları. Kaynak sürümleri veya seçilen sürümün 05.1 incelemesini açma.

### 03.2.3 · Üretim kanıtları

Düzen: `T03 + T04`

Kaynak türü ve mevcut/eksik üretim kanıtları; bilinmeyen geçmiş açıkça belirtilir. Elle İçe Aktarma Kanıtında paket, gerçek talimat, kaynak yüzeyi ve sonuç dosyası; Sağlayıcı Üretim Kaydında mevcut ayrıntılar. Sağlayıcı, arayüz, model/sürüm, istenen/gerçekleşen ölçüler, tohum ve diğer üretim parametrelerini elle girme formu. Elle girilen değerleri Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları olarak bağlantı verisinden ayrı gösterme; boş sağlayıcı alanları Bilinmiyor kalır ve kullanıcı bildirimi tek başına onayı engellemez. Eski varlık için Geçmiş Varlık Beyanı girme.

### 03.2.4 · Hak Kayıtları

Düzen: `T03 + T02`

Seçili varlık veya referansın Hak Kaydı: kaynak, hak sahibi/sağlayıcı, izin kapsamı, kısıt ve belirsizlik. Metin/URL ve dosya kanıtı ekleme; Belgelendi/Yalnız Beyan/Bilinmiyor/Kısıtlı seçimi. Önceki kaydı koruyarak yeni sürüm oluşturma; Ana Tasarım, referans ve bağımlı kaynakların ayrı hak geçmişlerini açma.

### 03.2.5 · Bağımlılık bağlantıları

Düzen: `T03 + T02`

Varlığın kaynak Ana Tasarımı ve bağımlı olduğu kesin kayıtlar; kimlik, siluet, ekipman, palet, Tema, perspektif veya zamanlama türleri. Bağlantı ekleme/düzenleme, eksik bağımlılıkları görme ve 05.5 değişiklik etkisine geçiş.

### 03.2.6 · Görsel ölçüler

Düzen: `T03 + T04`

Dosyadan doğrulanan Kaynak Görsel Ölçüsü; mantıksal çözünürlük, hücre, görünür içerik sınırı, gösterim ölçeği ve atlas ölçüleri için ayrı alanlar. Sınırın koordinat temeli ve önerilen/doğrulanmış değerler. Hazır veya özel kare/dikdörtgen ölçü girme; tam sayı olmayan gösterim ölçeğinde keskinlik uyarısı.

## 04. Üretim ve İçe Aktarma

Üretim girdilerini hazırlama, dosyaları alma, denemeleri karşılaştırma.

### 04.1 · Üretim Paketi

Düzen: `T04`

Hedef, etkin bağlam kopyası, kesin Ana Tasarım, ölçüler ve beklenen çıktı alanları. Korunacak/değişecek/kaçınılacak özellikleri ve sabit birimleri belirleme; referansları inceleyip Üretim Paketi oluşturma. Kesinleşen paketi 04.1.2 içinde açma.

### 04.1.1 · Referans panosu

Düzen: `T06`

Yan yana referans görselleri, notlar ve her görselin hazır/özel kullanım amacı. Görsel ekleme, izinli/yasak aktarımı düzenleme ve çakışmayı çözme. Referansın 03.2.4 Hak Kaydını açma; kimlik sınırı değişecekse 02.1.1.1 istisnasına geçiş.

### 04.1.2 · Üretim paketi ayrıntısı ve geçmişi

Düzen: `T02`

Değişmez Üretim Paketleri ve seçili denemenin sabitlenmiş bağlam, Ana Tasarım, referans, ölçü ve çıktı özeti. Paketi harici üretimde kullanmak üzere inceleme; paket özetini kopyalama, pakete bağlı Ana Tasarım ve referans görsellerini indirme kontrolleri. Doğal dil talimatını harici üretim yüzeyinde kullanıcı yazar. İlişkili sonucu 04.2 ile içe aktarma ve bağlı Aday Sürümün kanıtlarını açma.

### 04.2 · İçe Aktarma Gelen Kutusu

Düzen: `T02`

Yapıştırma, sürükleme veya yükleme alanı; dosya önizlemeleri, kaynak türü ve her dosyanın aktarım sonucu. Desteklenmeyen/okunamayan dosya ve eksik kanıt açıklamaları. Mevcut dosyalar Üretim Paketi hazırlanmadan da içe alınabilir. Hedefsiz girdileri bekletme; 04.2.2 ilişkilendirmesine, 04.2.1 metadata eşlemeye ve eksik kanıt için 03.2.3 üretim kanıtına geçiş.

### 04.2.1 · Metadata eşleme

Düzen: `T05`

Görsel ve JSON sidecar için kare, süre, tag, slice, pivot, dokuz parça ve palet alanlarının kaynak/hedef karşılaştırması. Alan bazında tanılama ve çakışma çözümü; isteğe bağlı Bilinmiyor değerleri koruma. Yeni öneriyi önceki kullanıcı kararından ayrı kesinleştirme.

### 04.2.2 · Hedef ilişkilendirme

Düzen: `T04`

Seçili girdinin görseli ve kaynak bilgisi yanında hedef Varlık Kaydı, yön/animasyon/durum veya birim seçimleri. Yeni kayıt gerekiyorsa aynı 03.1.1 formunu açma. Kullanıcı ilişkiyi kesinleştirince oluşan Aday Sürümü açma; onay için 05.1 kullanılır.

### 04.3 · Üretim Deneyleri

Düzen: `T02 + T05`

Deney listesi; ortak üretim amacı belirleme ve her denemeye ayrı paket/Aday Sürüm ekleme. Sonuçları ve bağlam, Ana Tasarım, referans, talimat, ölçü, çıktı yapısı ve varsa üretim parametresi farklarını karşılaştırma. Seçim/sonuçsuzluk/bırakma kararı; deney seçimi varlığı onaylamaz. Öğrenimi 02.1.1 önerisine aktarma, ayrıştırılamayan nedenleri belirtme.

### 04.4 · Üretim Tarifleri

Düzen: `T02 + T04`

Tarif listesi ve sürümler; seçilen deneyden tarif oluşturma. Talimat iskeleti, referans rolleri, çıktı yapısı ve sabit/doldurulacak alanları düzenleme. Güncel girdilerle paket hazırlama veya 08.3 › Hedef proje seçici ile başka projeye bağımsız kopyalama; eksik girdileri alıcı projede yeniden seçme ve kural çatışmalarını çözme.

## 05. İnceleme ve Kalite Kontrolü

Varlıkları sınama, düzeltme ve onay/ret kararı. Kütüphane, aile ve teslimat engelleri bu bölümdeki aynı test ve inceleme ekranlarını açar.

### 05.1 · Sürüm incelemesi

Düzen: `T03`

Seçili kesin sürümün önizlemesi, kalite kanıtları, onay engelleri ve karar geçmişi. Önceki sürümle karşılaştırmak için aynı 03.2.2.3 ekranını açma. Onay/ret/yeniden Aday seçimi ve gerekçe alanı; kullanıcı kararıyla yeni İnceleme Kaydı oluşturma. İnceleme, bağlama uygunluk, kalite ve kayıt durumları 08.2.8 rozetleriyle.

### 05.1.1 · Toplu inceleme

Düzen: `T05`

Seçili sürümlerin yan yana önizlemeleri ve her öğenin kendi kanıtları/engelleri. Her uygun öğe için ayrı karar; engelli öğelerin nedenleri görünür kalır.

### 05.1.2 · Kalite İstisnası

Düzen: `T10 + T04`

İstisnaya izin veren kural, gözlenen değer, kesin sürüm, kullanım kapsamı, Bağlam Sürümü ve Ana Tasarım. Gerekçe girme ve istisnayı kesinleştirme; bütünlük, zorunlu inceleme ve test kanıtı eksikliği istisnayla aşılmaz.

### 05.2 · Profil testleri

Düzen: `T02`

Seçili sürümün türü, etkin profil sözleşmesi ve değerlendirme sonuçları. Uygun test alanını (05.2.1) açma, kesin test girdilerini seçme ve kanıtları inceleme; özel profili olmayan tür için 05.2.2 Genel Varlık Desteğine geçiş.

### 05.2.1 · Test alanı

Düzen: `T06`

**Ortak:** Bütünlük, ölçülebilir gereksinim, uyarı, insan incelemesi ve kullanım testi sonuçları ayrı gruplar. Her sonuçtan kural, şüpheli kare/bölge ve kanıta geçiş. 05.2.1.1 sözleşmesini açma; 05.2.1.2 ile test ve kullanıcı değerlendirmesini kaydetme. Her tür görünümü bu çerçeveyi uyarlar ve yalnız türe özgü kısmıyla gösterilir.

- **Karakter ve animasyon:** Ana Tasarım ve yön önizlemeleri, zaman çizgisi ve kareye bağlı bilgiler. Eşzamanlı oynatma, 1× görünüm, soluk kareler ve değişken süre kontrolleri; döngü/geçiş, pivot, zemin, bağlantı noktası ve olay zamanlarını karşılaştırma.
- **Obje ve ekipman:** Obje/ekipmanın durum ve yön önizlemeleri; durum geçişlerini oynatma; bağlantı noktası, ölçek, pivot, zemin ve sıralamayı karşılaştırma.
- **Nesne yerleşim sahnesi:** Nesnenin onaylı karakterin yanında, proje ızgarasında ve farklı zeminlerde yerleştirildiği kullanım sahnesi; ölçek, pivot, zemin ve sıralamayı bu sahnede karşılaştırma.
- **İkon:** İkonun kaynak, mantıksal ve gerçek kullanım ölçülerindeki önizlemeleri; aile üyeleri yan yana. Açık/koyu zemin ve gri tonlama seçenekleri; siluet, iç boşluk, ışık, kontur ve durum/nadirlik renklerini karşılaştırma.
- **Efekt:** Efektin tek başına ve sahibiyle birlikte önizlemesi; hücre sınırı ve zaman çizgisi. Zemin, şeffaflık, süre/döngü, başlangıç noktası ve katman kontrolleri; taşmayı ve oyun olayıyla eşzamanlamayı inceleme.
- **Karo ve doku:** Karo testi ve doku tekrarı için ayrı bölümler. Karo atlası ve boyanabilir haritada köşe/kenar/koridor/dolgu/rastgele yerleşim; sorunlu karoyu seçme. Dokuda 2×2, 3×3 ve kaydırmalı tekrar; kesin kenar eşleşmesi ile görünür tekrar izini ayrı inceleme.
- **Arka plan:** Arka plan katmanları, hedef görüntü oranı, kırpma ve oyuncu güvenli alanı. Katman sırası, göreli hız ve kaydırma kontrolleri; döngü birleşimi, kontrast ve oyuncu görünürlüğünü hareket hâlinde inceleme.
- **Oyun arayüzü varlıkları:** Aynı ailede ekran, panel ve bileşenler; normal, üzerine gelme, basılı, devre dışı, seçili, açık/kapalı durumlar. Durum ve hedef ölçü seçimi; paneli farklı boyutlarda germe, dokuz parça paylarını ve metin güvenli alanını görme. Düzeltilen bileşeni ekran yerleşiminde sınama.
- **Portre, logo ve tanıtım:** Portre ve logo/tanıtım için ayrı kullanım bölümleri. Portrede ifade, Ana Tasarım bağı ve diyalog/arayüz kırpması; logo/tanıtımda hedef ölçü, güvenli alan, açık/koyu zemin ve şeffaf/opak kullanım. Kimlik ve küçük boyut okunurluğunu karşılaştırma.

### 05.2.1.1 · Özel Profil Sözleşmesi

Düzen: `T02`

Sözleşme sürümleri; metadata alanları, kural sınıfları, zorunlu insan incelemesi/kullanım testleri, istisna izni ve dışa aktarım eşlemeleri. Geçerli sürümü inceleyip etkinleştirme; yeni kurallardan etkilenen kanıtları görme.

### 05.2.1.2 · Değerlendirme ve test kanıtı

Düzen: `T04`

Kesin varlık/birim/bileşim, profil sürümü, test ortamı ve kanıtlar. Otomatik sonuçları inceleme; zorunlu insan değerlendirmesi ile Geçti/Başarısız/Sonuçsuz kullanım testi sonucunu kaydetme. Tutarlılık/yanlış uyarı geri bildirimi ve önceki değerlendirmeler.

### 05.2.2 · Genel Varlık Desteği

Düzen: `T03`

Özel profili olmayan yazı tipi, imleç ve yardımcı görsellerin kayıt/dosya bilgileri ve uygun önizlemesi. Temel bütünlük sonuçlarını ve kullanıcı incelemesini açma; türe özgü test kanıtı iddia edilmez.

### 05.3 · Son Dokunuş Piksel Düzenleyicisi

Düzen: `T07`

**Ortak:** Üstte kaynak sürüm/aile ve taslak durumu; solda araçlar, ortada tuval, sağda sayısal ayarlar ve çok kareli içerikte altta kare şeridi. 1×/tam sayı yakınlaştırma ve şeffaflık zeminleri. Tuval yakınlaştırmasından bağımsız, sürekli görülebilen gerçek kullanım boyutu önizlemesi; 1×, 2× veya seçili tam sayı Gösterim Ölçeği. Geri al/yinele, yerel taslak kaydı ve “Bitir ve yeni Aday Sürüm oluştur” kontrolü. Piksel, karo ve sahne düzenlemesi için klavyeyle kullanılabilen eşdeğer görevler veya erişilebilir özellik paneli.

- **Piksel ve palet araçları:** Kalem, silgi, renk seçici, çizgi ve kesin renk doldurma; seçim, kes/kopyala/yapıştır, piksele oturan taşıma, çevirme ve 90° döndürme. Kırpma, tuval ölçüsü ve tam sayı ölçekleme; palet kilidi, yabancı renkler ve toplu değişimde etkilenecek piksel sayısı.
- **Görsel sayfasını dilimleme:** Hücre genişliği/yüksekliği, satır/sütun, başlangıç ofseti, boşluk ve okuma sırası alanları. Numaralı hücre sınırları ve oynatılabilir kare önizlemesi; kaynak görseli koruyarak dilimlemeyi çalışma taslağına uygulama.
- **Kare ve animasyon düzenleme:** Kare şeridi; ekleme, çoğaltma, silme, dosyayla değiştirme ve sıralama kontrolleri. Kare süresi, X/Y ofseti, pivot ve koru işareti; oynat/durdur, döngü ve önceki/sonraki soluk kareler. Zemin hizasını karşılaştırma.
- **Fark ve seçici düzeltme:** Orijinal/taslak farkını yan yana, üst üste veya durdurulabilir geçişle görme; değişen piksel/kare listesi, değişen piksel sayısı ve değişiklik sınır kutusu. Görsele yazılmayan ok, bölge ve notlar; sorunlu/korunacak birimleri 04.1 paketine aktarma. Dönen seçeneği taslağı ezmeden karşılaştırma.

### 05.4 · Sahne Kalite Kontrol Alanı

Düzen: `T06`

Karo, arka plan, karakter, obje, gölge ve efekt için kesin sürüm seçip yerleştirilen sahne. Karakter hareketi, bekleme/yürüme/saldırı geçişleri, olay anı, katman/Y sırası ve kamera kontrolleri. Metadata katmanlarını gösterme; sonucu 05.2.1.2 ile kanıta bağlama.

### 05.5 · Yeniden doğrulama

Düzen: `T02`

Değişen kural veya Ana Tasarım; doğrudan/dolaylı etkilenen varlıklar ve etki nedenleri. 05.5.2 ile değişiklik kapsamını belirtme; etkilenen sürümü yeniden incelemeye veya düzeltmeye açma. Yeniden Doğrulama Gerekli 08.2.8 rozetiyle gösterilir.

### 05.5.1 · Tarihsel bileşim

Düzen: `T04`

Geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtı seçimleri. Kesin tarihsel bileşim için uyumluluk raporu ve çözülemeyen engeller; bu seçim güncel yeniden doğrulama ihtiyacını kaldırmaz.

### 05.5.2 · Değişiklik kapsamı

Düzen: `T04`

Değişen Bağlam Sürümleri veya eski/yeni Ana Tasarım; etkilenen kimlik, siluet, ekipman, palet, Tema, perspektif ve zamanlama seçimleri. Kullanıcının Değişiklik Tanımını kaydetmesi; eşleşen doğrudan/dolaylı bağımlılıkları 05.5 listesinde görme.

## 06. Teslimat

Hedef planlama, paket oluşturma, oyunda doğrulama ve teslimatı kaydetme.

### 06.1 · Hedef ve Hazırlık Planı

Düzen: `T02`

Teslimat Hedefleri ve her hedefin etkin sürümü, amacı, kapsamı ve Hazır/Engelli durumu. Hedef oluşturma veya seçme; 06.1.1 hedef tanımını ve 06.1.2 Hazırlık Planını açma. Hazır/Engelli ve Teslim Edildi 08.2.8 rozetleriyle.

### 06.1.1 · Teslimat Hedefi tanımı

Düzen: `T04 + T05`

Amaç, gerekli aileler/liste sürümleri, Bağlam Sürümü, kullanım testleri ve kabul koşulları. Üretim Kanıtı/Hak Kanıtı Politikaları ile gerekli çalışma zamanı ortamlarını seçme. Yeni tabana geçerken kapsam, kural ve tamamlanma farklarını inceleme; taslağı yeni hedef sürümü olarak etkinleştirme ve geçmiş sürümleri açma.

### 06.1.2 · Hazırlık Planı

Düzen: `T02`

Etkin hedefin engelleri, eksik kanıtları ve bir düzeltmeyle açılacak işler. Hedef zorunluluğu, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçeler; iş sırasını değiştirme ve her engelden ilgili düzeltme ekranına geçiş: eksik varlık 03'e, kalite engeli 05'e, hak kaydı 03.2.4'e.

### 06.2 · Profil ve paket

Düzen: `T03`

Paket girdilerinden önce 06.2.2'de seçilen Dışa Aktarım Profili sürümü, kesin varlık/birim/bileşim girdileri ve paket içerik özeti. Bağlam, gerekli liste, üretim/hak/kalite kanıtı ve istisna seçimlerini inceleme; engelleri çözme ve paket oluşturma. Sonucu 06.2.3 paket ayrıntısında açma.

### 06.2.1 · Paket doğrulama

Düzen: `T08`

Doğrulanacak paketi seçme ve Paket Doğrulama Kitinin şema, dosya özetleri, README ve sürümünü görme. Ağ olmadan doğrulamayı başlatma; eksik/uyuşmayan dosya, yinelenen yol ve bozuk kayıt bağlantısı sonuçlarını inceleme.

### 06.2.2 · Dışa Aktarım Profili

Düzen: `T04`

Profil sürümleri; yerleşim, padding, trim, ölçek, biçim ve adlandırma alanları. Metadata eşlemelerinde alan kimliği, birim ve koordinat sistemi; bilinmeyen/eksik alan davranışı. Ayarları yeni profil sürümü olarak kaydetme ve pakette kullanılacak sürümü seçme.

### 06.2.3 · Paket ayrıntısı ve geçmişi

Düzen: `T02`

Değişmez paket listesi; seçili paketin manifesti, dosya yolları/özetleri, sabitlenmiş sürümleri, kanıtları ve istisnaları. Paketi ve Doğrulama Kitini indirme; 06.2.1 doğrulamasına, 06.3 Godot çıktısına, 06.4 oyun testine veya 06.5 teslimat konumuna geçiş.

### 06.3 · Godot çıktısı

Düzen: `T03 + T08`

Kaynak Dışa Aktarım Paketi, desteklenen Godot ve bağdaştırıcı sürümü, üretilecek dosyalar. Motor çıktısını oluşturma/indirme; kare, pivot, zamanlama, olay ve geçerli karo/arayüz eşlemelerini inceleme. Gerçek oyun testine 06.4 ile geçiş.

### 06.4 · Oyunda doğrulama

Düzen: `T03 + T04`

Kesin paket, oyun yapısı, motor/bağdaştırıcı sürümü ve doğrulama geçmişi. Görüntü, video, test sonucu veya gözlem ekleme; elle/izinli araç kaynaklarını ayırma. Geçti/Başarısız/Sonuçsuz sonucunu, başarısızlık kaynağını ve etkilenen kapsamı kesinleştirme.

### 06.5 · Güvenli yenileme

Düzen: `T05`

Seçili konum, paket ve Teslimat Yenileme Kilidi. İlk teslimat için 06.5.1; sonraki yenilemede değişmemiş/güncellenecek/bayat/eksik/ayrışmış yollar. Farkı inceleyip koruma, başka konum veya açık değiştirme kararı; uygulanan ve durdurulan yolları ayrı görme. Webde değişiklik paketini, kilidi ve ayrışma raporunu indirme; masaüstünde izinli klasöre yenilemeyi uygulama kontrolleri.

### 06.5.1 · İlk teslimat ve konum seçimi

Düzen: `T08`

Uygulanacak kesin paket ve teslimat konumu; masaüstünde klasör seçimi/erişim izni, webde indirilecek paket ve elle uygulama yolu. İlk uygulamayı başlatma; yazılan göreli yolları, oluşan Teslimat Yenileme Kilidini ve varsa kısmi başarısızlığı görme.

### 06.6 · Teslimatı kesinleştirme

Düzen: `T05`

Hazır hedefin gereksinimleri ve her birini karşılayan kesin paket/sürümler ile gerekli kullanım/çalışma zamanı kanıtları. Eksik veya örtüşen eşlemeleri çözme; geçerli seçimlerle Teslimat Gerçekleşmesini kesinleştirme.

### 06.6.1 · Teslimat geçmişi

Düzen: `T02 + T05`

Teslimat Gerçekleşmesi listesi; kayıt ayrıntısını veya karşılaştırılacak iki kaydı seçme. Eklenen/çıkarılan/değişen varlıklar, bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemeleri ayrı fark grupları. İlgili kesin kayıtları açma.

### 06.6.2 · Tarihsel Risk Bildirimleri

Düzen: `T02`

Etkilenen geçmiş teslimatlar, riskli kaynak, yeni Hak Kaydı sürümü, sabitlenmiş politikayla uyuşmazlık ve saptama zamanı. Kaynak hak kaydını veya teslimat ayrıntısını açma; geçmiş Teslim Edildi sonucu korunur.

## 07. Ortak işlemler

Çevrimdışı taslak, çakışma, işlem kurtarma ve kalıcı silme akışları.

### 07.1 · Çevrimdışı çalışma ve çakışma

Düzen: `T02`

Cihazdaki yerel taslaklar, bağlı oldukları proje/kaynak sürüm ve kayıt durumları. Taslağı yeniden açıp çalışmaya devam etme; bağlantı dönünce güncel tabanı kontrol etme. Bulut ilerlemişse 07.1.1 Çakışma çözümünü açma; çevrimdışı taslak bulut kararı sayılmaz.

### 07.1.1 · Çakışma çözümü

Düzen: `T05`

Taban sürüm, güncel bulut ve yerel taslağın üçlü karşılaştırması. Yeni Aday Sürüm oluşturma, bulutu koruyup taslağı saklama veya 08.3 › Taslağı bırakma ile açıkça bırakma seçenekleri. Bağlam, inceleme ve teslimat gibi kesin kararlar için güncel bulut tabanında yeni karar oluşturma; seçilen çözümün kesin sonucu.

### 07.2 · İşlem durumu ve kurtarma

Düzen: `T02 + T08`

**Ortak:** Arşivleme, geri yükleme, paket oluşturma, doğrulama ve silme için ortak işlem listesi; kimlik, tür, kapsam, durum, ilerleme, denemeler ve kesin sonuç. Bağlantı döndüğünde güncel sonucu bulma. İptal isteği ile kesin iptal sonucu ayrı gösterilir.

- **Çalışıyor:** İlerleme ve uygun işte iptal isteme.
- **Başarısız:** Hata açıklaması ve güvenli yeniden deneme.
- **Teknik bilgi:** Seçili işlemin denemeleri ve destek için teknik ayrıntılar; ham hata ayrıntıları ve sırlar gösterilmez.

### 07.3 · Kalıcı silme

Düzen: `T08`

Varlık ve arşiv silme için aynı akış, farklı kapsamla. Silinecek kayıtlar, Yönetilen Kopyalar, bütün paket/arşivler ve etkilenen teslimatların kapsamı/sayıları. Kapsam dışı kopyalar, geri alınamaz sonuç ve yedek saklama takvimi; içeriksiz Silme Kaydı bırakma seçimi. Kesin dökümü 08.3 › Kalıcı silme onayı ile onaylama; başladıktan sonra 07.3.1 sonucunu açma.

### 07.3.1 · Silme sonucu ve makbuz

Düzen: `T08`

07.2 ortak işlem görünümüyle silme ilerlemesi; etkin depo temizliği ve yedeklerden kaldırma takvimi. İçeriksiz Silme Makbuzunu açma, kapsam dışında kalan kopyaları ve varsa oluşturulan içeriksiz Silme Kaydını görme.

## 08. Ortak sayfalar ve ekran durumları

Bulunamayan sayfa, erişim sorunu, yükleme, boş içerik, hata durumları ve ortak onay penceresi. 08.1 **durum sayfası** bütün içerik alanını kaplar; 08.2.1–08.2.8 **ekran durumları** mevcut ekranın veya panelin yuvasını doldurur; 08.3 **onay penceresi** ekranın üzerinde açılır. Çakışma çözümü, işlem kurtarma ve silmenin ayrıntılı akışları 07'ye, işlem durumuna giriş kontrolü 00.3'e aittir; 08 yalnız bunların ortak görünümünü verir.

### 08.1 · Durum sayfası

Düzen: `T00 (durum dolgusu)`

**Ortak:** İçerik alanını kaplayan durum başlığı, açıklama ve güvenli çıkış kontrolü.

- **Sayfa bulunamadı (404):** Geçersiz adres açıklaması ve Projeler ekranına dönüş.
- **Erişim reddedildi:** Erişim reddi açıklaması ve erişilebilir projelere dönüş; korunan proje bilgisi, içerik veya önizleme gösterilmez.
- **Oturum sona erdi:** Yeniden giriş gerektiği açıklaması ve 01.1 Giriş'e geçiş; varsa yerel taslağın kayıt durumu görünür kalır.
- **Sayfa yüklenemedi:** Güvenli yeniden yükleme ve Projeler ekranına dönüş; beklenmeyen sunucu hatasında Destek Referansı gösterilir.

### 08.2.1 · Yükleniyor

Düzen: `Yuva dolgusu`

Liste, ayrıntı veya önizleme alanında yükleme göstergesi ve içeriğin yerini koruyan yer tutucular. Yüklenen bölüm ile kullanılabilir içerik ayırt edilir.

### 08.2.2 · Boş içerik

Düzen: `Yuva dolgusu`

**Ortak:** Gösterilecek kayıt olmadığını açıklayan mesaj ve sonraki adım kontrolü.

- **Henüz içerik yok:** Ekranın bağlamına göre proje/koleksiyon oluşturma, varlık içe aktarma veya teslimat hazırlama işlemine geçiş.
- **Arama sonucu yok:** Arama/filtrelerle eşleşen kayıt olmadığı; mevcut arama ve filtreler görünür kalır, aramayı değiştirme veya filtreleri temizleme kontrolleri.

### 08.2.3 · İçerik gösterilemedi

Düzen: `Yuva dolgusu`

**Ortak:** Gösterilemeyen içeriğin yuvasında açıklama ve güvenli sonraki adım.

- **Kayıt bulunamadı:** Seçilen proje, varlık veya sürümün görüntülenemediği açıklaması ve ilgili listeye dönüş; yetkisiz kişiye özel kaydın bilgileri verilmez.
- **Önizleme yüklenemedi:** Görselin yerinde önizleme hatası ve güvenli yeniden deneme; erişilebilir kayıt bilgileri ve diğer kullanılabilir alanlar görünür kalır.
- **Veri yüklenemedi:** Başarısız liste/panel içinde aynı okumayı yeniden çalıştıran kontrol; beklenmeyen sunucu hatasında Destek Referansı gösterilir, diğer bölümler kullanılabilir kalır.

### 08.2.4 · Bağlantı kesildi

Düzen: `Yuva dolgusu`

Bağlantı kesintisi bildirimi, yerel taslağın 08.2.7 › Yerel taslak kaydedildi durumu ve kullanılabilir çevrimdışı işlemler. Taslak/çakışma yönetimi için 07.1 geçişi; bulutta kesinleşmeyen sonuç açıkça belirtilir.

### 08.2.5 · Form doğrulama hatası

Düzen: `Yuva dolgusu`

Eksik veya geçersiz alanın yanında düzeltme açıklaması. Girilmiş değerler korunur; kullanıcı sorunlu alanı düzelterek işlemi tekrar gönderebilir.

### 08.2.6 · İşlem engellendi

Düzen: `Yuva dolgusu`

İşlemi engelleyen koşul ve düzeltme yolu. Eksik kanıt, kalite engeli ve bilinmeyen sözleşme sürümü ayrı belirtilir. Desteklenmeyen platform/biçim veya kapasite sınırında ilgili sınır ve 00.4 bilgilerine geçiş gösterilir.

### 08.2.7 · Kayıt ve işlem bildirimi

Düzen: `Yuva dolgusu` (T00 `NoticeRegion`)

**Ortak:** Tek bildirim yeri; ilgili kayıt veya işlemin adıyla durumunu bildirir.

- **Kaydediliyor:** Devam eden kayıt; kesin sonuç alınana kadar başarı mesajı gösterilmez.
- **Yerel taslak kaydedildi:** Taslağın bu cihazda saklandığı; bulut kaydının henüz kesinleşmediği açıkça gösterilir, taslağı incelemeye erişim.
- **Bulut kaydı tamamlandı:** Bulut kaydının tamamlandığı ve güncel kayıt durumu; kesinleşen sonucu ilgili kayıtta görme.
- **Kaydedilemedi:** Yalnız yazmanın gerçekleşmediği doğrulanmışsa hata açıklaması ve güvenli sonraki adım; taslak ve girilmiş içerik korunur.
- **Sonuç belirsiz:** Sonucun henüz doğrulanamadığı açıklaması ve güncel durumu sorgulama eylemi; başarı/başarısızlık ilan edilmez, aynı yazmayı tekrar gönderen işlem sunulmaz.
- **İşlem ilerlemesi:** Bekliyor, çalışıyor, tamamlandı, başarısız, iptal istendi ve iptal edildi bildirimleri. İlerleme veya kesin sonuç özeti; seçildiğinde 07.2 işlem ayrıntısı açılır.

### 08.2.8 · Durum rozetleri

Düzen: `Yuva dolgusu`

İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu, Kayıt Durumu, Yeniden Doğrulama Gerekli, Hazır/Engelli ve Teslim Edildi için ortak rozet; her rozet ikon, etiket ve renkle verilir. Durumlar birbirinden ayrı gösterilir: Hazır, Teslim Edildi sonucundan; Yeniden Doğrulama Gerekli, geçmiş onaydan ayrıdır. Değerler sözlükteki tanımlardan gelir (İnceleme Kararı: Aday/Onaylı/Reddedildi; Kalite Kontrol Durumu: Değerlendirilmedi/Engelli/İstisnalarla Hazır/Dışa Aktarıma Hazır; Kayıt Durumu: Etkin/Arşivlenmiş/Silinmiş).

### 08.3 · Onay penceresi

Düzen: `T10`

**Ortak:** İşlemin kapsamını ve sonucunu açıklayan pencere; açık kesinleştirme ve vazgeçme kontrolleri.

- **Kullanıcı kararını onaylama:** Onay, istisna veya değişiklik kararının kapsamı, gerekçesi ve beklenen sonucu.
- **Taslağı bırakma:** Bırakılacak yerel taslağın içeriği ve geri alınamayan sonuç; taslağı koruma veya açıkça bırakma.
- **Kalıcı silme onayı:** 07.3'teki kesin dökümün kapsamı ve etkilenen içerik sayılarıyla onaylama; döküm değişirse yeni kapsam için yeniden onay gerekir.
- **Hedef proje seçici:** Stil Modülünü (02.1.2) veya Üretim Tarifini (04.4) başka projeye bağımsız kopyalarken hedef proje seçimi; kopyanın alıcı projede sahibi ekranın tanımladığı şekilde ele alındığı açıklaması.
