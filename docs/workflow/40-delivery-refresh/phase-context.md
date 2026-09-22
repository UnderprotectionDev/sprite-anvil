# Ayrışma Güvenli Tekrar Teslim

Kullanıcı aynı hedefe yeni paketi tek yönlü uygular; Workbench'in önceki teslimde sahiplendiği bir dosya hedefte değişmişse karar verilmeden üzerine yazılmaz.

Tekrar teslim yalnız seçili değişmez paketten hedefe doğru kullanıcı tarafından başlatılır. Önceki yazımın kilidi hangi dosyanın Workbench sahipliğinde olduğunu gösterir.

## Alt Fazlar

### İlk Paketi Hedefe Uygulama ve Kilitleme

Kullanıcının seçtiği kesin paket hedefe uygulanır; yazılan yollar ve içerik özetleri yalnız sahip olunan hedef kapsamı için kaydedilir.

Başarılı ilk uygulama, Sprite Anvil tarafından yazılan göreli yolları ve özetleri kesin paket ile profil sürümüne bağlayan Teslimat Yenileme Kilidi üretir. Kısmi uygulama başarılı sayılmaz. Kilit mutlak yerel yol veya erişim sırrı taşımaz; tanınmayan hedef dosyalarını sahiplenmez.

### Ayrışmayı Çözerek Yenileme

Değişmemiş, güncellenecek, bayat, eksik ve ayrışmış yollar ayrı gösterilir; kullanıcı kararından sonra izinli yollar yeni paketle yenilenir.

Yenilemeden önce yalnız sahip olunan yollar eski kilitle karşılaştırılır. Ayrışmış yol için kullanıcı koruma, başka konum seçme veya farkı gördükten sonra açık değiştirme kararı vermeden etkilenen dosya yazılmaz. Uygulanan yollar ve durdurulan ayrışmalar ayrı raporlanır; kısmi uygulama tamamlanmış teslimat gibi gösterilmez.

Kilit kendi tam sözleşme sürümünü taşır; bilinmeyen ana sürüm veya zorunlu alan uygulamayı durdurur. Web indirilebilir değişiklik paketi, kilit ve ayrışma raporu verir; masaüstü yalnız kullanıcının izin verdiği klasöre uygular. İki yüzey aynı yol sınıflarını kullanır.

## Tamamlanma Ölçütleri

- İlk uygulama kesin paketle bağlı kilit üretir; tekrar teslimde hedefte değişen sahipli dosya karar bekler, tanınmayan dosya korunur ve izinli yenileme sonucu web ile masaüstünde aynı anlamı taşır.

## Kapsam Sınırları

- Sürekli çift yönlü motor eşitlemesi ve ayrı Tüketim Makbuzu oluşturulmaz.
