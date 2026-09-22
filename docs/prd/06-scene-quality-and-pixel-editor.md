> [PRD içindekiler](README.md)

### 4.10 Sahne kalite kontrol alanı ve oyun içi bilgiler

Sahne kalite kontrol alanı, özel profillerin yapılandırdığı hafif bir görsel kullanım test alanıdır. Betik yazma aracı, seviye düzenleyici, tam fizik benzetimi veya oyun içi davranışların kaynağı değildir.

Kullanıcı karo setlerini, arka planları, karakterleri, objeleri, gölgeleri ve görsel efektleri aynı sahneye yerleştirebilir. Karakteri hareket ettirebilir, bekleme/yürüme/saldırı geçişlerini oynatabilir, efekti isabet anına bağlayabilir ve katmanları, Y eksenine göre sıralamayı ya da kamera davranışını görebilir. Böylece ölçek, perspektif, ayrıntı, kontrast ve okunurluk gerçek kullanıma yakın bir ortamda değerlendirilir.

Dönüş noktası, zemin noktası, sıralama noktası, efekt başlangıç noktası, vuruş alanı, hasar alma alanı, çarpışma bilgisi ve animasyon olayları görsel katman olarak gösterilebilir. Oyun içi kullanım bilgilerini kullanıcı yazar veya içe aktarır. İncelemeden sonra bu bilgiler dışa aktarılabilir.

Ürün görsel şeffaflıktan yetkili çarpışma bilgisi çıkarmaz ve tam fizik benzetimi sunmaz.

Doğrulanmış motor çıktısının gerçek oyunda denenmesinden elde edilen ekran görüntüsü, kısa kayıt, test sonucu ve kullanıcı gözlemi bir Çalışma Zamanı Doğrulama Kaydı olarak ilgili Dışa Aktarım Paketi’ne ve kullanılan kesin Varlık Sürümlerine bağlanabilir. Kayıt, test edilen oyun yapısını, motor ve motor bağdaştırıcısı sürümünü ve Geçti, Başarısız veya Sonuçsuz sonucunu taşır. Kanıt kullanıcı tarafından elle eklenebilir veya açık araç izniyle doğrulanmış motor bağdaştırıcısı tarafından hazırlanabilir; kayıt kanıtın kaynağını ayırt eder. Bağdaştırıcı taslak hazırlayabilir, ancak sonucu veya başarısızlık kaynağını kesinleştiremez. Oyun projesinden Workbench’e tek yönlü kanıt aktarımı oyun motorunu yetkili veri kaynağı yapmaz ve açık projeyle sürekli ya da çift yönlü eşitleme oluşturmaz.

Başarısız sonuç geçmiş İnceleme Kaydı’nı veya Dışa Aktarım Paketi’ni değiştirmez. Kayıt önce Kaynak Belirsiz sınıfındadır. Sistem kanıta göre kaynak önerebilir; kullanıcı Varlık İçeriği, Motor Bağdaştırıcısı, Oyun Yapılandırması veya Birden Fazla Kaynak sınıfını kesinleştirir. Yalnız kesinleştirilen kapsam bu kullanım için Yeniden Doğrulama Gerekli olur. Kaynak Belirsiz kaldığı sürece çalışma zamanı doğrulamasını kabul koşulu yapan Teslimat Hedefi tamamlanamaz. Başarısızlık başka kullanım bağlamlarındaki dışa aktarımları kendiliğinden engellemez.

Çalışma Zamanı Doğrulama Kaydı değişmezdir ve yalnız bağlandığı kesin Dışa Aktarım Paketi ile kaydedilen oyun yapısı, motor ve bağdaştırıcı sürümleri için geçerlidir. Bunlardan ilgili olan değiştiğinde yeni kayıt gerekir. Teslimat Hedefi, gereken çalışma zamanı ortamlarını ve kanıtın güncellik koşullarını kabul ölçütü olarak belirleyebilir.

### 4.11 Yapısal düzenleme ve son dokunuş piksel düzenleyicisi

Ürün, mantıksal piksellerde küçük düzeltmeler ve üretim sonu temizliği için görev odaklı bir Son Dokunuş Piksel Düzenleyicisi içerir. Düzenleyici boş bir çizim uygulaması olarak değil, belirli bir Varlık Sürümü, Birim Sürümü veya Birleşik Sürüm içinden açılır. Temel amacı sıfırdan resim çizmek değil; üretilmiş ya da içe aktarılmış bir görseldeki küçük piksel, palet, şeffaflık, hizalama ve kare yapısı sorunlarını kaynağı bozmadan gidermektir.

#### Çalışma alanı

Çalışma alanı beş görünür bölgeden oluşur:

- **Üst bağlam çubuğu:** Varlık Ailesi, durum/yön/animasyon adı, düzenlenen kaynak sürüm, mantıksal ölçü, hücre ölçüsü, yakınlaştırma ve taslak durumu gösterilir. Birincil eylem Kaydet değil, **Bitir ve yeni Aday Sürüm oluştur** olur.
- **Sol araç çubuğu:** Piksel kalemi ve silgi, renk seçici, sınırlı doldurma ve çizgi, dikdörtgen seçim, piksele oturan taşıma, kırpma, tuval ölçüsü ve görseli değiştirmeyen işaretleme araçlarını içerir.
- **Orta tuval:** Görsel doğal 1× veya tam sayı yakınlaştırma seviyelerinde, görüntü yumuşatma olmadan gösterilir. Piksel ızgarası, seçim sınırı, önceki/sonraki kare görünümü, dönüş ve zemin çizgileri, fark görünümü ve notlar görselden ayrı katmanlardır; dışa aktarılan piksellere yazılmaz.
- **Sağ inceleme paneli:** Etkin aracın sayısal ayarlarını, kullanılan renkleri ve palet dışı renkleri, orijinal-taslak farkını, işaretleri ve seçili karenin ölçü/süre/dönüş noktası bilgilerini gösterir.
- **Alt kare şeridi:** Yalnız animasyon veya çok kareli görsel sayfasında açılır. Kare küçük görselini, süresini ve değiştirilmiş, sorunlu ya da korunacak durumunu gösterir; kare ekleme, çoğaltma, silme, dosyayla değiştirme ve sürükleyerek sıralama olanağı verir.

Tuvalin yakınlaştırması ile gerçek oyun boyutu önizlemesi ayrıdır. Kullanıcı ayrıntıyı örneğin 16× büyütmede düzenlerken sonucu sürekli 1×, 2× veya seçilen tam sayı gösterim ölçeğinde görebilir. Şeffaflık; damalı, açık, koyu ve kullanıcı tarafından seçilmiş kontrast arka planlarda denetlenebilir.

#### Piksel ve palet araçları

Tam Ürün Kapsamı şu deterministik araçları sunar:

- 1 piksel ve küçük tam sayı boyutlarında, kenar yumuşatmasız kalem ve silgi
- Renk seçici, düz çizgi ve bitişik alanı kesin renk eşleşmesiyle doldurma
- Dikdörtgen seçim; kesme, kopyalama, yapıştırma ve tam piksel adımıyla taşıma
- Yatay/dikey çevirme ve yalnız piksel ızgarasını koruyan 90 derecelik döndürme
- Kırpma, sabit bağlantı noktasına göre tuval büyütme/küçültme ve en yakın komşu yöntemiyle tam sayı ölçekleme
- Kullanılan renkleri çıkarma, proje paletinde olmayan renkleri gösterme, paleti kilitleme ve bir kaynak rengini hedef renkle toplu değiştirmeden önce etkilenecek piksel sayısını önizleme
- Geri al/yinele; birbirine bağlı çoklu piksel değişikliklerini tek kullanıcı işlemi olarak geri alma

Serbest açılı döndürme, yumuşatmalı ölçekleme ve rengin fark edilmeden ara ton üretmesine yol açan işlemler sunulmaz. Gelişmiş fırça motoru, kapsamlı katman sistemi, katman grupları ve karışım kipleri, vektör ve yazı düzenleme, filtre veya efekt paketi, iskelet kurma ve iskelet animasyonu kapsam dışındadır.

#### Kareler, animasyon ve görsel sayfaları

Görsel sayfası içe aktarılırken kullanıcı hücre genişliği/yüksekliği, satır ve sütun sayısı, başlangıç ofseti, hücreler arası boşluk ve okuma sırasını belirtir. Sistem sonucu numaralı hücre sınırları ve oynatılabilir önizlemeyle gösterir; özgün görsel sayfasını değiştirmez.

Her karenin kendi süresi olabilir. Kullanıcı animasyonu oynatabilir, durdurabilir, döngüyü açıp kapatabilir ve önceki/sonraki kareleri ayarlanabilir saydamlıkta üst üste gösterebilir. Zemin çizgisi ve dönüş noktası boyunca oluşan kayma görünür olmalıdır. Ortak hizalama korunurken yalnız sorunlu kareye piksel cinsinden X/Y ofseti verilebilir. Oynatma ve üst üste bindirme, azaltılmış hareket tercihine uyar ve kullanıcı tarafından durdurulabilir.

Bir kareyi koru olarak işaretlemek onun sessizce değiştirilmesini engeller. Kare ekleme, silme, sıralama, süre, ofset, dönüş noktası ve hücre alanı değişiklikleri de piksel değişikliği gibi sürümlenir. Karo setinin pikselini düzeltmek bu düzenleyicinin işidir; karoları harita üzerine boyamak ve komşuluk davranışını sınamak [Bölüm 4.9](05-asset-profiles.md#49-varlık-türüne-özel-profiller) ve [4.10](#410-sahne-kalite-kontrol-alanı-ve-oyun-içi-bilgiler)’daki ayrı test alanının işidir.

#### Karşılaştırma, işaretleme ve seçici düzeltme

Kullanıcı kaynak ve taslağı yan yana, üst üste veya kullanıcı tarafından başlatılıp durdurulan geçişli karşılaştırmayla inceleyebilir. Sistem değişen piksel sayısını, değişiklik sınır kutusunu ve etkilenen kareleri gösterir. Görsel fark yalnız renkle anlatılmaz.

Kullanıcı görseli değiştirmeyen bölge, ok, dönüş ve zemin çizgisi ile metin notu ekleyebilir. Bu işaretler elle düzeltme için kullanılabildiği gibi yeni bir Üretim Paketi’ne de eklenebilir. Ürün, yerel ve deterministik işlem ile generatif düzeltmeyi açıkça ayırır:

- Yanlış pikseli silmek, rengi eşlemek, kareyi kaydırmak veya sıralamak yerel düzenleme işlemidir.
- Eli yeniden çizmek, pozu değiştirmek ya da yeni ara kare üretmek yeni bir üretim denemesidir. Düzenleyici hedef bölgeyi, sorun notunu, korunacak kareleri ve komşu kareleri paketler; üretimi kendi içinde zorunlu kılmaz.
- Harici üretimden dönen sonuç mevcut taslağın üzerine sessizce yazılmaz. Hedef karenin veya bölgenin karşılaştırılabilir yeni seçeneği olarak içe alınır; kullanıcı kabul ederse yeni Birim Sürümü ve gerekiyorsa yeni Birleşik Sürüm hazırlanır.

Üretim akışında gereken yapısal işlemler şunlardır:

- Animasyon karelerini içeren görsel sayfasını karelere ayırıp yeniden birleştirme
- Kare sırasını ve kare sürelerini değiştirme
- Bir kareyi veya durumu başka bir dosyayla değiştirme
- Kareyi tuval içinde kaydırarak hizalama
- Boşluğu ve tuval ölçüsünü değiştirme
- Kırpmadan kaynaklanan alan sorunlarını düzeltme
- Mantıksal 1× kaynağı koruyarak tam sayı katında ölçekleme

Bu işlemler geri alınabilir ve sürümlüdür; orijinal dosya korunur. Düzenleyicideki çalışma taslağı kurtarılabilir, ancak kullanıcı değişikliği kesinleştirene kadar Varlık Sürümü sayılmaz. Kesinleştirme işlemi tek bir değişmez Aday Sürüm oluşturur.

Her düzeltme denemesi yeni ve değişmez bir Üretim Paketi kullanır. Paket; sorun notunu ve işaretlerini, hedef Birim Sürümü’nü, gerekirse komşu kare veya birimleri, seçili Ana Tasarım’ı, etkin Üretim Bağlamı Kopyası’nı ve korunacak birimleri içerir. Şekli düzelt, gövdeyi değiştirme gibi talimatlar da pakette saklanır.

#### Örnek kullanım senaryoları

- **Tek yanlış piksel:** Kullanıcı koyu arka planda görünmeyen fakat açık arka planda beliren yarı saydam kenar pikselini siler. Fark görünümü bir pikselin değiştiğini gösterir; bitirildiğinde kaynak korunur ve yeni Aday Sürüm oluşur.
- **Yürüme sırasında ayak kayması:** Sekiz kare oynatılırken zemin çizgisi ve önceki/sonraki kare görünümü üçüncü karenin bir piksel yukarıda olduğunu gösterir. Kullanıcı yalnız o kareyi bir piksel aşağı taşır; diğer yedi kare aynı Birim Sürümlerini korur.
- **Tek bozuk saldırı karesi:** Kullanıcı bozuk eli işaretler, “eli düzelt; gövdeyi, silah açısını ve paleti değiştirme” notunu yazar ve komşu kareleri koru olarak seçer. Paket dışarıda üretim için kullanılır; dönen kare ancak karşılaştırma ve kullanıcı kabulünden sonra birleşime girer.
- **Palet sapması:** İçe aktarılan görselde proje paletindeki laciverde çok yakın iki yabancı renk bulunur. Kullanıcı eşlemeyi ve etkilenecek piksel sayısını önizleyip tek geri alınabilir işlemle uygular.
- **Yanlış dilimlenmiş görsel sayfası:** Kullanıcı `64×64`, dört sütun, iki satır ve sıfır boşluk tanımlar; sekiz kareyi önizler, sıralamayı düzeltir, gereksiz kareyi çıkarır ve kare sürelerini ayarlar. Kaynak PNG değişmeden kalır.

Tam Ürün Kapsamı PNG, ayrı kareler ve düzenli görsel sayfalarını destekler; [Bölüm 4.5](04-ingestion-lifecycle-and-quality.md#45-referanslar-üretim-paketi-ve-içe-aktarma)’te tanımlanan JSON sidecar metadata bu görsellerle ilişkilendirilebilir. Photoshop, yerel `.aseprite` veya Pixelorama çalışma dosyalarını kayıpsız biçimde açıp yeniden yazma; tam katmanlı kaynak belge uyumluluğu ve genel amaçlı çizim uygulaması davranışı vaat edilmez.

