# Oyun Çalışma Zamanında Doğrulama

## Problem Statement

Kullanıcı kesin bir Dışa Aktarım Paketini belirli oyun yapısı ve motor ortamında sınayıp tek yönlü, değişmez kanıt ve sonuç kaydı oluşturur. Bu kayıt sahne önizlemesi yerine gerçek oyun yapısında yapılan sınamanın kanıtıdır.

## Solution

Kullanıcı kesin bir Dışa Aktarım Paketini belirli oyun yapısı ve motor ortamında sınayıp tek yönlü, değişmez kanıt ve sonuç kaydı oluşturur.

Bu kayıt sahne önizlemesi yerine gerçek oyun yapısında yapılan sınamanın kanıtıdır. Paket, oyun ve motor sürümü sonuçtan ayrılamaz.

Tamamlanma kanıtı: Kullanıcı sonucu ve hata kaynağını kesinleştirir; gerekiyorsa hedef hazır olma koşulu yalnız geçerli güncel doğrulamayla sağlanır.

## User Stories

1. Bir kullanıcı olarak kesin Dışa Aktarım Paketini belirli oyun yapısı, motor ve bağdaştırıcı sürümüyle sınamak istiyorum; böylece testin ortamı ve girdisi sabitlenir.
2. Bir kullanıcı olarak ekran görüntüsü, kısa kayıt, test sonucu veya gözlem ekleyerek değişmez Çalışma Zamanı Doğrulama Kaydı oluşturmak istiyorum; böylece gerçek oyun testi pakete bağlanır.
3. Bir kullanıcı olarak kanıtı elle eklemek veya izinli bağdaştırıcının taslak hazırlamasını seçmek istiyorum; böylece kanıt kaynağı açık kalır.
4. Bir kullanıcı olarak Geçti, Başarısız veya Sonuçsuz sonucunu ve başarısızlık kaynağını kendim kesinleştirmek istiyorum; böylece araç benim adıma oyun kabulü vermez.
5. Bir kullanıcı olarak Başarısız kaydın geçmiş İnceleme Kaydını veya Dışa Aktarım Paketini değiştirmemesini istiyorum; böylece başarısız doğrulama geçmiş kanıtı yeniden yazmaz.
6. Bir kullanıcı olarak yalnız kesinleştirdiğim kapsamın bu kullanım için yeniden doğrulama istemesini istiyorum; böylece bir sorun ilgisiz dışa aktarımları otomatik engellemez.
7. Bir kullanıcı olarak Kaynak Belirsiz sonuç hedef kabul koşuluyken hedefin tamamlanmamasını istiyorum; böylece çözümlenmemiş başarısızlık geçerli kanıt sayılmaz.
8. Bir kullanıcı olarak oyun projesini Workbench için yetkili kaynak veya sürekli eşitleme girdisi yapmamayı istiyorum; böylece doğrulama tek yönlü kanıt aktarımı olarak kalır.

## Normatif gereksinimler

- **EXP-01 — Aileler arası teslimat hedefi:** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez.
- PRD 06-scene-quality-and-pixel-editor.md §4.10 bölümü ayrıca bu fazın davranışını belirler.

## Implementation Decisions

- **Çalışma Zamanı Kanıtı Toplama:** Ekran görüntüsü, kayıt, test sonucu ve gözlem kesin paket, yapı, motor ve bağdaştırıcı sürümüne bağlanır. Ekran görüntüsü, video veya test sonucu kesin Dışa Aktarım Paketine, oyun yapısına, motor sürümüne ve varsa bağdaştırıcı sürümüne bağlanır. Büyük ikili kanıt ayrı saklansa bile kimliği ve özeti kayıtla ilişkili kalır.
- **Sonucu ve Başarısızlık Kaynağını Kesinleştirme:** Bağdaştırıcı taslak hazırlayabilir; sonucu ve etkilenen yeniden doğrulama kapsamını yalnız kullanıcı kesinleştirir. Doğrulanmış bağdaştırıcı teknik taslak hazırlayabilir; Geçti, Başarısız veya Sonuçsuz kararı ile başarısızlığın kaynak sınıfını kullanıcı kesinleştirir. Kaynak Belirsiz başarısızlık hedefi engeller; düzeltme yeni kayıt üretir, eski kanıtı değiştirmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Oyun projesi Workbench için yetkili girdi veya sürekli eşitleme kaynağı olmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- **Teslim edilen sözleşme:** Çalışma Zamanı Doğrulama Kaydı kesin paket özeti, oyun yapısı, motor sürümü ve isteğe bağlı bağdaştırıcı sürümüyle bir kez eklenir, değişmez. Kanıt (ekran görüntüsü, kayıt, test sonucu, gözlem; dosya kimliği ve SHA-256 ile) yalnız eklenir ve sonuç kesinleşince kapanır. Sonuç ve hata kaynağı yalnız kullanıcının eklenmiş kararlarıdır: bir kaydın en çok bir sonuç kararı vardır, Kaynak Belirsiz başarısızlık ilk durumdur, yeniden sınıflandırma yeni karar ekler ve en sonuncusu (ekleme sırasıyla, zaman damgasıyla değil) geçerlidir. Yeniden sınama yeni kayıt olup yalnız aynı paket ve ortamdaki Sonuçsuz ya da kaynağı onaylı Başarısız kaydın yerini alabilir; bekleyen, Geçti veya Kaynak Belirsiz kayıt önceki sayılamaz. Teslimat Hedefi sürümünün çalışma zamanı ölçütü her gerekli ortam için güncel (yerine geçilmemiş) kaydın kullanıcı onaylı Geçti olmasını arar; engelleyen nedenler listelenir. Oyun yapısı, motor ve bağdaştırıcı sürümü metni tek tanıma (kırpılmış, en çok 200 karakter) uyar.
- **Teslim edilen sözleşmenin testleri:** [`runtime-validation.test.ts`](../../../apps/server/src/features/runtime-validation/server/tests/runtime-validation.test.ts) (kayıt, kanıt, karar ekleme sırası, yarış, yerine geçme uygunluğu), [`runtime-validation-readiness.test.ts`](../../../apps/server/src/features/runtime-validation/server/tests/runtime-validation-readiness.test.ts) (ölçüt ve engelleyen nedenler, Kaynak Belirsiz başarısızlığın gizlenememesi), [`runtime-validation-evidence-routes.test.ts`](../../../apps/server/src/features/runtime-validation/server/tests/runtime-validation-evidence-routes.test.ts) (dosya yükleme ve kapalı kanıt), [`runtime-validation-view.test.tsx`](../../../apps/web/src/features/runtime-validation/ui/views/runtime-validation-view.test.tsx) (formlar, erişilebilir hata bağlantıları, yeniden sınama seçici), [`runtime-validation-api.test.ts`](../../../apps/web/src/features/runtime-validation/lib/runtime-validation-api.test.ts) (409 iletileri) ve [`schemas.test.ts`](../../../apps/web/src/features/runtime-validation/schemas.test.ts) (ortak ortam alanı kuralı). Bellek içi depolama ikizi gerçek veritabanı kilidini sınamaz; kanıt ile sonucun eşzamanlı yarışı (`database-runtime-validation-storage.ts` içinde kayıt satırı kilidi) yalnız veritabanıyla doğrulanabilir.
- Fazın özgül başarı ve red kanıtı: Kullanıcı sonucu ve hata kaynağını kesinleştirir; gerekiyorsa hedef hazır olma koşulu yalnız geçerli güncel doğrulamayla sağlanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Oyun projesi Workbench için yetkili girdi veya sürekli eşitleme kaynağı olmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Oyun projesi Workbench için yetkili girdi veya sürekli eşitleme kaynağı olmaz.

## Further Notes

- Tek faz kaynağı: [`39-runtime-validation/phase-context.md`](../../workflow/39-runtime-validation/phase-context.md).
- Kanonik teknik adlar: Runtime Validation Record. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-01`](../../prd/07-export.md) — Aileler arası teslimat hedefi.
- [PRD §4.10](../../prd/06-scene-quality-and-pixel-editor.md) — bu alt bölümde ayrı gereksinim kimliği yok; kapsamı doğrudan bölüm metni belirler.

**İlgili mimari sınırlar**

- [ADR 0017](../../adr/0017-treat-runtime-validation-as-one-way-user-finalized-evidence.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
