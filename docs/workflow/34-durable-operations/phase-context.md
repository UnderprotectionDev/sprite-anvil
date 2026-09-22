# Uzun İşlem Durumunu ve Kurtarmayı Yönetme

Arşivleme, geri yükleme, dışa aktarım, doğrulama ve silme gibi uzun işlemler kesinti veya yinelenen teslimde kaybolmadan, kullanıcının görebildiği yetkili durumla ilerler.

Etkileşimli istek içinde güvenle bitmeyen dışa aktarım, arşiv, geri yükleme, doğrulama ve silme işleri bu görünür işlem yaşam döngüsünü kullanır.

## Alt Fazlar

### Yetkili İşlem Yaşam Döngüsü

Bekleyen, çalışan, tamamlanan, başarısız ve iptal durumları taşıma altyapısından bağımsız kalıcı kayıtta izlenir.

Her uzun iş için yetkili kayıt tetikleyiciyi, durum geçişini, ilerlemeyi ve kesin sonucu gösterir. İstek yanıtı kesilse bile iş ve kullanıcının görebildiği durum taşıma mesajına indirgenmez.

Kullanıcı eylemine bir saniye içinde sonuç verilemiyorsa ilerleme durumu gösterilir. Güvenle durmayan işlem bağlantı kesilse de sürer; yeniden bağlanınca yetkili kayıttan görülebilir.

Yinelenen mesaj ikinci sonuç oluşturmaz. Yayımlanmamış outbox kaydı yeniden teslim edilir; uzlaştırma ilerlemeyen işi bulur. Deneme sınırı aşılırsa iş başarısız işler alanına alınır ve kullanıcı başarısız sonucu görür.

### Güvenli İptal

Kullanıcı geri döndürülemez sınırdan önce iptal isteyebilir; güvenle durmayan iş tamamlanıp sonucu dürüstçe bildirilir.

Kullanıcı geri döndürülemez sınırdan önce iptal ister ve kesin iptal sonucunu görür. İş güvenle durdurulamıyorsa sistem tamamlanan sonucu saklar; iptal isteğini başarılı iptal gibi göstermez.

## Tamamlanma Ölçütleri

- Kesinti ve yinelenen teslim altında her iş tek kesin sonuç üretir; kullanıcı ilerleme, hata, yeniden deneme ve güvenli iptal sonucunu görebilir.

## Kapsam Sınırları

- Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.
