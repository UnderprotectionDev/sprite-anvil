> [PRD içindekiler](README.md)

## 11. Zorunlu karar kapıları, özellik adayları ve araştırmalar

Bu bölüm, doğrudan zorunlu ürün davranışına dönüştürülmemiş fırsatların güncel karar kaydıdır. Her satırın araştırması veya karar kapısı sonuçlandırılır; ancak sonuç özellik geliştirmek zorunda değildir. F1–F3 özellik adayı, F4 dar değer araştırması, O5 değer koşuluna bağlı özellik kararı ve O4 tetikleyiciye bağlı araştırmadır. O1 Kaynak Metadata Eşleme Önerisi, O2 sürümlü ve ayrışma güvenli teslimat, O3 Paket Doğrulama Kiti ile E1 kabul sertleştirmesi Tam Ürün Kapsamına alınmış ve [Bölüm 2–10](README.md#içindekiler)’a işlenmiştir; bu bölümde yeniden adaylaştırılmaz.

| Kod | Fırsat | Statü | Tasarım önceliği |
| --- | --- | --- | --- |
| F1 | Oyun içi anlamların ayırt edilebilirliği | Özellik adayı | 1 |
| F2 | Dil ve bölgeye göre görsel seçimi | Özellik adayı | 2 |
| F3 | Aileler arası ekipman uyumluluğu | Özellik adayı; adaylık için önce deney şartı yok | 3 |
| F4 | Teslimatın doku kaynak bütçesi | Dar değer araştırması | Uygun gerçek teslimat örneğiyle ayrı değerlendirme |
| O5 | Animasyon ailesi normalizasyonu | Koşullu özellik kararı; OV-18 değer kanıtı gerekli | Araştırma zorunlu, özellik sonucu kanıta bağlı |
| O4 | Bağlantı kabiliyet yetkileri ve işlem önizlemesi | Tetikleyiciye bağlı araştırma | Ücret harcayan veya yazabilen resmî bağlantı seçilirse yeniden karar |

### 11.1 Oyun içi anlamların ayırt edilebilirliği

**Çözülen iş:** Aynı görsel dile uygun varlıkların oyuncuya farklı oyun anlamlarını doğru aktardığını değerlendirmek. Mevcut siluet, gri tonlama ve kontrast önizlemelerinin ötesindeki katkı, hangi anlamların hangi kullanım koşulunda birbirinden ayrılması gerektiğini ve inceleme sonucunu korumaktır.

**Anlamsal Ayrışma Gereksinimi** (Semantic Distinction Requirement), kullanıcının belirli oyun anlamlarının belirli kullanım koşullarında görsel olarak ayırt edilmesine ilişkin beklentisidir. Birden fazla Varlık Ailesini kapsayabilir. Beklenti bütün projeye kendiliğinden uygulanmaz; ortak beklentiler kullanım kapsamları korunarak yeniden kullanılabilir.

**Anlamsal Ayrışma İncelemesi** (Semantic Distinction Review), kesin Varlık Sürümlerinin bu beklentiye göre kullanıcı tarafından değerlendirilmesidir. Tekil sürümlerin İnceleme Kararı’ndan ve otomatik Kalite Uyarısı’ndan ayrıdır.

Kullanıcı incelemeyi bir Teslimat Hedefinin zorunlu kabul koşulu yapabilir. Eksik veya başarısız zorunlu inceleme hedefin Hazır olmasını engeller. Otomatik görsel şüphe tek başına engel oluşturmaz. Başarısız inceleme için ayrı bir kabul istisnası sunulmaz; kullanıcı görselleri düzeltip yeniden inceler veya hedefin/gereksinimin kapsamını yeni sürümle açıkça değiştirir. Mevcut Kalite İstisnası öznel inceleme sonucunu aşacak biçimde genişletilmez; geçmiş başarısızlık kanıtı değişmez.

**Sınır senaryosu:** Sağlık ve zehir iksirleri envanterde ayrışmalı, sisli bir sahnede ise bilerek belirsiz görünebilir. Envanter incelemesindeki başarısızlık, sisli sahnenin tasarımını veya önceki teslimatı kendiliğinden geçersiz kılmaz.

Bu aday Kalite Profili, Sahne Kalite Kontrol Alanı, Gerekli Öğeler Listesi ve Teslimat Hedefiyle ilişkilidir. Kullanım koşullarını ve karşılaştırılan sürümleri açık tutma yükü getirir; bütün oyunun erişilebilirliğini sertifikalandırmaz. Karar gerekçesi: [ADR-0018](../adr/0018-scope-semantic-distinction-by-use.md).

### 11.2 Dil ve bölgeye göre görsel seçimi

**Çözülen iş:** Tabela, logo veya üzerinde yazı bulunan görsel gibi bir kullanım için doğru dil/bölge karşılığını teslim etmek. Katkı yalnız görsel çeşitlerini saklamak değil, hangi kullanımda hangi karşılığın seçileceğini ve eksik kapsamı belirlemektir.

**Yerelleştirilmiş Görsel Eşlemesi** (Localized Visual Mapping), bir görsel kullanımını dil/bölge karşılıklarına ve o kullanım için açıkça kabul edilmiş geri dönüş görseline bağlar. Çeviri hizmeti, yazı düzenleme veya kapsamlı metin yerleşim sistemi içermez.

Gerekli dil karşılığı tanımlanmamışsa yalnız kullanıcının o kullanım için önceden seçtiği geri dönüş devreye girebilir. Geri dönüş seçilmemişse gerekli dil eksik kalır; projenin varsayılan diline örtük geçiş yapılmaz.

Asıl karşılık mevcut fakat reddedilmiş, yeniden doğrulama bekleyen veya hedef politikasına uygun olmayan durumdaysa geri dönüş otomatik seçilmez. Kullanıcı eşlemeyi açıkça değiştirmelidir. Geri dönüşün kendisi de ilgili onay, bağlama uygunluk, kalite ve hedef politikalarını karşılamalıdır. Yeni eşleme geçmiş Dışa Aktarım Paketlerinin sabitlediği seçimleri değiştirmez.

**Sınır senaryosu:** Arapça çıkış tabelası eksikken yazısız simge kabul edilmiş geri dönüş olabilir. Arapça tabela sonradan eklenip reddedilirse aynı simgeye geçiş açık eşleme değişikliği gerektirir. Arayüzdeki geri oku ile haritada doğuyu gösteren ok aynı aynalama kararıyla ele alınmaz.

Bu aday Varlık Kimliği, Görsel Dünya, türevler, Gerekli Öğeler Listesi, Teslimat Hedefi ve Oyun Motorundan Bağımsız Paketle ilişkilidir. Dil kapsamı ve motor eşlemelerini doğrulama yükü getirir; Unity’yi ilk zorunlu doğrulanmış motor yapmaz. Karar gerekçesi: [ADR-0019](../adr/0019-require-explicit-visual-locale-fallbacks.md).

### 11.3 Aileler arası ekipman uyumluluğu

**Çözülen iş:** Aynı ekipmanı farklı karakterlerde yeniden kullanırken hangi birleşimlerin gerçekten değerlendirildiğini korumak. Ayrı parça önizlemesi, ekipman ilişkisi veya dönüş noktası alanı tek başına bu adayın yeni katkısı değildir.

**Ekipman Uyumluluk Kapsamı** (Equipment Compatibility Scope), kullanıcının değerlendirmeyi seçtiği karakter, ekipman, yön ve hareket birleşimlerini belirtir. Bütün olası kombinasyonların sınanması gerekmez. Sınanmamış, açıkça kapsam dışı ve uyumsuz bulunmuş birleşimler ayrı anlam taşır. Zorunlu ve isteğe bağlı kapsam mevcut Gerekli Öğeler Listesi ve Teslimat Hedefi üzerinden belirlenir.

**Ekipman Uyumluluk Kanıtı** (Equipment Compatibility Evidence), bu kapsamdaki bir kullanım için kesin parça veya tam sonuç sürümlerinin incelenmesine ilişkin kanıttır. Parçaların ayrı ayrı onaylanması birleşimin onayı olmaz; bir yöndeki başarılı kullanım başka yön veya hareket için kendiliğinden kanıt oluşturmaz.

Hem bağımsız parçalar hem de ekipmanın görsele gömülü olduğu eski sonuçlar kapsanabilir. Gömülü ekipmanlı sonuç yalnız açıkça eşlendiği tam kullanım için kanıt taşır; bağımsız parça uyumluluğu kazanmaz. Ürün katman veya bilinmeyen üretim geçmişi çıkarmaz.

**Sınır senaryosu:** Kılıç şövalyenin güney saldırısında çalışırken cücenin kuzey saldırısında elin arkasında kaybolabilir. Bu sonuç diğer birleşimlerin incelemesini veya önceki paketi değiştirmez. Silahı karelere çizilmiş eski şövalye animasyonu, ayrı silah parçası üretilmeden tam kullanım olarak değerlendirilebilir.

Bu aday Varlık Aileleri, Birim ve Birleşik Sürümler, Bağımlılık Bağlantıları ve kullanım testleriyle ilişkilidir. Kapsam ve kanıt takibi yükü getirir; tam katman birleştirme, iskelet düzenleme veya otomatik ekipman üretimi aracı içermez. Karar gerekçesi: [ADR-0020](../adr/0020-bound-equipment-compatibility-to-declared-combinations.md).

### 11.4 Teslimatın doku kaynak bütçesi araştırması

F4, seçili oyun kullanımındaki görsellerin kaynak maliyetini üretim seçenekleriyle birlikte değerlendirmenin değerini araştırır. [Bölüm 6](08-platform-and-operations.md)’daki Workbench performans sınırları ve OV-09/OV-10 parametre kapanışlarından ayrıdır; oyunda kullanılacak görsellerin maliyetini ele alır.

Bir gerçek paket ve oyun yapısında, mevcut motor iş akışına kıyasla daha erken veya daha az elle işlemle üretim kararı vermeye yardımcı olduğu gösterilmelidir. Bellek veya paket boyutunun azalması zorunlu başarı ölçütü değildir; kullanıcı görsel kaliteyi koruyarak daha yüksek maliyeti bilinçli seçebilir. Motor raporunu aynı biçimde tekrar göstermek yeterli değer kanıtı sayılmaz.

Tahmini kaynak maliyeti ile belirli oyun yapısından ölçülmüş kullanım ayrı tutulur. PNG dosya boyutundan kesin GPU belleği veya kare süresi sonucu çıkarılmaz; birlikte yüklenen kapsam ve motor koşulları hesaba katılmalıdır. Gerçek paket deneyi henüz yapılmadığından F4 özellik taahhüdü değildir. Olumlu araştırma sonucu da kendiliğinden adaylık veya kapsam kararı oluşturmaz.

### 11.5 Animasyon ailesi normalizasyonu — koşullu özellik kararı

O5, aynı Varlık Ailesindeki seçilmiş animasyonlar için tuval, mantıksal ölçek, zemin çizgisi ve anchor değerlerini kullanıcı tarafından incelenen bir dönüşümle uyumlu hâle getirmeyi amaçlar. Dönüşüm kaynak kareleri değiştirmez; yeni Birim veya Birleşik Sürümler üretir. Bilinçli kök hareketi ve boyut değişimi korunmalıdır. Otomatik kırpma veya ölçekleme aile onayı ya da görsel niyet kanıtı sayılmaz.

O5’in özellik olarak uygulanması Tam Ürün Kapsamının doğrudan tamamlanma koşulu değildir; karar kapısının sonuçlandırılması zorunludur. Uygulama kararı için OV-18’deki animasyon-ağırlıklı referans proje, mevcut manuel iş akışına kıyasla düzeltme süresini veya geçiş sıçramalarını anlamlı biçimde azalttığını ve kabul edilemez görsel niyet kaybı üretmediğini göstermelidir. Olumlu sonuç bu sınırlarla uygulamayı açar; başarısız veya sonuçsuz kanıt “uygulanmayacak” kararıyla kapatılabilir ve Tam Ürün Kapsamındaki diğer gereksinimleri değiştirmez.

### 11.6 Bağlantı işlem korumaları — tetikleyiciye bağlı araştırma

O4; okuma, yazma, üretme ve harcama yetkilerini ayıran bağlantı kapsamlarını, sağlayıcı destekliyorsa işlem/maliyet önizlemesini, idempotency’yi ve bağlantı başına durdurma sınırlarını araştırır. Bu davranışlar insan onayı modelini genişletmez; bağlantının kullanıcı adına sanatsal karar vermesine izin vermez.

Üretim kredisi veya sağlayıcı maliyeti muhasebesi panosu kapsam dışındadır. O4 ancak ücret harcayabilen veya Sprite Anvil dışına yazabilen belirli bir resmî bağlantı seçildiğinde yeni bir kullanıcı kararı için açılır. Böyle bir bağlantı seçilmeden O4 uygulanamaz olarak kapanır; duyurulan güvenlik özelliği veya [Bölüm 10](12-completion-criteria.md) tamamlanma koşulu değildir.

Önceki rakip taraması, maliyet takibinin reddedildiğini bildirir; ancak dayandığı ayrıntılı 2026-09-21 görüşme kaydı depoda bulunmamaktadır. Bu eksik tarihsel kanıt yeniden oluşturulmuş sayılmaz. 2026-09-22 kararı, muhasebe panosu reddini korur ve işlem öncesi korumaları yalnız yukarıdaki tetikleyiciye bağlar.

### 11.7 Ortak sınırlar ve karar dayanağı

Üç özellik adayı, koşullu özellik kararı ve araştırmalar mevcut insan yetkisi ve kesin sürümlü kanıt modelini kullanır. Ajanlar öneri ve kanıt taslağı hazırlayabilir; kullanıcı kararlarını kesinleştiremez. İlgili içerik veya bağımlılık değişimlerinde mevcut yeniden doğrulama modeli uygulanır; geçmiş onay ve teslimatlar yeniden yazılmaz.

Web ve masaüstünde temel üretim sonucu eşdeğer olmalıdır; elle kanıt ekleme yolu korunur. Hiçbir aday Harici Görsel Analizi iznini, zorunlu üretim API’sini veya sürekli çift yönlü motor eşitlemesini önkoşul yapmaz. Motor bağımsız dışa aktarım ve taşınabilir arşiv ilkeleri geçerlidir.

Araştırma kabiliyet kanıtını, görüşme ise kapsam ve bağımlılık kararlarını sağlar; araştırma sonuçları tek başına kullanıcı değerini veya destek garantisini kanıtlamaz. Güncel rakip envanteri ve fırsat ayrımı [competitors.md](../competitors.md), ayrıntılı kaynak izi [2026-09-22 rekabet araştırması](../research/2026-09-22-competitive-capability-landscape.md), önceki kısa tarama ise [2026-09-22 doğrudan rakip taraması](../research/2026-09-22-direct-competitor-scan.md) içinde korunur. Teslimat sınırının karar gerekçesi [ADR-0021](../adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md) içindedir.

PRD’nin önceki sürümünde bağlanan `docs/research/2026-09-21-tool-capabilities.md` ve `docs/research/2026-09-21-product-opportunities.md` dosyaları 2026-09-22 tarihinde depoda bulunmamaktadır. Bunlar yeni araştırmayla geriye dönük tamamlanmış gösterilmez. ADR-0018–0020 ve bu bölümde kayıtlı mevcut statüler geçerliliğini korur; eksik atıflar yalnız karar kaynağı boşluğu olarak görünür tutulur.


