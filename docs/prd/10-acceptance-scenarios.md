> [PRD içindekiler](README.md)

## 8. Kabul senaryoları

### Gereksinim-kabul izlenebilirliği

| Gereksinimler | Birincil kabul kanıtı |
| --- | --- |
| `CTX-01`–`CTX-03`, `AUT-01`, `IMP-01`–`IMP-03` | [Bölüm 8.1](10-acceptance-scenarios.md#81-tüm-profiller-için-ortak-senaryo-akışı) ortak akış; RAS-01–RAS-08 |
| `AST-01`–`AST-05`, `AST-07`, `QLT-01`–`QLT-03` | RAS-01–RAS-08; YAS-01 |
| `AST-06`, `VER-01` | [Bölüm 8.1](10-acceptance-scenarios.md#81-tüm-profiller-için-ortak-senaryo-akışı) adım 5; RAS-01 |
| `DIM-01`–`DIM-03` | RAS-01, RAS-03, RAS-05 ve RAS-08 |
| `IMP-04` | YAS-02; hedefli içe aktarma için [Bölüm 8.1](10-acceptance-scenarios.md#81-tüm-profiller-için-ortak-senaryo-akışı) adım 3 |
| `EXP-01` | YAS-01 |
| `EXP-02` | [Bölüm 8.1](10-acceptance-scenarios.md#81-tüm-profiller-için-ortak-senaryo-akışı) adım 6–7; YAS-03 |
| `EXP-03` | YAS-03 |
| `PLT-01` | Bütün RAS ve YAS senaryolarının web/masaüstü sonuç karşılaştırması |
| `PLT-02` | YAS-04 |
| `OPS-01`–`OPS-05` | YAS-03, YAS-04, Operasyonel Kabul Profili ve [Bölüm 10](12-completion-criteria.md) tamamlanma matrisi |

### 8.1 Tüm profiller için ortak senaryo akışı

Her kabul senaryosu sürümlü bir test örneğidir. Örnek görseller yeni bir evrensel sanat kuralı oluşturmaz.

Her senaryo web ve masaüstünde ayrı ayrı yürütülür. Ekran adımları değişebilir; ancak oluşan Bağlam Sürümü, Varlık Sürümü, İnceleme Kaydı, kalite kanıtı ve Oyun Motorundan Bağımsız Paket anlam bakımından eşdeğer olmalıdır.

Her profilin ortak senaryosu şu kanıtları üretir:

1. Kullanıcı uygun Bağlam Sürümü’nü ve Gerekli Öğeler Listesi’ni etkinleştirir; varsa Ana Tasarım’ı seçer.
2. Referans amaçlarını ve aktarım kurallarını içeren Üretim Paketi hazırlanır. Çözülmemiş çelişki varsa paket oluşturulamaz.
3. Manuel ChatGPT yolunda sonuç içe alınır ve Elle İçe Aktarma Kanıtı tamamlanır. Resmî entegrasyon varsa ayrıca sınanabilir, ancak manuel yolun yerini almaz.
4. Aday Sürüm, sabitlenmiş Özel Profil Sözleşmesi sürümündeki Bütünlük Denetimlerini, İstisna Verilebilir Gereksinimleri, zorunlu insan incelemesini ve profile özgü kullanım testlerini tamamlar. Kural kimliği, sınıfı, kanıtı ve dışa aktarım etkisi görünürdür. İnceleme Kaydı’nı kullanıcı oluşturur.
5. Test örneğindeki sorunlu tek Birim Sürümü değiştirilir. Eski Birleşik Sürüm değişmeden kalır. Yeni Birleşik Sürüm yalnızca değiştirilen birimi sabitler; bağımlılık etkileri görünür olur. Değiştirilen Birim Sürümü ile yeni Birleşik Sürüm ayrı ayrı incelenip onaylanır. Birimin onaylanması bileşiği onaylamaz.
6. Etkin Gerekli Öğeler Listesi’ndeki tüm gerekli öğeler Bağlama Uygun ve Dışa Aktarıma Hazır olur. Kullanıcı Dışa Aktarım Profili sürümünü seçip Dışa Aktarım Paketi oluşturmayı başlatır. Paket; sürüm, kalite kanıtı, istisna ve profil kimliklerini içerik listesinde taşır.
7. Paket yeniden okunduğunda dosya özetleri, içerik listesi ilişkileri ve Paket Doğrulama Kiti aynı sonucu verir. Paket ağ erişimi olmadan doğrulanır. Web ve masaüstü kanıtları ortak senaryo kimliğiyle karşılaştırılır.

### 8.2 Her profil için test örneği ve kanıtlar

#### RAS-01 — Karakterler, yaratıklar ve animasyon

**Test örneği:** Ayrı bir Varlık Kimliği’ne bağlı, birden fazla yönü olan karakterin Ana Tasarımı, bekleme ve saldırı animasyonları, farklı kare süreleri, bir isabet olayı, mount point ve çarpışma alanı bulunur. Saldırı karelerinden birinde bilerek siluet veya ekipman hatası; başka bir örnekte zemin çizgisi/loop sapması ve metadata roundtrip kaybı yer alır.

**Kanıt:** Yönler eşzamanlı karşılaştırılır. Kimlik, dönüş noktası, zemine temas, ekipmanın hangi tarafta olduğu, zamanlama, isabet olayı, mount point ve çarpışma alanı incelenir. Eksik veya yanlış kareye bağlanan metadata Bütünlük Denetimi’nde dışa aktarımı engeller ve kaynak → düzenleme → paket → yeniden okuma turunda tam kimliğiyle korunur. Zemin ve loop sapması profil toleransına göre gereksinim veya insan incelemesi olur; evrensel otomatik engel sayılmaz. Sahne kalite kontrol alanı bekleme → saldırı geçişini ve olay zamanlamasını doğrular. Onarım yalnızca hatalı kareyi kapsar; ilgisiz yönler yeniden üretilmez.

#### RAS-02 — Objeler, silahlar, ekipmanlar ve durum aileleri

**Test örneği:** Ortak perspektif, ızgara, malzeme ve sıralama noktası kuralları olan, birden fazla durum içeren obje ailesi. Durumlardan birinde perspektif veya sabitleme noktası uyumsuzluğu vardır.

**Kanıt:** Durumlar aile olarak karşılaştırılır. Gerekli ve isteğe bağlı durumlar Gerekli Öğeler Listesi’nde görünür. Sahne kalite kontrol alanında ölçek, sıralama ve durum geçişi onaylı karakter ve zeminle denenir. Dışa Aktarım Paketi her durumun kimliğini ve sabitleme noktası bilgilerini taşır.

#### RAS-03 — İkon ailesi

**Test örneği:** Ortak ışık, kontur ve iç boşluk kurallarına sahip ikon ailesi; en az iki kullanım boyutu ve açık/koyu arayüz arka planları. İkonlardan biri hedef boyutta okunurluğunu veya aile içindeki nesne ölçeğini kaybeder.

**Kanıt:** Görseller gerçek kullanım boyutunda, gri tonlamada ve farklı arka planlarda yan yana karşılaştırılır. Nadirlik veya durum rengi nesne kimliğini sessizce değiştirmez. Dışa Aktarım Paketi mantıksal boyutu, kullanım çeşidini ve kullanılan ikonun tam sürümünü taşır.

#### RAS-04 — Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri

**Test örneği:** Karakter olayına bağlı, şeffaflık verisi içeren ve hücre sınırını bilerek aşan zamanlamalı efekt. Hücre dışına taşma, İstisna Verilebilir Gereksinimdir. Okunamayan bileşim, bozuk dosya veya okunamayan/bozuk şeffaflık verisi Bütünlük Denetimi’ne takılır. Profil, şeffaflığın bulunması veya miktarı için ayrıca istisna tanımlayabilir.

**Kanıt:** Efekt şeffaf, açık, koyu ve gerçek sahne arka planında hem tek başına hem de sahibiyle eşzamanlı oynatılır. Yalnızca hücre dışına taşma kuralına sürüme özel istisna verilebilir; Bütünlük Denetimi aşılamaz. Değiştirilen efekt karesinin olay zamanı korunur. Dışa Aktarım Paketi başlangıç noktasını, süreyi, olayı ve istisna kanıtını taşır.

#### RAS-05 — Karo setleri, arazi ve kesintisiz dokular

**Test örneği:** İç/dış köşe, kenar, dar koridor, tek araziyle dolgu ve tekrar edilebilir yüzey malzemesi içeren bir set. Bir bağlantı karosunda komşuluk hatası veya dokuda görünür birleşim izi bulunur.

**Kanıt:** Boyanabilir test haritası; zor komşulukları, rastgele tekrarları ve 2×2, 3×3 ile kaydırmalı doku önizlemelerini çalıştırır. Sorunlu karo veya doku bağımsız birim olarak tanımlanır. Dışa Aktarım Paketi komşuluk eşlemelerini, karo alanlarını ve doku tekrar ayarını korur.

#### RAS-06 — Arka planlar ve katmanlı kaydırma

**Test örneği:** Farklı hızlarda hareket eden katmanlar, hedef görüntü oranları, döngü veya kontrollü kırpma ve oyuncunun görülebilmesi için güvenli alan. Katmanlardan birinde birleşim izi, kırpma veya kontrast sorunu vardır.

**Kanıt:** Katmanlar gerçek kaydırma davranışıyla oynatılır. Hedef görüntü oranlarında döngü, birleşim izi, kırpma, oyun içi kontrast ve oyuncunun görünürlüğü incelenir. Dışa Aktarım Paketi katman sırasını, göreli hareketi, döngü/kırpma ayarını ve kullanılan sürümleri taşır.

#### RAS-07 — Arayüz ekranları ve bileşenleri

**Test örneği:** Ekran düzeni, dokuz parçalı panel, metin için güvenli alan ve normal, imleç üzerindeyken, basılı veya devre dışı gibi durumları olan etkileşimli bileşen. Durumlardan biri aile stilinden veya germe kuralından sapar.

**Kanıt:** Durumlar karşılaştırılır. Panel farklı hedef ölçülerde gerilir ve metin güvenli alanı görünür. Düzeltilmiş durum yeni ekran düzeninde sabitlenir. Dışa Aktarım Paketi durum eşlemelerini, germe paylarını, doğal boyutları ve tam sürümleri taşır.

#### RAS-08 — Portreler, logolar ve tanıtım görselleri

**Test örneği:** Oyun içi görünümden farklı bir Görsel Dünya’da, aynı Varlık Kimliği’ne bağlı bir portre Ana Tasarımı ve logo/tanıtım yerleşimi. Farklı kırpma, açık/koyu arka plan, küçük kullanım ve güvenli alan koşulları vardır. Bir çeşit kimlik veya güvenli alan kuralını ihlal eder.

**Kanıt:** Farklı Görsel Dünyalardaki ayrı Ana Tasarımlar birbirine zorlanmadan Varlık Kimliği korunur. Portre kırpma ve ifade tutarlılığı, logo güvenli alanı ve küçük boyutta okunurluk sınanır. Dışa Aktarım Paketi kullanım amacını, kırpma ve güvenli alanı, arka plan çeşidini ve kullanılan Ana Tasarım bağlantısını taşır.

### 8.3 Yatay teslimat ve kanıt senaryosu

#### YAS-01 — Geçmiş varlıktan doğrulanmış teslimata

**Test örneği:** Mevcut bir projeden topluca alınan, özgün üretim talimatı bilinmeyen en az bir varlık; aynı hedef için birden fazla üretim denemesi; iki Dışa Aktarım Paketiyle karşılanan ve çalışma zamanı doğrulaması isteyen bir Teslimat Hedefi; farklı Hak Kaydı durumlarına sahip kaynaklar ve isteğe bağlı büyük çalışma zamanı kanıtı bulunur.

**Kanıt:**

1. Toplu içe aktarma dosyalardan kendiliğinden Varlık Ailesi veya üretim geçmişi kurmaz. Kullanıcı Geçmiş Varlık Beyanı ile ayrı Hak Kaydı oluşturur; iki kayıt birbirinin yerine geçmez.
2. Bir Üretim Deneyi içindeki değişmez Üretim Paketleri karşılaştırılır. Birden fazla girdinin değiştiği deneme nedenin ayrıştırılamadığını gösterir. Kullanıcı deneyi sonuçlandırır; seçilen deneme kendiliğinden onaylanmaz. Kullanıcı bu denemeden Üretim Tarifi oluşturur ve tarifin bağımsız kopyasını başka proje bağlamında kullanırken proje değerlerini yeniden çözer.
3. Ajan veya kurallı sistem Teslimat Hedefi taslağı hazırlayabilir; yalnız kullanıcı hedef sürümünü etkinleştirir. Etkin hedef Bağlam Sürümü’nü, Gerekli Öğeler Listesi sürümlerini, Üretim Kanıtı Politikası’nı ve Hak Kanıtı Politikası’nı sabitler. Yeni tabana geçiş yeni hedef sürümü ve görünür fark oluşturur.
4. Hazırlık Planı bir engelin açacağı bağımlı işleri, hedef zorunluluğunu, kullanıcı önceliğini ve yeniden doğrulama etkisini ayrı gerekçelerle gösterir. Öneri kendiliğinden işlem başlatmaz.
5. Doğrulanmış motor bağdaştırıcısı Çalışma Zamanı Doğrulama Kaydı taslağı hazırlayabilir; sonucu ve başarısızlık kaynağını kullanıcı kesinleştirir. Kaynak Belirsiz başarısızlık hedefi engeller. Kaynak sınıflandırılıp sorun giderildikten sonra yeni ve geçerli ortam kaydı oluşturulur; eski kayıt değişmez.
6. En az iki Dışa Aktarım Paketi hedefi birlikte karşılar ve aynı gereksinim için bilinçli bir çakışma içerir. Sistem eşleme taslağı hazırlar; kullanıcı çakışmayı çözerek Teslimat Gerçekleşmesini oluşturur. Hedef Hazır olmadan ve gerçekleşme bulunmadan Teslim Edildi sayılmaz.
7. İkinci bir Teslimat Gerçekleşmesi oluşturulur ve Teslimat Farkı varlık, bağlam, kalite, hak, çalışma zamanı kanıtı ve paket eşlemesi değişikliklerini gösterir. Yeni bir Kısıtlı Hak Kaydı sürümü geçmiş gerçekleşmeye Tarihsel Risk Bildirimi bağlar; geçmiş Teslim Edildi durumu değişmez ve yeni kullanım güncel politikayla yeniden değerlendirilir.
8. Proje Arşivi bağımsız projeye geri yüklenir. Yeni yapısal kayıtların ve ilişkilerin tamamı korunur. İsteğe bağlı büyük ikili kanıt arşiv dışında bırakılmışsa kimliği, dosya özeti ve eksikliği içerik listesinde doğrulanır.

Senaryo web ve masaüstünde aynı kayıt ve karar anlamlarını üretir. Masaüstündeki otomatik bağdaştırıcı yolu kullanıldığında web uygulaması aynı sonuca elle kanıt ekleme yoluyla ulaşabilir.

#### YAS-02 — Kaynak metadata’dan kullanıcı-onaylı ilişkilendirmeye

**Test örneği:** Aynı eski projeden alınmış bir PNG sprite sheet, desteklenen Aseprite JSON sidecar’ı ve desteklenen TexturePacker JSON sidecar’ı bulunur. Kaynaklardan birinde aynı tag veya pivot için çelişen değer, başka birinde profile göre isteğe bağlı eksik alan vardır. Özgün üretim geçmişi bilinmez.

**Kanıt:**

1. Web ve masaüstü aynı dosya özetlerinden aynı tanınan alanları ve aynı çakışmaları içeren Kaynak Metadata Eşleme Önerisi üretir.
2. Sistem kare, tag, slice, pivot, 9-slice ve palet verisini öneri olarak gösterir; üretim geçmişi, onay, Hak Kaydı veya yetkili oyun içi anlam uydurmaz.
3. Zorunlu çakışma çözülmeden eşleme kesinleşmez ve ilgili sonuç Dışa Aktarıma Hazır olmaz. İsteğe bağlı alan kullanıcı tarafından Bilinmiyor bırakılabilir.
4. Kullanıcı alan bazında karar verdiğinde ilişkilendirme kaynak metadata ile kullanıcı kararını ayrı gösterir. Değiştirilmiş sidecar yeniden içe alındığında eski ilişkiyi değiştirmez; yeni öneri ve görünür fark oluşturur.
5. Geçmiş Varlık Beyanı gerekiyorsa ayrıca kullanıcı tarafından oluşturulur; Kaynak Metadata Eşleme Önerisi onun veya Elle İçe Aktarma Kanıtı’nın yerini tutmaz.

#### YAS-03 — Ayrışma güvenli tekrar teslim ve çevrimdışı paket doğrulaması

**Test örneği:** Aynı Teslimat Hedefi için aynı Dışa Aktarım Profiliyle ardışık iki Dışa Aktarım Paketi üretilir. İlk paket bir test oyun klasörüne uygulanır; Workbench’in yazdığı bir dosya hedefte elle değiştirilir, tanınmayan bir yerel dosya eklenir ve ikinci pakette yalnız bir varlık değişir.

**Kanıt:**

1. İki paketin de Paket Doğrulama Kiti doğru JSON Schema, checksum listesi, README ve statik örnekleri taşır; Workbench ile ayrı sürümlenmiş doğrulayıcı ağ erişimi olmadan aynı sonucu verir. Pakette çalıştırılabilir içerik veya ajan talimatı bulunmaz.
2. Teslimat Yenileme Kilidi yalnız önceki teslimatın sahiplendiği yolları karşılaştırır; tanınmayan yerel dosyayı değiştirmez veya silmez.
3. Elle değiştirilen yol Ayrışmış olarak gösterilir ve etkilenen yenileme kullanıcı kararı olmadan ilerlemez. Değişmemiş ve güncellenecek yollar ayrı gösterilir.
4. Kullanıcı dosyayı koruma, yeni hedef seçme veya açıkça değiştirme seçeneklerinden birini seçer. İşlem geçmiş paketi değiştirmez ve oyun klasöründeki durumu Workbench kaynağına dönüştürmez.
5. Web aynı profil, kilit ve ayrışma raporuyla indirilebilir değişiklik paketi üretir; masaüstü aynı sonucu açık izinli klasöre uygulayabilir. Ayrı Tüketim Makbuzu oluşmaz; gerekiyorsa kurulum ve oyun kanıtı mevcut Teslimat Gerçekleşmesi ile Çalışma Zamanı Doğrulama Kaydı üzerinden tutulur.

#### YAS-04 — Çevrimdışı çakışma ve kapsamı doğrulanmış kalıcı silme

**Test örneği:** Aynı taban sürümünden başlayan çevrimdışı bir çalışma taslağı varken buluttaki kayıt başka bir değişiklikle ilerler. Projede ayrıca bir Varlık Sürümünü içeren değişmez Dışa Aktarım Paketi, Proje Arşivi ve Teslimat Gerçekleşmesi bulunur.

**Kanıt:**

1. Yeniden bağlantıda yerel taslak bulut kaydının üzerine yazılmaz ve alanlar otomatik birleştirilmez. Çakışma Kaydı taban sürümü, güncel bulut sürümünü ve yerel taslağı gösterir; bulut kaydı yetkili kalır.
2. Kullanıcı yerel taslaktan ayrı Aday Sürüm oluşturur. Aynı çözüm isteğinin yeniden teslimi ikinci sürüm üretmez; çözüm kaydı yeni sürüm kimliğini ve kullanıcı seçimini taşır.
3. Kalıcı silme öncesi Silme Etki Dökümü, varlık içeriğini gömen Dışa Aktarım Paketini ve Proje Arşivini, bağlı Teslimat Gerçekleşmesini ve harici kopyaların geri çağrılamayacağını ayrı gösterir.
4. Kullanıcı değişmez kapsayıcıları silme kapsamına almadığında içerik bu kapsayıcılarda kalır ve işlem kapsamlı temizleme olarak sunulmaz. Kapsayıcı seçildiğinde paket veya arşiv bütünüyle kaldırılır; manifest ya da checksum listesi yeniden yazılmaz.
5. Korunan içeriksiz Teslimat Gerçekleşmesi artık doğrulanamaz olduğunu gösterir. Silme Makbuzu içerik taşımaz; seçilen kapsamı, özetleri, kapsam dışı bağımlılıkları ve saklama takvimi sürümünü taşır.
6. Yayımlanmış yedek temizleme süresi sonunda operasyonel kontrol, seçilen bütün yönetilen kopyaların etkin depoda ve yedeklerde bulunmadığını doğrular.


