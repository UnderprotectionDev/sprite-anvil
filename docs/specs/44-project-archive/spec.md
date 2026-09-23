# Projeyi Taşınabilir Arşivle Koruma

## Problem Statement

Kullanıcı proje bağlamını, varlık ve kanıt ilişkilerini, paket geçmişini ve seçili çalışma dosyalarını sırlar olmadan arşivleyip bağımsız projeye geri yükler. Taşınabilir arşiv teslimat paketinden daha geniş proje, ilişki ve kanıt geçmişini korur.

## Solution

Kullanıcı proje bağlamını, varlık ve kanıt ilişkilerini, paket geçmişini ve seçili çalışma dosyalarını sırlar olmadan arşivleyip bağımsız projeye geri yükler.

Taşınabilir arşiv teslimat paketinden daha geniş proje, ilişki ve kanıt geçmişini korur. Geri yükleme varsayılan olarak bağımsız yeni proje oluşturur.

Tamamlanma kanıtı: Arşiv içeriği ile dışarıda bırakılan büyük ikili kanıt ayrışır; yeni projede ilişki ve dosya özetleri tutarlı olarak geri kurulur.

## User Stories

1. Bir kullanıcı olarak Proje Bağlamını, varlık geçmişini, ilişkileri ve paket geçmişini taşınabilir Proje Arşivinde saklamak istiyorum; böylece teslimat paketinden daha geniş proje geçmişi korunur.
2. Bir kullanıcı olarak seçili çalışma dosyalarını arşive eklemek istiyorum; böylece arşivleme kapsamı kullanıcı seçimine dayanır.
3. Bir kullanıcı olarak arşiv dışında kalan büyük ikili kanıtların kimliğini, özetini ve eksikliğini görmek istiyorum; böylece arşiv içeriği ile dışarıda bırakılan kanıt ayrışır.
4. Bir kullanıcı olarak şifreleme anahtarı, erişim belirteci ve sunucu sırrının arşive girmemesini istiyorum; böylece taşınabilir dosya yetki bilgisi taşımaz.
5. Bir kullanıcı olarak uzun süren arşiv oluşturma ve geri yükleme işini yetkili Arka Plan İşlemi durumundan izlemek istiyorum; böylece istek zaman aşımı işin sonucunu kaybettirmez.
6. Bir kullanıcı olarak arşiv içeriği ve ilişkilerini özetlerle doğrulamak istiyorum; böylece eksik veya bozuk geri yükleme tamamlandı sayılmaz.
7. Bir kullanıcı olarak arşivi varsayılan olarak bağımsız yeni projeye geri yüklemek istiyorum; böylece mevcut proje sessizce üzerine yazılmaz veya birleştirilmez.
8. Bir kullanıcı olarak yeni bulut kimliklerinin eski kimliklerle eşlemesini ayrı kaydetmek istiyorum; böylece yeni ortam ilişkileri korunurken kaynak arşiv değişmez kalır.

## Normatif gereksinimler

- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.
- **OPS-01 — Yetkili işlem kaydı:** Etkileşimli istek süresinde güvenle tamamlanamayan arşivleme veya geri yükleme dayanıklı arka plan yürütücüsü ve kullanıcıya görünür yetkili işlem kaydıyla yürütülür.
- **OPS-02 — Atomik ve idempotent kesinleştirme:** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.


## Implementation Decisions

- **Temel arşiv kayıtları:** Sürümlü arşiv Bağlam Sürümlerini, varlık ilişkilerini ve dosyalarını, referans rollerini ve seçilmiş çalışma dosyalarını taşır. İçerilmeyen büyük ikili kanıtın kimliği, özeti ve eksikliği manifestte belirtilir; sırlar dışlanır.
- **Üretim ve değerlendirme geçmişi:** Arşiv inceleme ve kalite geçmişini, metadata önerileri ile kullanıcı kararlarını, üretim kanıtı ve deneylerini, tarifleri ve hak kayıtlarını taşır.
- **Teslimat ve doğrulama geçmişi:** Arşiv dışa aktarım profili ve yenileme kilitlerini, teslimat hedefi ve gerçekleşmelerini, tarihsel risk bildirimlerini, teslimat farklarını, çalışma zamanı doğrulamalarını ve paket manifestlerini taşır.
- **Bağımsız Projeye Geri Yükleme:** Arşiv ilişki ve dosya bütünlüğünü koruyarak yeni bulut kimliklerine eşlenir; mevcut projenin üzerine yazılmaz veya otomatik birleşmez. Geri yükleme dosya özetlerini ve iç ilişkileri doğrular, ardından yeni bulut kimlikleriyle bağımsız proje kurar. Geçersiz arşiv kısmi proje bırakmaz; mevcut proje üzerine yazma veya otomatik birleştirme yapılmaz.
- **Uzun işlem sınırı:** Arşivleme veya geri yükleme etkileşimli istekte güvenle tamamlanamıyorsa OPS-01'in yetkili işlem kaydı ve dayanıklı yürütümü kullanılır. Etkileşimli süre veya desteklenecek boyut implementer tarafından varsayılmaz; arşiv kabulü OV-09 ve OV-10 kanıtlarına bağlıdır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.

## Testing Decisions

- **Birincil test seam’i:** Project Archive oluşturma ve bağımsız projeye geri yükleme turunda dosya/ilişki özetlerini karşılaştırma; bozuk arşivin kısmi proje bırakmadığını doğrulama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Arşiv içeriği ile dışarıda bırakılan büyük ikili kanıt ayrışır; yeni projede ilişki ve dosya özetleri tutarlı olarak geri kurulur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.
- OV-09 boyut sınırı ve OV-10 operasyonel performans/bellek kanıtı kapanmadan arşiv özelliği tamamlanmış sayılmaz; bu değerler gelene kadar fixture ve geliştirme çalışması başlayabilir.
- Kabul örnekleri: YAS-01, YAS-04. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.

## Further Notes

- Tek faz kaynağı: [`44-project-archive/phase-context.md`](../../workflow/44-project-archive/phase-context.md).
- Kanonik teknik adlar: Project Archive. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.
- [`OPS-01`](../../prd/08-platform-and-operations.md) — Etkileşimli istekte güvenle tamamlanamayan arşivleme ve geri yükleme.
- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0007](../../adr/0007-provide-portable-restorable-project-archives.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- [YAS-04](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
