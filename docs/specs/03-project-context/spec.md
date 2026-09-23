# Proje Kurallarını Sürümleme ve Etkinleştirme

## Problem Statement

Sistem kullanıcı kararlarını kapsamı ve dayanağı belli kural önerilerine dönüştürür; yalnız kullanıcının doğruladığı çakışmasız sürüm üretimde yetkili olur. Yeni proje yalnız ad ve genel sanat yaklaşımıyla başlayabilir.

## Solution

Sistem kullanıcı kararlarını kapsamı ve dayanağı belli kural önerilerine dönüştürür; yalnız kullanıcının doğruladığı çakışmasız sürüm üretimde yetkili olur.

Yeni proje yalnız ad ve genel sanat yaklaşımıyla başlayabilir. Etkin kurallar işlem kapsamına göre çözülür ve sonraki üretimlerde yeniden sorulmadan kullanılabilir.

Tamamlanma kanıtı: Kullanıcı onayıyla oluşan etkin sürüm, çakışmasız kural zincirini ve üretime alınacak bağlam kopyasını aynı anlamla verir.

## User Stories

1. Bir kullanıcı olarak yeni projeyi yalnız adı ve genel sanat yaklaşımıyla başlatmak istiyorum; böylece ayrıntılı kurallar hazır olmadan çalışmaya başlayabilirim.
2. Bir kullanıcı olarak onaylanmış proje kurallarının kimliğini, kapsamını ve değerini yapılandırılmış Proje Bağlamında görmek istiyorum; böylece açıklayıcı metin yetkili kural sanılmaz.
3. Bir kullanıcı olarak kararlarımı ve gözlenen değişiklikleri Bağlam Önerisi olarak hazırlatmak istiyorum; böylece olası kural değişikliği mevcut etkin sürümden ayrı kalır.
4. Bir kullanıcı olarak her önerinin dayandığı Bağlam Sürümünü, ajan/model bilgisini, önerilen kuralları ve doğrulama sonucunu görmek istiyorum; böylece önerinin kaynağını ve geçerliliğini inceleyebilirim.
5. Bir kullanıcı olarak Bağlam Ajanı bulunmadığında yaygın kararlar için yapılandırılmış kontrollerin öneri hazırlamasını istiyorum; böylece ajan yokluğu doğrulanmış biçimli öneriyi engellemez.
6. Bir kullanıcı olarak ham context.md metnini yetkili kural düzenleme yolu olarak değiştirmemeyi istiyorum; böylece kurallar şema ve kaynak geçmişiyle yönetilir.
7. Bir kullanıcı olarak proje, Görsel Dünya, Tema, Varlık Ailesi, Varlık ve işlem kapsamındaki kuralların önceliğini incelemek istiyorum; böylece daha dar kapsamlı kuralın hangi kararı yönettiğini anlayabilirim.
8. Bir kullanıcı olarak aynı kural veya örtüşen kapsam üzerindeki öneri çatışmalarını çözmeden etkinleştirme yapamamayı istiyorum; böylece çelişkili kurallar üretime girmez.
9. Bir kullanıcı olarak geçersiz yapı, çözülmemiş kapsam veya referans çatışmasında etkinleştirmenin engellenmesini istiyorum; böylece doğrulanmamış set yetkili olmaz.
10. Bir kullanıcı olarak öneriyi inceleyip açıkça etkinleştirerek yeni Bağlam Sürümü oluşturmak istiyorum; böylece üretim yalnız benim kesinleştirdiğim kuralları tüketir.
11. Bir kullanıcı olarak üretim anında etkin Bağlam Sürümünün kullanılan kısmını Üretim Bağlamı Kopyasında sabitlemek istiyorum; böylece sonradan yapılan bağlam değişikliği geçmiş üretim girdisini değiştirmez.

## Normatif gereksinimler

- **CTX-01 — Yetkili proje bağlamı:** Proje Bağlamı, tek bir oyun projesinin onaylanmış görsel kurallarını, istisnalarını ve üretim kararlarını tutar. Kuralın kimliği, kapsamı ve değeri yapılandırılmış biçimde kaydedilir. `context.md` dosyasını ajanlar yönetir; kullanıcı ham metni düzenlemez.
- **CTX-02 — Bağlam önerisi:** Bağlam Ajanı, kullanıcı kararlarını ve gözlenen değişiklikleri sürümlü sözleşmeye uygun Bağlam Önerisi’ne dönüştürür. Öneri, dayandığı Bağlam Sürümü’nü, ajan/model bilgisini, önerilen kuralları ve doğrulama sonucunu kaydeder.
- **CTX-03 — Etkinleştirme kapısı:** Kullanıcı inceleyip etkinleştirmedikçe öneri bağlamın parçası olmaz; ajan kendi önerisini etkinleştiremez. Veri yapısı hatası, çakışan kapsam veya çözülmemiş referans çatışması etkinleştirmeyi engeller.
- **AUT-01 — Hazırlık ve kesinleştirme:** Hazırlık; kanıt, öneri veya taslak üretir. Kesinleştirme ise ürünün geçerli kaydını değiştirir.


## Implementation Decisions

- **Kural Değişikliği Önerme:** Kullanıcı kararları ve gözlenen değişiklikler, dayanak sürümü ve kanıtı belli yapılandırılmış bir Bağlam Önerisine dönüşür. Öneri taban Bağlam Sürümünü, ajan veya yapılandırılmış kontrolün kaynağını ve her ekleme, değiştirme ya da kaldırmanın dayanağını taşır. Serbest açıklama tek başına etkin kural değildir; ajan kullanılamadığında yapılandırılmış yaygın kararlar yine hazırlanabilir.
- **Kural Sürümünü Doğrulama ve Etkinleştirme:** Kapsam önceliği, açık istisnalar ve çakışmalar doğrulanır; yalnız kullanıcının onayladığı geçerli set yeni Etkin Bağlam Sürümü olur. Sistem önerinin dayandığı Bağlam Sürümünü güncel sürümle karşılaştırır. Bağımsız kural değişiklikleri anlamları korunarak uzlaştırılabilir; aynı kuralı veya kapsamı etkileyen değişiklikler kullanıcı çözmeden etkinleşmez. Kullanıcı geçerli öneriyi inceleyip etkinleştirir. Veri yapısı, aynı kapsam düzeyindeki çelişki ve referans sınırları doğrulanır; dar kapsamın geniş kapsamı geçmesi ile gerekçeli istisnanın kaynağı yeni sürümde izlenir. Palet, kontur ve benzeri kurallar sürümlü Stil Modüllerinde gruplanabilir. Başka projeye kopyalanan modül orada bağımsız Bağlam Önerisi olarak incelenir; kaynak projeyle canlı eşitlenmez. Bağlam Kuralı ve Bağlam Ajanı sözleşmelerinin tam sürümü korunur; bilinmeyen zorunlu alan veya ana sürüm etkinleştirmeyi durdurur. Göç eski sürümü yazmaz ve yeni sürüm kullanıcı etkinleştirmeden üretime girmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Ajan öneriyi etkinleştiremez; ham context.md metni kullanıcıya yetkili kural düzenleme yolu olarak açılmaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı onayıyla oluşan etkin sürüm, çakışmasız kural zincirini ve üretime alınacak bağlam kopyasını aynı anlamla verir. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Ajan öneriyi etkinleştiremez; ham context.md metni kullanıcıya yetkili kural düzenleme yolu olarak açılmaz.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Ajan öneriyi etkinleştiremez; ham context.md metni kullanıcıya yetkili kural düzenleme yolu olarak açılmaz.

## Further Notes

- Tek faz kaynağı: [`03-project-context/phase-context.md`](../../workflow/03-project-context/phase-context.md).
- Kanonik teknik adlar: Project Context, Context Proposal, Context Revision. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`CTX-01`](../../prd/03-project-and-asset-foundations.md) — Yetkili proje bağlamı.
- [`CTX-02`](../../prd/03-project-and-asset-foundations.md) — Bağlam önerisi.
- [`CTX-03`](../../prd/03-project-and-asset-foundations.md) — Etkinleştirme kapısı.
- [`AUT-01`](../../prd/03-project-and-asset-foundations.md) — Hazırlık ve kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0001](../../adr/0001-agent-maintained-project-context-is-authoritative.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
