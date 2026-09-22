# Oyun Çalışma Zamanında Doğrulama

Kullanıcı kesin bir Dışa Aktarım Paketini belirli oyun yapısı ve motor ortamında sınayıp tek yönlü, değişmez kanıt ve sonuç kaydı oluşturur.

Bu kayıt sahne önizlemesi yerine gerçek oyun yapısında yapılan sınamanın kanıtıdır. Paket, oyun ve motor sürümü sonuçtan ayrılamaz.

## Alt Fazlar

### Çalışma Zamanı Kanıtı Toplama

Ekran görüntüsü, kayıt, test sonucu ve gözlem kesin paket, yapı, motor ve bağdaştırıcı sürümüne bağlanır.

Ekran görüntüsü, video veya test sonucu kesin Dışa Aktarım Paketine, oyun yapısına, motor sürümüne ve varsa bağdaştırıcı sürümüne bağlanır. Büyük ikili kanıt ayrı saklansa bile kimliği ve özeti kayıtla ilişkili kalır.

### Sonucu ve Başarısızlık Kaynağını Kesinleştirme

Bağdaştırıcı taslak hazırlayabilir; sonucu ve etkilenen yeniden doğrulama kapsamını yalnız kullanıcı kesinleştirir.

Doğrulanmış bağdaştırıcı teknik taslak hazırlayabilir; Geçti, Başarısız veya Sonuçsuz kararı ile başarısızlığın kaynak sınıfını kullanıcı kesinleştirir. Kaynak Belirsiz başarısızlık hedefi engeller; düzeltme yeni kayıt üretir, eski kanıtı değiştirmez.

## Tamamlanma Ölçütleri

- Kullanıcı sonucu ve hata kaynağını kesinleştirir; gerekiyorsa hedef hazır olma koşulu yalnız geçerli güncel doğrulamayla sağlanır.

## Kapsam Sınırları

- Oyun projesi Workbench için yetkili girdi veya sürekli eşitleme kaynağı olmaz.
