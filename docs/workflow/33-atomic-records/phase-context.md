# Yetkili Kayıtları Atomik Kesinleştirme

Kullanıcıya başarılı görünen kayıt kaybolmaz; yinelenen veya yarım kalan işlem ikinci kesin sonuç ya da sahte başarı üretmez.

Bağlam, varlık, inceleme, istisna, hedef, paket, arşiv ve silme gibi kesin kayıtlar içerik veya paket özetiyle birlikte tamamlanır. Yarım kalan yükleme, içe aktarma, dışa aktarma, arşiv veya geri yükleme kısmi başarı sayılmaz; bulut yazımı tamamlanmadıysa arayüz geçerli bulut durumunu ayrı gösterir.

Aynı idempotency anahtarıyla yinelenen kesinleştirme aynı kayıt kimliği ve sonucu verir; ikinci inceleme, istisna, paket, arşiv veya silme sonucu oluşturmaz. Açıklanamayan özet veya ilişki farkı başarı olarak yayımlanmaz.

## Tamamlanma Ölçütleri

- Kesinti ve tekrar fixture’larında kesin kayıt tek kez oluşur; yarım işlem görünür başarısız veya yeniden denenebilir durumda kalır.

## Kapsam Sınırları

- Arka plan taşıma mesajı yetkili kayıt yerine geçmez; işin yürütülmesi ayrı uzun işlem akışıdır.
