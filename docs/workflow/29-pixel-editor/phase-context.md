# Son Dokunuş Piksel Düzenleme

Kullanıcı mevcut bir sürümdeki küçük piksel, palet, şeffaflık, hizalama ve kare yapısı sorunlarını kaynağı bozmadan giderip yeni Aday Sürüm oluşturur.

Düzenleyici dar kapsamlı son dokunuşları ve yapısal kare düzeltmelerini destekler. Çalışma taslağı ile kabul edilen Aday Sürüm birbirinden ayrılır.

## Alt Fazlar

### Deterministik Piksel ve Palet Düzeltme

Piksel ızgarasını koruyan dar araçlarla yapılan değişiklikler önizlenir, geri alınabilir ve kaynak dosyadan ayrı tutulur.

Mantıksal piksel ızgarasını koruyan dar araçlar renk, palet, şeffaflık ve hizalama düzeltmesini karşılaştırmalı önizler. Geri alma çalışma taslağını etkiler; kabul edilen değişiklik kaynak dosyayı değiştirmek yerine yeni Aday Sürüm oluşturur.

### Kare ve Görsel Sayfası Yapısını Düzenleme

Dilimleme, sıra, süre, ofset, pivot, hücre ve bileşim değişiklikleri yalnız etkilenen birimleri yenileyerek sürümlenir.

Kare dilimleme, sıra, süre, ofset ve pivot düzenlemeleri etkilenen Birim Sürümlerini yeniden kurar. Yeni Birleşik Sürüm bu birimleri sabitler; seçilmemiş kareler ve önceki görsel sayfası korunur.

### Üretimle Seçici Düzeltme Hazırlama

Yeniden çizim gereken bölge, sorun notu ve korunacak birimler yeni Üretim Paketine aktarılır; dönen seçenek taslağı sessizce ezmez.

Çizim gerektiren bölge ve korunacak birimler yeni Üretim Paketine açık kısıt olarak aktarılır. Gelen alternatif mevcut taslağı veya onaylı birimi otomatik değiştirmez; kullanıcı yeni sonucu ayrıca içe alıp inceler.

## Tamamlanma Ölçütleri

- Kullanıcı bir piksel veya kare kusurunu kaynak ve ilgisiz birimleri değiştirmeden düzeltir; üretime yönlendirdiği onarım yeni paket ve aday döngüsüne girer.

## Kapsam Sınırları

- Tam çizim paketi, katman birleştirme veya iskelet animasyonu bu çalışma alanının sonucu değildir.
