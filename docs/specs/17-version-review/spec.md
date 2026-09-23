# Varlık Sürümünü İnceleme

## Problem Statement

Kullanıcı kesin Varlık Sürümünü onaylama, reddetme veya yeniden Aday yapma kararını değişmez İnceleme Kaydıyla verir. Kararın geçmişi, sürümün güncel Bağlama Uygunluk ve Kalite Kontrol Durumundan ayrı korunur.

## Solution

Kullanıcı kesin Varlık Sürümünü onaylama, reddetme veya yeniden Aday yapma kararını değişmez İnceleme Kaydıyla verir. Kararın geçmişi, sürümün güncel Bağlama Uygunluk ve Kalite Kontrol Durumundan ayrı korunur.

Ana Tasarım onaylanmadan Türetilmiş Varlıkların keşif sonuçları nihai kabul sayılmaz. Bütünlük hatası veya eksik zorunlu kanıt onayı durdurur. Toplu inceleme her uygun öğe için ayrı kayıt üretir; engelli öğe sessizce atlanmaz veya otomatik istisna almaz.

Tamamlanma kanıtı: Kullanıcının her kesin sürüm için verdiği son karar, zamanı ve gerekçesi geçmiş kararları silmeden izlenir; toplu işlemde her onay ayrı İnceleme Kaydıdır.

## User Stories

1. Bir kullanıcı olarak kesin bir Aday Sürüm için Onayla veya Reddet kararı vermek istiyorum; böylece inceleme sonucu kullanıcıya ait kalır.
2. Bir kullanıcı olarak her kararın zamanı, seçimi ve verdiğim gerekçeyi İnceleme Kaydında saklamak istiyorum; böylece değişiklik geçmişi izlenebilir olur.
3. Bir kullanıcı olarak kararımı değiştirdiğimde yeni İnceleme Kaydı oluşturmak istiyorum; böylece geçmiş karar silinmeden güncel karar belirlenir.
4. Bir kullanıcı olarak onaylanan sürümün kimliği ve içeriğini değişmez tutmak istiyorum; böylece yeni içerik yeni Aday Sürüm olarak değerlendirilir.
5. Bir kullanıcı olarak bağlam veya Ana Tasarım değiştiğinde geçmiş onayın korunmasını istiyorum; böylece tarihsel karar güncel Bağlama Uygunluk durumuyla karıştırılmaz.
6. Bir kullanıcı olarak Onaylı Sürümün kendiliğinden Bağlama Uygun veya Dışa Aktarıma Hazır sayılmamasını istiyorum; böylece onay, güncel kalite ve uygunluk kanıtı yerine geçmez.
7. Bir kullanıcı olarak ajan veya bağlantının benim adıma İnceleme Kaydı oluşturmamasını istiyorum; böylece kesin kabul kararı kullanıcı kontrolünde kalır.

## Normatif gereksinimler

- **QLT-01 — Kalite kanıtı ve kullanıcı kararı:** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.
- **AUT-01 — Hazırlık ve kesinleştirme:** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir.


## Implementation Decisions

- **Kesin sürüme İnceleme Kaydı yazma:** Kullanıcı kesin Varlık Sürümü için Onaylı, Reddedildi veya Aday kararını değişmez İnceleme Kaydı ile verir. Bütünlük veya zorunlu kanıt eksikse onay engellenir.
- **Toplu incelemede kararları ayırma:** Toplu inceleme her uygun sürüm için ayrı İnceleme Kaydı üretir; engelli öğe sessizce atlanmaz. Geçmiş kararlar ve diğer durum eksenleri korunur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcının her kesin sürüm için verdiği son karar, zamanı ve gerekçesi geçmiş kararları silmeden izlenir; toplu işlemde her onay ayrı İnceleme Kaydıdır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.

## Further Notes

- Tek faz kaynağı: [`17-version-review/phase-context.md`](../../workflow/17-version-review/phase-context.md).
- Kanonik teknik adlar: Review Event, Review Disposition. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Kalite kanıtı ve kullanıcı kararı.
- [`AUT-01`](../../prd/03-project-and-asset-foundations.md) — Hazırlık ve kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0005](../../adr/0005-separate-historical-approval-from-current-applicability.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
