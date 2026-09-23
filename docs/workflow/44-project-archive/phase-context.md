# Projeyi Taşınabilir Arşivle Koruma

Kullanıcı proje bağlamını, varlık ve kanıt ilişkilerini, paket geçmişini ve seçili çalışma dosyalarını sırlar olmadan arşivleyip bağımsız projeye geri yükler.

Taşınabilir arşiv teslimat paketinden daha geniş proje, ilişki ve kanıt geçmişini korur. Geri yükleme varsayılan olarak bağımsız yeni proje oluşturur.

## Alt Fazlar

### Temel Proje Kayıtlarını Arşive Aktarma

Sürümlü arşiv Bağlam Sürümlerini, varlık ilişkilerini ve dosyalarını, referans rollerini ve seçilmiş çalışma dosyalarını taşır. Dışarıda bırakılan büyük ikili kanıtın kimliği, özeti ve eksikliği görünür; sırlar arşive girmez.

### Üretim ve Değerlendirme Geçmişini Arşive Ekleme

Arşiv inceleme ve kalite geçmişini, metadata önerileri ile kullanıcı kararlarını, üretim kanıtı ve deneylerini, tarifleri ve hak kayıtlarını taşır. Mevcut geçmiş kayıtları değiştirilmez.

### Teslimat ve Doğrulama Geçmişini Arşive Ekleme

Arşiv dışa aktarım profilleri ve yenileme kilitlerini, teslimat hedefi ve gerçekleşme geçmişini, tarihsel risk bildirimlerini, teslimat farklarını, çalışma zamanı doğrulamalarını ve paket manifestlerini taşır.

### Bağımsız Projeye Geri Yükleme

Arşiv ilişki ve dosya bütünlüğünü koruyarak yeni bulut kimliklerine eşlenir; mevcut projenin üzerine yazılmaz veya otomatik birleşmez.

Geri yükleme dosya özetlerini ve iç ilişkileri doğrular, ardından yeni bulut kimlikleriyle bağımsız proje kurar. Geçersiz arşiv kısmi proje bırakmaz; mevcut proje üzerine yazma veya otomatik birleştirme yapılmaz.

## Tamamlanma Ölçütleri

- Arşiv içeriği ile dışarıda bırakılan büyük ikili kanıt ayrışır; yeni projede ilişki ve dosya özetleri tutarlı olarak geri kurulur.
- Etkileşimli istekte güvenle tamamlanamayan arşivleme veya geri yükleme OPS-01 yetkili işlem yaşam döngüsünü kullanır. OV-09 boyut sınırı ve OV-10 performans/bellek kanıtı kapanmadan arşiv kabulü tamamlanmış sayılmaz.

## Kapsam Sınırları

- Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.
