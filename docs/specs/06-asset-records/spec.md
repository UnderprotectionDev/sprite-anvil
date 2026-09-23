# Varlık Kayıtlarını ve Kayıt Durumunu Yönetme

## Problem Statement

Kullanıcı bağımsız ürün anlamı taşıyan 2D görselleri kalıcı kayıtlar olarak izler ve kayıt durumunu sürüm değerlendirmesinden ayrı yönetir. Özel profili olmayan yazı tipi, imleç ve yardımcı görseller de Genel Varlık Desteğiyle saklanır, sürümlenir, ilişkilendirilir ve incelenir.

## Solution

Kullanıcı bağımsız ürün anlamı taşıyan 2D görselleri kalıcı kayıtlar olarak izler ve kayıt durumunu sürüm değerlendirmesinden ayrı yönetir.

Özel profili olmayan yazı tipi, imleç ve yardımcı görseller de Genel Varlık Desteğiyle saklanır, sürümlenir, ilişkilendirilir ve incelenir.

Tamamlanma kanıtı: Kayıt, geçmiş ve ayrı ölçü değerleri tekrar bulunur; arşivleme hiçbir sürümün onay veya kalite geçmişini değiştirmez.

## User Stories

1. Bir kullanıcı olarak bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği olan görsel için Varlık Kaydı oluşturmak istiyorum; böylece kütüphane yalnız dosya galerisi olarak kalmaz.
2. Bir kullanıcı olarak bir kayıtta Onaylı Sürümü, alternatifleri, Türetilmiş Varlıkları, referansları, kalite durumunu ve üretim geçmişini incelemek istiyorum; böylece aynı kimliğin yaşam döngüsünü takip edebilirim.
3. Bir kullanıcı olarak yalnız teknik olarak ayrı düzenlenebilen her parçanın ayrı kayıt sayılmamasını istiyorum; böylece bağımsız ürün kimliği ile dosya birimi karışmaz.
4. Bir kullanıcı olarak özel profili olmayan yazı tipi, imleç ve yardımcı görselleri Genel Varlık Desteğiyle saklamak istiyorum; böylece desteklenmeyen türler de ilişki ve temel dışa aktarım bilgilerini korur.
5. Bir kullanıcı olarak Kaynak Görsel Ölçüsü, Mantıksal Çözünürlük, Hücre Ölçüsü, Görünür İçerik Sınırı, Gösterim Ölçeği ve Atlas Ölçüsünü ayrı alanlarda görmek istiyorum; böylece farklı ölçüler birbirinin yerine kullanılmaz.
6. Bir kullanıcı olarak dosya veya metadata kaynaklı ölçüleri öneri olarak incelemek ve doğrulanmış değeri ayrıca belirlemek istiyorum; böylece tahmin yetkili ölçüye dönüşmez.
7. Bir kullanıcı olarak bağımsız kare, yön, karo veya durumları Birim Sürümü olarak yönetmek istiyorum; böylece ayrı değişebilen birimler izlenebilir sürüm alır.
8. Bir kullanıcı olarak Varlık Sürümünün değişmez kalmasını istiyorum; böylece düzenleme kabul edilmiş geçmişi üzerine yazmaz.
9. Bir kullanıcı olarak kaydı arşivleyip yeniden etkinleştirirken geçmiş inceleme ve kalite durumlarının korunmasını istiyorum; böylece Kayıt Durumu, sürüm kararıyla karışmaz.

## Normatif gereksinimler

- **AST-03 — Varlık Kaydı:** Varlık kütüphanesi yalnızca dosyaları gösteren bir galeri değildir. Bağımsız ürün anlamı, yaşam döngüsü veya teslimat kimliği taşıyan öğe Varlık Kaydıdır; yalnız teknik olarak değiştirilebilir olması ayrı kayıt olmasını gerektirmez.
- **DIM-03 — Bağımsız ölçü değerleri:** Kaynak Görsel Ölçüsü, Mantıksal Çözünürlük, Hücre Ölçüsü, Görünür İçerik Sınırı, Gösterim Ölçeği ve Atlas Ölçüsü ayrı alanlardır. Sistem dosya veya metadata’dan değer önerebilir; doğrulanmamış tahmini yetkili değer yapamaz ve kaynak ölçüden sessizce mantıksal çözünürlük türetemez.
- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.


## Implementation Decisions

- **Varlık Kaydı Oluşturma ve İzleme:** Kayıt onaylı sürüm, alternatif, Türetilmiş Varlık, referans, kalite ve üretim geçmişini aynı kimlikte gösterir. Kayıt sınırı dosya veya değiştirilebilir birim sayısına göre değil bağımsız anlam, yaşam döngüsü veya teslimat kimliğine göre kurulur.
- **Bağımsız Görsel Ölçüleri Kaydetme:** Kaynak, mantıksal, hücre, görünür içerik, gösterim ve atlas ölçüleri kayıtla ilişkilendirilir; öneri ile doğrulanmış değer ayrılır. Dosya veya sidecar ölçüsü yetkili mantıksal çözünürlük sayılmaz. Özel kare ve dikdörtgen ölçüler korunur; piksel sanatının mantıksal 1× kaynağı ve doğal sayı olmayan gösterim ölçeğinin keskinlik riski açıkça gösterilir. Yüksek çözünürlüklü illüstrasyonlar piksel sanatı ölçü kuralına zorlanmaz.
- **Kaydı Arşivleme ve Geri Alma:** Kullanıcı etkin kaydı geri alınabilir biçimde arşivler veya yeniden etkinleştirir. Etkin ve Arşivlenmiş Kayıt Durumu, sürümün İnceleme Kararı, Bağlama Uygunluk Durumu ve Kalite Kontrol Durumundan ayrı kalır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kalıcı silme kendi etki ve temizlik akışındadır; genel destek özel profil kanıtı üretmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-03, RAS-05, RAS-08 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kayıt, geçmiş ve ayrı ölçü değerleri tekrar bulunur; arşivleme hiçbir sürümün onay veya kalite geçmişini değiştirmez. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Kalıcı silme kendi etki ve temizlik akışındadır; genel destek özel profil kanıtı üretmez.
- Kabul örnekleri: RAS-01, RAS-03, RAS-05, RAS-08. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Kalıcı silme kendi etki ve temizlik akışındadır; genel destek özel profil kanıtı üretmez.

## Further Notes

- Tek faz kaynağı: [`06-asset-records/phase-context.md`](../../workflow/06-asset-records/phase-context.md).
- Kanonik teknik adlar: Asset Record, Availability. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-03`](../../prd/03-project-and-asset-foundations.md) — Varlık Kaydı.
- [`DIM-03`](../../prd/03-project-and-asset-foundations.md) — Bağımsız ölçü değerleri.
- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-03](../../prd/10-acceptance-scenarios.md)
- [RAS-05](../../prd/10-acceptance-scenarios.md)
- [RAS-08](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
