# Gizlilik Korumalı Ürün Telemetrisi Toplama

## Problem Statement

Sistem üretimden teslimata kadar süre, başarı ve koruma sonuçlarını sürümlü olay ve metrik tanımlarıyla hesaplar; kullanıcı görsellerini, ham talimatlarını ve sırlarını telemetriye taşımaz. Ürün sonuçları gerçek iş akışı olaylarından hesaplanır.

## Solution

Sistem üretimden teslimata kadar süre, başarı ve koruma sonuçlarını sürümlü olay ve metrik tanımlarıyla hesaplar; kullanıcı görsellerini, ham talimatlarını ve sırlarını telemetriye taşımaz.

Ürün sonuçları gerçek iş akışı olaylarından hesaplanır. Ölçüm tanımı kalite kapısından ayrı sürümlü bir hesap sözleşmesidir.

Tamamlanma kanıtı: Süre, başarı ve koruma ölçüleri gizlilik zarfını koruyarak hesaplanır; tanımsız veya yarım akışlar yanlış başarı serisine katılmaz.

## User Stories

1. Bir kullanıcı olarak her ürün metriği için sürümlü Ölçüm Tanımı etkinleştirmek istiyorum; böylece metrik başlangıç, bitiş, kapsam ve hesap kuralıyla belirlenir.
2. Bir kullanıcı olarak tanımın pay, paydayı, hariç tutmaları, zaman aralığını, saklama süresini ve karar kullanımını içermesini istiyorum; böylece aynı ad altındaki farklı ölçümler karıştırılmaz.
3. Bir kullanıcı olarak süre hesabının istemci saatinden bağımsız sunucu zamanına dayanmasını istiyorum; böylece cihaz saati ölçümü değiştirmez.
4. Bir kullanıcı olarak görsel, dosya içeriği, ham talimat, serbest not, dosya yolu, varlık adı veya sırların ölçüm olayına yazılmamasını istiyorum; böylece telemetri gizlilik sınırını korur.
5. Bir kullanıcı olarak olayların yalnız takma adlı kapsam, iş akışı kimliği, yüzey, sonuç ve gerekli sayaçları taşımasını istiyorum; böylece ölçüm için gereken asgari veri kullanılır.
6. Bir kullanıcı olarak üretim, inceleme, onarım, eşleme, teslimat, çalışma zamanı doğrulaması ve çevrimdışı doğrulama sürelerini tanımlı olay sınırlarından hesaplamak istiyorum; böylece metrik gerçek iş akışı sonucunu yansıtır.
7. Bir kullanıcı olarak başlangıç veya bitiş olayı eksik akışın başarı süresine katılmamasını ve bırakma olarak ayrı görünmesini istiyorum; böylece tamamlanmayan iş başarı gibi sayılmaz.
8. Bir kullanıcı olarak kullanıcıya ait öznel tutarlılık ve yanlış uyarı değerlendirmesinin açık inceleme eylemiyle kaydedilmesini istiyorum; böylece sistem görselden gizli başarı etiketi çıkarmaz.
9. Bir kullanıcı olarak gerçek baseline ve kararlaştırılmış hedef olmadan yüzde başarı iddiası yayımlanmamasını istiyorum; böylece metrik varlığı ürün başarısı kanıtı sayılmaz.

## Normatif gereksinimler

- **OPS-03 — Gizlilik ve en az yetki:** Proje içeriği varsayılan olarak gizlidir; kullanıcı içeriği veya sırlar yalnız açık amaç, kapsam ve gerekli en az yetkiyle işlenir.
- PRD 09-success-measurement.md §7 bölümü ayrıca bu fazın davranışını belirler.

## Implementation Decisions

- **Ölçüm Tanımını Etkinleştirme:** Her metriğin kapsamı, olay sınırları, pay ve paydası, hariç tutmaları, zaman penceresi, saklama süresi ve karar kullanımı sürümlenir. Tanım nüfusu, başlangıç ve bitiş olaylarını, pay ile paydayı, hariç tutmaları, zaman penceresini, sunucu zamanını ve saklama süresini sabitler. Yeni tanım eski başlangıç serisini sessizce değiştirmez. Ölçüm Tanımı tam sözleşme sürümünü taşır; bilinmeyen ana sürüm veya zorunlu alan etkinleştirmeyi durdurur. Göç eski tanımı yazmadan yeni sürüm üretir; ayrı tanım sürümlerinin başlangıç değerleri birleştirilmez.
- **Gizlilik Korumalı Olay Toplama:** Takma adlı kimlikler ve gerekli sayısal sayaçlar toplanır; dosya içeriği, serbest metin, yerel yol ve kimlik bilgileri olay dışında kalır. Olay zarfı takma adlı kullanıcı ve proje kimliğini, iş akışı ile kayıt türünü, yüzeyi, sunucu zamanını, sonuç sınıfını ve gerekli sayaçları taşır. Görsel pikseli, ham talimat, not, yerel yol, varlık adı ve erişim sırrı olaylara alınmaz.
- **Ürün Ölçülerini Hesaplama ve Gösterme:** Sistem süre, başarı ve koruma ölçülerini etkin tanıma göre hesaplar; yarım kalan akışları ve farklı tanım sürümlerini ayrı gösterir. Süre yalnız aynı iş akışının açık başlangıç ve bitiş olayı varsa hesaplanır; yarım akış ayrı bırakma sonucudur. Tanım sürümleri ayrı tutulur ve kullanıcıya ait öznel kalite değerlendirmesi gizli görüntü sınıflandırmasından çıkarılmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Ölçüm olayları görsel içerik ve ham üretim talimatı taşımaz; baseline olmadan keyfî başarı yüzdesi ilan edilmez.

## Testing Decisions

- **Birincil test seam’i:** Sürüm sabitli Measurement Definition altında sunucu olaylarından tam ve yarım akış ölçülerini hesaplama; olay yükünün dosya, ham metin, yerel yol ve sır içermediğini doğrulama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Süre, başarı ve koruma ölçüleri gizlilik zarfını koruyarak hesaplanır; tanımsız veya yarım akışlar yanlış başarı serisine katılmaz. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Ölçüm olayları görsel içerik ve ham üretim talimatı taşımaz; baseline olmadan keyfî başarı yüzdesi ilan edilmez.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Ölçüm olayları görsel içerik ve ham üretim talimatı taşımaz; baseline olmadan keyfî başarı yüzdesi ilan edilmez.

## Further Notes

- Tek faz kaynağı: [`46-product-measurement/phase-context.md`](../../workflow/46-product-measurement/phase-context.md).
- Kanonik teknik adlar: Measurement Definition. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-03`](../../prd/08-platform-and-operations.md) — Gizlilik ve en az yetki.
- [PRD §7](../../prd/09-success-measurement.md) — bu alt bölümde ayrı gereksinim kimliği yok; kapsamı doğrudan bölüm metni belirler.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
