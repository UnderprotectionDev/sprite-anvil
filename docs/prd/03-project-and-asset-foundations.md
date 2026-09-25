> [PRD içindekiler](README.md)

### 4.1 Proje bağlamı

**CTX-01 — Yetkili proje bağlamı.** Proje Bağlamı, tek bir oyun projesinin onaylanmış görsel kurallarını, istisnalarını ve üretim kararlarını tutar. Kuralın kimliği, kapsamı ve değeri yapılandırılmış biçimde kaydedilir. `context.md` dosyasını ajanlar yönetir; kullanıcı ham metni düzenlemez.

Yeni proje için ad ve genel sanat yaklaşımı yeterlidir; ayrıntılar ihtiyaç oldukça eklenir. Kullanıcının etkinleştirdiği kararlar sonraki üretimlerde yeniden sorulmaz.

**CTX-02 — Bağlam önerisi.** Bağlam Ajanı, kullanıcı kararlarını ve gözlenen değişiklikleri sürümlü sözleşmeye uygun Bağlam Önerisi’ne dönüştürür. Öneri, dayandığı Bağlam Sürümü’nü, ajan/model bilgisini, önerilen kuralları ve doğrulama sonucunu kaydeder. Ajan yoksa yapılandırılmış kontroller yaygın kararlar için öneri oluşturabilir; serbest biçimli değişiklikler için ajan gerekir. Açıklama metni tek başına ürün davranışını değiştiremez.

**CTX-03 — Etkinleştirme kapısı.** Kullanıcı inceleyip etkinleştirmedikçe öneri bağlamın parçası olmaz; ajan kendi önerisini etkinleştiremez. Veri yapısı hatası, çakışan kapsam veya çözülmemiş referans çatışması etkinleştirmeyi engeller. Dar kapsamlı kural geniş kapsamlı kuralı geçersiz kılar (proje → Görsel Dünya → Tema → Varlık Ailesi → Varlık → işlem); istisnalar gerekçesi ve kaynak zinciriyle gösterilir.

Palet, kontur ve benzeri kurallar sürümlü Stil Modülleri’nde gruplanabilir; bunlar Proje Bağlamı’nın parçasıdır ve başka projeye kopyalandığında kaynakla otomatik eşitlenmez. Üretim Bağlamı Kopyası, etkin sürümden yalnızca işlem için gereken kuralları alır ve Üretim Paketi ile Aday Sürüm geçmişinde değişmez olarak saklanır.

### 4.2 Görsel Dünya, Tema ve ölçüler

**DIM-01 — Görsel Dünya kapsamı.** Bir projede, her biri kendi görsel kurallarına sahip birden fazla Görsel Dünya bulunabilir. Örneğin oyun içi piksel sanatı, resimli portreler, arayüz ve tanıtım görselleri ayrı Görsel Dünyalar olabilir. Her Görsel Dünya içinde birden fazla Tema bulunabilir.

**DIM-02 — Kimlik ve aile sınırı.** Aynı karakter, obje veya konu farklı Görsel Dünyalarda ve farklı amaçlarla kullanılabilir. Temsiller ortak bir Varlık Kimliği ile ilişkilendirilir; farklı Görsel Dünya veya kullanım bağlamında ayrı Ana Tasarım gereken temsiller ayrı Varlık Ailelerine aittir. Her Varlık Ailesi tek Görsel Dünya, kullanım bağlamı ve Ana Tasarım soyuyla sınırlıdır. Her Türetilmiş Varlık hangi Ana Tasarım’dan üretildiğini belirtir.

**Örnek:** Ash Knight oyun içi sprite ailesi, resimli portre ailesi ve arayüz ikonu ailesi aynı Varlık Kimliğine bağlanabilir; fakat her biri kendi Ana Tasarımına ve Varlık Ailesine sahiptir.

Proje Bağlamı, geçerli olduğu yerlerde perspektif, kamera yaklaşımı, palet, kontur, gölgelendirme, ışık yönü, ayrıntı yoğunluğu, malzeme dili ve kullanılabilecek ya da kaçınılacak motifleri tutar. Bu alanların her Varlık Kaydı için doldurulması gerekmez. Varlık, proje ve Görsel Dünya varsayımlarını devralır; kullanıcı gerektiğinde bunları açıkça değiştirebilir.

**DIM-03 — Bağımsız ölçü değerleri.** Kaynak Görsel Ölçüsü, Mantıksal Çözünürlük, Hücre Ölçüsü, Görünür İçerik Sınırı, Gösterim Ölçeği ve Atlas Ölçüsü ayrı alanlardır. Sistem dosya veya metadata’dan değer önerebilir; doğrulanmamış tahmini yetkili değer yapamaz ve kaynak ölçüden sessizce mantıksal çözünürlük türetemez.

Ölçüler yalnızca önceden belirlenmiş kare seçeneklerden oluşmaz. 16×16, 24×24, 32×32, 48×48, 64×64, 96×96, 128×128, 192×192 ve 256×256 gibi yaygın ölçüler hızlı seçim olarak sunulabilir. Özel kare ve dikdörtgen ölçüler de doğrudan desteklenir. Geçerli bir 72×80 varlık sessizce 64×64 veya 128×128 boyutuna dönüştürülmez.

Piksel sanatı için mantıksal 1× kaynak korunur. Önizleme ve dışa aktarım ölçekleri keskinliği bozmayacak doğal sayı katlarıyla üretilebilir; doğal sayı olmayan Gösterim Ölçeği keskinlik riski olarak açıkça gösterilir. Yüksek çözünürlüklü illüstrasyonlar piksel sanatı kurallarına zorlanmaz.

### 4.3 Varlık kaydı, varlık ailesi ve yaşam döngüsü

**AST-03 — Varlık Kaydı.** Varlık kütüphanesi yalnızca dosyaları gösteren bir galeri değildir. Bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği taşıyan öğe Varlık Kaydıdır; yalnız teknik olarak değiştirilebilir olması ayrı kayıt olmasını gerektirmez. Her Varlık Kaydı onaylı sürümünü, alternatiflerini, türevlerini, referanslarını, kalite kontrol durumunu ve üretim geçmişini saklar.

**AST-04 — Varlık Ailesi.** Aynı Ana Tasarım soyundaki karakter yönleri, animasyonları, varyantları ve ekipmanları aynı Varlık Ailesinde ilişkilendirilebilir. Farklı Görsel Dünya veya kullanım bağlamındaki portre ve ikon gibi temsiller ayrı ailelerde tutulur ve Varlık Kimliği üzerinden bağlanır. Objelerin durumları, arayüz ekranları ve bileşenleri, karo setleri, geçişler ve test haritaları da yalnız kendi aile sınırları içinde bir arada görülebilir.

**AST-05 — Koleksiyon.** Kullanıcı varlıkları ada, Varlık Kategorisine, Temaya, Görsel Dünya’ya, Kaynak Görsel Ölçüsüne, etikete ve Kayıt Durumuna göre arayıp filtreleyebilir. Varlık Kategorisi mevcut sekiz profil grubunu ve diğer kategorileri kapsar; kategori seçimi tek başına Özel Varlık Profili kanıtı değildir. Ölçü filtresi, eşleşen herhangi bir değişmez Varlık Sürümünün Kaynak Görsel Ölçüsünü bulur ve eşleşen sürümü gösterir. Varlık Kategorisi ve etiketler Varlık Kaydı metadata’sıdır; Tema ile Görsel Dünya proje kapsam kataloğundan seçilir. İlişkileri farklı olan Varlık Kayıtları isteğe bağlı Koleksiyonlarda bir araya getirilebilir. Koleksiyon üyeliği soy, kural aktarımı, tamamlanma koşulu, bağımlılık veya teslimat zorunluluğu oluşturmaz.

Bir Varlık Sürümü’nün durumu tek bir alanda tutulmaz. İnceleme Kararı, Bağlama Uygunluk Durumu ve Kalite Kontrol Durumu sürümün değerlendirmesini; Kayıt Durumu ise Varlık Kaydı’nın etkin, arşivlenmiş veya silinmiş olmasını belirtir. Birindeki değişiklik diğerlerinin geçmişini değiştirmez.

| Durum grubu | Değerler ve geçiş kuralı | Yetki |
| --- | --- | --- |
| İnceleme Kararı | Yeni Varlık Sürümü Aday olarak başlar. Kullanıcı bir İnceleme Kaydı oluşturarak Onaylı, Reddedildi veya yeniden Aday kararı verir. Kayıt değişmez; kararı, zamanı ve varsa gerekçeyi saklar. Güncel karar son geçerli İnceleme Kaydı’ndan hesaplanır. | Kararı yalnızca kullanıcı verir. |
| Bağlama Uygunluk Durumu | Seçili Bağlam Sürümü ve Ana Tasarım ile uyumlu sürüm Bağlama Uygun’dur. İlgili bir değişiklik sürümü etkiliyorsa durum Yeniden Doğrulama Gerekli olur. | Sistem kanıta göre hesaplar. Kullanıcı değişikliğin kapsamını ve yeniden inceleme kararını doğrular. |
| Kalite Kontrol Durumu | Yeni veya henüz incelenmemiş sürüm Değerlendirilmedi durumundadır. Başarısız Bütünlük Denetimi, karşılanmamış İstisna Verilebilir Gereksinim veya eksik zorunlu kalite kanıtı varsa sürümün durumu Engel Var olur. Bütünlük Denetimi hatası ve eksik zorunlu kanıt istisnayla aşılamaz. Yalnızca karşılanmamış İstisna Verilebilir Gereksinim için kullanıcı geçerli bir Kalite İstisnası verdiğinde ve başka engel kalmadığında durum İstisnalarla Hazır olur. Tüm zorunlu kanıtlar istisnasız karşılandığında Dışa Aktarıma Hazır olur. | Sistem kalite profili kanıtlarına göre hesaplar. İstisnayı yalnızca kullanıcı tanır. |
| Kayıt Durumu | Değerleri Etkin, Arşivlenmiş ve Silinmiş’tir. Varlık Kaydı Etkin olarak başlar. Kullanıcı kaydı geri alınabilir biçimde arşivleyebilir veya bağımlılıkları gördükten sonra kalıcı olarak silebilir. Silme tamamlanınca kayıt Silinmiş olur. Kullanıcı isterse içeriksiz Silme Kaydı bırakabilir. | Kullanıcı arşivler veya silmeyi başlatır. Sistem silme işlemini yürütür ve makbuz oluşturur. |

Onaylı, Bağlama Uygun, Dışa Aktarıma Hazır ve Etkin farklı anlamlara gelir. Yeni dışa aktarımda kullanılacak sürüm, seçili bileşim için dört durum grubunun koşullarını da ayrı ayrı karşılamalıdır. Ürün bu durumları tek, serbestçe değiştirilebilen bir alanda birleştirmez.

**AST-06 — Bileşim Üyeliği.** Bir Birim Sürümünün daha yeni bir Birleşik Sürümde başka bir birimle değiştirilmesi, eski birime global “Yerini Yeni Sürüm Aldı” durumu vermez. Ürün değişimi kesin Birleşik Sürüm içindeki Bileşim Üyeliği olarak gösterir. Eski birimin İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu ve geçmiş bileşimlerdeki kullanımı değişmeden kalır.

Geniş varlık aileleri yan yana incelenebilir. Toplu onaydan önce ürün her öğenin uygunluğunu ve engellerini gösterir. Onaylanan her öğe için ayrı İnceleme Kaydı oluşturulur. Bütünlük Denetimi hatası veya eksik zorunlu kanıtı bulunan öğe atlanamaz, onaylanamaz ya da istisna alamaz. İstisna Verilebilir Gereksinim nedeniyle engeli bulunan öğe toplu onay sırasında sessizce atlanamaz veya otomatik istisna alamaz; kullanıcı ilgili kural ve sürüm için ayrı, gerekçeli Kalite İstisnası oluşturduktan sonra yeniden hesaplanır.

### 4.4 Yetki ve kullanıcı onayı

**AUT-01 — Hazırlık ve kesinleştirme.** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir. Ajanlar ve bağlantılar öneri hazırlayabilir, ancak kullanıcı onayı gerektiren işlemleri yapamaz.

| İşlem | Yapay zekâ ajanı veya bağlantı | Kurallı sistem | Kullanıcı |
| --- | --- | --- | --- |
| Bağlam önerisi hazırlama | Hazırlayabilir. | Yapılandırılmış kontrollerle hazırlayabilir. | İsteyebilir ve talimat verebilir. |
| Bağlam sürümünü etkinleştirme | Etkinleştiremez. | Doğrular ama etkinleştiremez. | Etkinleştirebilen tek kişidir. |
| Gerekli öğeler listesi taslağı hazırlama | Hazırlayabilir. | Profil varsayımı önerebilir. | Taslağı inceler. |
| Gerekli öğeler listesini etkinleştirme | Etkinleştiremez. | Etkinleştiremez. | Etkinleştirebilen tek kişidir. |
| Teslimat Hedefi taslağı hazırlama | Hazırlayabilir. | Kapsam ve politika yapısını doğrulayabilir. | Hedef sürümünü etkinleştirebilen tek kişidir. |
| Ana tasarım önerme veya seçme | Önerebilir, seçemez. | Uygunluk kanıtı gösterebilir. | Seçimi yalnızca kullanıcı yapar. |
| Üretim paketi hazırlama | Hazırlayabilir. | Bağlamı derler ve çelişkileri engeller. | Paketi inceler ve üretimde kullanır. |
| Aday sürüm içe aktarma | Açık araç izni varsa yapabilir. | Doğrular ve yönetilen kopya oluşturur. | Elle içe aktarabilir. |
| Kaynak metadata eşleme önerisi hazırlama | Açık dosya izniyle öneri hazırlayabilir. | Desteklenen sidecar verisini ayrıştırır, doğrular ve çakışmaları gösterir. | Öneriyi inceler ve zorunlu alanları kesinleştirir. |
| Bağımlılık bağlantısı veya değişiklik tanımı önerme | Önerebilir. | Olası etkileri hesaplar. | Kapsamı doğrular. |
| İnceleme kaydı oluşturma | Oluşturamaz. | Kaydedebilir ama karar veremez. | Oluşturabilen tek kişidir. |
| Kalite istisnası verme | Veremez. | İstisnanın uygulanıp uygulanamayacağını doğrular. | Verebilen tek kişidir. |
| Üretim Deneyi’ni sonuçlandırma | Sonuç ve deneme önerebilir. | Karşılaştırmayı doğrular ama sonuçlandıramaz. | Sonucu ve varsa seçilen denemeyi kesinleştirir. |
| Çalışma Zamanı Doğrulama Kaydı hazırlama | Açık araç izniyle kanıt ve sonuç taslağı hazırlayabilir. | Teknik kanıtı doğrulayabilir. | Sonucu ve başarısızlık kaynağını kesinleştirir. |
| Dışa aktarım paketi oluşturmayı başlatma | Başlatamaz. | Gerekli kontrolleri yapar ve kullanıcı isteğini yürütür. | Başlatabilen tek kişidir. |
| Ayrışmış teslimat hedefini çözme | Seçenek ve fark hazırlayabilir; karar veremez. | Dosya özetlerini ve sahip olunan yolları doğrular. | Hedef dosyayı koruma, yeni hedef seçme veya açıkça değiştirme kararını verir. |
| Teslimat Gerçekleşmesi hazırlama | Paket ve gereksinim eşlemesi önerebilir. | Kapsamı ve çakışmaları doğrular. | Değişmez gerçekleşmeyi oluşturabilen tek kişidir. |
| Proje arşivi oluşturma veya geri yükleme | Kendiliğinden başlatamaz. | Kullanıcı isteğini yürütür ve doğrular. | İşlemi başlatır. |
| Kalıcı silme | Başlatamaz. | Onaylanmış silme işlemini yürütür. | Silmeyi başlatabilen tek kişidir. |

Bir araca verilen izin yalnızca belirli bir teknik işlemi kapsar; kullanıcı adına karar verme yetkisi vermez. Başarısız veya yarıda kalan işlem ürün verilerini kısmen değiştiremez. Kullanıcı işlemin durumunu ve yeniden denenip denenemeyeceğini görür.

