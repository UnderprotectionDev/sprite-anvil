> [PRD içindekiler](README.md)

## 6. Platform, güvenlik ve diğer gereksinimler

### Platform davranışı

**PLT-01 — Anlamsal platform eşdeğerliği.** Web ve masaüstü uygulamaları temel üretim akışını baştan sona tamamlar. Ekran ve adımların aynı olması gerekmez; yetkili kayıt, sabitlenmiş sürüm, kalite kanıtı, paket, kilit ve ayrışma sonucu anlam bakımından eşdeğer olmalıdır. Masaüstü uygulaması yerel klasör izleme, pano, sürükleyip bırakma, harici düzenleyicide dosya açma, canlı dosya bağlantısı ve izinli klasöre teslimat yenilemesi uygulama gibi kolaylıklar sunabilir. Web uygulaması aynı sonuca indirilebilir değişiklik paketi ve elle uygulama yoluyla ulaşır.

Çevrimdışı Hazırlık Çalışması; önbelleğe alınmış projeyi görüntüleme, dosya içe aktarma ve kurtarılabilir çalışma taslağı hazırlamayla sınırlıdır. Çevrimdışı hazırlanan içerik bağlantı yeniden kurulduktan sonra çakışma kontrolünden geçer.

**PLT-02 — Çevrimdışı çakışma.** Her çevrimdışı taslak, başladığı bulut kayıt sürümünü `taban sürüm` olarak sabitler. Bağlantı yeniden kurulduğunda taban sürüm hâlâ güncelse taslak normal kesinleştirme akışına alınabilir. Buluttaki kayıt değişmişse sistem otomatik alan birleştirmesi, son yazan kazanır davranışı veya sessiz taslak silme uygulamaz; taban sürüm, güncel bulut sürümü ve yerel taslaktan oluşan bir **Çakışma Kaydı** oluşturur.

Çakışma çözülene kadar buluttaki kayıt yetkili kalır ve yerel çalışma kurtarılabilir taslak olarak korunur. Kullanıcı yerel taslaktan ayrı bir Aday Sürüm oluşturabilir, bulut sürümünü koruyup yerel taslağı saklayabilir veya yerel taslağı açıkça bırakabilir. Bağlam etkinleştirme, İnceleme Kaydı, Kalite İstisnası, Teslimat Hedefi, Teslimat Gerçekleşmesi ve silme gibi kesin karar kayıtları alan bazında birleştirilmez; kullanıcı güncel bulut tabanı üzerinde yeni bir karar oluşturur. Bir taslağı bırakma işlemi geri alınamazsa etkilenen yerel içerik ve sonuç kullanıcıya gösterilir ve ayrı onay alınır.

Çakışma çözümü yeni değişmez sürüm veya karar kaydı üretir; mevcut bulut kaydını ya da çevrimdışı tabanı geriye dönük değiştirmez. Çakışma kaydı seçimi, zamanı, kullanıcıyı ve oluşan yeni kayıt kimliğini saklar. Ağ kesintisi çözüm sırasında tekrarlanırsa aynı idempotency anahtarı ikinci bir sürüm veya karar oluşturamaz.

İnceleme kayıtları, bağlam sürümünü etkinleştirme ve doğrulanmış dışa aktarım, bulutla eşitlenene kadar yetkili ürün kaydı sayılmaz.

### Veri bütünlüğü ve dayanıklılık

**OPS-02 — Atomik ve idempotent kesinleştirme.** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.

- Varlık Sürümü, Bağlam Sürümü, İnceleme Kaydı, Kalite İstisnası, Gerekli Öğeler Listesi sürümü, Hak Kaydı, Üretim Deneyi sonucu, Çalışma Zamanı Doğrulama Kaydı, Teslimat Hedefi, Teslimat Gerçekleşmesi, Proje Arşivi ve Dışa Aktarım Paketi; içerik veya paket listesi özetiyle doğrulanabilir. Dışa Aktarım Profili sürümü paket tarafından sabitlenir; Teslimat Yenileme Kilidi hedef yolları ve özetleri kesin paket kimliğine bağlar.
- Yarım kalan yükleme, eşitleme, içe aktarma, dışa aktarma, arşivleme veya geri yükleme işlemi kısmi sonucu başarılı gösteremez. İşlem ya tamamen tamamlanır ya da açıkça başarısız ve yeniden denenebilir durumda kalır.
- Aynı isteği yeniden denemek ikinci bir İnceleme Kaydı, Kalite İstisnası, Dışa Aktarım Paketi veya silme işlemi oluşturmamalıdır.
- Kullanıcıya başarılı görünen bir değişiklik sessizce kaybolamaz. Bulut yazımı tamamlanmadıysa arayüz bu durumu buluttaki geçerli durumdan ayrı gösterir.
- Proje Arşivi geri yüklendiğinde dosya özetleri ve ortamdan bağımsız içerik listesi ile ilişki özetleri karşılaştırılır. Yeniden eşlenen bulut kimlikleri ayrı bir eşleme olarak saklanır ve bu karşılaştırmaya katılmaz. Açıklanamayan fark varsa geri yükleme tamamlanmış sayılmaz.
- Paket Doğrulama Kiti ağ erişimi olmadan doğrulanabilir; gömülü JSON Schema, checksum listesi veya README’nin paket manifestiyle açıklanamayan farkı bütünlük hatasıdır.
- Teslimat yenilemesi, kilitle uyuşmayan hedef yolunu kullanıcı kararı olmadan değiştiremez. Kısmi uygulama başarılı sayılmaz; tamamlanan yollar ve durdurulan ayrışmalar açıkça ayrılır.

### Dayanıklı arka plan işlemleri

**OPS-01 — Yetkili işlem kaydı.** Etkileşimli istek süresinde güvenle tamamlanamayan arşivleme, geri yükleme, dışa aktarım koordinasyonu, doğrulama ve kalıcı silme işlemleri dayanıklı bir arka plan yürütücüsüyle işlenir. Kullanılan kuyruk, worker, barındırma ve depolama sağlayıcısı teknik tasarım ve ADR konusudur; bu PRD gözlemlenebilir dayanıklılık sözleşmesini tanımlar.

- Taşıma mesajı yetkili ürün kaydı değildir. İşlem kimliği, türü, proje kapsamı, idempotency anahtarı, durum, deneme sayısı ve sonuç özeti yetkili Arka Plan İşlemi kaydında tutulur.
- API aynı atomik işlem içinde Arka Plan İşlemi ve güvenilir yayın/outbox kaydı oluşturur. Yayın başarısızlığı yeniden denenir; yetkili yazım ile taşıma yayını arasındaki hata işi kaybettiremez.
- Taşıma mesajı yalnız gerekli kimlikleri, komut sürümünü ve idempotency anahtarını taşır. Görsel dosya, arşiv, ham üretim talimatı, erişim belirteci veya proje sırrı mesaja yazılmaz.
- Yürütücü mesajı ancak sonuç ve durum kalıcı olarak yazıldıktan sonra tamamlanmış sayar. Geçici hata yeniden deneme üretir; yapılandırılmış deneme sınırı aşılan iş başarısız işler alanına taşınır ve kullanıcıya başarısız olarak gösterilir.
- Mesaj yeniden teslim edilebilir. Aynı idempotency anahtarı ikinci bir çıktı, Dışa Aktarım Paketi, silme makbuzu veya başka bir kesin kayıt oluşturamaz.
- Taşıma katmanının mesaj saklama süresi ürünün veri saklama süresi değildir. Bekleyen veya çalışıyor görünüp ilerlemeyen Arka Plan İşlemleri uzlaştırılır ve gerektiğinde yeni teslim kimliğiyle yeniden yayımlanır.
- Arka Plan İşlemi durumları en az Bekliyor, Çalışıyor, Tamamlandı, Başarısız, İptal İstendi ve İptal Edildi değerlerini kapsar. Kullanıcı durumu taşıma altyapısından değil yetkili işlem kaydından görür.
- İptal isteği yetkili kayda yazılır. Yürütücü geri döndürülemez sınırdan önce bu durumu denetler; güvenle iptal edemediği işlemi tamamlar ve sonucu açıkça bildirir.
- Büyük girdiler ve çıktılar mesaj gövdesine yerleştirilmez; taşıma katmanı yalnız doğrulanmış nesne kimliklerini taşır.

### Güvenlik ve gizlilik

**OPS-03 — Gizlilik ve en az yetki.** Proje içeriği varsayılan olarak gizlidir; kullanıcı içeriği veya sırlar yalnız açık amaç, kapsam ve gerekli en az yetkiyle işlenir.

- Projeler varsayılan olarak gizlidir. Kimliği doğrulanmamış kullanıcı proje içeriğine, önizlemeye, dışa aktarıma veya arşive erişemez.
- Buluta aktarılan ve Workbench’in yönettiği depoda tutulan veriler güncel endüstri standardına uygun şifrelemeyle korunur. Şifreleme anahtarları, erişim belirteçleri ve sağlayıcı sırları Proje Arşivi’ne, Dışa Aktarım Paketi’ne, kullanım verilerine veya kullanıcıya gösterilen kaynak geçmişine yazılmaz.
- MCP, eklenti, Bağlam Ajanı ve Harici Görsel Analizi erişimleri en az yetki ilkesiyle, amaç ve kapsam açıkça belirtilerek verilir. İzin geri alındığında yeni erişim durur.
- Arka plan taşıma ve yürütme kimlik bilgileri yalnız sunucu ortamında tutulur; tarayıcıya, masaüstü istemcisine, arşive veya dışa aktarım paketine verilmez. Her kimlik bilgisi en az yetki ve gerekli proje/hesap kapsamıyla sınırlandırılır.
- Harici sağlayıcıya görsel, yalnızca ilgili proje ve analiz kategorisi için izin verildikten sonra gönderilir. Gönderimden önce aktarılacak veri, amaç, sağlayıcı ve bilinen saklama koşulları gösterilir.
- Güvenlik ve gizlilik kullanım verileri varsayılan olarak görsel dosyanın kendisini, ham üretim talimatını veya proje sırrını içermez.

### Erişilebilirlik

**OPS-04 — Erişilebilir temel akış.** Web uygulamasındaki temel üretim akışı WCAG 2.2 AA düzeyini karşılamalıdır. Masaüstü uygulamasında aynı akış için eşdeğer klavye erişimi, görünür odak, ekran okuyucu adı ve durum bildirimi sağlanır.

İnceleme Kararı, Bağlama Uygunluk Durumu, Kalite Kontrol Durumu, Kayıt Durumu, görsel farklar, uyarılar ve hatalar yalnızca renkle anlatılmaz. Animasyon ve yanıp sönme önizlemesi durdurulabilir. Azaltılmış hareket tercihi açıkken çalışma araçları anlaşılır kalır. Piksel, karo seti ve sahne düzenleme alanlarında klavyeyle kullanılabilen eşdeğer görevler veya erişilebilir özellik panelleri bulunur.

### Hata bildirimi

**OPS-06 — Güvenli ve izlenebilir hata bildirimi.** Uygulama API'sinin oRPC işlem sınırında veya genel HTTP hata sınırında yakaladığı beklenmeyen sunucu hatalarında, kullanıcıya gösterilen hata sunucunun doğrulayabildiği işlem sonucunu ve güvenli sonraki adımı açıkça belirtir.

- Beklenmeyen sunucu hataları, ham istisna ayrıntılarını veya sırları istemciye göndermeden genel bir açıklama ve **Destek Referansı** taşır. Aynı referans sunucu tarafındaki hata kaydında bulunur; istek girdisi, Proje içeriği veya kimlik bilgisi bu kayıtla birlikte yazılmaz.
- Okuma isteği hata verdiğinde kullanıcı aynı okumayı güvenle yeniden deneyebilir; `Retry` eylemi başarısız sorguyu gerçekten yeniden çalıştırır.
- Yazma isteğinin sonucu belirsizse arayüz “kaydedilmedi” demez ve aynı işlemi yeniden gönderen bir eylem sunmaz. Kullanıcıya güncel durumu kontrol etmesi söylenir. “Kaydedilmedi” yalnız yetkili işlem sınırı yazmanın gerçekleşmediğini doğruladığında gösterilebilir.
- Sunucuya ulaşmayan bağlantı hataları için üretilmiş gibi bir Destek Referansı gösterilmez; bağlantı durumu ve güvenli sonraki adım açıklanır.
- Destek Referansı hata veya operasyon kimliği değildir; tek başına işlem sonucunu, idempotency güvencesini ya da veri kurtarma başarısını kanıtlamaz.

### Performans ve uzun işlemler

**OPS-05 — Ölçülebilir performans.** Harici ChatGPT ve üçüncü taraf analiz süreleri ürün performansından ayrı ölçülür. Yerel veya bulut işlemi kullanıcı eylemine bir saniye içinde yanıt veremiyorsa ilerleme durumu gösterilir.

Veri bütünlüğünü bozmadan iptal edilebilen işlemler iptal edilebilir. Güvenle iptal edilemeyen işlemler dayanıklı arka plan yürütücüsünde sürer; bağlantı yeniden kurulduğunda kullanıcı yetkili Arka Plan İşlemi kaydından durumunu görebilir.

Yayın, teslim, sonuçlandırma, yeniden deneme, başarısız işler alanı ve outbox uzlaştırma süreleri ayrı ölçülür. Yürütücü boş iş kaynağını gereksiz ve agresif biçimde sorgulamaz; gecikme hedefini bozmayacak geri çekilme uygular.

Arama ve filtreleme, sürüm karşılaştırma, animasyon önizlemesi, karo seti test haritası, sahne önizlemesi, içe aktarma, arşivleme ve dışa aktarma için ortanca (p50) ve yüzde 95 (p95) yanıt süresi ile bellek sınırları Operasyonel Kabul Profili’nde yayımlanır.

Profil; referans cihazını, ağ koşullarını, proje test örneğini, varlık ve sürüm sayısını, görsel ölçülerini ve paket boyutunu belirtir. Desteklenecek en büyük test örneğinde belirlenen sınırlar aşılırsa ilgili özellik tamamlanmış sayılmaz.

### Desteklenen platformlar

Desteklenen web tarayıcıları, masaüstü işletim sistemleri, doğrulanmış motor sürümleri ve doğrulanmış proje boyutları sürümlü Desteklenen Platformlar Tablosu’nda yayımlanır. Tablodaki her birleşim temel üretim akışını ve ilgili kabul senaryolarını geçmelidir.

Bir platform veya sürüm desteği kaldırılacaksa bu önceden duyurulur ve kullanıcıya verilerini dışa aktarma yolu sağlanır.

Operasyonel Kabul Profili, Desteklenen Platformlar Tablosu, depolama sınırları, yedek temizleme süresi ve harici sağlayıcı açıklamaları bu dosyanın sürümlü eklerinde tutulur. Ayrı bir gereksinim kaynağı oluşturulmaz. Değeri veya kanıtı olmayan bir parametre ürünün tamamlandığını kanıtlayamaz. Bu değerler ölçümle kapanan yayın parametreleridir; implementer tarafından varsayılmaz. Değer yayımlanana kadar ilgili destek veya kapasite iddiası kapalı kalır, ancak aşağıdaki sürümlü sözleşmelerle uyumlu geliştirme ve test fixture'ı hazırlığı başlayabilir.

### Bağlayıcı veri sözleşmeleri ve sürüm uyumluluğu

Tam Ürün Kapsamı aşağıdaki sözleşme ailelerini bağımsız olarak sürümler. Sözleşme kimliği ve tam sürümü kaydın veya paketin içinde bulunur; yalnız uygulama sürümünden çıkarılamaz.

| Sözleşme ailesi | Başlangıç sözleşme kimliği | Zorunlu içerik ve karar sınırı |
| --- | --- | --- |
| Bağlam Kuralı | `context-rule/1.0.0` | Kararlı kural kimliği, kapsam türü ve kimliği, tipli değer, kaynak, gerekçe, oluşturulma zamanı, yerini aldığı kural ve öncelik zinciri |
| Bağlam Ajanı | `context-agent/1.0.0` | Dayanak Bağlam Sürümü, ajan/model kimliği, önerilen ekleme/değiştirme/kaldırmalar, her önerinin kaynak kanıtı, doğrulama sonucu ve etkinleştirme yetkisinin kullanıcıda olduğu bilgisi |
| Özel Profil | `asset-profile/1.0.0` | Profil kimliği, desteklenen varlık türü, kural kimliği ve sınıfı, girdi, başarılı/başarısız sonuç, kanıt, istisna uygunluğu, insan incelemesi, kullanım testi ve dışa aktarım eşlemesi |
| Kaynak Metadata Eşleme | `source-metadata-mapping/1.0.0` | Kaynak biçim kimliği, kaynak ve sidecar özetleri, kare/tag/slice/pivot/9-slice/palet alanları, alan bazlı kaynak değeri, önerilen değer, kullanıcı kararı, `Bilinmiyor` durumu ve tanılama |
| Dışa Aktarım Profili | `export-profile/1.0.0` | Yerleşim, padding, trim, ölçek, dosya biçimi, adlandırma ve metadata eşlemeleri; her alanın birimi ve varsayılan bulunmadığındaki davranışı |
| Teslimat Yenileme Kilidi | `delivery-refresh-lock/1.0.0` | Kesin paket ve profil kimliği, hedef kapsam kimliği, Workbench'in sahiplendiği göreli yollar, önceki içerik özetleri ve son başarılı uygulama zamanı; mutlak yerel yol veya erişim sırrı içermez |
| Paket Manifesti | `package-manifest/1.0.0` | Bağlam, Gerekli Öğeler Listesi, profil, özel profil ve bağdaştırıcı sürümleri; birim/birleşik sürümler; kalite, hak ve istisna kayıtları; teslim dosyaları ve özetleri |
| Paket Doğrulama Kiti | `package-verification-kit/1.0.0` | Manifestle aynı ana sürümde JSON Schema, deterministik checksum listesi, README ve çalıştırılabilir olmayan statik örnek eşlemeleri |
| Çevrimdışı Çakışma | `offline-conflict/1.0.0` | Taban, güncel bulut ve yerel taslak kimlikleri ile özetleri; kullanıcı seçimi, oluşan kayıt kimliği, idempotency anahtarı ve çözüm zamanı |
| Silme Etki Dökümü ve Makbuzu | `deletion-record/1.0.0` | Seçilen ve kapsam dışı nesne kimlikleri ile özetleri, gömülü kapsayıcılar, saklama takvimi sürümü, işlem durumu ve zamanları; kullanıcı içeriği taşımaz |
| Ölçüm Tanımı | `measurement-definition/1.0.0` | Metrik kimliği, kapsam, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman penceresi, saklama süresi ve karar kullanımı |

Sözleşme sürümleri `ana.alt.yama` biçimindedir. Ana sürüm, mevcut okuyucunun aynı anlamı koruyarak okuyamayacağı değişiklikte artar. Alt sürüm yalnız geriye uyumlu, isteğe bağlı alan veya yeni tanınan değer ekler. Yama sürümü temsil veya davranış değiştirmeyen açıklama ve fixture düzeltmesidir.

Web, masaüstü, worker, motor bağdaştırıcısı ve ayrı paket doğrulayıcısı yazdığı sözleşmenin tam sürümünü kaydeder. Okuyucu kendi desteklediği ana sürümdeki daha eski alt/yama sürümlerini okumalıdır. Daha yeni alt sürümdeki bilinmeyen isteğe bağlı alanları değiştirmeden korur; bilinmeyen zorunlu alan veya bilinmeyen ana sürümle karşılaşırsa yazma, etkinleştirme, geri yükleme ya da doğrulamayı durdurur ve desteklenmeyen sözleşme sürümünü gösterir. Bilinmeyen alan sessizce düşürülemez.

Değişmez kayıt yerinde göç ettirilmez. Eski sözleşmeden yeni sözleşmeye geçiş, kaynak kayıt kimliğini ve kullanılan göç sürümünü taşıyan yeni bir kayıt veya paket üretir. Göç aynı girdide deterministik ve idempotenttir; başarısızlık eski kaydı geçerli bırakır. Bağlam kuralı göçü yeni Bağlam Sürümü oluşturur ve kullanıcı etkinleştirmeden yürürlüğe girmez. Dışa Aktarım Profili veya paket göçü geçmiş profili ya da paketi değiştirmez.

İlk Kaynak Metadata Eşleme parser matrisi dört giriş biçimini tanır: `aseprite-json-array/1`, `aseprite-json-hash/1`, `texturepacker-json-array/1` ve `texturepacker-json-hash/1`. Biçim tanıma dosya adına değil, kök yapı ile zorunlu alanlara dayanır. Kare dikdörtgeni ve kimliği bütün biçimlerde zorunludur. Süre, tag, slice, pivot, 9-slice ve palet yalnız kaynakta bulunduğunda kaynak değeri olarak alınır; bulunmayan alan uydurulmaz. Aynı alan için birden fazla kaynak farklı değer verirse zorunlu alan çakışması oluşur. Tanınmayan alanlar temizlenmiş kaynak anlık kaydında korunur, ancak kullanıcı kararı veya yetkili oyun içi anlam sayılmaz.

Paket Manifesti ile Paket Doğrulama Kiti aynı ana sürümde olmalıdır. Doğrulayıcı; manifest şemasını, her dosya özetini, göreli yolların tekilliğini, referans verilen kayıt kimliklerini ve sözleşme sürümlerini ağ erişimi olmadan denetler. Şema uyumsuzluğu, eksik dosya, özet farkı, yol çakışması veya çözülemeyen zorunlu referans Bütünlük Denetimi hatasıdır. README veya statik örnekler manifestle çelişirse paket geçerli sayılmaz.
