> [PRD içindekiler](README.md)

## 7. Başarı ölçümü

Başarı yalnızca yüklenen görsel sayısıyla ölçülmez. Ölçüler üç sınıfta yorumlanır; sınıflandırma hiçbir ölçüyü kapsam dışına çıkarmaz.

### Birincil ürün sonucu

- Dışa aktarıma hazır bir Varlık Ailesine ulaşma süresi ve başarı oranı.

### Destekleyici sonuçlar

- Kullanılabilir ilk varlık önizlemesine ulaşma süresi.
- Her üretimde yeniden girilen bağlam miktarı.
- Sorunlu tek birimi düzeltme süresi.
- Oyun motoruna aktardıktan sonra gereken elle düzeltmeler.
- Teslimat Hedefinin etkinleştirilmesinden Hazır ve Teslim Edildi durumlarına ulaşma süresi.
- Mevcut proje içe aktarımında ilk kullanıcı-onaylı eşlemeye ulaşma süresi, elle yeniden girilen metadata alanı ve düzeltilen öneri sayısı.
- Üretim Deneylerinde seçim yapılma, sonuçsuz kalma ve Üretim Tarifinin yeniden kullanılma oranı.
- Temiz bir ortamda ilk başarılı çevrimdışı paket doğrulamasına ulaşma süresi.

### Koruma ölçüleri

- Kabul edilmiş işin yanlışlıkla kaybolması veya üzerine yazılması.
- Yanlış referans özelliğinin aktarılması; karakter kimliği, Tema veya perspektif kayması.
- Yanlış ya da rahatsız edici kalite uyarıları ve kullanım testine kaçan gerçek sorunlar.
- Teslimat öncesinde yakalanan hedef ayrışması ve yanlış dışa aktarım ayarı; kullanıcı kararı olmadan ezilen ayrışma sayısı sıfır olmalıdır.
- Tam Üretim Paketi geçmişi, Geçmiş Varlık Beyanı ve eksik üretim kanıtı bulunan teslim edilen öğelerin dağılımı.
- Bilinmiyor veya Kısıtlı Hak Kaydı, metadata roundtrip, zemin çizgisi, loop ve mount/collision bağlantı hatalarının teslimat ya da çalışma zamanı doğrulamasından önce yakalanma oranı.
- Çalışma zamanı doğrulamasında bulunan başarısızlıkların kaynak sınıfı ve çözülme süresi.

Gerçek kullanım ölçümleri olmadan yüzdesel hedef belirlenmez. Önce başlangıç ölçümleri toplanır; ardından ölçüm yöntemiyle birlikte iyileştirme hedefleri belirlenir. İşlevsel kabul keyfî bir yüzdelik hedef bulunmadığı için engellenmez; ancak “ürün başarısı doğrulandı” iddiası başlangıç ölçümü ve kararlaştırılmış hedeflere karşı sonuç olmadan yapılamaz. Bu hedefler kalite kapılarından ayrı ürün başarısı ölçüleridir.

Başlangıç ölçümü toplanmadan önce her metrik için sürümlü bir **Ölçüm Tanımı** etkinleştirilir. Tanım; metrik kimliğini, dahil edilen kullanıcı ve proje kapsamını, başlangıç ve bitiş olaylarını, pay ve paydayı, hariç tutma kurallarını, zaman penceresini, istemci saatinden bağımsız sunucu zamanını, veri saklama süresini ve sonucu değiştirecek ürün kararını belirtir. Tanımsız veya tanım sürümü değişmiş ölçümler aynı baseline içinde birleştirilemez.

Tam Ürün Kapsamının ölçüm olayları aşağıdaki ortak zarfı kullanır: olay kimliği ve sürümü, takma adlı kullanıcı ve proje kimliği, iş akışı ve ilgili kayıt türü kimliği, web/masaüstü yüzeyi, sunucu zamanı, sonuç sınıfı ve yalnız ilgili sayısal sayaçlar. Görsel pikseli, dosya içeriği, ham üretim talimatı, serbest metin notu, dosya yolu, kullanıcı tarafından verilen varlık adı, erişim sırrı veya harici sağlayıcı kimlik bilgisi ölçüm olayına yazılmaz.

Metrikler şu olay ailelerinden hesaplanır:

| Olay ailesi | Başlangıç ve bitiş sınırı | Ürettiği ölçüm grubu |
| --- | --- | --- |
| `production_workflow` | Üretim Paketi hazırlığının başlaması → ilk kullanılabilir Aday Sürüm önizlemesi veya açık bırakma | Kullanılabilir önizlemeye ulaşma süresi, yeniden girilen yapılandırılmış bağlam alanı, üretim deneyi sonucu |
| `review_and_repair` | İlk profil engeli/uyarısı veya kullanıcı işareti → ilgili yeni Birim/Birleşik Sürümün inceleme kararı | Sorunlu birimi düzeltme süresi, yakalanan kimlik/Tema/perspektif/metadata sınıfı, yanlış uyarı ve kullanıcı tarafından geçersiz sayılan uyarı |
| `import_mapping` | İçe aktarma grubunun kabul edilmesi → ilk kullanıcı kesinleştirmeli eşleme | İlk eşlemeye ulaşma süresi, yeniden girilen alan ve düzeltilen öneri sayısı |
| `export_delivery` | Dışa aktarım veya etkin Teslimat Hedefi başlangıcı → paket doğrulaması, Hazır veya Teslim Edildi sonucu | Profil kurma süresi, ayrışma, yanlış ayar, hedef hazırlık süresi ve teslim başarısı |
| `runtime_validation` | Kesin paket için doğrulama kaydı hazırlığı → kullanıcı tarafından kesinleştirilen sonuç veya bırakma | Başarısızlık kaynak sınıfı, çözüm süresi ve oyun motorunda gereken elle düzeltme sayısı |
| `offline_verification` | Temiz ortamda paketin açılması → doğrulama sonucu | İlk başarılı çevrimdışı doğrulama süresi ve schema/checksum/eşleme hata sınıfı |

Süre ölçümleri yalnız aynı iş akışı kimliğinin açık başlangıç ve bitiş olayı varsa hesaplanır; yarım kalan akışlar başarı süresine katılmaz ve ayrı bırakma oranında gösterilir. Oranların paydası ve hariç tutmaları Ölçüm Tanımı'nda sabitlenir. Kullanıcının görsel tutarlılık veya yanlış uyarı gibi öznel değerlendirmesi açık bir inceleme eylemi olarak kaydedilir; sistem görüntü içeriğinden gizli bir başarı etiketi çıkarmaz. OV-12 bu sözleşmeye göre baseline ve hedef değerlerini kapatır; ölçüm olaylarının varlığı tek başına işlevsel kalite kapısını değiştirmez.


