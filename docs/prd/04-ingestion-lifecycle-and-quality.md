> [PRD içindekiler](README.md)

### 4.5 Referanslar, üretim paketi ve içe aktarma

**IMP-01 — Referans rolü.** Referans panosu görsel yapıştırmayı, sürükleyip bırakmayı, görselleri yan yana düzenlemeyi ve not eklemeyi destekler. Her referansa kullanım amacı atanır. Hazır amaçlar en az şu seçenekleri kapsar:

- Kimliği, silueti ve ayırt edici özellikleri korumak
- Yalnızca poz veya hareket aktarmak
- Yalnızca çizim ya da görüntüleme stilini aktarmak
- Yalnızca palet veya renk ilişkisini aktarmak
- Yalnızca ekipman ya da malzeme tasarımını aktarmak
- Yalnızca kompozisyonu, kamerayı veya yerleşimi aktarmak
- Tema ve çevre dilini aktarmak
- Belirli özelliklerden kaçınmak

Kullanıcı hazır seçeneklerle sınırlı değildir. Özel bir kullanım amacı ve açık aktarım ya da yasak sınırları tanımlayabilir. Bu sınırlar referans aktarım kuralı olarak kaydedilir. Açık yasak, genel aktarma izninden önceliklidir. Ana tasarımın kimlik sınırını aşmak için Bağlam Kuralı İstisnası açıkça kaydedilmelidir.

Aynı ayrıntı düzeyindeki referanslar arasında çözülememiş bir çelişki varsa üretim paketi oluşturulamaz. Referansların eklenme sırası veya modelin yorumu bu çelişkiye kendiliğinden öncelik vermez.

Örneğin Frost Warrior görseli Ash Knight için poz referansıysa omuz hareketi, gövde dönüşü ve kılıcın hareket yolu aktarılabilir. Mavi palet, buz kristalleri, kıyafet ve karakter kimliği aktarılamaz. Bu sınırlar yalnızca üretim talimatında değil, üretim geçmişinde de saklanır.

Kullanıcı ChatGPT’ye geçmeden önce ayrı bir üretim talimatı sihirbazı kullanmak zorunda değildir. Workbench’in açık varlık kaydı ekranı proje kurallarını, Görsel Dünya’yı ve Temayı, ölçüleri, perspektifi, Ana Tasarımı, referans amaçlarını ve mevcut işin hedefini gösterir.

**IMP-02 — Üretim Paketi.** Sistem bu bilgileri tek bir harici üretim denemesi için değişmez ve incelenebilir Üretim Paketi içinde toplar. Paket şunları içerir:

- Üretimde kullanılacak bağlamın kopyası
- Hedef görev ve ölçüler
- Ana Tasarım
- Referansların kullanım amaçları
- Korunacak, değiştirilecek ve kaçınılacak özellikler
- Değiştirilmeyecek birimler
- Beklenen çıktı yapısı

Kullanıcı, o üretime ait doğal dil talimatını ChatGPT’de yazar.

**IMP-03 — Üretim kaynakları.** ChatGPT’yi elle kullanma yolu her zaman geçerli bir üretim yoludur. Kullanıcı sonucu kopyalayıp yapıştırabilir, sürükleyebilir veya dosya olarak yükleyebilir. Aynı yaşam döngüsü insan üretimi görselleri, başka sağlayıcı sonuçlarını, harici araç çalışma dosyalarını, eski proje varlıklarını ve lisanslı üçüncü taraf varlıkları kabul eder; her kaynak kendi kanıt gereksinimini karşılar ve bilinmeyen geçmiş tahmin edilmez.

**IMP-04 — Gelen Kutusu yetkisi.** Belirli bir animasyon, yön, durum ya da başka hedef açıksa içe aktarılan sonuç doğrudan o hedefin Aday Sürümü olur. Hedef çalışma yoksa veya dosyalar bağlam dışından topluca eklenirse sistem yönetilen kopyayı ilişkilendirme bekleyen bir İçe Aktarma Gelen Kutusu Girdisi olarak saklar. Girdi Varlık Kaydı veya Aday Sürüm değildir; onaylanamaz ve dışa aktarılamaz. Kaynak gerçeklerini ve eşleme önerilerini taşıyabilir. Kullanıcı hedef ilişkiyi kesinleştirdiğinde ilgili Varlık Kaydında Aday Sürüm oluşur.

Tam Ürün Kapsamı, PNG veya düzenli görsel sayfasının yanında sağlanan, yayımlanmış biçimi tanınan Aseprite ve TexturePacker JSON sidecar verisini web ve masaüstünde ayrıştırabilir. Ayrıştırma sonucu bir **Kaynak Metadata Eşleme Önerisi** oluşturur. Öneri en az kaynak biçim ve sürümünü, kaynak ve sidecar dosya özetlerini, tanınan kare/tag/slice/pivot/9-slice/palet alanlarını, önerilen Varlık Ailesi ve Gerekli Öğeler bağlantılarını, önerilen Oyun İçi Bilgileri, alan bazlı tanılamaları ve çözülemeyen çakışmaları taşır.

Öneri bir Varlık Ailesi, üretim geçmişi, onay, hak durumu veya yetkili oyun içi anlam oluşturmaz. Zorunlu bir alan çakışıyorsa kullanıcı alan bazında karar vermeden eşleme kesinleşmez ve ilişkili sonuç Dışa Aktarıma Hazır olamaz. Profil için isteğe bağlı alanlar açıkça Bilinmiyor bırakılabilir. Kullanıcının kesinleştirmesi, kaynak metadata ile kullanıcı kararını ayrı tutan izlenebilir bir ilişkilendirme oluşturur; sonradan değişen sidecar eski ilişkiyi değiştirmez ve yeni bir öneri üretir.

Hedef hesap ve uygulama yüzeyi resmen destekliyorsa MCP veya eklenti bağlantısı proje bağlamını okuyabilir, ilgili referanslara erişebilir ve açık araç izniyle sonuç dosyasını Aday Sürüm olarak geri yazabilir. Bu bağlantı inceleme kaydı oluşturamaz, kalite istisnası veremez, Ana Tasarım seçemez, bağlam sürümü etkinleştiremez veya dosya silemez.

Ürün, doğrulanmamış yazma ya da dosya aktarım özelliklerine bağlı olmaz. Bağlantı çalışmadığında kullanıcı üretim akışını elle tamamlayabilir.

Her Aday Sürüm için üretim paketi kimliği, kullanıcının gerçek üretim talimatı, üretim kaynağı veya arayüzü ve sonuç dosyası saklanır. ChatGPT konuşmasının tamamını saklamak gerekmez.

Üretim bağlantısı, kullandığı sağlayıcı ve çağrı hakkında bilgi sunuyorsa her dış üretim denemesi için değişmez bir Sağlayıcı Üretim Kaydı oluşturulur. Kayıt; sağlayıcıyı, kullanılan arayüz veya API'yi, model ve varsa model sürümünü, istenen ve gerçekleşen ölçüleri, referans kimliklerini, paleti, tohumu ve bağlantının sunduğu diğer üretim parametrelerini kapsar. Ortak alanlar yapılandırılmış biçimde tutulur; sağlayıcıya özgü ek alanlar veri yapısı sürümü belirtilen, temizlenmiş bir anlık kayıt olarak korunur. Kimlik bilgileri, API anahtarları, yetkilendirme başlıkları ve geçici erişim adresleri kayda alınmaz.

Bağlantının sunduğu üretim alanları kaybolmadan kaydedilmelidir; bağlantı üzerinden üretildiği bildirilen yeni bir sonuç bu alanlar kaydedilmeden onaylanamaz. Elle kullanılan bir arayüzün veya eski bir içe aktarımın sunmadığı sağlayıcı ayrıntıları Bilinmiyor olarak gösterilir ve tek başına onayı engellemez. Bu kayıt üretim koşullarını karşılaştırmaya yarayan kanıttır; aynı sonucu yeniden üretme garantisi veya Proje Bağlamı kuralı değildir.

Elle İçe Aktarma Kanıtı; üretim paketi kimliğini, kaynağı, sonuç dosyasını ve kullanıcının gerçek üretim talimatını kapsar. Kanıtı eksik dosyalar İçe Aktarma Gelen Kutusu'na alınabilir; ancak bu dört alan tamamlanmadan onaylanamaz.

Mevcut bir projeden gelen ve özgün üretim geçmişi artık bilinmeyen dosya için kullanıcı Geçmiş Varlık Beyanı oluşturabilir. Beyan; bilinen kaynağı, kullanıcının dosyayla ilişkisini, hangi geçmiş alanlarının bilinmediğini, beyan zamanını ve varsa destekleyici kanıtı taşır. Bilinmeyen talimat veya üretim paketi sonradan tahmin edilerek tarihsel kanıt gibi gösterilemez. Geçmiş Varlık Beyanı bulunan bir sürüm, ilgili kalite ve kullanım gereksinimlerini karşılıyorsa kullanıcı tarafından onaylanabilir; eksik geçmiş sürümde ve onu içeren her dışa aktarımın içerik listesinde görünür kalır. Bu yol, Workbench içinde Üretim Paketi ile oluşturulan yeni sonuçlarda Elle İçe Aktarma Kanıtı zorunluluğunun yerini alamaz.

Aynı üretim amacına yönelik alternatif denemeler bir Üretim Deneyi içinde gruplanabilir. Her deneme kendi değişmez Üretim Paketi’ni ve Aday Sürümünü korur. Ürün, denemeler arasında değişen girdileri ve kullanıcı tarafından kaydedilen sonucu karşılaştırır. Bir deneyden çıkarılan öğrenim kendiliğinden Proje Bağlamı’nı değiştirmez; kullanıcı incelemesine sunulan bir Bağlam Önerisi’ne dönüştürülebilir.

Ürün; bağlam, Ana Tasarım, referanslar ve aktarım sınırları, doğal dil talimatı, hedef ölçüler, beklenen çıktı yapısı, Sağlayıcı Üretim Kaydı alanları ve diğer kayıtlı girdiler arasındaki farkları gösterir. Birden fazla girdi aynı anda değişmişse karşılaştırma, sonucun nedenini ayrıştırmadığını açıkça belirtir. Bu durum denemenin saklanmasını, sürümün incelenmesini veya onaylanmasını engellemez.

Deney öğreniminden oluşturulan Bağlam Önerisi; kaynak Üretim Deneyi’ni, karşılaştırılan denemeleri, değişen girdileri, nedenin ayrıştırılıp ayrıştırılamadığını ve kullanıcının yorumunu belirtir. Öneri varsayılan olarak deneyin en dar anlamlı kapsamını kullanır. Daha geniş Varlık Ailesi, Tema, Görsel Dünya veya proje kapsamına geçiş kullanıcı kararıdır; ürün bu seçimden etkilenecek üretimleri ve mevcut kural çatışmalarını etkinleştirmeden önce gösterir.

Üretim Deneyi’ni yalnız kullanıcı Seçim Yapıldı, Sonuçsuz veya Bırakıldı sonucu ile kapatabilir. Seçim Yapıldı sonucunda tercih edilen deneme belirtilir. Bu seçim Aday Sürümü kendiliğinden onaylamaz, Bağlam Önerisi’ni etkinleştirmez veya diğer denemeleri silmez.

Kullanıcı, seçilen bir denemeden sürümlü Üretim Tarifi oluşturabilir. Tarif; doğal dil talimatı için düzenlenebilir bir iskeleti, referans rollerini, beklenen çıktı yapısını, kilitlenecek ve kullanıcı tarafından doldurulacak alanları taşır. Tarif sanat veya bağlam kuralı değildir. Kullanıldığında güncel Proje Bağlamı ile yeni ve değişmez bir Üretim Paketi hazırlanır; tarif ile etkin kurallar arasındaki çatışmalar çözülmeden paket oluşturulamaz. Tarif kendiliğinden uygulanmaz.

Üretim Tarifi ait olduğu projede sürümlenir. Başka bir projeye bağımsız kopya olarak aktarılabilir; kaynak tarifte daha sonra yapılan değişiklikler kopyayı değiştirmez. Proje Bağlamı kuralları, Varlık Sürümleri, referans dosyaları ve Hak Kayıtları yeni projeye tarif değeri gibi taşınmaz; eksik girdiler alıcı projede yeniden seçilir ve doğrulanır.

Kullanıcı, referanslara ve sonuç dosyalarına kaynak, hak sahibi veya sağlayıcı, beyan edilen izin ya da lisans kapsamı, bilinen kısıt ve belirsizlik ile destekleyici kanıtı içeren Hak Kaydı ekleyebilir. Hak Kaydı izlenebilirlik sağlar; ürün hukuki uygunluk kararı vermez ve kayıt tek başına dışa aktarımı engellemez. İlgili Hak Kayıtları dışa aktarımın içerik listesinde görünür biçimde taşınır.

Her Hak Kaydı kullanıcı tarafından Belgelendi, Yalnız Beyan, Bilinmiyor veya Kısıtlı olarak sınıflandırılır. Belgelendi, destekleyici kanıt bulunduğunu; Yalnız Beyan, kullanıcının kanıtsız beyanını; Bilinmiyor, yeterli bilgi olmadığını; Kısıtlı ise beyan edilen kapsamın en az bir kullanım sınırı taşıdığını ifade eder. Bu durumlar ürünün hukuki geçerlilik değerlendirmesi değildir.

Hak Kaydı değişmezdir. Beyan, kanıt, kapsam, kısıt veya durum değişikliği yeni bir Hak Kaydı sürümü oluşturur. Açık Teslimat Hedefleri ve gelecekteki dışa aktarımlar seçilen yeni kayıtla yeniden değerlendirilir. Geçmiş Dışa Aktarım Paketleri ve Teslimat Gerçekleşmeleri sabitledikleri Hak Kaydı sürümünü korur; sonradan öğrenilen risk bunlarla ilişkilendirilebilir ancak tarihsel içerik listelerini değiştiremez.

Geçmiş Varlık Beyanı üretim geçmişindeki boşluğu; Hak Kaydı ise beyan edilen kullanım hakkını açıklar. Biri diğerinin yerine geçmez. Ürün iki kaydı aynı içe aktarma adımında toplamayı ve birbirine bağlamayı destekleyebilir, ancak birinin varlığı diğerini oluşturmaz veya tamamlamaz.

Ürün, her sonuç için kendi Hak Kaydı ile Üretim Paketi’nde kullanılan referansların, Ana Tasarımın ve bağımlı kaynak sonuçların Hak Kayıtlarını ayrı tutan bir Hak Geçmişi gösterir. Bir kaynağın Hak Kaydı türeve otomatik aktarılmaz ve türevin kullanım hakkını kendiliğinden kanıtlamaz. Hak Kanıtı Politikası, bu geçmişteki hangi kaynak ve sonuç kayıtlarının gerekli olduğunu belirler.

### 4.6 Gerekli öğeler listesi, onay ve bağımlılıklar

Ana Tasarım onaylanmadan yönler, animasyonlar, durumlar ve varyantlar nihai kabul sayılmaz. Ön keşif sonuçları Aday olarak saklanabilir, ancak üretim için onaylanmış sayılmaz.

**AST-07 — Aile tamamlanması.** Her Varlık Ailesinin sürümlenen bir Gerekli Öğeler Listesi vardır. Liste yalnız o ailenin hangi yönlerinin, animasyonlarının, durumlarının, varyantlarının ve kullanım testlerinin gerekli, isteğe bağlı veya uygulanamaz olduğunu belirtir. Birden fazla aileyi kapsayan zorunluluklar Gerekli Öğeler Listesine değil Teslimat Hedefine aittir.

Bir Varlık Ailesi ancak etkin liste sürümündeki tüm gerekli öğeler Bağlama Uygun ve Dışa Aktarıma Hazır olduğunda tamamlanır. Liste değişirse yeni bir sürüm oluşturulur ve tamamlanma durumu yeniden hesaplanır. Önceki tamamlanma kanıtları ve dışa aktarım paketleri değişmez. Listeyi yalnızca kullanıcı etkinleştirebilir.

Türetilmiş varlıklar; kimlik, siluet, ekipman, palet, Tema, perspektif, zamanlama veya başka özelliklere göre türü belirtilmiş bağımlılık bağlantıları taşır. Etkin Bağlam Sürümü veya Ana Tasarım değiştiğinde kullanıcı değişikliği açıklayan bir kayıt oluşturur.

Sistem, değişiklik kaydıyla eşleşen doğrudan ve dolaylı bağımlılıkları Yeniden Doğrulama Gerekli olarak işaretler. Bağımlılığı eksik tanımlanmış türevler de güvenli tarafta kalmak için işaretlenir.

Yeniden Doğrulama Gerekli durumu geçmişteki inceleme kaydını silmez, ancak güncel bağlamla yapılacak yeni dışa aktarımı durdurur. Bu durum Kalite Kontrol Durumu'ndan bağımsızdır; Kalite İstisnası yalnız kendi İstisna Verilebilir Gereksinimini karşılar ve Bağlama Uygunluk Durumu'nu değiştiremez.

Güncel bağlamla dışa aktarım için sürüm kullanıcı tarafından yeniden incelenir. İnceleme olumlu sonuçlanırsa yeni, değişmez İnceleme Kaydı oluşturulur ve sistem sürümü seçili Bağlam Sürümü ile Ana Tasarım için Bağlama Uygun olarak hesaplar. İçerik düzeltmesi gerekiyorsa yeni Birim Sürümü veya Birleşik Sürüm oluşturulur; eski sürümün durumu değiştirilmez.

Kullanıcı bunun yerine geçmiş bir bağımlılık bileşimini kullanmayı seçebilir. Bu yol güncel bileşimdeki Yeniden Doğrulama Gerekli durumunu temizlemez. Bütün bağımlılıklar, geçmiş Bağlam Sürümü, Ana Tasarım ve gerekli kalite kanıtları açıkça sabitlenir; uyumluluk raporu bu tarihsel seçimi gösterir ve Dışa Aktarım Paketi yalnız bu sabitlenmiş tarihsel bileşim için üretilebilir. Bütünlük Denetimi hatası, eksik zorunlu kanıt veya sabitlenmemiş bağımlılık bu yolla aşılamaz.

Örneğin kılıç tasarımındaki değişiklik, kılıcı gösteren yönleri ve animasyonları etkileyebilir; bağımsız bir gölge varlığını etkilemeyebilir. Önceden oluşturulmuş değişmez dışa aktarım paketleri geçmiş teslimat kaydı olarak saklanır.

### 4.7 Sürümler, çalışma dosyaları, arşiv ve silme

**VER-01 — Değişmez sürümler.** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır. Animasyon klipleri, görsel sayfaları ve benzeri montajlar ise içerdikleri Birim Sürümlerini sabitleyen Birleşik Sürüm olarak saklanır. Birim Sürümü, bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği taşımıyorsa ayrıca Varlık Kaydı olmaz.

Bir birim değiştirildiğinde eski birleşik sürüm değişmez. Yeni bir birleşik sürüm oluşturulur. Birim Sürümünün onaylanması, onu içeren birleşik sürümü kendiliğinden onaylamaz.

Yeni içe aktarımlar, yapısal değişiklikler ve kaydedilen piksel düzeltmeleri yeni Aday Sürüm oluşturur. Kullanıcı sürümleri karşılaştırabilir, eski sürümü yeniden incelemeye alabilir ve Varlık Kaydı’nı etkin veya arşivlenmiş yapabilir. İçe aktarılan her aday Workbench denetiminde değişmez bir kopya olarak saklanır.

Kullanıcı isterse Aseprite, Photoshop, Spine veya benzeri araçlardaki önemli çalışma dosyalarını bu kopya olarak üretim geçmişine ekleyebilir. Harici projenin tamamını her kayıtta kopyalamak gerekmez.

Masaüstü uygulamasındaki canlı dosya bağlantısı, harici dosyayı açmayı ve değişiklikleri fark etmeyi kolaylaştırır. Tek başına sürümün kaynağını kanıtlamaz. Algılanan değişiklik kendiliğinden onaylanmaz. Dosya içe alındığında yeni bir kopya ve Aday Sürüm oluşur. Web uygulamasında aynı işlem dosya seçme, sürükleyip bırakma veya yapıştırmayla yapılır.

Proje Arşivi; proje bağlamı sürümlerini, varlık kayıtları arasındaki ilişkileri ve sürüm dosyalarını, referansları ve kullanım amaçlarını, inceleme ve kalite kontrol geçmişini, dışa aktarım paketlerinin içerik listelerini ve isteğe bağlı çalışma dosyalarını taşır. Arşiv biçiminin sürümü belirtilir. Kimlik bilgileri ve gizli anahtarlar arşive eklenmez.

Arşiv; Kaynak Metadata Eşleme Önerilerini ve kullanıcı kararlarını, Geçmiş Varlık Beyanlarını, Sağlayıcı Üretim Kayıtlarını, Üretim Deneylerini ve sonuçlarını, Üretim Tariflerini, Hak Kayıtlarını ve Hak Geçmişini, Dışa Aktarım Profillerini, Teslimat Yenileme Kilitlerini, Teslimat Hedeflerini ve politikalarını, kullanıcı önceliklerini, Çalışma Zamanı Doğrulama Kayıtlarını, Teslimat Gerçekleşmelerini, Tarihsel Risk Bildirimlerini ve Teslimat Farklarını ilişkileriyle birlikte taşır. Büyük ekran kayıtları, videolar ve benzeri ikili çalışma zamanı kanıtları isteğe bağlıdır. Arşive eklenmeyen ikili kanıtların kimliği, dosya özeti ve eksik olduğu içerik listesinde belirtilir.

Arşiv geri yüklendiğinde varsayılan olarak bağımsız yeni bir proje oluşturulur. Bulut kimlikleri yeniden eşlenir; mevcut projenin üzerine yazılmaz ve mevcut projeyle otomatik birleştirme yapılmaz.

Proje Arşivi projeyi taşımak ve bağımsız biçimde geri yüklemek içindir. Seçilmiş dosya ve ek bilgilerden teslimat oluşturan Dışa Aktarım Paketi’nin yerini tutmaz.

Kalıcı silmeden önce sistem bir **Silme Etki Dökümü** hazırlar. Döküm; silinecek Varlık Kayıtlarını ve sürüm dosyalarını, aynı içerik özetini kullanan diğer yönetilen kopyaları, içeriği gömen Proje Arşivlerini ve Dışa Aktarım Paketlerini, bunlara bağlı Teslimat Gerçekleşmelerini ve korunacak içeriksiz kayıtları ayrı ayrı gösterir. Yalnız kimlik veya dosya özetiyle ilişki kuran, içeriği kendi içinde taşımayan bir tarihsel kayıt yönetilen kopya sayılmaz.

Varlık düzeyindeki kalıcı silme, değişmez bir Proje Arşivini veya Dışa Aktarım Paketini sessizce yeniden yazamaz. Silinecek içerik böyle bir kapsayıcı içinde gömülüyse kullanıcı kapsayıcıyı bütünüyle silme kapsamına ekler veya işlemi iptal eder. Kapsayıcı bütünüyle silindiğinde manifesti, dosyaları ve Paket Doğrulama Kiti birlikte kaldırılır; checksum listesi eksiltilmiş yeni bir tarihsel paket üretilmez. Silinen bir pakete dayanan Teslimat Gerçekleşmesi korunacaksa yalnız paket kimliği, önceki içerik özeti, silme zamanı ve artık doğrulanamaz olduğu bilgisini taşıyan içeriksiz tarihsel kayıt kalır; Hazır veya Teslim Edildi durumunun tarihsel olduğu, içeriğin Workbench'te yeniden doğrulanamayacağı açıkça gösterilir.

Kullanıcı Silme Etki Dökümü'ndeki bütün yönetilen kopyaları ve onları gömen kapsayıcıları seçerek kapsamlı temizleme başlatabilir. Alternatif olarak yalnızca seçilmiş kopyaları silebilir; seçilmemiş değişmez kapsayıcılardaki içerik kalır ve arayüz bunun kalıcı silmenin kapsamı dışında olduğunu açıkça belirtir. İndirilen veya başka sisteme aktarılmış harici kopyalar geri çağrılamaz.

İşlem kuyruğa alınmadan önce ürün seçilen kayıt, dosya, paket, arşiv ve etkilenen tarihsel gerçekleşme sayılarını; yedeklerden temizleme takvimini; kapsam dışında kalacak kopyaları ve işlemin Workbench içinde geri alınamayacağını gösterir. Kullanıcı bu kesin kapsam için ayrı bir kalıcı silme onayı verir. Döküm değişmişse önceki onay kullanılamaz; yeni döküm ve yeni onay gerekir.

Silme işlemi izlenir. Sistem seçilen içeriğin etkin depodan kaldırıldığını ve yayımlanmış saklama süresi içinde yedeklerden temizlendiğini raporlar. İşlem tamamlanınca içerik taşımayan bir Silme Makbuzu oluşturur. Makbuz; işlem ve kullanıcı kimliğini, seçilen kapsamı, silinen nesne kimlikleri ile dosya özetlerini, kapsam dışında bırakılan bağımlılıkları, başlangıç ve tamamlanma zamanını ve uygulanmış saklama takvimi sürümünü taşır. Silinen görsel, üretim talimatı veya başka kullanıcı içeriği makbuza yazılmaz.

### 4.8 Kalite modeli ve harici analiz

**QLT-01 — Kalite kanıtı ve kullanıcı kararı.** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.

Her varlık türüne özel profildeki her kural aşağıdaki sınıflardan tam olarak birine girer:

- **Bütünlük Denetimi:** Bozuk veya okunamayan içerik, geçersiz veri yapısı, dosya özeti ya da referans bütünlüğü ihlali ve geçersiz bileşim, arşiv veya dışa aktarım yapısı gibi güvenilir biçimde saptanabilen hatalardır. İstisna tanıyarak aşılamaz; onayı ve dışa aktarımı durdurur.
- **İstisna Verilebilir Gereksinim:** Beklenen kare sayısı, ölçü, şeffaflık, birleşim izi, dönüş noktası veya kare dışına taşma gibi ölçülebilir bir gereksinimdir. Karşılanmadığında işlemi durdurur. Kullanıcı ilgili sürüme Kalite İstisnası verirse devam edilebilir.
- **Kalite Uyarısı:** Kimlik kayması, Tema sızıntısı, hareket kopukluğu veya perspektif farkı gibi açıklanabilir görsel ya da zamansal şüphedir. Tek başına otomatik onay, ret veya engel oluşturmaz.

Kesin olarak ölçülebilen her yapısal kontrol, profilde Bütünlük Denetimi veya İstisna Verilebilir Gereksinim olarak sınıflandırılır. Profil; dosya boyutunu, şeffaflık verisinin okunabilirliğini, beklenen şeffaflık koşulunu, görsel sayfasının bölünebilirliğini, kare veya durum sayısını, hücre sınırlarını, kaynak kırpılmasını, tanımlı paleti ve zorunlu yön ya da durumların eksik olup olmadığını denetleyebilir.

Kareye bağlı dönüş noktası, mount point, çarpışma alanı ve olay kimliğinin desteklenen içe aktarma → düzenleme → dışa aktarma → yeniden okuma turunda kaybolması, yanlış kareye bağlanması veya geçersiz biçime dönüşmesi Bütünlük Denetimi hatasıdır ve istisnayla aşılamaz. Kaynakta bulunmayan isteğe bağlı bir oyun içi bilgi bu kuralla kendiliğinden zorunlu hâle gelmez.

Örneğin okunamayan veya bozuk şeffaflık verisi bütünlük hatasıdır. Şeffaflığın bulunması veya miktarıyla ilgili bir istisna ise profil böyle bir kural tanımlamışsa İstisna Verilebilir Gereksinim sayılabilir.

Kalite İstisnası; tam kural kimliğini, gözlenen değeri, ilgili Birim Sürümü veya Birleşik Sürümü, gerekçeyi, kullanıcıyı, zamanı, Bağlam Sürümü’nü ve Ana Tasarım’ı kaydeder. İstisna sonraki sürümlere otomatik aktarılmaz. İçerik, bağımlılık veya kural değişirse yeniden değerlendirilir. İstisna içeren her Dışa Aktarım Paketi bunu içerik listesinde belirtir.

Görsel ve zamansal Kalite Uyarıları şu şüpheleri gösterebilir: dönüş noktası kayması, zemine basışta sıçrama, beklenmeyen siluet değişimi, geçici piksel gürültüsü, döngü kopukluğu, yönler arasında süre farkı, Tema veya kimlik kayması, perspektif farkı ve aileden ayrılan ayrıntı yoğunluğu.

Sistem yalnızca kalite düşük demekle yetinmez; şüpheli kareyi, bölgeyi veya karşılaştırmayı gösterir. Bilinçli ezilme/esneme, kök hareketi, dönüşüm veya asimetrik hareket kendiliğinden hata sayılmaz.

Loop başlangıcı ve sonu arasındaki görsel kopukluk ile kareler veya yönler arasındaki zemin çizgisi sapması evrensel otomatik engel değildir. Kalite Profili ölçülebilir bir tolerans tanımlıyorsa sonuç İstisna Verilebilir Gereksinim olarak değerlendirilebilir; tolerans tanımlanmamışsa ürün karşılaştırmayı Kalite Uyarısı veya zorunlu insan incelemesi olarak gösterir. Profil, hangi sınıfın uygulandığını ve dayanağını açıkça belirtir.

Kalite Profili hangi kuralların, insan incelemelerinin ve kullanım testlerinin gerektiğini belirtir. Kalite Uyarısı tek başına işlemi durdurmaz. Ayrı ve açık bir profil gereksinimi varsa bu gereksinim kendi sınıfı ve kanıtıyla gösterilir. Kullanıcı kuralın sınıfını ve dayanağını görebilir; yalnızca istisna kabul eden kurallar için gerekçeli Kalite İstisnası verebilir.

Harici Görsel Analizi, üçüncü taraf yapay zekâ hizmetiyle yapılan kimlik, Tema veya stil analizidir. Varsayılan olarak kapalıdır. Kullanıcı izin vermeden önce projeyi ve analiz kategorisini seçer; gönderilecek veriyi, amacı, sağlayıcıyı ve bilinen saklama koşullarını görür. Bir kategori için verilen izin başka kategorileri kapsamaz.

İzin yokken kullanıcı görselleri elle yan yana karşılaştırabilir ve kesin kurallı kontrolleri kullanabilir.


