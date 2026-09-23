# Karo Seti, Arazi ve Doku Profilini Uygulama

## Problem Statement

Karo ve doku aileleri komşuluk, köşe, koridor, dolgu, tekrar ve kesin kenar eşleşmesi senaryolarında sorunlu birime kadar izlenebilir biçimde sınanır. Bu profil karo kimliği ve komşuluk kuralını gerçek boyanabilir örnek üzerinde sınar; dokunun tekrarı ayrı kullanım davranışıdır.

## Solution

Karo ve doku aileleri komşuluk, köşe, koridor, dolgu, tekrar ve kesin kenar eşleşmesi senaryolarında sorunlu birime kadar izlenebilir biçimde sınanır.

Bu profil karo kimliği ve komşuluk kuralını gerçek boyanabilir örnek üzerinde sınar; dokunun tekrarı ayrı kullanım davranışıdır.

Tamamlanma kanıtı: Zor komşuluk ve tekrar senaryoları sorunlu birime bağlanır; atlas alanı, terrain bağlantısı ve tekrar ayarı pakette korunur.

## User Stories

1. Bir kullanıcı olarak karo ailesini sabit sayıya veya tek atlas düzenine zorlanmadan tanımlamak istiyorum; böylece farklı set yapıları kendi düzenleriyle incelenebilir.
2. Bir kullanıcı olarak iç/dış köşe, kenar, koridor ve dolgu gibi zor komşulukları boyanabilir test haritasında sınamak istiyorum; böylece bağlantı hatası kullanım içinde görünür olur.
3. Bir kullanıcı olarak tekrar eden yüzey dokusunu karo komşuluğundan ayrı test etmek istiyorum; böylece iki farklı kullanım davranışı karıştırılmaz.
4. Bir kullanıcı olarak dokuyu 2×2, 3×3 ve kaydırmalı tekrarlarla incelemek istiyorum; böylece görünür birleşim ve tekrar izi bulunur.
5. Bir kullanıcı olarak matematiksel kenar eşleşmesini otomatik denetleyip göze çarpan tekrarları insan incelemesine sunmak istiyorum; böylece ölçülebilir ve görsel kanıt ayrılır.
6. Bir kullanıcı olarak sorunlu bağımsız karo veya bağlantı durumunu belirlemek istiyorum; böylece düzeltme tüm seti değiştirmeden hedeflenebilir.
7. Bir kullanıcı olarak atlas alanı, komşuluk eşlemesi ve doku tekrar ayarını pakette korumak istiyorum; böylece doğrulanan kullanım dışa aktarımda aynı anlamı taşır.
8. Bir kullanıcı olarak test haritasının tam seviye düzenleyicisi olmamasını istiyorum; böylece profil testi kapsamı olduğundan geniş sunulmaz.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Karo Komşuluklarını Test Haritasında Sınama:** İç ve dış köşe, dar koridor, dolgu, keskin geçiş ve rastgele yerleşim sorunlu karo veya bağlantıya kadar izlenir. Atlas yanında boyanabilir test haritası köşe, kenar, dar koridor, tek arazi dolgusu ve rastgele kombinasyonları gösterir. Hatalı komşuluk veya geçiş ilgili karo kimliğine bağlanır; kesin kenar eşleşmesi otomatik denetlenebilir.
- **Kesintisiz Doku Tekrarını İnceleme:** Dokular 2×2, 3×3 ve kaydırmalı tekrarda kesin kenar eşleşmesi ve göze çarpan tekrar açısından değerlendirilir. Doku ikiye iki, üçe üç ve kaydırmalı tekrar düzeninde incelenir. Matematiksel kenar eşleşmesi ayrı sonuç verir; hâlâ göze çarpan tekrar insan incelemesine kalır ve doku tekrar ayarı pakete taşınır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.

## Testing Decisions

- **Birincil test seam’i:** RAS-05 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Zor komşuluk ve tekrar senaryoları sorunlu birime bağlanır; atlas alanı, terrain bağlantısı ve tekrar ayarı pakette korunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.
- Kabul örnekleri: RAS-05. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Karo seti sabit karo sayısına veya tek şablona zorlanmaz; test haritası tam seviye düzenleyicisi değildir.

## Further Notes

- Tek faz kaynağı: [`24-tileset-texture-profile/phase-context.md`](../../workflow/24-tileset-texture-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile, Unit Version. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-05](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
