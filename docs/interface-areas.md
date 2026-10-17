# Sprite Anvil — Arayüz Tasarım Planı

Paper'da hangi artboard'ların, hangi düzen şablonuyla çizileceğinin listesi. Ekranın içinde ne olacağını bu belge değil, [PRD](prd/README.md) ve ilgili [iş akışı aşaması](workflow/) belirler; tablolardaki **İş akışı** sütunu o aşamanın numarasıdır.

- **Paper dosyası:** [Sprite Anvil · Product](https://app.paper.design/file/01M4ASVM4ATF4HHXQSJ96CWVFY). Başlamadan önce `Start Here` sayfasını okuyun.
- **Görsel kararlar:** `Design Language` (renk, yazı, boşluk, bileşenler) ve `Layout Templates` (şablon iskeletleri) sayfaları.
- Kaynaklar çelişirse uygulamadan önce açıklanır.

## Kurallar

1. **Artboard adı** `Kimlik · Ekran adı` biçimindedir (ör. `03.2 · Varlık ayrıntısı`) ve bölümün Paper sayfasına çizilir.
2. **Alt ekran** (`03.2.1`), üst ekranın içinden açılan sekme, panel veya penceredir; üst ekranın üzerinde açık hâliyle kendi artboard'unda çizilir.
3. **Görünüm**, aynı ekranın içerik veya durum farkıdır; numara almaz ve `08.2.7 › Kaydediliyor` gibi anılır. Aynı artboard'da etiketlenir; yerleşim belirgin değişiyorsa `Kimlik · Ekran — Görünüm` adlı ayrı artboard açılır.
4. **Ortak parçalar bir kez çizilir.** 00, 07 ve 08 diğer bölümlerde yeniden kullanılır; bölümlere ayrı silme, durum veya onay penceresi çizilmez. Aynı işi yapan bileşen `Design Language` içinde tek örnektir.
5. **Açıklamalar** ekranın yanındaki not artboard'una yazılır.
6. **Ürün etiketleri** [sözlükteki](CONTEXT.md) Türkçe adlardır.
7. **Her ekranda:** klavye ve görünür odak, yalnız renge dayanmayan durumlar, webde yükleme/indirme yolu, ham hata yerine güvenli açıklama ve gerekiyorsa Destek Referansı.
8. **Liste tamamlanma değildir.** Paper'da artboard bulunması, ekranın onaylandığı veya kodlandığı anlamına gelmez.
9. **Kimlik değişirse** bu belge, Paper artboard adı ve artboard içindeki kimlik etiketi birlikte güncellenir.

## Düzen şablonları

| Kod | Şablon | Kod | Şablon |
| --- | --- | --- | --- |
| `T00` | Workspace Shell | `T06` | Test Harness |
| `T01` | Entry Window | `T07` | Pixel Editor |
| `T02` | List + Detail | `T08` | Operation Flow |
| `T03` | Record Detail | `T09` | Dashboard |
| `T04` | Structured Form | `T10` | Dialog / Sheet |
| `T05` | Compare | | |

- `A + B`: A şablonunun yuvasına B'nin yerleşimi girer.
- `Yuva dolgusu`: durum, bulunduğu ekranın yuvasını doldurur.
- Kompakt (960) varyant yalnız düzende `+960` yazıyorsa çizilir.

## 00 · Ortak çerçeve

Paper sayfası: `00 · Shared Shell`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 00.1 | Proje ve gezinme | `T00` | Seçili proje adı ve proje değiştirme; 01.2 Projeler'e dönüş; Proje Bağlamı, Kütüphane, Üretim, İnceleme ve Teslimat geçişleri, açık alanın seçili görünümü. | 01 |
| 00.2 | İçerik alanı | `T00` | Ekran başlığı, seçili kaydın adı ve konum yolu; ana içerik, kayda ait işlem kontrolleri, alt ekran geçişleri; üst kayda veya listeye dönüş. | — |
| 00.3 | Durum alanı | `T00` | Bağlantı durumu (çevrimdışıyken 08.2.4) ve devam eden işlemler (08.2.7 › İşlem ilerlemesi); işlem seçilince 07.2 açılır. | 32, 34 |
| 00.4 | Destek ve sınır bilgileri | `T09` | Desteklenen tarayıcı, masaüstü, motor sürümü ve proje boyutu; yayımlanmış işlem/depolama sınırları ve destek değişikliği duyuruları. | 48 |
| 00.4.1 | Destek kaldırma duyurusu ve dışa aktarma | `T08` | Desteği kaldırılacak platform veya sürüm için önceden duyuru ve verileri dışa aktarma yolu. | 48 |
| 00.5 | Hesap menüsü | `T00` | Kullanıcının adı ve e-postası, oturumu kapatma; çıkıştan sonra 01.1 Giriş açılır. | 01 |

## 01 · Hesap ve Projeler

Paper sayfası: `01 · Accounts & Projects`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 01.1 | Giriş | `T01` | Kimlik bilgisi formu, gönderim bekleme ve başarısız gönderim açıklaması; başarılı girişte 01.2 açılır. Giriş: e-posta, parola. Hesap oluşturma: ad, e-posta, parola, alan doğrulama ve kayıt hatası. Görünümler: Giriş · Hesap oluşturma. | 01 |
| 01.2 | Projeler | `T00 (proje öncesi) + T02` | Proje adları ve projeyi açma; yeni proje oluşturma, Proje Arşivine geçiş; proje yoksa 08.2.2 › Henüz içerik yok. Görünümler: Izgara · Liste. | 01 |
| 01.3 | Yeni proje | `T01 + T04` | Proje adı ve genel sanat yaklaşımı alanları; oluşturma kontrolü, eksik/geçersiz alan açıklamaları, oluşan projeye geçiş. | 01 |
| 01.4 | Proje Arşivi | `T00 (proje öncesi) + T02` | Arşiv listesi, seçili arşivin içerik özeti, indirme ve 01.4.1 geri yüklemeye geçiş. Arşiv oluşturmada bağlam, varlık, üretim, inceleme ve teslimat geçmişi seçimi; dışarıda kalan kanıtlar ve sonucu izleme. Görünümler: Arşiv listesi · Arşiv oluşturma. | 44 |
| 01.4.1 | Geri yükleme | `T08` | Mevcut projenin üzerine yazmaz, her zaman bağımsız yeni proje oluşturur; dosya/ilişki bütünlüğü sonucu, eksik kanıtlar, işlem ilerlemesi ve yeni projeyi açma. Görünümler: Arşiv seçimi · Bütünlük kontrolü · Yeni projeyi açma. Geçersiz arşivde başarısızlık ve kısmi proje bırakılmadığı açıklaması. | 44 |
| 01.5 | Proje yönetimi | `T04` | Açık projenin yönetimi: 01.4 Proje Arşivine geçiş ve kalıcı silmeyi başlatma (07.3). | 44, 45 |

## 02 · Proje Bağlamı ve Yönetimi

Paper sayfası: `02 · Project Context & Management`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 02.1 | Proje Bağlamı | `T02` | Etkin Bağlam Sürümü ve kapsamlara göre gruplanmış kurallar; seçili kapsamda devralınan ve geçerli kurallar; yeni öneri, bekleyen öneriler, 02.1.3 sürüm geçmişi ve 02.1.2 Stil Modülleri geçişleri. | 03 |
| 02.1.1 | Kural önerisi | `T04 + T05` | Mevcut ve önerilen kural farkları, taban sürüm, ajan/model veya kontrol kaynağı, doğrulama sonucu. Hazırlamada kural, kapsam, değer ve dayanak alanları. Görünümler: Hazırlama · Bekleyen öneriler · Çakışma çözümü · İnceleme ve etkinleştirme. Bağlam Ajanından öneri isteme ve talimat verme (serbest biçimli değişiklikler). | 03 |
| 02.1.1.1 | Bağlam Kuralı İstisnası | `T04` | Devralınan kural, yerine geçecek dar kapsamlı değer ve gerekçe; kaynak kural zinciri ve etkilenen kapsam; istisnayı Bağlam Önerisine ekleme. Kalite İstisnası ayrıdır (05.1.2). | 03 |
| 02.1.2 | Stil Modülleri | `T02` | Stil Modülleri, kuralları ve sürümleri; palet, kontur gibi kuralları gruplama; 08.3 › Hedef proje seçici ile başka projeye kopyalama (alıcıda Bağlam Önerisi olur). Görünümler: Modül listesi · Sürüm hazırlama · Sürüm inceleme. | 03 |
| 02.1.3 | Bağlam sürüm geçmişi | `T02 + T05` | Bağlam Sürümleri, etkin sürüm işareti, seçili sürümün kural ve istisnaları; sürüm farkları, kaynak öneri ve bu sürümü kullanan üretim kayıtları. | 03 |
| 02.2 | Görsel Dünyalar ve Temalar | `T02` | Görsel Dünyalar ve bağlı Temalar; oluşturma/düzenleme; seçili dünya veya Temanın kuralları ve Proje Bağlamındaki karşılığı. | 04 |
| 02.3 | Bağlantılar ve izinler | `T04` | Araç/ajan başına izin durumu, amaç ve proje/veri kapsamı; izin verme/geri alma. Başlangıçta kapalı Harici Görsel Analizi için kategori, sağlayıcı, aktarılan veri ve saklama koşulları; desteklenmeyen bağlantılar kullanılamaz görünür. | 02 |
| 02.3.1 | Harici Görsel Analizi gönderim bildirimi | `T10` | Her gönderimden hemen önce 08.3 penceresiyle kategori, sağlayıcı, aktarılacak veri ve saklama bilgisi; gönder veya vazgeç. | 02 |
| 02.4 | Ürün ölçümleri | `T09` | Süre, başarı, koruma ve yarım kalan akış sonuçları; ölçüm kapsamı ve zaman aralığı; farklı tanım sürümleri ayrı, kullanılan Ölçüm Tanımını açma. Baseline ve hedef durumu; baseline yoksa başarı yüzdesi gösterilmez. | 46 |
| 02.4.1 | Ölçüm Tanımları | `T04 + T05` | Tanımın kapsamı, başlangıç/bitiş olayları, pay/payda, hariç tutmalar, zaman aralığı ve saklama süresi; yeni sürüm hazırlama, fark inceleme, etkinleştirme. Sonucu değiştirecek ürün kararı (karar kullanımı). | 46 |

## 03 · Varlık Kütüphanesi

Paper sayfası: `03 · Asset Library`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 03.1 | Kütüphane | `T02` | Varlık önizlemeleri, adları, Varlık Kategorileri ve Kayıt Durumları; seçilen varlık 03.2'de açılır. Varlıklar: ad, Varlık Kategorisi, Tema, Görsel Dünya, ölçü, etiket ve Etkin/Arşivlenmiş filtreleri. Koleksiyonlar: üye ekleme/çıkarma. Varlık Aileleri: üyeler, Onaylı Ana Tasarım, Türetilmiş Varlıklar, eksik öğeler. Görünümler: Varlıklar · Koleksiyonlar · Varlık Aileleri. | 05, 07, 08 |
| 03.1.1 | Yeni Varlık Kaydı | `T04 + T10` | Ad, Varlık Kategorisi, etiket, Görsel Dünya ve Tema alanları; bağımsız kayıt oluşturma, aile bağlantısı için 03.1.3, görseli 04.2 ile Aday Sürüm olarak ekleme. | 06 |
| 03.1.2 | Gerekli Öğeler Listesi | `T04` | Gerekli yön, animasyon, durum, varyant ve kullanım testleri ile tamamlanma durumları; gerekli/isteğe bağlı/uygulanamaz seçimi, yeni liste sürümü, eski sürümler ve onları kullanan paketler. Ajan veya profil varsayımından gelen liste taslağını etkin sürümün yanında inceleme; etkinleştirilmeden geçerli olmaz. | 15 |
| 03.1.3 | Aile ve temsil ilişkileri | `T04` | Varlık Kimliği, Görsel Dünya ve kullanım bağlamı; aile oluşturma ve üye ilişkilendirme; Onaylı Ana Tasarımı ve Türetilmiş Varlık kaynaklarını seçme; farklı dünyadaki temsili ayrı aileye bağlama. | 05 |
| 03.2 | Varlık ayrıntısı | `T03` | Büyük önizleme ve kayıt alanları; geçerli kurallar, perspektif, ölçüler, Ana Tasarım, referans amaçları ve üretim hedefi özeti; Onaylı Sürüm, alternatifler ve Türetilmiş Varlıklar, 08.2.8 durum rozetleri; alt ekran sekmeleri, 04.1'e geçiş, arşivleme ve 07.3 kalıcı silme. | 06 |
| 03.2.1 | Oyun İçi Bilgiler | `T03 + T06` | Seçili kare üzerinde pivot, zemin, sıralama, bağlantı ve efekt noktaları; vuruş, hasar ve çarpışma alanları, olaylar; katman göster/gizle, koordinat düzenleme; bilinmeyen alanlar açıkça belirtilir. Profil alanlarını da girer: arka plan katman sırası, doğal ölçü, döngü/kırpma ve güvenli alan; arayüzde durum kimliği, germe payları ve metin güvenli alanı; portre/tanıtımda kullanım amacı, kırpma, güvenli alan ve arka plan çeşidi. | 19 |
| 03.2.1.1 | Metadata paketi indirme | `T08` | Seçili sürümün Oyun İçi Bilgiler ve animasyon metadata JSON paketini indirme; indirilen dosyayı yeniden okuyup doğrulama. | 19 |
| 03.2.2 | Sürümler ve dosyalar | `T03 + T02` | Birim ve Birleşik Sürüm listeleri; önizleme, inceleme durumu, bileşim üyeleri ve dosyalar; 03.2.2.3 karşılaştırma, 05.1 inceleme, 05.3 düzenleyici, 03.2.2.1 ve 03.2.2.2 geçişleri. | 09 |
| 03.2.2.1 | Yeni bileşim oluşturma | `T05` | Kaynak bileşimin birimleri ve seçilebilir kesin Birim Sürümleri; değişecek/korunacak birimleri karşılaştırma; eski bileşimi koruyarak yeni Birleşik Sürüm oluşturma. | 09 |
| 03.2.2.2 | Harici çalışma dosyası | `T03 + T04` | Yönetilen Kopya ve masaüstündeki Canlı Dosya Bağlantısı durumu; harici düzenleyicide açma, algılanan değişikliği PNG/WebP Aday Sürüme bağlama; dosya kaybolursa yeniden seçme, webde yükleme yolu. | 09, 48 |
| 03.2.2.3 | Sürüm karşılaştırması | `T05` | Aynı varlığın iki kesin sürümü yan yana; ortak yakınlaştırma, kare seçimi; görsel, ölçü, Oyun İçi Bilgiler ve Bileşim Üyeliği farkları; 05.1 incelemesine geçiş. | 09, 17 |
| 03.2.3 | Üretim kanıtları | `T03 + T04` | Kaynak türü, mevcut/eksik kanıtlar, bilinmeyen geçmiş; Elle İçe Aktarma Kanıtı ve Sağlayıcı Üretim Kaydı ayrıntıları; sağlayıcı, model, ölçü, tohum gibi değerleri elle girme (Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları, boşlar Bilinmiyor); Geçmiş Varlık Beyanı. Elle İçe Aktarma Kanıtını tamamlama: paket, gerçek üretim talimatı ve kaynak yüzeyi girişi; dört alan tamamlanmadan onaylanamaz. | 13 |
| 03.2.4 | Hak Kayıtları | `T03 + T02` | Hak Kaydı: kaynak, hak sahibi/sağlayıcı, izin kapsamı, kısıt ve belirsizlik; metin/URL ve dosya kanıtı; Belgelendi/Yalnız Beyan/Bilinmiyor/Kısıtlı seçimi; eskisini koruyarak yeni sürüm ve ayrı hak geçmişleri. Kanıt dosyası 5 MiB'a kadar; yalnız proje sahibi indirebilir. | 14 |
| 03.2.5 | Bağımlılık bağlantıları | `T03 + T02` | Kaynak Ana Tasarım ve bağımlı kesin kayıtlar; kimlik, siluet, ekipman, palet, Tema, perspektif, zamanlama türleri; bağlantı ekleme/düzenleme, eksik bağımlılıklar, 05.5'e geçiş. | 18 |
| 03.2.6 | Görsel ölçüler | `T03 + T04` | Dosyadan doğrulanan Kaynak Görsel Ölçüsü; mantıksal çözünürlük, hücre, görünür içerik sınırı, gösterim ölçeği ve atlas için ayrı alanlar; hazır/özel ölçü girme, tam sayı olmayan ölçekte keskinlik uyarısı. | 06 |

## 04 · Üretim ve İçe Aktarma

Paper sayfası: `04 · Production & Import`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 04.1 | Üretim Paketi | `T04` | Hedef, etkin bağlam kopyası, kesin Ana Tasarım, ölçüler ve beklenen çıktı; korunacak/değişecek/kaçınılacak özellikler ve sabit birimler; referansları inceleyip paketi oluşturma, sonucu 04.1.2'de açma. | 11 |
| 04.1.1 | Referans panosu | `T06` | Yan yana referans görselleri, notlar ve hazır/özel kullanım amacı; izinli/yasak aktarım, çakışma çözümü; 03.2.4 Hak Kaydı ve kimlik sınırı değişirse 02.1.1.1 geçişi. | 10 |
| 04.1.2 | Üretim paketi ayrıntısı ve geçmişi | `T02` | Değişmez Üretim Paketleri ve sabitlenmiş bağlam, Ana Tasarım, referans, ölçü, çıktı özeti; özeti kopyalama, görselleri indirme; talimatı kullanıcı dış yüzeyde yazar; sonucu 04.2 ile içe aktarma. | 11 |
| 04.2 | İçe Aktarma Gelen Kutusu | `T02` | Yapıştırma, sürükleme veya yükleme alanı; dosya önizlemesi, kaynak türü, aktarım sonucu; desteklenmeyen dosya ve eksik kanıt açıklamaları; paket olmadan da içe alma; 04.2.1, 04.2.2 ve 03.2.3 geçişleri. Görsel sayfası içe aktarılırken hücre ölçüsü, satır/sütun, ofset, boşluk ve okuma sırası (05.3 › Görsel sayfasını dilimleme ile aynı kontroller). | 12 |
| 04.2.1 | Metadata eşleme | `T05` | Görsel ve JSON sidecar için kare, süre, tag, slice, pivot, dokuz parça ve palet alanlarının kaynak/hedef karşılaştırması; alan bazında tanılama ve çakışma çözümü, Bilinmiyor değerleri koruma. Kaynak biçim ve sürümü, kaynak ve sidecar özetleri; önerilen Varlık Ailesi ve Gerekli Öğeler bağları; tanınmayan alanlar korunmuş görünür; değişen sidecar yeniden alınınca önceki öneriyle görünür fark. | 12 |
| 04.2.2 | Hedef ilişkilendirme | `T04` | Girdinin görseli ve kaynağı yanında hedef Varlık Kaydı, yön/animasyon/durum veya birim seçimi; gerekirse 03.1.1 formu; kesinleşince oluşan Aday Sürümü açma. | 12 |
| 04.3 | Üretim Deneyleri | `T02 + T05` | Deney listesi, ortak amaç ve her denemeye ayrı paket/Aday Sürüm; sonuçları ve girdi farklarını karşılaştırma; seçim/sonuçsuz/bırakma kararı (varlığı onaylamaz); öğrenimi 02.1.1 önerisine aktarma. | 30 |
| 04.4 | Üretim Tarifleri | `T02 + T04` | Tarif listesi ve sürümleri; deneyden tarif oluşturma; talimat iskeleti, referans rolleri, çıktı yapısı, sabit/doldurulacak alanlar; paket hazırlama veya 08.3 › Hedef proje seçici ile kopyalama. | 31 |

## 05 · İnceleme ve Kalite Kontrolü

Paper sayfası: `05 · Review & Quality Control`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 05.1 | Sürüm incelemesi | `T03` | Kesin sürümün önizlemesi, kalite kanıtları, onay engelleri ve karar geçmişi; 03.2.2.3 ile karşılaştırma; onay/ret/yeniden Aday ve gerekçe; 08.2.8 durum rozetleri. | 17 |
| 05.1.1 | Toplu inceleme | `T05` | Seçili sürümler yan yana, her birinin kanıt ve engelleri; Onayla/Reddet/Aday yap kararı ve gerekçe için önizleme. Engelli seçim varsa toplu işlem durur; kullanıcı seçimi değiştirip yeni önizlemeyle kesinleştirir. | 17 |
| 05.1.2 | Kalite İstisnası | `T10 + T04` | İzin veren kural, gözlenen değer, kesin sürüm, kullanım kapsamı, Bağlam Sürümü ve Ana Tasarım; gerekçe ve kesinleştirme. Bütünlük, zorunlu inceleme ve eksik test kanıtı istisnayla aşılmaz. | 16 |
| 05.2 | Profil testleri | `T02` | Sürümün Varlık Kategorisi, etkin profil sözleşmesi ve değerlendirme sonuçları; 05.2.1 test alanı, kesin test girdileri; özel profil yoksa 05.2.2'ye geçiş. | 16 |
| 05.2.1 | Test alanı | `T06` | Bütünlük, ölçülebilir gereksinim, uyarı, insan incelemesi ve kullanım testi sonuçları ayrı gruplar; her kuralın kimliği, sınıfı, kanıtı ve dışa aktarım etkisi; her sonuçtan kural, şüpheli kare/bölge ve kanıta geçiş; 05.2.1.1 ve 05.2.1.2 geçişleri. Her tür görünümü yalnız türe özgü kısmı gösterir. Görünümler: Karakter ve animasyon · Obje ve ekipman · Nesne yerleşim sahnesi · İkon · Efekt · Karo ve doku · Arka plan · Oyun arayüzü varlıkları · Portre, logo ve tanıtım. | 20–27 |
| 05.2.1.1 | Özel Profil Sözleşmesi | `T02` | Sözleşme sürümleri; metadata alanları, kural sınıfları, zorunlu inceleme/testler, istisna izni ve dışa aktarım eşlemeleri; etkinleştirme ve etkilenen kanıtlar. | 16 |
| 05.2.1.2 | Değerlendirme ve test kanıtı | `T04` | Kesin varlık/birim/bileşim, profil sürümü, test ortamı ve kanıtlar; otomatik sonuçlar, insan değerlendirmesi, Geçti/Başarısız/Sonuçsuz kullanım testi; yanlış uyarı geri bildirimi ve önceki değerlendirmeler. | 16 |
| 05.2.2 | Genel Varlık Desteği | `T03` | Yazı tipi, imleç ve yardımcı görseller için kayıt/dosya bilgisi ve önizleme; temel bütünlük ve kullanıcı incelemesi; türe özgü test iddia edilmez. | 16 |
| 05.3 | Son Dokunuş Piksel Düzenleyicisi | `T07` | Üstte kaynak sürüm/aile, durum/yön/animasyon adı, mantıksal ve hücre ölçüsü, taslak durumu; solda araçlar, ortada tuval, sağda ayarlar, altta kare şeridi; 1×/tam sayı yakınlaştırma, piksel ızgarası, şeffaflık zemini, pivot ve zemin çizgisi katmanları, sürekli gerçek boyut önizlemesi; geri al/yinele, yerel taslak, “Bitir ve yeni Aday Sürüm oluştur”; piksel düzenlemesi için klavyeyle eşdeğer görevler. Görünümler: Piksel ve palet araçları · Görsel sayfasını dilimleme · Kare ve animasyon düzenleme · Fark ve seçici düzeltme. | 29 |
| 05.4 | Sahne Kalite Kontrol Alanı | `T06` | Karo, arka plan, karakter, obje, gölge ve efekt için kesin sürüm seçilen sahne; hareket, bekleme/yürüme/saldırı geçişleri, olay anı, katman/Y sırası, kamera; metadata katmanları; sonucu 05.2.1.2 kanıtına bağlama. Karo boyama ve sahne düzenlemesi için klavyeyle eşdeğer görevler veya erişilebilir özellik paneli. | 28 |
| 05.5 | Yeniden doğrulama | `T02` | Değişen kural veya Ana Tasarım; doğrudan/dolaylı etkilenen varlıklar ve nedenleri; 05.5.2 kapsam; yeniden incelemeye veya düzeltmeye açma; Yeniden Doğrulama Gerekli rozeti. | 18 |
| 05.5.1 | Tarihsel bileşim | `T04` | Geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılık ve kalite kanıtı seçimi; uyumluluk raporu ve çözülemeyen engeller; güncel yeniden doğrulama ihtiyacını kaldırmaz. | 18 |
| 05.5.2 | Değişiklik kapsamı | `T04` | Değişen Bağlam Sürümleri veya eski/yeni Ana Tasarım; etkilenen kimlik, siluet, ekipman, palet, Tema, perspektif, zamanlama seçimi; Değişiklik Tanımını kaydetme. | 18 |

**05.2.1 tür görünümleri**

- **Karakter ve animasyon:** Ana Tasarım ve yön önizlemeleri, zaman çizgisi; eşzamanlı oynatma, 1×, soluk kareler, değişken süre, genel oynatma hızı, kareye hareket evresi işaretleme; döngü, pivot, zemin, bağlantı noktası ve olay zamanları.
- **Obje ve ekipman:** En az iki Varlık Kaydı seçerek durum ve yön önizlemeleri, durum geçişlerini oynatma; bağlantı noktası, ölçek, pivot, zemin, sıralama; perspektif, malzeme dili ve durum/yön ayrışması gözlemleri.
- **Nesne yerleşim sahnesi:** Nesne onaylı karakterin yanında, proje ızgarasında ve farklı zeminlerde; ölçek, pivot, zemin, sıralama.
- **İkon:** Kaynak, mantıksal ve gerçek kullanım ölçüleri, aile üyeleri yan yana; açık/koyu zemin, gri tonlama; siluet, iç boşluk, ışık, kontur, ayrıntı yoğunluğu, arka plan/çerçeve yaklaşımı, durum/nadirlik renkleri; kullanım çeşidini kaydetme ve İkon Ailesi İnceleme Arşivini (JSON) indirme.
- **Efekt:** Tek başına ve sahibiyle önizleme, hücre sınırı, zaman çizgisi; zemin, şeffaflık, süre/döngü, başlangıç noktası, katman; taşma ve oyun olayıyla eşzamanlama.
- **Karo ve doku:** Atlas bölgeleri, arazi kimlikleri ve kenar bağlayıcılarını tanımlama; karo atlası ve boyanabilir haritada iç/dış köşe, kenar, koridor, dolgu, keskin geçiş ve rastgele yerleşim; karo boyama için klavye eşdeğeri; dokuda 2×2, 3×3 ve kaydırmalı tekrar; kenar eşleşmesi ile görünür tekrar izi ayrı; pakete taşınan doku tekrar ayarı.
- **Arka plan:** Katmanlar, hedef oran, kırpma, oyuncu güvenli alanı; katman sırası, göreli hız, kaydırma; döngü birleşimi, kontrast ve oyuncu görünürlüğü hareket hâlinde.
- **Oyun arayüzü varlıkları:** Ekran, panel ve bileşenlerin normal/üzerine gelme/basılı/devre dışı/seçili/açık-kapalı durumları; paneli germe, dokuz parça payları, metin güvenli alanı; ekran yerleşiminde sınama.
- **Portre, logo ve tanıtım:** Portrede ifade, Ana Tasarım bağı, diyalog/arayüz kırpması; logo/tanıtımda hedef ölçü, güvenli alan, açık/koyu zemin, şeffaf/opak kullanım; küçük boyut okunurluğu.

**05.3 görünümleri**

- **Piksel ve palet araçları:** 1 piksel ve küçük tam sayı boyutlarında kalem ve silgi, renk seçici, çizgi, kesin doldurma; seçim, kes/kopyala/yapıştır, taşıma, çevirme, 90° döndürme; kırpma, tuval ölçüsü, tam sayı ölçekleme; palet kilidi, yabancı renkler, toplu değişimde etkilenecek piksel sayısı.
- **Görsel sayfasını dilimleme:** Hücre ölçüsü, satır/sütun, ofset, boşluk, okuma sırası; numaralı hücre sınırları ve oynatılabilir önizleme; kareleri yeniden birleştirme ve boşluk değiştirme; kaynak görsel korunur.
- **Kare ve animasyon düzenleme:** Kare şeridinde ekleme, çoğaltma, silme, dosyayla değiştirme, sıralama; kare süresi, X/Y ofseti, pivot; koru, değiştirilmiş ve sorunlu işaretleri; oynat/durdur, döngü, saydamlığı ayarlanabilir soluk kareler, zemin hizası.
- **Fark ve seçici düzeltme:** Orijinal/taslak farkı yan yana, üst üste veya geçişle; değişen piksel/kare listesi, sayısı ve sınır kutusu; görsele yazılmayan ok, bölge ve notlar; birimleri ve komşu kareleri 04.1 paketine aktarma.

## 06 · Teslimat

Paper sayfası: `06 · Delivery`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 06.1 | Hedef ve Hazırlık Planı | `T02` | Teslimat Hedefleri, etkin sürüm, amaç, kapsam ve Hazır/Engelli durumu; hedef oluşturma/seçme; 06.1.1 ve 06.1.2 geçişleri; Hazır/Engelli ve Teslim Edildi rozetleri. | 35 |
| 06.1.1 | Teslimat Hedefi tanımı | `T04 + T05` | Amaç, gerekli aileler/liste sürümleri, Bağlam Sürümü, kullanım testleri ve kabul koşulları; Üretim/Hak Kanıtı Politikaları ve çalışma zamanı ortamları; taban değişikliği farkları, yeni hedef sürümü ve geçmiş sürümler. Ajan veya kurallı sistemin hazırladığı hedef taslağı, etkinleşene kadar Hazırlık Planını değiştirmez; Üretim Kanıtı Politikası seçenekleri (tam paket geçmişi / Geçmiş Varlık Beyanı kabul / yalnız uyarı), Hak Kanıtı Politikasının kabul ettiği kayıt durumları ve çalışma zamanı kanıtının güncellik koşulları. | 35 |
| 06.1.2 | Hazırlık Planı | `T02` | Engeller, eksik kanıtlar ve açılacak işler; zorunluluk, kullanıcı önceliği ve yeniden doğrulama etkisi ayrı gerekçe; iş sırasını değiştirme; engelden düzeltme ekranına geçiş (03, 05, 03.2.4). | 36 |
| 06.2 | Profil ve paket | `T03` | 06.2.2'de seçilen profil sürümü, kesin varlık/birim/bileşim girdileri ve içerik özeti; bağlam, liste, kanıt ve istisna seçimlerini inceleme, engelleri çözme, paket oluşturma, sonucu 06.2.3'te açma. Paketin hangi Teslimat Hedefi sürümünü gerçekleştirdiğini belirtme. | 37 |
| 06.2.1 | Paket doğrulama | `T08` | Paket seçimi; Paket Doğrulama Kitinin şeması, dosya özetleri, README ve sürümü; ağsız doğrulama; eksik/uyuşmayan dosya, yinelenen yol, bozuk kayıt bağlantısı sonuçları. | 37 |
| 06.2.2 | Dışa Aktarım Profili | `T04` | Profil sürümleri; yerleşim, padding, trim, ölçek, biçim ve adlandırma; metadata eşlemelerinde alan kimliği, birim, koordinat sistemi, bilinmeyen alan davranışı; yeni sürüm kaydetme ve seçme. | 37 |
| 06.2.3 | Paket ayrıntısı ve geçmişi | `T02` | Değişmez paket listesi; manifest, dosya yolları/özetleri, sabitlenmiş sürümler, kanıtlar, istisnalar; paketi ve Doğrulama Kitini indirme; 06.2.1, 06.3, 06.4, 06.5 geçişleri. Son dışa aktarım işaretini görme ve değiştirme (her zaman belirli bir değişmez paketi gösterir). | 37 |
| 06.3 | Godot çıktısı | `T03 + T08` | Kaynak paket, desteklenen Godot ve bağdaştırıcı sürümü, üretilecek dosyalar; çıktıyı oluşturma/indirme; kare, pivot, zamanlama, olay, karo/arayüz eşlemelerini inceleme; 06.4'e geçiş. | 38 |
| 06.4 | Oyunda doğrulama | `T03 + T04` | Kesin paket, oyun yapısı, motor/bağdaştırıcı sürümü ve doğrulama geçmişi; görüntü, video, test sonucu veya gözlem ekleme, elle/izinli araç kaynağını ayırma; Geçti/Başarısız/Sonuçsuz, başarısızlık kaynağı ve kapsamı. Başarısızlık önce Kaynak Belirsiz'dir ve hedefi engeller; sistemin önerdiği kaynak ve bağdaştırıcı taslağı kullanıcı kararından ayrı; kullanıcı Varlık İçeriği, Motor Bağdaştırıcısı, Oyun Yapılandırması veya Birden Fazla Kaynak sınıfını kesinleştirir. | 39 |
| 06.5 | Güvenli yenileme | `T05` | Konum, paket ve Teslimat Yenileme Kilidi; değişmemiş/güncellenecek/bayat/eksik/ayrışmış yollar; koru, başka konum veya açık değiştir kararı; webde değişiklik paketi, kilit ve ayrışma raporunu indirme, masaüstünde izinli klasöre uygulama. | 40 |
| 06.5.1 | İlk teslimat ve konum seçimi | `T08` | Kesin paket ve konum; masaüstünde klasör seçimi/izin, webde indirme ve elle uygulama; ilk uygulamayı başlatma; yazılan yollar, oluşan kilit, kısmi başarısızlık. | 40 |
| 06.6 | Teslimatı kesinleştirme | `T05` | Hazır hedefin gereksinimleri ve karşılayan kesin paket/sürümler, kullanım ve çalışma zamanı kanıtları; eksik/örtüşen eşlemeleri çözme; Teslimat Gerçekleşmesini kesinleştirme. Sistemin hazırladığı eşleme taslağı, eksik ve çakışan kapsam vurgulu; gerçekleşmeyi yalnız kullanıcı oluşturur. | 41 |
| 06.6.1 | Teslimat geçmişi | `T02 + T05` | Teslimat Gerçekleşmesi listesi; kayıt ayrıntısı veya iki kaydı karşılaştırma; varlık, bağlam, kalite, istisna, hak, çalışma zamanı kanıtı ve paket eşlemelerinde ayrı fark grupları. Paketi silinmiş gerçekleşme içeriksiz tarihsel kayıt olarak görünür: artık doğrulanamaz, Hazır/Teslim Edildi tarihseldir. | 42 |
| 06.6.2 | Tarihsel Risk Bildirimleri | `T02` | Etkilenen geçmiş teslimatlar, riskli kaynak, yeni Hak Kaydı sürümü, politika uyuşmazlığı ve saptama zamanı; hak kaydını veya teslimatı açma; geçmiş Teslim Edildi sonucu korunur. Etkilenen kullanım. | 43 |

## 07 · Ortak işlemler

Paper sayfası: `07 · Shared Operations`

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 07.1 | Çevrimdışı çalışma ve çakışma | `T02` | Cihazdaki yerel taslaklar, bağlı proje/kaynak sürüm ve kayıt durumları; taslağa devam etme; bağlantı dönünce tabanı kontrol, bulut ilerlemişse 07.1.1; çevrimdışı taslak bulut kararı sayılmaz. | 32 |
| 07.1.1 | Çakışma çözümü | `T05` | Taban, güncel bulut ve yerel taslak üçlü karşılaştırması; yeni Aday Sürüm, bulutu koruyup taslağı saklama veya 08.3 › Taslağı bırakma; kesin kararlar güncel bulut tabanında yeniden verilir. | 32 |
| 07.2 | İşlem durumu ve kurtarma | `T02 + T08` | Arşiv, geri yükleme, paket, doğrulama ve silme için ortak işlem listesi: kimlik, tür, kapsam, durum, ilerleme, denemeler, kesin sonuç; iptal isteği ile kesin iptal ayrı; ham hata ve sırlar gösterilmez. Görünümler: Çalışıyor · Başarısız · Teknik bilgi. Teknik bilgide tetikleyici ve durum geçişi geçmişi. | 34 |
| 07.3 | Kalıcı silme | `T08` | Varlık ve arşiv için aynı akış; silinecek kayıtlar, Yönetilen Kopyalar, paket/arşivler ve etkilenen teslimat sayıları; kapsam dışı kopyalar, geri alınamazlık, yedek takvimi, içeriksiz Silme Kaydı seçimi; 08.3 › Kalıcı silme onayı. Silinecek içeriği gömen paket/arşivi bütünüyle kapsama ekleme veya iptal; yalnız seçili kopyalar silinirse bunun kapsamlı temizleme olmadığı açıkça belirtilir. | 45 |
| 07.3.1 | Silme sonucu ve makbuz | `T08` | 07.2 görünümüyle silme ilerlemesi; depo temizliği ve yedek takvimi; içeriksiz Silme Makbuzu, kapsam dışı kopyalar ve varsa Silme Kaydı. | 45 |

## 08 · Ortak sayfalar ve ekran durumları

Paper sayfası: `08 · Shared Pages & States`. 08.1 bütün içerik alanını kaplar, 08.2 durumları ekranın yuvasını doldurur, 08.3 ekranın üzerinde açılır.

| Kimlik | Ekran | Düzen | İçerik | İş akışı |
| --- | --- | --- | --- | --- |
| 08.1 | Durum sayfası | `T00 (durum dolgusu)` | İçerik alanını kaplayan başlık, açıklama ve güvenli çıkış. Erişim reddinde korunan bilgi gösterilmez; oturum bitince yerel taslak durumu görünür kalır; sunucu hatasında Destek Referansı. Görünümler: Sayfa bulunamadı (404) · Erişim reddedildi · Oturum sona erdi · Sayfa yüklenemedi. | 01 |
| 08.2.1 | Yükleniyor | `Yuva dolgusu` | Liste, ayrıntı veya önizleme yuvasında yükleme göstergesi ve yer tutucular; yüklenen bölüm kullanılabilir içerikten ayırt edilir. | 47 |
| 08.2.2 | Boş içerik | `Yuva dolgusu` | Kayıt olmadığını açıklayan mesaj ve sonraki adım; arama sonucunda mevcut arama/filtreler görünür, değiştirme veya temizleme kontrolü. Görünümler: Henüz içerik yok · Arama sonucu yok. | 47 |
| 08.2.3 | İçerik gösterilemedi | `Yuva dolgusu` | Yuvada açıklama ve güvenli sonraki adım; yetkisiz kişiye kayıt bilgisi verilmez; diğer bölümler kullanılabilir kalır; sunucu hatasında Destek Referansı. Görünümler: Kayıt bulunamadı · Önizleme yüklenemedi · Veri yüklenemedi. | 47 |
| 08.2.4 | Bağlantı kesildi | `Yuva dolgusu` | Kesinti bildirimi, yerel taslak durumu ve kullanılabilir çevrimdışı işlemler; 07.1 geçişi; bulutta kesinleşmeyen sonuç açıkça belirtilir. | 32 |
| 08.2.5 | Form doğrulama hatası | `Yuva dolgusu` | Sorunlu alanın yanında düzeltme açıklaması; girilen değerler korunur ve yeniden gönderilebilir. | 47 |
| 08.2.6 | İşlem engellendi | `Yuva dolgusu` | Engelleyen koşul ve düzeltme yolu; eksik kanıt, kalite engeli ve bilinmeyen sözleşme sürümü ayrı; platform/biçim veya kapasite sınırında 00.4'e geçiş. | 47, 48 |
| 08.2.7 | Kayıt ve işlem bildirimi | `Yuva dolgusu` (T00 `NoticeRegion`) | Tek bildirim yeri, kayıt veya işlemin adıyla. Kesin sonuç gelmeden başarı gösterilmez; Sonuç belirsiz'de başarı/başarısızlık ilan edilmez ve aynı yazma yeniden gönderilmez; İşlem ilerlemesi seçilince 07.2 açılır. Görünümler: Kaydediliyor · Yerel taslak kaydedildi · Bulut kaydı tamamlandı · Kaydedilemedi · Sonuç belirsiz · İşlem ilerlemesi. | 32, 33, 34 |
| 08.2.8 | Durum rozetleri | `Yuva dolgusu` | Her rozet ikon, etiket ve renkle; durumlar birbirinden ayrı (Hazır ≠ Teslim Edildi, Yeniden Doğrulama Gerekli ≠ geçmiş onay). Değerler sözlükten: İnceleme Kararı Aday/Onaylı/Reddedildi; Kalite Kontrol Durumu Değerlendirilmedi/Engel Var/İstisnalarla Hazır/Dışa Aktarıma Hazır; Kayıt Durumu Etkin/Arşivlenmiş/Silinmiş; Teslimat Hedefi Hazır/Engelli. Görünümler: İnceleme Kararı · Bağlama Uygunluk · Kalite Kontrol · Kayıt Durumu · Yeniden Doğrulama Gerekli · Hazır/Engelli · Teslim Edildi. | 17, 36 |
| 08.3 | Onay penceresi | `T10` | İşlemin kapsamı ve sonucu, açık kesinleştirme ve vazgeçme; kalıcı silmede döküm değişirse yeniden onay; hedef proje seçicide kopyanın alıcı projede nasıl ele alındığı. Görünümler: Kullanıcı kararını onaylama · Taslağı bırakma · Kalıcı silme onayı · Hedef proje seçici. | — |
