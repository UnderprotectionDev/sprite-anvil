# Portre, Logo ve Tanıtım Profilini Uygulama

## Problem Statement

Portre, logo ve tanıtım görselleri kendi Görsel Dünyasında kimlik, ifade, kırpma, güvenli alan, arka plan ve küçük kullanım okunurluğuyla incelenir. Portre ve tanıtım görselleri aynı proje kimliğinde bulunur fakat kullanım oranları ve Görsel Dünya kuralları ayrıdır.

## Solution

Portre, logo ve tanıtım görselleri kendi Görsel Dünyasında kimlik, ifade, kırpma, güvenli alan, arka plan ve küçük kullanım okunurluğuyla incelenir.

Portre ve tanıtım görselleri aynı proje kimliğinde bulunur fakat kullanım oranları ve Görsel Dünya kuralları ayrıdır.

Tamamlanma kanıtı: Portre ifade ve kırpması ile logo ve tanıtımın küçük kullanım ve güvenli alan sonuçları ayrı kanıtlanır; paket bu amaçları korur.

## User Stories

1. Bir kullanıcı olarak portre, logo ve tanıtım görsellerini kullanım amaçlarına uygun ayrı Görsel Dünyalarda yönetmek istiyorum; böylece oyun içi piksel kuralları pazarlama görsellerine taşınmaz.
2. Bir kullanıcı olarak portreyi aynı Varlık Kimliğine bağlarken ayrı Ana Tasarım ve çözünürlük kurallarını korumak istiyorum; böylece kimlik bağı aile sınırını kaldırmaz.
3. Bir kullanıcı olarak portre ifadesini ve kırpma tutarlılığını hedef kullanımda incelemek istiyorum; böylece portre kimliği ve yüz görünürlüğü değerlendirilir.
4. Bir kullanıcı olarak logo ve tanıtım görsellerini küçük boyutta, güvenli alanla ve açık/koyu arka planlarda sınamak istiyorum; böylece gerçek gösterim koşullarında okunurluk kanıtlanır.
5. Bir kullanıcı olarak her sürümün kullanım amacını, kırpmasını, güvenli alanını ve arka plan çeşidini kaydetmek istiyorum; böylece farklı çıktı varyantları ayırt edilir.
6. Bir kullanıcı olarak ilgili Ana Tasarım bağını ve tam sürümü pakete eklemek istiyorum; böylece taşınan görselin dayanak tasarımı izlenebilir olur.
7. Bir kullanıcı olarak portre ve pazarlama testlerini etkin Özel Profil Sözleşmesi altında tamamlamak istiyorum; böylece uygunluk profile özgü kullanım kanıtına dayanır.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Portre Kimliğini ve Kırpmayı İnceleme:** Farklı Görsel Dünyadaki portre Ana Tasarımı ortak Varlık Kimliğini, ifade çeşitlerini ve diyalog ya da arayüz kırpmasını korur. Portre oyun içi sprite ile Varlık Kimliğini paylaşabilir, ancak ayrı Görsel Dünya ve Ana Tasarım soyunda kalır. İfade seçenekleri ile diyalog ya da arayüzdeki kırpma kesin kullanım boyutunda karşılaştırılır.
- **Logo ve Tanıtım Kullanımlarını Sınama:** Logo ve tanıtım yerleşimleri şeffaf veya opak kullanımda, güvenli alanda, küçük boyutta ve açık/koyu arka planda okunur kalır. Logo, açılış ve mağaza görselleri açık ve koyu zeminle şeffaf veya opak biçimde denenir. Güvenli alan, küçük kullanım okunurluğu ve kullanım amacına bağlı kırpma korunur; tanıtım görseli oyun içi piksel kuralına zorlanmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tanıtım görselleri oyun içi piksel sanatının çözünürlük ve ölçek kuralına zorlanmaz.

## Testing Decisions

- **Birincil test seam’i:** RAS-08 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Portre Kimliği İncelemesi için `portraitIdentityReviews.save/list` API seam’i `apps/server/src/features/portrait-marketing-profile/server/tests/portrait-identity-review.test.ts` ve opt-in `portrait-identity-review.integration.test.ts` ile sınanır. Ortak Varlık Kimliği, ayrı Görsel Dünya/Ana Tasarım, ifade soy bağı, kaynak kırpma sınırları, kesin kullanım ölçüsü, etkin sözleşme, kullanıcı gözlemleri, belirsiz yazım ve tekrar isteği korunur. `apps/web/src/features/portrait-marketing-profile/ui/components/portrait-identity-review-manager.test.tsx` aynı React yüzeyinin yükleme, kayıt ve yeniden okuma davranışını sınar. `apps/web/e2e/portrait-identity-review.spec.ts` tarayıcıda portre sürümlerini yükleme, Ana Tasarım onayı, ifade soy bağı, kırpma doğrulaması, kullanıcı kararı ve sayfa yenilemesinden sonra kalıcı ayrıntıları yeniden okuma yolunu sınar; `bun run test:e2e:portrait-review` bunu yalnız geçici yerel PostgreSQL üzerinde çalıştırır. `apps/web/desktop-e2e/portrait-identity-reviews.spec.ts`, web yolunda oluşturulan hesabı ve aileyi normal oturum açma yoluyla yeniden açıp aynı ölçü/kırpma/gözlemleri kaydetme ve yenileme seam’ini sınar. `PORTRAIT_REVIEW_RESULT_PATH` web testinin yazdığı, yalnız sahibi tarafından okunabilen geçici hesap dosyasını seçer. `bun run test:e2e:portrait-review:surfaces` web verisini oluşturur, gerçek Tauri uygulamasını derler ve native akışı aynı geçici PostgreSQL/API üzerinde çalıştırır. WKWebView’in HTTP Secure cookie sınırı için yalnız gerçek auth handler’ın ürettiği çerezler tek native test oturumu boyunca loopback test adaptöründe taşınır; üretim oturum davranışı veya sunucu yetkilendirmesi değiştirilmez. Masaüstü ayrıca gerçek Tauri uygulamasında çalıştırılmadan eşdeğerlik kanıtı sayılmaz. Logo/tanıtım incelemesi bu issue kapsamında teslim edilmez. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Portre belirsiz yazım seam’i: manager testleri OPS-06 gereği `Kaydı yeniden kontrol et` eyleminin yalnız listeyi yeniden okuduğunu, aynı yazımı tekrar göndermediğini ve sonuç henüz bulunmadığında kayıt kilidini koruduğunu doğrular. SQL entegrasyonu silinmiş sürümlü kaydın içerikli API yanıtından saklanmasına rağmen tarihsel inceleme satırının değiştirilmediğini ayrıca sınar. İçeriksiz Erasure Tombstone üretimi ayrı silme iş akışının kapsamıdır.
- Logo/tanıtım kullanım seam’i: `marketingUsageReviews.save/list` üzerinden kesin kaynak ölçüsü, küçük kullanım ölçüsü, kırpma/güvenli alan, şeffaf/opak sunum ve ayrı açık/koyu zemin gözlemleri kalıcı kayıttan yeniden okunur. `marketing-usage-review.test.ts` eksik/geçersiz girdiyi, yetkisiz erişimi, profil/ana tasarım değişimini, kaynak doğrulama hatasını ve belirsiz yeniden okumayı sınar. `marketing-usage-preview.test.tsx` kesirli ölçeği ve güvenli alan gösterimini; manager testleri yükleme, kaydetme ve belirsiz sonuçta yeniden göndermeme davranışını sınar. SQL entegrasyon testi gerçek store yazmasını ve ikinci bağlantıdan yeniden okumayı doğrular.
- Yüzey eşdeğerliği: `apps/web/e2e/marketing-usage-reviews.spec.ts` ve `apps/web/desktop-e2e/marketing-usage-reviews.spec.ts` aynı 301 × 199 kaynak sürümünü 77 × 51 ölçüsünde, güvenli alanla ve şeffaf/opak sunumda sınar; kaydetme, yenileme ve indirme sonrasında kesin sürüm/amaç/gözlemler karşılaştırılır. `bun run test:e2e:marketing-usage` ayrılmış yerel PostgreSQL ve bellek dosya depolamasıyla bu senaryoları çalıştırır; paylaşılan geliştirme verisi oluşturmaz.
- Tanıtım Kullanımı İncelemesi JSON kanıt paketi amaç, tam sürüm, Görsel Dünya, varsa kesin Ana Tasarım, kırpma/güvenli alan ve arka plan sonuçlarını korur; tam Dışa Aktarım Paketi entegrasyonu ve portre ifade incelemesi ayrı teslim kapsamıdır.
- OPS-06 hata bildirimi seam’i: `marketing-usage-review-manager.test.tsx`, kaydetme sunucu hatasında doğrulanmış Destek Referansının ortak bildirimde görünmesini ve ham istisna ayrıntısının gizlenmesini sınar. Bağlantı hatasında referans üretilmez; her iki durumda da belirsiz yazım kilidi korunur, yeniden gönderme eylemi sunulmaz ve güncel kayıtları kontrol etmek yeni bir yazım oluşturmaz.
- Fazın özgül başarı ve red kanıtı: Portre ifade ve kırpması ile logo ve tanıtımın küçük kullanım ve güvenli alan sonuçları ayrı kanıtlanır; paket bu amaçları korur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tanıtım görselleri oyun içi piksel sanatının çözünürlük ve ölçek kuralına zorlanmaz.
- Kabul örnekleri: RAS-08. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tanıtım görselleri oyun içi piksel sanatının çözünürlük ve ölçek kuralına zorlanmaz.

## Further Notes

- Tek faz kaynağı: [`27-portrait-marketing-profile/phase-context.md`](../../workflow/27-portrait-marketing-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile, Subject Identity. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0014](../../adr/0014-scope-canonical-designs-by-visual-world.md)

**Kabul izlenebilirliği**

- [RAS-08](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
