# Üretim Deneylerini Sonuçlandırma

Kullanıcı aynı üretim amacına yönelik alternatif denemeleri kayıtlı girdileri ve sonuçlarıyla karşılaştırır; deneyi seçim, sonuçsuzluk veya bırakma kararıyla kapatır.

## Alt Fazlar

### Denemeleri Karşılaştırma ve Sonuçlandırma

Her denemenin değişmez Üretim Paketi ve Aday Sürümü korunur; bağlam, referans, talimat, ölçü ve varsa sağlayıcı parametresi farkları görünür olur.

Birden fazla girdi değiştiyse karşılaştırma nedenin ayrıştırılamadığını söyler. Sonucu ve varsa seçilen denemeyi kullanıcı kesinleştirir; seçim Aday Sürümü kendiliğinden onaylamaz ve diğer denemeleri silmez.

### Deney Öğrenimini Bağlam Önerisine Dönüştürme

Kullanıcı deney öğrenimini en dar anlamlı kapsamda incelenebilir Bağlam Önerisine aktarır.

Öneri kaynak deneyi, karşılaştırılan denemeleri, değişen girdileri, nedenin ayrıştırılıp ayrıştırılamadığını ve kullanıcı yorumunu saklar. Kapsamı genişletme kullanıcı kararıdır; öneri etkin kural olmaz ve bağlam etkinleştirme kapısını ayrıca geçer.

## Tamamlanma Ölçütleri

- Deney sonucu kesinleşir, deneme kanıtı korunur ve öğrenim yalnız kullanıcıya sunulan öneri olarak taşınır.

## Kapsam Sınırları

- Seçilen deneme otomatik onay veya etkin bağlam kuralı değildir; neden ayrıştırılamıyorsa kesin nedensellik iddiası üretilmez.
