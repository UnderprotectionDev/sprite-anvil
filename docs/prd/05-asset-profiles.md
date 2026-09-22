> [PRD içindekiler](README.md)

### 4.9 Varlık türüne özel profiller

**QLT-02 — Özel profil kapsamı.** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:

1. Karakterler, yaratıklar ve animasyonlar
2. Objeler, silahlar, ekipmanlar ve durum aileleri
3. İkonlar
4. Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri
5. Karo setleri, arazi ve kesintisiz dokular
6. Arka planlar ve katmanlı kaydırma
7. Arayüz ekranları ve bileşenleri
8. Portreler, logolar ve tanıtım görselleri

Yazı tipleri, imleçler ve normal haritalar, ışık yayılımı haritaları, yükseklik haritaları veya ışık maskeleri gibi yardımcı görseller başlangıçta Genel Varlık Desteği alır. Ürün bu dosyaların ilişkilerini ve dışa aktarmada gereken temel bilgileri korur; ancak türe özel testler veya tamamlanmayı engelleyen kontroller sunmaz.

Bir varlık türü ancak üretim bilgileri, kalite kuralları, insan incelemesi, kullanım testi, istisna kuralları, dışa aktarım eşlemesi ve örnek kabul senaryosu tanımlandığında özel profile sahip olur.

Her özel profil; üretim bilgilerini, Bütünlük Denetimlerini, İstisna Verilebilir Gereksinimleri, Kalite Uyarılarını, insan incelemesini, kullanım testlerini, istisna kurallarını ve dışa aktarım eşlemelerini tanımlar.

#### Bağlayıcı özel profil sözleşmesi

**QLT-03 — Özel Profil Sözleşmesi.** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar. Sözleşmedeki her kural; kararlı bir kural kimliği, kural sınıfı, değerlendirilen girdi, gözlenebilir başarılı/başarısız sonuç, üretilecek kanıt, uygulanacağı varlık kapsamı ve dışa aktarım etkisini taşır. İstisna yalnız `İstisna Verilebilir Gereksinim` sınıfındaki kurallarda açıkça `izin verilir` olarak işaretlenebilir. Bütünlük Denetimleri, zorunlu insan incelemeleri ve zorunlu kullanım testleri istisna alamaz. Sözleşmesi etkin olmayan bir tür Genel Varlık Desteği alır; arayüzde özel profil olarak sunulamaz ve tamamlanma kanıtı üretemez. Geçmiş kalite değerlendirmeleri ve Dışa Aktarım Paketleri kullandıkları kesin sözleşme revizyonunu korur.

Bütün özel profillerde şu ortak taban zorunludur:

- Dosyanın okunabilirliği, dosya özeti, benzersiz birim kimlikleri, hücre sınırları, referans bütünlüğü ve desteklenen metadata'nın içe aktarma → düzenleme → dışa aktarma → yeniden okuma turunda kaybolmaması Bütünlük Denetimidir ve istisna alamaz.
- Etkin Gerekli Öğeler Listesi'nde zorunlu işaretlenen yön, durum, kare grubu, kullanım çeşidi veya testin eksikliği aile tamamlanmasını engeller ve Kalite İstisnasıyla aşılamaz. Kullanıcı öğeyi sağlar veya listeyi yeni bir sürümle isteğe bağlı ya da uygulanamaz yapar; geçmiş liste değiştirilmez. İstisna Verilebilir Gereksinim yalnız mevcut bir Birim Sürümü veya Birleşik Sürüm üzerinde ölçülebilen profil kuralına uygulanır ve tam kural, sürüm ile kullanım kapsamına bağlanır.
- Kimlik, stil, perspektif, hareket ve okunurluk gibi kesin eşik olmadan insan yorumu gerektiren sonuçlar Kalite Uyarısıdır. Özel Profil Sözleşmesi aynı konuyu zorunlu insan incelemesi olarak belirlemişse inceleme kaydı olmadan profil tamamlanamaz; otomatik şüphe kullanıcı yerine karar vermez.
- Kullanım testi, sabitlenmiş varlık sürümleriyle, tanımlı test ortamında yürütülür ve Geçti, Başarısız veya Sonuçsuz sonucu üretir. Zorunlu testte yalnız Geçti sonucu tamamlanma kanıtıdır.
- Dışa aktarım eşlemesi, profilin taşıdığı her alanın paket içindeki kararlı alan kimliğini, birimini, koordinat sistemini, varsayılan bulunmadığında uygulanacak davranışı ve yeniden okuma kontrolünü belirtir. Tanımlanmamış alan sessizce tahmin edilmez veya düşürülmez; zorunluysa dışa aktarım durur, isteğe bağlıysa `Bilinmiyor` olarak korunur.

Tam Ürün Kapsamındaki sekiz özel profil için bağlayıcı asgari sözleşme aşağıdadır. Proje veya Varlık Ailesi bağlamı ek ölçülebilir kurallar tanımlayabilir; bu ek kurallar ortak tabanı gevşetemez.

| Profil | Bütünlük Denetimleri | İstisna Verilebilir Gereksinimler | Zorunlu insan incelemesi ve kullanım testi | Dışa aktarım eşlemesi |
| --- | --- | --- | --- | --- |
| Karakterler, yaratıklar ve animasyonlar | Kare/yön kimliği, süre, sıra, pivot, mount point, çarpışma alanı ve olay bağlantılarının roundtrip bütünlüğü; geçersiz hücre veya kopuk birim bağlantısı | Mevcut sürümün tanımlı ölçüsü, kare sayısı ve zemin/loop toleransları | Ana Tasarıma göre kimlik, siluet, ekipman tarafı, perspektif ve zemine temas incelemesi; çok yönlü eşzamanlı oynatma ve sahne geçişi testi | Kare alanı ve sırası, yön, süre, döngü, pivot, zemin noktası, mount point, çarpışma alanı ve olay kimliği |
| Objeler, silahlar, ekipmanlar ve durum aileleri | Durum/yön kimliği, pivot ve sıralama noktası bağlantıları; eksik veya çakışan durum eşlemesi | Mevcut sürümün tanımlı ölçü ve yerleşim toleransları | Aile içi ölçek, perspektif, malzeme ve durum ayrışması incelemesi; onaylı karakter ve zeminle sahne testi | Durum ve yön kimliği, doğal ölçü, pivot, zemin/sıralama noktası ve kullanım bağlantıları |
| İkonlar | Kullanım çeşidi, kaynak/mantıksal ölçü ve renk verisinin roundtrip bütünlüğü | Mevcut sürümün tanımlı ölçü, renk ve iç boşluk sınırları | Hedef boyutta siluet, okunurluk, aile içi nesne ölçeği ve açık/koyu arka plan incelemesi | Kullanım çeşidi, doğal ve mantıksal ölçü, ölçekleme kuralı, renk alanı ve tam sürüm kimliği |
| Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri | Kare, süre, başlangıç noktası, olay ve şeffaflık verisinin okunabilirliği ile roundtrip bütünlüğü | Mevcut sürümün tanımlı süre, hücre taşması ve şeffaflık miktarı kuralları | Açık, koyu, şeffaf ve gerçek sahne arka planında okunurluk; sahibiyle eşzamanlı olay testi | Kare alanı, süre, döngü, başlangıç noktası, katman, olay, taşma izni ve şeffaflık bilgisi |
| Karo setleri, arazi ve kesintisiz dokular | Karo kimliği, atlas alanı, komşuluk eşlemesi ve tekrar eksenlerinin geçerliliği; kesin kenar eşleşmesi | Mevcut sürümün tanımlı atlas ölçüsü ve birleşim toleransı | İç/dış köşe, dar koridor, tek arazi dolgusu ve rastgele tekrar test haritası; görünür tekrar incelemesi | Karo alanı, komşuluk kuralı, terrain kimliği, animasyon bilgisi ve doku tekrar ayarı |
| Arka planlar ve katmanlı kaydırma | Katman kimliği, sıra, göreli hareket, döngü ve kırpma alanı bağlantılarının geçerliliği | Mevcut sürümün tanımlı görüntü oranı, güvenli alan ve döngü/birleşim toleransı | Hedef oranlarda kırpma, birleşim, kontrast ve oyuncu görünürlüğü; gerçek kaydırma testi | Katman sırası, göreli hız, döngü/kırpma modu, doğal ölçü, güvenli alan ve sürüm kimliği |
| Arayüz ekranları ve bileşenleri | Bileşen/durum kimliği, doğal ölçü, dokuz parça germe payı ve güvenli alan geometrisinin geçerliliği | Mevcut sürümün tanımlı hedef ölçü ve metin güvenli alan sınırları | Aile stili ve durum ayrışması incelemesi; belirtilen hedef ölçülerde germe ve metin alanı testi | Durum eşlemesi, doğal ölçü, germe payları, güvenli alan ve ekran/bileşen bağlantısı |
| Portreler, logolar ve tanıtım görselleri | Kullanım çeşidi, Görsel Dünya, Ana Tasarım, kırpma ve güvenli alan bağlantılarının geçerliliği | Mevcut sürümün tanımlı hedef oran, küçük kullanım ve güvenli alan sınırları | Kimlik ve ifade tutarlılığı, küçük boyutta okunurluk, açık/koyu arka plan ve güvenli alan incelemesi | Kullanım amacı, Görsel Dünya, Ana Tasarım, doğal ölçü, kırpma, güvenli alan ve arka plan çeşidi |

Özel Profil Sözleşmesi değiştiğinde yeni sözleşme sürümü oluşur. Geçmiş kalite kanıtı eski sözleşmeyi sabitler. Seçili yeni sözleşme sürümünde değişen veya eklenen zorunlu kuralın etkilediği öğelerin eski kalite kanıtı yeni sözleşmeyi karşılamaz; eksik yeni kanıt Kalite Kontrol Durumu'nu Engel Var yapar. Etkilenmeyen kalite kanıtları korunur. Bu değişiklik tek başına Bağlama Uygunluk Durumu'nu değiştirmez. OV-03 ve OV-17, bu asgari sınıfları yeniden tanımlamaz; yalnız projeden bağımsız varsayılan tolerans veya uyarı eşiği yayımlanacaksa gereken kabul kanıtını kapatır.

#### Karakterler ve yaratıklar

Çalışma alanı Ana Tasarımı, gerekli yönleri, varyantları, ekipman ilişkilerini ve animasyonları aynı Varlık Ailesi içinde gösterir. Farklı Görsel Dünya veya kullanım bağlamına ait portre ve ikon ailelerine Varlık Kimliği üzerinden geçiş sunar; bunları aynı aileye katmaz.

Yönler arasında siluet, beden oranı, ekipmanın hangi tarafta olduğu, palet, perspektif, zemine temas ve ölçek karşılaştırılabilir. Dört veya sekiz yön aynı anda görüntülenip eşzamanlı oynatılabilir. Dönüş sırasındaki farklar da incelenebilir.

#### Animasyonlar

Animasyon çalışma alanı görsel sayfalarıyla veya ayrı karelerle çalışır. Kullanıcı kare sırasını ve her karenin süresini, genel oynatma hızını, döngü davranışını, hareket evrelerini ve oyun içi olayları inceleyebilir.

Araçlarda önceki ve sonraki kareyi gösteren katmanlı kare önizlemesi, birden fazla soluk kare görünümü, dönüş noktası ve zemin çizgisi, görsel fark katmanı ve doğal 1× boyutta inceleme bulunur.

Yürüme, koşma ve saldırı animasyonları tek bir sabit kare hızına zorlanmaz; karelerin süreleri farklı olabilir. Hazırlık, hareket, temas, hareketin devamı ve toparlanma gibi evreler işaretlenebilir, ancak belirli bir evre veya kare düzeni zorunlu değildir.

Birden fazla yönün oynatma konumu eşzamanlanabilir. İsabet, nesne fırlatma, ayak sesi ve büyü bırakma gibi olayların zamanlaması karşılaştırılabilir.

Animasyon profili, yönler ve kareler için zemin çizgisi sapmasını, loop başlangıç/bitiş karşılaştırmasını ve kareye bağlı dönüş noktası, mount point, çarpışma alanı ile olay eşlemelerini aynı inceleme yüzeyinde gösterir. Yapısal metadata roundtrip kaybı engeldir; görsel geçiş ve zemin değerlendirmesi [Bölüm 4.8](04-ingestion-lifecycle-and-quality.md#48-kalite-modeli-ve-harici-analiz)’deki profil sınıfına göre ele alınır.

#### Objeler, silahlar, ekipmanlar ve durum aileleri

Objeler tek tek resimler olarak değil, durum ve yön aileleri olarak yönetilir. Kapalı/açık/yağmalanmış veya sağlam/hasarlı/kırık gibi durumlar ortak ölçek, perspektif, malzeme dili ve yerleşim noktalarına göre karşılaştırılır.

Objeler proje ızgarasında, onaylı karakterlerin yanında ve farklı zeminlerde denenebilir. Görsel merkez ile zemine oturma veya sıralama noktası ayrı ayrı değerlendirilebilir.

#### İkonlar

İkonlar hem kaynak boyutlarında hem de gerçek kullanım boyutlarında incelenir. İkon ailesindeki görseller açık ve koyu arayüz arka planlarında; siluet, gri tonlama, iç boşluk ve nesne ölçeği açısından yan yana karşılaştırılır.

Işık yönü, kontur, ayrıntı yoğunluğu, arka plan veya çerçeve yaklaşımı ve nadirlik renginin nesne kimliğine karışıp karışmadığı incelenir.

#### Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri

Görsel efektler şeffaf, açık, koyu ve gerçek oyun arka planlarında gösterilebilir. Efekt tek başına veya sahibi olan karakter animasyonuyla eşzamanlı oynatılabilir.

Başlangıç noktası, tek seferlik ya da döngülü oynatma, kare süreleri, hücre dışına taşma izni, katman ve oyun içi olay bilgisi korunur. Efekt hücre dışına bilinçli olarak taşabilir; profil bunu karakter görselinden farklı değerlendirir.

#### Karo setleri, arazi ve kesintisiz dokular

Karo setleri sabit sayıda karoya veya tek bir düzene zorlanmaz. Bağımsız karolar, yollar, kenar ve köşe arazi parçaları, otomatik döşeme ve komşuluk kurallarına göre birbirine bağlanan karo setleri, izometrik arazi, bina parça setleri ve animasyonlu karolar desteklenebilir.

Karo atlasının yanında boyanabilir bir test haritası sunulur. Testlerde komşuluk kombinasyonları, iç ve dış köşeler, dar koridor, tek arazi türüyle dolgu, keskin geçiş ve tekrarları görünür kılan rastgele harita bulunur. Sorun ilgili karoya veya bağlantı durumuna bağlanır.

Kesintisiz dokular 2×2, 3×3 ve kaydırmalı tekrarlarla incelenir. Kenar eşleşmesi otomatik ve kesin biçimde denetlenebilir. Matematiksel birleşim izi olmasa bile göze çarpan tekrarlar insan incelemesine sunulur. Şeffaf yüzey işaretleri, tekrar eden manzara arka planları ve malzeme dokuları ayrı kullanım türleridir.

#### Arka planlar ve katmanlı kaydırma

Arka planlar hedef görüntü oranında, güvenli oyun alanı ve kaydırma davranışıyla denenir. Farklı hızlarda hareket eden katmanlar birlikte oynatılır; döngü, birleşim izi, kırpma, kontrast ve oyuncunun görünürlüğü incelenir.

#### Arayüz ekranları ve bileşenleri

Arayüz, kendine ait bir Görsel Dünya kullanabilir. Ekran tasarımı ile bu tasarımdan türeyen panel, düğme, eşya gözü, açıklama balonu, gösterge, sekme ve onay kutusu gibi bileşenler aynı Varlık Ailesi’ne bağlanır.

Normal, imleç üzerindeyken, basılı, devre dışı, seçili, açık ve kapalı durumlar karşılaştırılır. Panel ve çerçeveler gerçek ekran üzerinde; metin için ayrılan güvenli alan ve köşeleri koruyarak genişleten dokuz parçalı germe yöntemiyle denenir.

#### Portreler, logolar ve tanıtım görselleri

Portre, oyunda kullanılan karakter görseliyle aynı Varlık Kimliği’ne bağlanabilir; ancak farklı Görsel Dünya ve çözünürlük kurallarına sahip olabilir. İfade çeşitleri, kırpma tutarlılığı ve diyalog ya da arayüz içindeki görünümü birlikte incelenir.

Logo ve açılış görselleri şeffaf veya opak kullanımda; güvenli alan, küçük boyutta okunurluk ve açık ya da koyu arka planlarda denenir. Mağaza ve tanıtım görselleri aynı proje kimliğinde tutulur, ancak oyun içi piksel sanatı kurallarına zorlanmaz.


