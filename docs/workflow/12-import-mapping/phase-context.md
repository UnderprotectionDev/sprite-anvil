# İçe Aktarma ve Kaynak Metadata Eşleme

Kullanıcı hedefli veya toplu görsel girdileri güvenle alır; desteklenen sidecar gerçeklerinden gelen önerileri alan bazında kesinleştirerek yetkili ilişkiye dönüştürür.

Hedefli üretim sonucu ile hedefsiz toplu dosya farklı yetki düzeyindedir. Sidecar bilgisi kaynak gerçeği sunar; varlık ailesi veya onay kararı vermez.

## Alt Fazlar

### İçe Aktarma Gelen Kutusuna Alma

Hedefi belirsiz dosyalar onaylanabilir varlık sayılmadan yönetilen kopya ve kaynak gerçekleriyle bekletilir.

Açık hedefe gelen dosya aday sürüm olabilir; hedefsiz toplu dosya yalnız yönetilen İçe Aktarma Gelen Kutusu Girdisidir. Kullanıcı ilişkiyi kesinleştirene kadar bu girdi onaylanamaz ve dışa aktarılamaz.

### Metadata Eşleme Önerisi Hazırlama

Desteklenen Aseprite ve TexturePacker JSON alanları, kaynak değerleri ve çakışmalarıyla izlenebilir bir öneriye dönüşür.

PNG veya düzenli görsel sayfasıyla gelen Aseprite ve TexturePacker JSON array/hash biçimleri dosya adına değil kök yapı ve zorunlu alanlara göre okunur. Kare kimliği ve dikdörtgeni zorunludur; süre, tag, slice, pivot, dokuz parça ve palet yalnız kaynakta varsa önerilir. Alanların kaynağı ile çakışması gösterilir; tanınmayan alan korunur, eksik geçmiş uydurulmaz.

### Alan Bazında Eşleme Kesinleştirme

Kullanıcı zorunlu çakışmaları çözer, isteğe bağlı bilinmeyenleri korur ve hedef kayıtta yeni Aday Sürüm oluşturur.

Zorunlu alan çakışmasını kullanıcı alan bazında çözer; isteğe bağlı alan Bilinmiyor kalabilir. Kesin ilişki kaynak değerini kullanıcı kararından ayırır; değişen sidecar eski ilişkiyi yazmaz, yeni öneri üretir.

Kaynak Metadata Eşleme sözleşmesinin tam sürümü öneriye yazılır. Bilinmeyen zorunlu alan veya ana sürüm kesinleştirmeyi durdurur; tanınmayan isteğe bağlı alan korunur. Sözleşme göçü eski öneriyi değiştirmeden yeni kayıt üretir.

## Tamamlanma Ölçütleri

- Desteklenen JSON biçimlerinden aynı alan önerisi iki uygulama yüzeyinde üretilebilir; kullanıcı kararından sonra kesin ve izlenebilir Aday Sürüm oluşur.

## Kapsam Sınırları

- Yerel .aseprite dosyasını kayıpsız ayrıştırma veya dosya adından üretim geçmişi çıkarma taahhüdü yoktur.
