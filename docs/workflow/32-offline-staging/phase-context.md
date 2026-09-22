# Çevrimdışı Hazırlık ve Çakışma Çözümü

Kullanıcı çevrimdışıyken önbelleğe alınmış projeyi görür, dosya ve kurtarılabilir taslak hazırlar; yeniden bağlantıda bulut kaydı sessizce ezilmez.

Bulut kayıtları yetkili kalırken bağlantısız hazırlık kurtarılabilir yerel taslak sağlar. Yeniden bağlantı güncel tabanla açık karşılaştırma yapar.

## Alt Fazlar

### Çevrimdışı Hazırlık Yapma

Görüntüleme, dosya içe aktarma ve Çalışma Taslağı bulut yetkisi kazanmadan kurtarılabilir biçimde saklanır.

Önbelleğe alınmış proje görüntülenir, dosya alınır ve Çalışma Taslağı yerel olarak kurtarılabilir biçimde tutulur. Bağlam etkinleştirme, inceleme kararı ve doğrulanmış paket eşitlenmeden yetkili bulut sonucu sayılmaz.

### Çakışma Kaydını Çözme

Taban, güncel bulut ve yerel taslak karşılaştırılır; kullanıcı yeni Aday Sürüm, taslağı koruma veya açık bırakma kararı verir.

Yeniden bağlanınca taban sürüm güncelse normal kesinleştirme yürür; bulut ilerlediyse üç sürümlü Çakışma Kaydı açılır. Kullanıcı yeni aday yaratır, taslağı korur veya açıkça bırakır; tekrar eden çözüm isteği ikinci kayıt yaratmaz.

Çakışma Kaydı kendi tam sözleşme sürümünü taşır. Bilinmeyen zorunlu alan veya ana sürüm çözümü durdurur; uyumlu isteğe bağlı alan ve taslak korunur. Kesin karar kayıtları alan bazında otomatik birleşmez.

## Tamamlanma Ölçütleri

- Bağlantı kesilip geri geldiğinde taslak kaybolmaz veya bulut sürümünü sessizce ezmez; kullanıcı seçimi yeni ve idempotent sonuç oluşturur.

## Kapsam Sınırları

- Tam çevrimdışı onay, bağlam etkinleştirme veya doğrulanmış dışa aktarım bu özelliğin kapsamı değildir.
