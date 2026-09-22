# Oyun İçi Bilgileri Yönetme

Kullanıcı görsel varlığa bağlı pivot, zemin, sıralama, efekt başlangıcı, çarpışma alanı ve olay bilgilerini yazar veya içe aktarıp inceler.

Bilgiler kesin kare ve varlık sürümüyle ilişkilendirilir; sahne önizlemesi ve dışa aktarım aynı incelenmiş anlamı kullanır.

## Alt Fazlar

### Oyun İçi Bilgileri Yazma ve Eşleme

Kullanıcının girdiği veya kaynak metadata’dan kesinleştirdiği alanlar ilgili kareye ve kullanım bağlamına bağlanır.

Hitbox, hurtbox, collision, pivot ve olay alanları görsel şeffaflıktan yetkili gerçek olarak çıkarılmaz; eksik isteğe bağlı alan Bilinmiyor kalabilir.

### Bilgileri İnceleme ve Koruma

Kullanıcı bilgi katmanlarını görselin üzerinde inceler ve düzenleme ile paket yeniden okumasında bağlantı kaybını görür.

Kare kimliği veya zorunlu bağlantının kaybolması bütünlük hatasıdır; incelenmiş isteğe bağlı alanlar paket ve yeniden okuma boyunca korunur.

## Tamamlanma Ölçütleri

- Aynı kesin sürümün incelenmiş oyun bilgileri sahnede görünür ve paket yeniden okumasında kaybolmaz.

## Kapsam Sınırları

- Ürün görsel alfa değerinden oyun fiziği veya yetkili çarpışma bilgisi üretmez.
