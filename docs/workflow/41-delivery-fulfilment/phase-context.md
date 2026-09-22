# Teslimatı Kesin Paketlerle Gerçekleştirme

Kullanıcı hazır bir Teslimat Hedefinin her gereksinimini kesin paket ve varlık sürümlerine eşler; çakışmaları çözerek değişmez teslim kanıtı oluşturur.

Hazır hedef ile Teslim Edildi durumu ayrıdır. Kullanıcı her gereksinimin hangi kesin paket ve sürümle karşılandığını karara bağlar.

Hazır hedefin her gereksinimi kesin paket ve varlık sürümüne eşlenir. Birden çok pakette aynı gereksinim karşılanıyorsa kullanıcı geçerli eşlemeyi seçer; gerçekleşme oluşmadan hedef Teslim Edildi sayılmaz.

## Tamamlanma Ölçütleri

- Çakışmasız eşleme değişmez gerçekleşme üretir; Hazır hedef yalnız geçerli gerçekleşme oluştuğunda Teslim Edildi sayılır.

## Kapsam Sınırları

- En yeni paket işareti geçmiş teslimata otomatik uygulanmaz; Hazır hedef tek başına teslim edilmiş sayılmaz.
