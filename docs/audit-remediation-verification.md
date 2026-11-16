# Denetim düzeltmeleri: doğrulama durumu

İlgili iş: [#224](https://github.com/UnderprotectionDev/sprite-anvil/issues/224). Davranış ve kapsam: [audit-remediation-spec.md](audit-remediation-spec.md).

Bu kayıt uygulama sırasında güncellenir. Otomatik kontrolün geçmesi, gerçek dış sistem ve yardımcı teknoloji kabulünün tamamlandığını göstermez.

## Otomatik regresyon

Ana test komutu, `VITEST_MAX_WORKERS=4` ile geçti: scripts 18, API 158, DB/script 134, web 682, server 925 başarılı test; toplam 1.917 başarılı ve 76 atlanan test. Atlananlar canlı veritabanı, dış sistem veya ayrı Godot koşumu gerektirir; atlanma kabul başarısı değildir. Godot ve disposable DB kanıtları aşağıda ayrı belirtilir. Yeni değişiklik sonrası ilgili sınır tekrar çalıştırılır.

## Gerçek ortamda alınan kanıt

| Sınır | Ortam / sonuç | Sınırlandırma |
|---|---|---|
| Godot golden output | macOS arm64; resmi 4.3, 4.4, 4.5 stable ikilileriyle sürüm başına iki test geçti; 4.5 üç kez tekrarlandı | Linux CI matrisi eklendi; uzak CI henüz çalıştırılmadı |
| Arşiv normal ürün kayıtları | Disposable loopback PostgreSQL; foundation/history/delivery ve aile kapsamı altı test ve 33 assertion geçti | Shared development DB ve gerçek R2 değildir |
| İnceleme/kalite kalıcılığı | Disposable PostgreSQL; Required Set ve Object scene evidence ret yolları dahil üç test/80 assertion geçti | Üretim Neon HTTP sürücüsü değildir |
| Katalog sayfalama | Disposable PostgreSQL; boyut filtresi, sayfa sınırı ve toplam 37 assertion geçti | Üretim hacminde performans kabulü değildir |
| Background Operation özeti | Disposable PostgreSQL; 110 kayıtla yaşından bağımsız yetkili toplam doğrulandı | Kuyruk sağlayıcısı uçtan uca çalıştırılmadı |
| Web kullanıcı akışları | Gerçek Chromium; tüm DB bağımsız koşuda 49 senaryo geçti, DB gerektiren 23 senaryo atlandı; 18 masaüstü/dar ekran görüntüsünde yatay taşma kontrolü geçti | İstekler kontrollü test yanıtlarıdır; kalıcı DB kanıtı ayrı tutulur |
| Native derleme | macOS; normal ve `webdriver` feature ile `cargo check`, WebDriver uygulama build ve WKWebView kabuk/programatik odak kontrolleri geçti (3 test); gerçek klavye 2 test atlandı | Gerçek dosya izni, native akış ve ekran okuyucu kabulü değildir |
| Migration güvenliği | 28 migration expansion baseline sonrasında geçti; 104 migration kimliği ve son şema snapshot kaynakla eşleşti | Ortak hedefe DDL uygulanmadı |

## Açık kabul sınırları

- Shared development DB teslimi, incelenmiş tam integration HEAD kullanıcı tarafından yayımlandıktan sonra `db:prepare`, etkilenen testler ve `db:ready` gerektirir. Agent branch'i push etmez veya PR açmaz.
- Arşiv ZIP import için `PROJECT_ARCHIVE_IMPORT_MANIFEST_MAX_BYTES` sunucunun ölçülmüş kaynak sınırına göre yapılandırılmalıdır; varsayılan sayısal değer uydurulmadı. Tek dosyada mevcut PostgreSQL `integer` alanının 2.147.483.647 bayt sınırı önceden denetlenir; bu teknik sınır büyük dosya performans iddiası değildir.
- Neon HTTP sürücüsünü isteyen entegrasyonlar loopback TCP hedefinde çalışmaz; geniş disposable denemede 14 fixture geçersiz HTTP endpoint nedeniyle başarısız oldu. İlgili altı eski hata ve yeni kayıt testleri TCP uyumlu adapter ile ayrıca doğrulandı; Docker/Neon HTTP proxy ve uzak CI koşumu bu ortamda yapılmadı. Bu, production-driver başarısı sayılmaz.
- Gerçek R2/Queue deployment, büyük arşiv kaynak tüketimi, backup retention/purge ve Operasyonel Kabul Profili eşikleri ölçülmedi.
- Embedded native sürücü sentetik `KeyboardEvent` gönderir; gerçek `Tab` geçişi/`:focus-visible` kanıtı sağlamaz. Yanıltıcı programatik fallback kaldırıldı; bu akış ayrı bir programatik odak smoke testidir. Chromium trusted klavye kontrolleri geçti.
- VoiceOver/NVDA ile kullanıcı incelemesi yapılmadı; [ekran okuyucu listesi](specs/47-accessible-workflow/screen-reader-checklist.md) açık kalır.
- Desteklenen Platformlar Tablosunun bütün OS/tarayıcı birleşimleri, RAS/YAS ve OV-08–OV-11 kabulü tamamlanmadı; destek kapısı bunları tamamlandı göstermez.
- Ağsız paket doğrulaması yerel çalışır ve ölçülmez. Yalnız bağlantılı koşularda sunucu başlangıç/bitiş olayları kaydedilir; ölçüm hatası doğrulamayı engellemez.
