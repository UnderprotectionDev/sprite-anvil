# Sprite Anvil — Arayüz Tasarım Planı

Tablolar ana arayüzleri ve bunlara bağlı alt alanları gösterir.

**Alt numaralar bağlılığı gösterir:** 03.4 “Varlık ayrıntısı”, 03.4.1 ise onun içindeki “Oyun İçi Bilgiler” alanıdır. Bunlar kullanıcı için zorunlu işlem sırası değildir. Alt alanlar ayrı ekran, sekme veya panel olarak tasarlanabilir.

## Paper dosyası ve tasarım sahipliği

Aktif tasarım kaynağı, Paper'daki `Sprite Anvil` klasöründe bulunan [Sprite Anvil · Product](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY) dosyasıdır. Aşağıdaki adlar bu dosyanın **Paper sayfalarıdır**; ayrı dosyalar veya uygulama route'ları değildir.

| Paper sayfası | Sahip olduğu tasarım |
| --- | --- |
| Start Here | Sayfa dizini, kaynak önceliği ve ortak tasarımları kullanma kuralları. |
| Design Language | Ortak tokenlar, tipografi, kontrol hiyerarşisi ve bileşen örnekleri. |
| 00 · Shared Shell | 00.1–00.5 ortak çerçevesi ve içerik yuvası. |
| 01 · Accounts & Projects | 01 hesap, proje ve Proje Arşivi alanları. |
| 02 · Project Context & Management | 02 Proje Bağlamı ve yönetim alanları. |
| 03 · Asset Library | 03 kütüphane, koleksiyon, aile ve varlık ayrıntısı alanları. |
| 04 · Production & Import | 04 üretim ve içe aktarma alanları. |
| 05 · Review & Quality Control | 05 inceleme, profil testleri, düzenleyici ve kalite kontrol alanları. |
| 06 · Delivery | 06 hedef, paket, doğrulama ve teslimat alanları. |
| 07 · Shared Operations | 07 çevrimdışı çalışma, çakışma, işlem kurtarma ve kalıcı silme akışları. |
| 08 · Shared Pages & States | 08 ortak uygulama sayfaları, ekran durumları ve onay pencereleri. |

Alan kimlikleri korunur: `00.1–00.5` ayrı Paper sayfalarına bölünmez; ilgili artboard ve katmanlar `00 · Shared Shell` içinde adlandırılır. `00.0 · Master Screen Template`, ortak çerçevenin tasarım örneğidir; yeni bir ürün gereksinimi değildir. Varlık ayrıntısı ve alt görünümlerinin sahibi `03.4–03.4.6` olduğundan bu tasarımlar `03 · Asset Library` içinde tutulur. `00.3` işlem durumuna giriş kontrolünü, `07.2` işlem ayrıntısını ve kurtarma akışını tanımlar; `08.2.15` bunların ortak durum bildirimidir.

### Ortak örnekleri kullanma ve kod aktarımı

- Davranışın kaynağı [PRD](prd/README.md), arayüz kapsamının kaynağı bu plandır. Görsel kararlar için aynı Product dosyasındaki `Design Language` ve ilgili ortak çerçeve örneği kullanılır. Bir çelişki, uygulama öncesinde ilgili kaynaklarla birlikte açıklanır.
- Her artboard adı ilgili alan kimliğiyle başlar. Alt görünümler ve durum örnekleri sahip oldukları alanın Paper sayfasında gruplanır; her durum için ayrı dosya veya Paper sayfası açılmaz.
- Ortak tokenlar dosya genelinde kullanılır. Çoğaltılmış artboard veya katman geometrisi canlı bileşen bağlantısı değildir. Ortak bir kontrol değiştiğinde önce kaynak örnek, sonra etkilenen ekran örnekleri güncellenip karşılaştırılır.
- Tam ekran örneği çerçeve ve içerik ilişkisini gösterir. Aynı çerçeveyi tekrar eden hata, odak ve bekleme durumları, gerekli bağlam korunarak kompakt bileşen örnekleriyle gösterilebilir.
- Kod aktarımında ilgili alanın artboard'u ve kullandığı ortak örnekler birlikte okunur. Yinelenen çerçeve ve kontroller kodda ortak bileşenlere ayrılır; Paper'daki kopyaların her biri ayrı uygulama bileşeni sayılmaz.
- Eski bağımsız dosyalar arşiv/yedek kaynağıdır; yeni tasarımlar ve kod aktarımı Product dosyasından yürütülür. `Archive · Before Consolidation` tasarım dosyalarının arşividir; üründeki `01.4 Proje Arşivi` ile ilişkili değildir.

**Kapsam ile tamamlanma ayrımı:** Bu belgedeki tablolar planlanan kapsamı gösterir. Paper'da bir sayfanın veya alan haritasının bulunması, o alanın bütün ekranlarının tasarlandığı, onaylandığı veya kodlandığı anlamına gelmez. Alan haritaları kapsam dizinidir; mevcut artboard'lar ve durum örnekleri ilgili görevde ayrıca kontrol edilir.

## Ana arayüzler

| Alan | Ana arayüz | Kullanıcı burada ne yapar? |
| --- | --- | --- |
| 00 | Ortak çerçeve | Proje değiştirir, ana alanlar arasında gezinir, işlem durumuna ulaşır. |
| 01 | Hesap ve Projeler | Giriş yapar, proje seçer/oluşturur, arşivler veya geri yükler. |
| 02 | Proje Bağlamı ve Yönetimi | Görsel kuralları, Temaları ve erişim izinlerini yönetir. |
| 03 | Varlık Kütüphanesi | Varlıkları bulur, ailelerini ve ayrıntılarını yönetir. |
| 04 | Üretim ve İçe Aktarma | Üretim girdilerini hazırlar, dosyaları alır, denemeleri karşılaştırır. |
| 05 | İnceleme ve Kalite Kontrolü | Varlıkları sınar, düzeltir ve onay/ret kararı verir. |
| 06 | Teslimat | Hedefi planlar, paket oluşturur, oyunda doğrular ve teslimatı kaydeder. |
| 07 | Ortak işlemler | Çevrimdışı taslağı, hatayı, çakışmayı veya kalıcı silmeyi yönetir. |
| 08 | Ortak sayfalar ve ekran durumları | Bulunamayan sayfa, erişim sorunu, yükleme, boş içerik ve hata durumlarını görür. |

**00, 07 ve 08 ortak tasarımlardır. 01–06 ana arayüzlerdir.**

## 00. Ortak çerçeve

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 00.1 | Proje ve gezinme | Seçili projenin adı, proje değiştirme kontrolü ve 01.2 Projeler listesine dönüş. Proje Bağlamı, Kütüphane, Üretim, İnceleme ve Teslimat geçişleri; açık alanın seçili görünümü. |
| 00.2 | İçerik alanı | Ekran başlığı, seçili kaydın adı ve açık alanın konum yolu. Ana içerik, o kayda ait işlem kontrolleri ve bağlı alt alanlara geçişler. Alt görünümden üst kayda veya açıldığı listeye dönüş kontrolü. |
| 00.3 | Durum alanı | Bağlantının açık veya çevrimdışı olduğunu gösteren bildirim ve devam eden işlemlerin durumu. Bir işlem seçildiğinde 07.2 ayrıntısı açılır. |
| 00.4 | Destek ve sınır bilgileri | Desteklenen tarayıcı, masaüstü, motor sürümü ve proje boyutu bilgileri. Yayımlanmış işlem/depolama sınırları ve destek değişikliği duyuruları; ilgili işlemde bu bilgilere erişim. |
| 00.5 | Hesap menüsü | Oturum açmış kullanıcının adı ve e-postası; oturumu kapatma kontrolü. Çıkış tamamlandığında 01.1 Giriş görünümü açılır. |

## 01. Hesap ve Projeler

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 01.1 | Giriş | E-posta ve parola alanları, giriş kontrolü ve 01.1.1 Hesap oluşturma görünümüne geçiş. Bekleme ve başarısız giriş açıklaması; giriş tamamlandığında 01.2 Projeler ekranını açma. |
| 01.1.1 | Hesap oluşturma | Ad, e-posta ve parola alanları; hesap oluşturma ve giriş görünümüne dönme kontrolleri. Alan doğrulama, gönderim ve kayıt hatası durumları; başarılı kayıttan sonra 01.2 Projeler ekranına geçiş. |
| 01.2 | Projeler | Proje adları ve her projeyi açma kontrolü. Yeni proje oluşturma ve Proje Arşivine geçiş; proje yoksa oluşturmayı yönlendiren boş görünüm. |
| 01.3 | Yeni proje | Proje adı ve genel sanat yaklaşımı için giriş alanları. Projeyi oluşturma kontrolü, eksik/geçersiz alan açıklamaları ve oluşturulan projeye geçiş. |
| 01.4 | Proje Arşivi | Arşiv listesi, seçili arşivin içerik özeti ve indirme kontrolü. Bağlam, varlık, üretim, inceleme ve teslimat geçmişini kapsayan içerik seçimi; seçili çalışma dosyaları ve dışarıda kalan kanıtlar. Arşiv oluşturma, sonucunu izleme ve geri yüklemeye geçiş. |
| 01.4.1 | Bağımsız projeye geri yükleme | Geri yüklenecek arşivi seçme kontrolü, dosya/ilişki bütünlüğü sonucu ve eksik kanıt açıklamaları. Bağımsız proje oluşturma, işlem ilerlemesi ve tamamlanan yeni projeyi açma; mevcut proje üzerine yazılmaz. |

**Bağlantı:** Açık projenin yönetiminden de 01.4 açılır. Kalıcı silme için ortak 07.3 kullanılır.

## 02. Proje Bağlamı ve Yönetimi

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 02.1 | Proje Bağlamı | Etkin Bağlam Sürümü ve kapsamlarına göre gruplanmış kurallar. Seçili kapsamda devralınan ve geçerli olan kuralları görme; yeni öneri hazırlama, bekleyen önerileri açma, 02.1.3 sürüm geçmişine ve Stil Modüllerine geçiş. |
| 02.1.1 | Kural önerisi | Kural, kapsam, değer ve dayanak girilen yapılandırılmış öneri kontrolleri. Mevcut/önerilen kuralların farkları, taban sürüm, ajan/model veya kontrol kaynağı ve doğrulama sonucu. Aynı kuraldaki çakışmayı çözme; geçerli öneriyi inceleyip etkinleştirme. |
| 02.1.1.1 | Bağlam Kuralı İstisnası | Devralınan kural, yerine geçecek daha dar kapsamlı değer ve gerekçe. Kaynak kural zincirini ve etkilenen kapsamı görme; istisnayı Bağlam Önerisine dahil etme. Kalite İstisnası ayrı 05.1.2 alanındadır. |
| 02.1.2 | Stil Modülleri | Stil Modülleri, her modülün kuralları ve sürümleri. Palet, kontur gibi kuralları modülde gruplama; yeni modül sürümü hazırlama ve başka projeye bağımsız kopyalama. Kopyayı alıcı projede Bağlam Önerisi olarak inceleme. |
| 02.1.3 | Bağlam sürüm geçmişi | Bağlam Sürümleri, etkin sürüm işareti ve seçili sürümün kuralları/istisnaları. Sürümler arasındaki değişiklikleri ve kaynak öneriyi açma; bu sürümü kullanan üretim kayıtlarına geçiş. |
| 02.2 | Görsel Dünyalar ve Temalar | Görsel Dünyalar ve her dünyaya bağlı Temalar. Oluşturma/düzenleme kontrolleri; seçili dünya veya Temanın kuralları ve bu kapsamın Proje Bağlamındaki karşılığı. |
| 02.3 | Bağlantılar ve izinler | Araç/ajan için izin durumu, amaç ve proje/veri kapsamı. İzin verme/geri alma; Harici Görsel Analizi için kategori, sağlayıcı, aktarılacak veri ve bilinen saklama koşulları. Henüz desteklenmeyen bağlantılar kullanılamaz olarak gösterilir. |
| 02.4 | Ürün ölçümleri | Süre, başarı, koruma ve yarım kalan akış sonuçları; ölçüm kapsamı ve zaman aralığı. Farklı tanım sürümleri ayrı gösterilir; kullanılan Ölçüm Tanımını açma. |
| 02.4.1 | Ölçüm Tanımları | Tanımın kapsamı, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman aralığı ve saklama süresi. Yeni tanım sürümünü hazırlama, farklarını inceleme ve etkinleştirme. |

**Bağlantı:** Değişen kuralların varlıklara etkisi 05.5'te görülür. Harici Görsel Analizi başlangıçta kapalıdır; kategori, gönderilecek veri ve bilinen saklama koşulları 02.3'te açıklanır.

## 03. Varlık Kütüphanesi

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 03.1 | Kütüphane | Varlık önizlemeleri, adları, türleri ve Kayıt Durumları. Ad, tür, Tema, Görsel Dünya, ölçü, etiket ve Etkin/Arşivlenmiş filtreleri; ölçüyle eşleşen sürümü gösterme. 03.1.1 ile kayıt oluşturma, varlık seçildiğinde 03.4 ayrıntısını açma. |
| 03.1.1 | Yeni Varlık Kaydı | Ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Bağımsız Varlık Kaydı oluşturma; varsa aile bağlantısını 03.3.2 ile kurma. Görsel sonucu 04.2 içe aktarma akışıyla yeni Aday Sürüm olarak ekleme. |
| 03.2 | Koleksiyonlar | Koleksiyon listesi ve seçili koleksiyonun varlıkları. Koleksiyon oluşturma, üye ekleme/çıkarma ve bir üyeden aynı 03.4 Varlık ayrıntısına geçiş. |
| 03.3 | Varlık Ailesi | Aile listesi ve seçili ailenin üyeleri, Onaylı Ana Tasarımı, Türetilmiş Varlıkları ve eksik öğeleri. 03.3.2 ile aile/temsil ilişkisini kurma; aynı Varlık Kimliğindeki ayrı aileleri açma ve Gerekli Öğeler Listesine geçiş. |
| 03.3.1 | Gerekli Öğeler Listesi | Gerekli yön, animasyon, durum, varyant ve kullanım testleri; her öğenin tamamlanma durumu. Öğe ekleme/düzenleme, gerekli/isteğe bağlı/uygulanamaz seçimi ve yeni liste sürümünü etkinleştirme. Eski liste sürümleri ile onları kullanan paketleri açma. |
| 03.3.2 | Aile ve temsil ilişkileri | Varlık Kimliği, Görsel Dünya ve kullanım bağlamı seçimleri; aile oluşturma ve üyeleri ilişkilendirme. Onaylı kesin Ana Tasarımı seçme, her Türetilmiş Varlığın kaynağını belirtme; farklı dünyadaki temsili ayrı aileye bağlama. |
| 03.4 | Varlık ayrıntısı | Büyük varlık önizlemesi; ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları. Geçerli görsel kurallar, perspektif, ölçüler, kesin Ana Tasarım, referans amaçları ve mevcut üretim hedefinin özeti; bu kayıt ve hedefle 04.1 paket hazırlığına geçiş. Onaylı Sürüm ve alternatifler; İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu ve Kayıt Durumu ayrı görünür. Alt alanları açma, kaydı arşivleme veya yeniden etkinleştirme. |
| 03.4.1 | Oyun İçi Bilgiler | Seçili kare/görsel üzerinde pivot, zemin, sıralama, bağlantı noktaları (`mount point`) ve efekt başlangıç noktaları; vuruş, hasar alma ve çarpışma alanları ile olaylar. Katmanları gösterme/gizleme, noktaların koordinatlarını ve diğer değerleri düzenleme, kesin sürüm ve kare bağlantısını inceleme; bilinmeyen alanlar açıkça belirtilir. |
| 03.4.2 | Sürümler ve dosyalar | Birim ve Birleşik Sürüm listeleri; her sürümün önizlemesi, inceleme durumu, kesin bileşim üyeleri ve dosyaları. Dosyaları inceleme; 03.4.2.3 ile iki sürümü karşılaştırma, seçili sürümü 05.1 incelemeye veya 05.3 düzenleyiciye açma. Yeni bileşim ve harici çalışma dosyasına geçiş. |
| 03.4.2.1 | Yeni bileşim oluşturma | Kaynak bileşimin birimleri ve seçilebilecek kesin Birim Sürümleri. Değişecek/korunacak birimleri karşılaştırma, üyeleri seçme ve eski bileşimi koruyarak yeni Birleşik Sürüm oluşturma. |
| 03.4.2.2 | Harici çalışma dosyası | Yönetilen Kopya ve masaüstündeki Canlı Dosya Bağlantısı durumu; dosyayı harici düzenleyicide açma. Algılanan değişikliği inceleyip PNG/WebP sonucunu yeni Aday Sürüme bağlama. Dosya bulunamaz veya erişilemezse yeniden seçme; webde dosya yükleme yolu. |
| 03.4.2.3 | Sürüm karşılaştırması | Aynı varlığın karşılaştırılacak iki kesin sürümü ve yan yana önizlemeleri. Ortak yakınlaştırma ve çok kareli içerikte kare seçimi; görsel, ölçü, Oyun İçi Bilgiler ve Bileşim Üyeliği farkları. Kaynak sürümleri veya seçilen sürümün 05.1 incelemesini açma. |
| 03.4.3 | Üretim kanıtları | Kaynak türü ve mevcut/eksik üretim kanıtları; bilinmeyen geçmiş açıkça belirtilir. Elle İçe Aktarma Kanıtında paket, gerçek talimat, kaynak yüzeyi ve sonuç dosyası; Sağlayıcı Üretim Kaydında mevcut ayrıntılar. Sağlayıcı, arayüz, model/sürüm, istenen/gerçekleşen ölçüler, tohum ve diğer üretim parametrelerini elle girme formu. Elle girilen değerleri Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları olarak bağlantı verisinden ayrı gösterme; boş sağlayıcı alanları Bilinmiyor kalır ve kullanıcı bildirimi tek başına onayı engellemez. Eski varlık için Geçmiş Varlık Beyanı girme. |
| 03.4.4 | Hak Kayıtları | Seçili varlık veya referansın Hak Kaydı: kaynak, hak sahibi/sağlayıcı, izin kapsamı, kısıt ve belirsizlik. Metin/URL ve dosya kanıtı ekleme; Belgelendi/Yalnız Beyan/Bilinmiyor/Kısıtlı seçimi. Önceki kaydı koruyarak yeni sürüm oluşturma; Ana Tasarım, referans ve bağımlı kaynakların ayrı hak geçmişlerini açma. |
| 03.4.5 | Bağımlılık bağlantıları | Varlığın kaynak Ana Tasarımı ve bağımlı olduğu kesin kayıtlar; kimlik, siluet, ekipman, palet, Tema, perspektif veya zamanlama türleri. Bağlantı ekleme/düzenleme, eksik bağımlılıkları görme ve 05.5 değişiklik etkisine geçiş. |
| 03.4.6 | Görsel ölçüler | Dosyadan doğrulanan Kaynak Görsel Ölçüsü; mantıksal çözünürlük, hücre, görünür içerik sınırı, gösterim ölçeği ve atlas ölçüleri için ayrı alanlar. Sınırın koordinat temeli ve önerilen/doğrulanmış değerler. Hazır veya özel kare/dikdörtgen ölçü girme; tam sayı olmayan gösterim ölçeğinde keskinlik uyarısı. |

**Bağlantı:** Koleksiyon ve aile görünümü aynı 03.4'ü açar. Yeni kayıt formu 03.1.1'dir; içe aktarmadan da aynı form açılır. Aile ilişkileri 03.3.2'de, bağımlılıklar 03.4.5'te yönetilir. Kalıcı silme 07.3'tedir.

## 04. Üretim ve İçe Aktarma

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 04.1 | Üretim Paketi | Hedef, etkin bağlam kopyası, kesin Ana Tasarım, ölçüler ve beklenen çıktı alanları. Korunacak/değişecek/kaçınılacak özellikleri ve sabit birimleri belirleme; referansları inceleyip Üretim Paketi oluşturma. Kesinleşen paketi 04.1.2 içinde açma. |
| 04.1.1 | Referans panosu | Yan yana referans görselleri, notlar ve her görselin hazır/özel kullanım amacı. Görsel ekleme, izinli/yasak aktarımı düzenleme ve çakışmayı çözme. Referansın 03.4.4 Hak Kaydını açma; kimlik sınırı değişecekse 02.1.1.1 istisnasına geçiş. |
| 04.1.2 | Üretim paketi ayrıntısı ve geçmişi | Değişmez Üretim Paketleri ve seçili denemenin sabitlenmiş bağlam, Ana Tasarım, referans, ölçü ve çıktı özeti. Paketi harici üretimde kullanmak üzere inceleme; paket özetini kopyalama, pakete bağlı Ana Tasarım ve referans görsellerini indirme kontrolleri. Doğal dil talimatını harici üretim yüzeyinde kullanıcı yazar. İlişkili sonucu 04.2 ile içe aktarma ve bağlı Aday Sürümün kanıtlarını açma. |
| 04.2 | İçe Aktarma Gelen Kutusu | Yapıştırma, sürükleme veya yükleme alanı; dosya önizlemeleri, kaynak türü ve her dosyanın aktarım sonucu. Desteklenmeyen/okunamayan dosya ve eksik kanıt açıklamaları. Hedefsiz girdileri bekletme; 04.2.2 ilişkilendirmesine, metadata eşlemeye ve üretim kanıtına geçiş. |
| 04.2.1 | Metadata eşleme | Görsel ve JSON sidecar için kare, süre, tag, slice, pivot, dokuz parça ve palet alanlarının kaynak/hedef karşılaştırması. Alan bazında tanılama ve çakışma çözümü; isteğe bağlı Bilinmiyor değerleri koruma. Yeni öneriyi önceki kullanıcı kararından ayrı kesinleştirme. |
| 04.2.2 | Hedef ilişkilendirme | Seçili girdinin görseli ve kaynak bilgisi yanında hedef Varlık Kaydı, yön/animasyon/durum veya birim seçimleri. Yeni kayıt gerekiyorsa aynı 03.1.1 formunu açma. Kullanıcı ilişkiyi kesinleştirince oluşan Aday Sürümü açma; onay için 05.1 kullanılır. |
| 04.3 | Üretim Deneyleri | Deney listesi; ortak üretim amacı belirleme ve her denemeye ayrı paket/Aday Sürüm ekleme. Sonuçları ve bağlam, Ana Tasarım, referans, talimat, ölçü, çıktı yapısı ve varsa üretim parametresi farklarını karşılaştırma. Seçim/sonuçsuzluk/bırakma kararı; öğrenimi 02.1.1 önerisine aktarma, ayrıştırılamayan nedenleri belirtme. |
| 04.4 | Üretim Tarifleri | Tarif listesi ve sürümler; seçilen deneyden tarif oluşturma. Talimat iskeleti, referans rolleri, çıktı yapısı ve sabit/doldurulacak alanları düzenleme. Güncel girdilerle paket hazırlama veya başka projeye bağımsız kopyalama; eksik girdileri ve kural çatışmalarını çözme. |

**Bağlantı:** Gelen sonuç 03.4'teki varlığa ve 05.1'deki incelemeye bağlanır. Eksik üretim kanıtı aynı 03.4.3 alanından tamamlanır. Deney öğrenimi 02.1.1'de öneri olarak açılır. Deney seçimi varlığı onaylamaz. Mevcut dosyalar paket hazırlanmadan da içe alınabilir.

## 05. İnceleme ve Kalite Kontrolü

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 05.1 | Sürüm incelemesi | Seçili kesin sürümün önizlemesi, kalite kanıtları, onay engelleri ve karar geçmişi. Önceki sürümle karşılaştırmak için aynı 03.4.2.3 görünümünü açma. Onay/ret/yeniden Aday seçimi ve gerekçe alanı; kullanıcı kararıyla yeni İnceleme Kaydı oluşturma. İnceleme, bağlama uygunluk, kalite ve kayıt durumları ayrı gösterilir. |
| 05.1.1 | Toplu inceleme | Seçili sürümlerin yan yana önizlemeleri ve her öğenin kendi kanıtları/engelleri. Her uygun öğe için ayrı karar; engelli öğelerin nedenleri görünür kalır. |
| 05.1.2 | Kalite İstisnası | İstisnaya izin veren kural, gözlenen değer, kesin sürüm, kullanım kapsamı, Bağlam Sürümü ve Ana Tasarım. Gerekçe girme ve istisnayı kesinleştirme; bütünlük, zorunlu inceleme ve test kanıtı eksikliği istisnayla aşılmaz. |
| 05.2 | Profil testleri | Seçili sürümün türü, etkin profil sözleşmesi ve değerlendirme sonuçları. Uygun test alanını açma, kesin test girdilerini seçme ve kanıtları inceleme; özel profili olmayan tür için Genel Varlık Desteğine geçiş. |
| 05.3 | Son Dokunuş Piksel Düzenleyicisi | Üstte kaynak sürüm/aile ve taslak durumu; solda araçlar, ortada tuval, sağda sayısal ayarlar ve çok kareli içerikte altta kare şeridi. 1×/tam sayı yakınlaştırma ve şeffaflık zeminleri. Tuval yakınlaştırmasından bağımsız, sürekli görülebilen gerçek kullanım boyutu önizlemesi; 1×, 2× veya seçili tam sayı Gösterim Ölçeği. Geri al/yinele, yerel taslak kaydı ve “Bitir ve yeni Aday Sürüm oluştur” kontrolü. |
| 05.3.1 | Piksel ve palet araçları | Kalem, silgi, renk seçici, çizgi ve kesin renk doldurma; seçim, kes/kopyala/yapıştır, piksele oturan taşıma, çevirme ve 90° döndürme. Kırpma, tuval ölçüsü ve tam sayı ölçekleme; palet kilidi, yabancı renkler ve toplu değişimde etkilenecek piksel sayısı. |
| 05.3.2 | Görsel sayfasını dilimleme | Hücre genişliği/yüksekliği, satır/sütun, başlangıç ofseti, boşluk ve okuma sırası alanları. Numaralı hücre sınırları ve oynatılabilir kare önizlemesi; kaynak görseli koruyarak dilimlemeyi çalışma taslağına uygulama. |
| 05.3.3 | Kare ve animasyon düzenleme | Kare şeridi; ekleme, çoğaltma, silme, dosyayla değiştirme ve sıralama kontrolleri. Kare süresi, X/Y ofseti, pivot ve koru işareti; oynat/durdur, döngü ve önceki/sonraki soluk kareler. Zemin hizasını karşılaştırma. |
| 05.3.4 | Fark ve seçici düzeltme | Orijinal/taslak farkını yan yana, üst üste veya durdurulabilir geçişle görme; değişen piksel/kare listesi, değişen piksel sayısı ve değişiklik sınır kutusu. Görsele yazılmayan ok, bölge ve notlar; sorunlu/korunacak birimleri 04.1 paketine aktarma. Dönen seçeneği taslağı ezmeden karşılaştırma. |
| 05.4 | Sahne Kalite Kontrol Alanı | Karo, arka plan, karakter, obje, gölge ve efekt için kesin sürüm seçip yerleştirilen sahne. Karakter hareketi, bekleme/yürüme/saldırı geçişleri, olay anı, katman/Y sırası ve kamera kontrolleri. Metadata katmanlarını gösterme; sonucu 05.2.1.2 ile kanıta bağlama. |
| 05.5 | Yeniden doğrulama | Değişen kural veya Ana Tasarım; doğrudan/dolaylı etkilenen varlıklar ve etki nedenleri. 05.5.2 ile değişiklik kapsamını belirtme; etkilenen sürümü yeniden incelemeye veya düzeltmeye açma. Yeniden Doğrulama Gerekli durumu geçmiş onaydan ayrı gösterilir. |
| 05.5.1 | Tarihsel bileşim | Geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtı seçimleri. Kesin tarihsel bileşim için uyumluluk raporu ve çözülemeyen engeller; bu seçim güncel yeniden doğrulama ihtiyacını kaldırmaz. |
| 05.5.2 | Değişiklik kapsamı | Değişen Bağlam Sürümleri veya eski/yeni Ana Tasarım; etkilenen kimlik, siluet, ekipman, palet, Tema, perspektif ve zamanlama seçimleri. Kullanıcının Değişiklik Tanımını kaydetmesi; eşleşen doğrudan/dolaylı bağımlılıkları 05.5 listesinde görme. |

### 05.2'ye bağlı değerlendirme alanları

Ortak test çerçevesini bir kez tasarla; sonra aşağıdaki türlere uyarlayarak ilerle.

| Alan | Test alanı | Görsel çalışma alanı |
| --- | --- | --- |
| 05.2.1 | Ortak test çerçevesi | Bütünlük, ölçülebilir gereksinim, uyarı, insan incelemesi ve kullanım testi sonuçları ayrı gruplar. Her sonuçtan kural, şüpheli kare/bölge ve kanıta geçiş. 05.2.1.1 sözleşmesini açma; 05.2.1.2 ile test ve kullanıcı değerlendirmesini kaydetme. |
| 05.2.1.1 | Özel Profil Sözleşmesi | Sözleşme sürümleri; metadata alanları, kural sınıfları, zorunlu insan incelemesi/kullanım testleri, istisna izni ve dışa aktarım eşlemeleri. Geçerli sürümü inceleyip etkinleştirme; yeni kurallardan etkilenen kanıtları görme. |
| 05.2.1.2 | Değerlendirme ve test kanıtı | Kesin varlık/birim/bileşim, profil sürümü, test ortamı ve kanıtlar. Otomatik sonuçları inceleme; zorunlu insan değerlendirmesi ile Geçti/Başarısız/Sonuçsuz kullanım testi sonucunu kaydetme. Tutarlılık/yanlış uyarı geri bildirimi ve önceki değerlendirmeler. |
| 05.2.2 | Karakter ve animasyon | Ana Tasarım ve yön önizlemeleri, zaman çizgisi ve kareye bağlı bilgiler. Eşzamanlı oynatma, 1× görünüm, soluk kareler ve değişken süre kontrolleri; döngü/geçiş, pivot, zemin, bağlantı noktası ve olay zamanlarını karşılaştırma. |
| 05.2.3 | Obje ve ekipman | Obje/ekipmanın durum ve yön önizlemeleri; onaylı karakter, proje ızgarası ve farklı zeminlerle kullanım sahnesi. Durum geçişlerini oynatma; ölçek, pivot, zemin, sıralama ve bağlantı noktalarını karşılaştırma. |
| 05.2.4 | İkon | İkonun kaynak, mantıksal ve gerçek kullanım ölçülerindeki önizlemeleri; aile üyeleri yan yana. Açık/koyu zemin ve gri tonlama seçenekleri; siluet, iç boşluk, ışık, kontur ve durum/nadirlik renklerini karşılaştırma. |
| 05.2.5 | Efekt | Efektin tek başına ve sahibiyle birlikte önizlemesi; hücre sınırı ve zaman çizgisi. Zemin, şeffaflık, süre/döngü, başlangıç noktası ve katman kontrolleri; taşmayı ve oyun olayıyla eşzamanlamayı inceleme. |
| 05.2.6 | Karo ve doku | Karo testi ve doku tekrarı için ayrı görünümler. Karo atlası ve boyanabilir haritada köşe/kenar/koridor/dolgu/rastgele yerleşim; sorunlu karoyu seçme. Dokuda 2×2, 3×3 ve kaydırmalı tekrar; kesin kenar eşleşmesi ile görünür tekrar izini ayrı inceleme. |
| 05.2.7 | Arka plan | Arka plan katmanları, hedef görüntü oranı, kırpma ve oyuncu güvenli alanı. Katman sırası, göreli hız ve kaydırma kontrolleri; döngü birleşimi, kontrast ve oyuncu görünürlüğünü hareket halinde inceleme. |
| 05.2.8 | Oyun arayüzü varlıkları | Aynı ailede ekran, panel ve bileşenler; normal, üzerine gelme, basılı, devre dışı, seçili, açık/kapalı durumlar. Durum ve hedef ölçü seçimi; paneli farklı boyutlarda germe, dokuz parça paylarını ve metin güvenli alanını görme. Düzeltilen bileşeni ekran yerleşiminde sınama. |
| 05.2.9 | Portre, logo ve tanıtım | Portre ve logo/tanıtım için ayrı kullanım görünümleri. Portrede ifade, Ana Tasarım bağı ve diyalog/arayüz kırpması; logo/tanıtımda hedef ölçü, güvenli alan, açık/koyu zemin ve şeffaf/opak kullanım. Kimlik ve küçük boyut okunurluğunu karşılaştırma. |
| 05.2.10 | Genel Varlık Desteği | Özel profili olmayan yazı tipi, imleç ve yardımcı görsellerin kayıt/dosya bilgileri ve uygun önizlemesi. Temel bütünlük sonuçlarını ve kullanıcı incelemesini açma; türe özgü test kanıtı iddia edilmez. |

**Bağlantı:** Kütüphane, aile ve teslimat engelleri aynı test/inceleme araçlarını açar. Profil ve sahne testlerinin kanıtı ortak 05.2.1.2'de kaydedilir. Piksel düzenleyicisi seçili sürümden açılır; yeniden çizim gereken iş 04.1'e aktarılır. Tarihsel seçim güncel yeniden doğrulama ihtiyacını kaldırmaz.

## 06. Teslimat

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 06.1 | Hedef ve Hazırlık Planı | Teslimat Hedefleri ve her hedefin etkin sürümü, amacı, kapsamı ve Hazır/Engelli durumu. Hedef oluşturma veya seçme; 06.1.1 hedef tanımını ve 06.1.2 Hazırlık Planını açma. Teslim Edildi sonucu hazırlık durumundan ayrı görünür. |
| 06.1.1 | Teslimat Hedefi tanımı | Amaç, gerekli aileler/liste sürümleri, Bağlam Sürümü, kullanım testleri ve kabul koşulları. Üretim Kanıtı/Hak Kanıtı Politikaları ile gerekli çalışma zamanı ortamlarını seçme. Yeni tabana geçerken kapsam, kural ve tamamlanma farklarını inceleme; taslağı yeni hedef sürümü olarak etkinleştirme ve geçmiş sürümleri açma. |
| 06.1.2 | Hazırlık Planı | Etkin hedefin engelleri, eksik kanıtları ve bir düzeltmeyle açılacak işler. Hedef zorunluluğu, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçeler; iş sırasını değiştirme ve her engelden ilgili düzeltme alanına geçiş. |
| 06.2 | Profil ve paket | Dışa Aktarım Profili sürümü, kesin varlık/birim/bileşim girdileri ve paket içerik özeti. Bağlam, gerekli liste, üretim/hak/kalite kanıtı ve istisna seçimlerini inceleme; engelleri çözme ve paket oluşturma. Sonucu 06.2.3 paket ayrıntısında açma. |
| 06.2.1 | Paket doğrulama | Doğrulanacak paketi seçme ve Paket Doğrulama Kitinin şema, dosya özetleri, README ve sürümünü görme. Ağ olmadan doğrulamayı başlatma; eksik/uyuşmayan dosya, yinelenen yol ve bozuk kayıt bağlantısı sonuçlarını inceleme. |
| 06.2.2 | Dışa Aktarım Profili | Profil sürümleri; yerleşim, padding, trim, ölçek, biçim ve adlandırma alanları. Metadata eşlemelerinde alan kimliği, birim ve koordinat sistemi; bilinmeyen/eksik alan davranışı. Ayarları yeni profil sürümü olarak kaydetme ve pakette kullanılacak sürümü seçme. |
| 06.2.3 | Paket ayrıntısı ve geçmişi | Değişmez paket listesi; seçili paketin manifesti, dosya yolları/özetleri, sabitlenmiş sürümleri, kanıtları ve istisnaları. Paketi ve Doğrulama Kitini indirme; 06.2.1 doğrulamasına, Godot çıktısına, oyun testine veya teslimat konumuna geçiş. |
| 06.3 | Godot çıktısı | Kaynak Dışa Aktarım Paketi, desteklenen Godot ve bağdaştırıcı sürümü, üretilecek dosyalar. Motor çıktısını oluşturma/indirme; kare, pivot, zamanlama, olay ve geçerli karo/arayüz eşlemelerini inceleme. Gerçek oyun testine 06.4 ile geçiş. |
| 06.4 | Oyunda doğrulama | Kesin paket, oyun yapısı, motor/bağdaştırıcı sürümü ve doğrulama geçmişi. Görüntü, video, test sonucu veya gözlem ekleme; elle/izinli araç kaynaklarını ayırma. Geçti/Başarısız/Sonuçsuz sonucunu, başarısızlık kaynağını ve etkilenen kapsamı kesinleştirme. |
| 06.5 | Güvenli yenileme | Seçili konum, paket ve Teslimat Yenileme Kilidi. İlk teslimat için 06.5.1; sonraki yenilemede değişmemiş/güncellenecek/bayat/eksik/ayrışmış yollar. Farkı inceleyip koruma, başka konum veya açık değiştirme kararı; uygulanan ve durdurulan yolları ayrı görme. Webde değişiklik paketini, kilidi ve ayrışma raporunu indirme; masaüstünde izinli klasöre yenilemeyi uygulama kontrolleri. |
| 06.5.1 | İlk teslimat ve konum seçimi | Uygulanacak kesin paket ve teslimat konumu; masaüstünde klasör seçimi/erişim izni, webde indirilecek paket ve elle uygulama yolu. İlk uygulamayı başlatma; yazılan göreli yolları, oluşan Teslimat Yenileme Kilidini ve varsa kısmi başarısızlığı görme. |
| 06.6 | Teslimatı kesinleştirme | Hazır hedefin gereksinimleri ve her birini karşılayan kesin paket/sürümler ile gerekli kullanım/çalışma zamanı kanıtları. Eksik veya örtüşen eşlemeleri çözme; geçerli seçimlerle Teslimat Gerçekleşmesini kesinleştirme. Hazır ve Teslim Edildi durumları ayrı gösterilir. |
| 06.6.1 | Teslimat geçmişi | Teslimat Gerçekleşmesi listesi; kayıt ayrıntısını veya karşılaştırılacak iki kaydı seçme. Eklenen/çıkarılan/değişen varlıklar, bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemeleri ayrı fark grupları. İlgili kesin kayıtları açma. |
| 06.6.2 | Tarihsel Risk Bildirimleri | Etkilenen geçmiş teslimatlar, riskli kaynak, yeni Hak Kaydı sürümü, sabitlenmiş politikayla uyuşmazlık ve saptama zamanı. Kaynak hak kaydını veya teslimat ayrıntısını açma; geçmiş Teslim Edildi sonucu korunur. |

**Bağlantı:** Eksik varlık 03'e, kalite engeli 05'e, hak kaydı 03.4.4'e gider. Dışa Aktarım Profili (06.2.2) paket girdilerinden önce seçilir. Godot çıktısı ile oyunda doğrulama kardeş alanlardır. “Hazır” ve “Teslim Edildi” ayrı gösterilir.

## 07. Ortak işlemler

| Alan | Tasarım | Ekranda ne bulunacak? |
| --- | --- | --- |
| 07.1 | Çevrimdışı çalışma ve çakışma | Cihazdaki yerel taslaklar, bağlı oldukları proje/kaynak sürüm ve kayıt durumları. Taslağı yeniden açıp çalışmaya devam etme; bağlantı dönünce güncel tabanı kontrol etme. Bulut ilerlemişse 07.1.1 Çakışma çözümünü açma; çevrimdışı taslak bulut kararı sayılmaz. |
| 07.1.1 | Çakışma çözümü | Taban sürüm, güncel bulut ve yerel taslağın üçlü karşılaştırması. Yeni Aday Sürüm oluşturma, bulutu koruyup taslağı saklama veya 08.3.2 ile açıkça bırakma seçenekleri. Bağlam, inceleme ve teslimat gibi kesin kararlar için güncel bulut tabanında yeni karar oluşturma; seçilen çözümün kesin sonucu. |
| 07.2 | İşlem durumu ve kurtarma | İşlem listesi; kimlik, tür, kapsam, durum, ilerleme, denemeler ve kesin sonuç. Bağlantı döndüğünde güncel sonucu bulma; başarısız işte güvenli yeniden deneme ve uygun işte iptal isteme. İptal isteği ile kesin iptal sonucu ayrı gösterilir. |
| 07.3 | Kalıcı silme | Silinecek kayıtlar, Yönetilen Kopyalar, bütün paket/arşivler ve etkilenen teslimatların kapsamı/sayıları. Kapsam dışı kopyalar, geri alınamaz sonuç ve yedek saklama takvimi; içeriksiz Silme Kaydı bırakma seçimi. Kesin dökümü 08.3.3 ile onaylama; başladıktan sonra 07.3.1 sonucunu açma. |
| 07.3.1 | Silme sonucu ve makbuz | 07.2 ortak işlem görünümüyle silme ilerlemesi; etkin depo temizliği ve yedeklerden kaldırma takvimi. İçeriksiz Silme Makbuzunu açma, kapsam dışında kalan kopyaları ve varsa oluşturulan içeriksiz Silme Kaydını görme. |

**Bağlantı:** Varlık silme ve arşiv silme aynı 07.3 akışını farklı kapsamla açar. Arşivleme, geri yükleme, paket oluşturma, doğrulama ve silme ilerlemesi aynı 07.2'yi kullanır. Her ana arayüz için yeni bir silme veya kurtarma tasarımı oluşturulmaz.

## 08. Ortak sayfalar ve ekran durumları

Ortak tasarımları bir kez oluştur ve ilgili arayüzlerde kullan. Aşağıda **sayfa**, bütün içerik alanını; **ekran durumu**, mevcut ekranın veya panelin bir durumunu ifade eder.

### 08.1. Ortak sayfalar

| Alan | Sayfa | Ekranda ne bulunacak? |
| --- | --- | --- |
| 08.1.1 | 404 — Sayfa bulunamadı | Sayfa bulunamadı başlığı, geçersiz adres açıklaması ve Projeler ekranına dönüş kontrolü. |
| 08.1.2 | Erişim reddedildi | Erişim reddi açıklaması ve erişilebilir projelere dönüş kontrolü. Korunan proje bilgisi, içerik veya önizleme gösterilmez. |
| 08.1.3 | Oturum sona erdi | Oturumun sona erdiği ve yeniden giriş gerektiği açıklaması; 01.1 Giriş'e geçiş kontrolü. Varsa yerel taslağın kayıt durumu görünür kalır. |
| 08.1.4 | Sayfa yüklenemedi | Sayfanın yüklenemediği açıklaması, güvenli yeniden yükleme ve Projeler ekranına dönüş kontrolleri. Beklenmeyen sunucu hatasında Destek Referansı gösterilir. |

### 08.2. Mevcut ekranın durumları

| Alan | Durum | Ekranda ne bulunacak? |
| --- | --- | --- |
| 08.2.1 | Loading — Yükleniyor | Liste, ayrıntı veya önizleme alanında yükleme göstergesi ve içeriğin yerini koruyan yer tutucular. Yüklenen bölüm ile kullanılabilir içerik ayırt edilir. |
| 08.2.2 | Boş içerik | Henüz içerik olmadığını açıklayan mesaj. Ekranın bağlamına göre proje/koleksiyon oluşturma, varlık içe aktarma veya teslimat hazırlama işlemine geçiş. |
| 08.2.3 | Arama sonucu bulunamadı | Arama/filtrelerle eşleşen kayıt olmadığı mesajı; mevcut arama ve filtreler görünür kalır. Aramayı değiştirme veya filtreleri temizleme kontrolleri. |
| 08.2.4 | Kayıt bulunamadı | Seçilen proje, varlık veya sürümün görüntülenemediği açıklaması ve ilgili listeye dönüş kontrolü. Yetkisiz kişiye özel kaydın bilgileri verilmez. |
| 08.2.5 | Önizleme yüklenemedi | Görselin yerinde önizleme hatası ve güvenli yeniden deneme kontrolü. Erişilebilir kayıt bilgileri ve diğer kullanılabilir alanlar görünür kalır. |
| 08.2.6 | Veri yükleme hatası | Başarısız liste/panel içinde hata açıklaması ve aynı okumayı yeniden çalıştıran kontrol. Beklenmeyen sunucu hatasında Destek Referansı; diğer bölümler kullanılabilir kalır. |
| 08.2.7 | Bağlantı kesildi / çevrimdışı | Bağlantı kesintisi bildirimi, yerel taslağın durumu ve kullanılabilir çevrimdışı işlemler. Taslak/çakışma yönetimi için 07.1 geçişi; bulutta kesinleşmeyen sonuç açıkça belirtilir. |
| 08.2.8 | Form doğrulama hatası | Eksik veya geçersiz alanın yanında düzeltme açıklaması. Girilmiş değerler korunur; kullanıcı sorunlu alanı düzelterek işlemi tekrar gönderebilir. |
| 08.2.9 | İşlem engellendi | İşlemi engelleyen koşul ve düzeltme yolu. Eksik kanıt, kalite engeli ve bilinmeyen sözleşme sürümü ayrı belirtilir. Desteklenmeyen platform/biçim veya kapasite sınırında ilgili sınır ve 00.4 bilgilerine geçiş gösterilir. |
| 08.2.10 | Kaydediliyor | Devam eden kaydı gösteren bildirim ve ilgili kaydın adı. Kesin sonuç alınana kadar başarı mesajı gösterilmez. |
| 08.2.11 | Yerel taslak kaydedildi | Taslağın bu cihazda saklandığını belirten bildirim. Bulut kaydının henüz kesinleşmediği açıkça gösterilir; taslağı incelemeye erişim. |
| 08.2.12 | Bulut kaydı tamamlandı | Bulut kaydının tamamlandığını belirten bildirim ve güncel kayıt durumu. Kullanıcı kesinleşen sonucu ilgili kayıtta görebilir. |
| 08.2.13 | Kaydedilemedi | Yazmanın gerçekleşmediği doğrulanmışsa hata açıklaması ve güvenli sonraki adım. Taslak ve girilmiş içerik korunur. |
| 08.2.14 | İşlem sonucu belirsiz | İşlem sonucunun henüz doğrulanamadığı açıklaması ve güncel durumu sorgulama eylemi. Başarı/başarısızlık ilan edilmez; aynı yazmayı tekrar gönderen işlem sunulmaz. |
| 08.2.15 | İşlem ilerlemesi ve sonucu | Bekliyor, çalışıyor, tamamlandı, başarısız, iptal istendi ve iptal edildi bildirimleri. İlerleme veya kesin sonuç özeti; seçildiğinde 07.2 işlem ayrıntısı açılır. |

### 08.3. Ortak onay pencereleri

| Alan | Pencere | Ekranda ne bulunacak? |
| --- | --- | --- |
| 08.3.1 | Kullanıcı kararını onaylama | Verilecek kararın kapsamı, gerekçesi ve beklenen sonucu. Onay, istisna veya değişiklik için açık kesinleştirme ve vazgeçme kontrolleri. |
| 08.3.2 | Taslağı bırakma | Bırakılacak yerel taslağın içeriği ve geri alınamayan sonucun açıklaması. Taslağı koruma veya açıkça bırakma kontrolleri. |
| 08.3.3 | Kalıcı silme onayı | 07.3 dökümündeki kesin kapsam, etkilenen içerik sayıları ve geri alınamaz sonuç. Silmeyi onaylama veya vazgeçme; döküm değişirse yeni kapsam için yeniden onay gerekir. |

**Bağlantı:** 08 görsel durumları ve ortak pencereleri tanımlar. Çakışma çözümü, işlem kurtarma ve silmenin ayrıntılı akışları 07'ye aittir. Her ana arayüz bu ortak tasarımları kendi içeriğiyle kullanır.

### Bütün tasarımlarda uygulanacak kurallar

| Konu | Tasarımda gösterilecek |
| --- | --- |
| Erişilebilirlik | Klavye kullanımı, görünür odak, ekran okuyucu adları ve durum bildirimleri; yalnız renkle anlatılmayan durumlar, erişilebilir özellik paneli, durdurulabilir animasyon ve azaltılmış hareket. |
| Web / masaüstü | Aynı iş sonucu; webde yükleme/indirme yolu. İlgili işlemde yayımlanmış platform, sürüm ve kapasite sınırları. |
| Güvenli hata açıklaması | Sunucu hatasında Destek Referansı; bağlantı hatasında üretilmiş gibi bir referans gösterilmez. Ham hata ayrıntıları ve sırlar gösterilmez. |
