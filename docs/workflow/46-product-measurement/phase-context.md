# Gizlilik Korumalı Ürün Telemetrisi Toplama

Sistem üretimden teslimata kadar süre, başarı ve koruma sonuçlarını sürümlü olay ve metrik tanımlarıyla hesaplar; kullanıcı görsellerini, ham talimatlarını ve sırlarını telemetriye taşımaz.

Ürün sonuçları gerçek iş akışı olaylarından hesaplanır. Ölçüm tanımı kalite kapısından ayrı sürümlü bir hesap sözleşmesidir.

## Alt Fazlar

### Ölçüm Tanımını Etkinleştirme

Her metriğin kapsamı, olay sınırları, pay ve paydası, hariç tutmaları, zaman penceresi, saklama süresi ve karar kullanımı sürümlenir.

Tanım nüfusu, başlangıç ve bitiş olaylarını, pay ile paydayı, hariç tutmaları, zaman penceresini, sunucu zamanını ve saklama süresini sabitler. Yeni tanım eski başlangıç serisini sessizce değiştirmez.

Ölçüm Tanımı tam sözleşme sürümünü taşır; bilinmeyen ana sürüm veya zorunlu alan etkinleştirmeyi durdurur. Göç eski tanımı yazmadan yeni sürüm üretir; ayrı tanım sürümlerinin başlangıç değerleri birleştirilmez.

### Gizlilik Korumalı Olay Toplama

Takma adlı kimlikler ve gerekli sayısal sayaçlar toplanır; dosya içeriği, serbest metin, yerel yol ve kimlik bilgileri olay dışında kalır.

Olay zarfı takma adlı kullanıcı ve proje kimliğini, iş akışı ile kayıt türünü, yüzeyi, sunucu zamanını, sonuç sınıfını ve gerekli sayaçları taşır. Görsel pikseli, ham talimat, not, yerel yol, varlık adı ve erişim sırrı olaylara alınmaz.

### Ürün Ölçülerini Hesaplama ve Gösterme

Sistem süre, başarı ve koruma ölçülerini etkin tanıma göre hesaplar; yarım kalan akışları ve farklı tanım sürümlerini ayrı gösterir.

Süre yalnız aynı iş akışının açık başlangıç ve bitiş olayı varsa hesaplanır; yarım akış ayrı bırakma sonucudur. Tanım sürümleri ayrı tutulur ve kullanıcıya ait öznel kalite değerlendirmesi gizli görüntü sınıflandırmasından çıkarılmaz.

## Tamamlanma Ölçütleri

- Süre, başarı ve koruma ölçüleri gizlilik zarfını koruyarak hesaplanır; tanımsız veya yarım akışlar yanlış başarı serisine katılmaz.

## Kapsam Sınırları

- Ölçüm olayları görsel içerik ve ham üretim talimatı taşımaz; baseline olmadan keyfî başarı yüzdesi ilan edilmez.
