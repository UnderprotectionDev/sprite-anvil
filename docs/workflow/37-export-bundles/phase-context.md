# Motor Bağımsız Dışa Aktarım Paketi Üretme

Kullanıcı kesin varlık, bağlam, kalite ve profil sürümlerini sabitleyen deterministik, motor bağımsız bir paket üretir; paket ağ olmadan doğrulanabilir.

Motor bağımsız paket teslimatın temel veri sözleşmesidir. Profil sürümü, seçimler ve tam kanıt geçmişi aynı paket kimliğinde sabitlenir.

## Alt Fazlar

### Dışa Aktarım Profilini Sürümleme

Yerleşim, padding, trim, ölçek, biçim ve metadata eşlemeleri deterministik profil sürümünde sabitlenir.

Profil yerleşim, padding, trim, ölçek, dosya biçimi, adlandırma ve metadata alanlarının birimlerini sabitler. Değişiklik yeni profil sürümü üretir; aynı girdiler, profil ve bağdaştırıcı sürümü aynı içerik özetlerini vermelidir.

Dışa Aktarım Profili tam sözleşme sürümünü taşır. Bilinmeyen ana sürüm veya zorunlu alan yeni paket oluşturmayı durdurur; isteğe bağlı alan korunur. Profil göçü eski profili yazmadan yeni sürüm oluşturur.

### Değişmez Paketi Oluşturma

Seçili dosyalar, oyun içi bilgiler, bağlam, sürümler ve kanıtlar tek değişmez Dışa Aktarım Paketinde korunur.

Kullanıcının başlattığı paket, özel profili olmayan Genel Varlık Desteği alan görselleri de türe özel engel uydurmadan kapsar; kesin bağlamı, Gerekli Öğeler Listesini, birim ve bileşim sürümlerini, üretim ve hak kanıtını, kalite kanıtını, istisnaları ve veri yapısı sürümünü manifestte sabitler. Son paket işareti değişebilir; tarihsel paket ve içeriği değişmez.

### Paketi Çevrimdışı Doğrulama

Eşleşen şema, checksum listesi, README ve çalıştırılamayan örnekler Workbench ve ayrı doğrulayıcıda aynı sonucu verir.

Doğrulama kiti aynı ana sürümde şema, deterministik dosya özetleri, README ve çalıştırılamayan örnek eşlemeler taşır. Workbench ile ayrı sürümlü doğrulayıcı ağ olmadan şema, özet, yol tekilliği ve kayıt bağlantılarında aynı sonucu verir.

Paket Manifesti ve Doğrulama Kiti tam sözleşme sürümlerini taşır. Bilinmeyen zorunlu alan veya ana sürüm, çelişen README ya da eksik dosya bütünlük hatasıdır; geçmiş paket göçte yerinde değiştirilmez.

## Tamamlanma Ölçütleri

- Aynı girdiler aynı paketi üretir; web ve masaüstünde yeniden okunan manifest ile çevrimdışı doğrulayıcı aynı bütünlük sonucuna ulaşır.

## Kapsam Sınırları

- Paket proje arşivi veya oyun motoru projesi değildir; çalıştırılabilir kurucu ve yetki taşıyan ajan talimatı içermez.
