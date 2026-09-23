# Bağımlılık Etkisini ve Bileşim Seçimini Yönetme

Kullanıcı bağlam veya Ana Tasarım değişikliğinin etkilediği sürümleri görür; güncel Türetilmiş Varlıkları yeniden inceler veya kesin geçmiş bileşimi açıkça seçer.

Bağımlılık bağlantıları değişiklik türüyle eşleşir; geçmiş onay ve bileşimler değişmez.

## Alt Fazlar

### Değişiklik Etkisini Belirleme

Doğrudan ve dolaylı Türetilmiş Varlıklar ile eksik tanımlanmış bağlantılar Yeniden Doğrulama Gerekli olarak görünür.

Yalnız değişiklik tanımıyla eşleşen açık bağımlılıklar etkilenir; eksik bağımlılık güvenli tarafta işaretlenir. Bu durum Kalite Kontrol Durumundan ayrıdır.

### Güncel Türetilmiş Varlığı Yeniden İnceleme

Kullanıcı etkilenen sürümü seçili güncel bağlam ve Ana Tasarım için yeniden inceler.

Olumlu sonuç yeni İnceleme Kaydı üretir; içerik düzeltmesi gerekiyorsa yeni Birim veya Birleşik Sürüm hazırlanır. Geçmiş onay kaydı yerinde değiştirilmez.

### Tarihsel Bileşimi Sabitleme

Kullanıcı geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtlarını tek kesin bileşim için seçer.

Uyumluluk raporu tarihsel seçimi ve çözülememiş engelleri gösterir. Bu yol güncel Yeniden Doğrulama Gerekli durumunu temizlemez; bütünlük hatasını veya eksik zorunlu kanıtı aşmaz.

## Tamamlanma Ölçütleri

- Etkilenen Türetilmiş Varlıklar güncel kullanım için yeni kanıt ister, etkilenmeyenler korunur; tarihsel bileşim yalnız bütün bağımlılıkları ve kalite kanıtı sabitlenince paketlenir.

## Kapsam Sınırları

- Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.
