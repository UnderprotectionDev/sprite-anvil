# Projeyi Taşınabilir Arşivle Koruma

Kullanıcı proje bağlamını, varlık ve kanıt ilişkilerini, paket geçmişini ve seçili çalışma dosyalarını sırlar olmadan arşivleyip bağımsız projeye geri yükler.

Taşınabilir arşiv teslimat paketinden daha geniş proje, ilişki ve kanıt geçmişini korur. Geri yükleme varsayılan olarak bağımsız yeni proje oluşturur.

## Alt Fazlar

### Proje Arşivi Oluşturma

Sürümlü arşiv gerekli kayıtları, ilişkileri ve dahil edilmeyen ikili kanıtların kimlik/özet bilgisini taşır; sırları dışlar.

Arşiv bağlam sürümlerini, varlık ilişkilerini ve dosyalarını, referans rollerini, inceleme ve kalite geçmişini, metadata önerileri ile kullanıcı kararlarını, üretim kanıtı ve deneylerini, tarifleri, hak kayıtlarını, dışa aktarım profili ve yenileme kilitlerini, hedef ve gerçekleşme geçmişini, tarihsel risk bildirimlerini, teslimat farklarını, çalışma zamanı doğrulamalarını ve paket manifestlerini taşır. Sırlar dışlanır; içerilmeyen büyük ikili kanıtın kimliği, özeti ve eksikliği manifestte belirtilir.

### Bağımsız Projeye Geri Yükleme

Arşiv ilişki ve dosya bütünlüğünü koruyarak yeni bulut kimliklerine eşlenir; mevcut projenin üzerine yazılmaz veya otomatik birleşmez.

Geri yükleme dosya özetlerini ve iç ilişkileri doğrular, ardından yeni bulut kimlikleriyle bağımsız proje kurar. Geçersiz arşiv kısmi proje bırakmaz; mevcut proje üzerine yazma veya otomatik birleştirme yapılmaz.

## Tamamlanma Ölçütleri

- Arşiv içeriği ile dışarıda bırakılan büyük ikili kanıt ayrışır; yeni projede ilişki ve dosya özetleri tutarlı olarak geri kurulur.

## Kapsam Sınırları

- Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.
