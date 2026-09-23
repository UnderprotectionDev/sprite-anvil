# Motor Bağımsız Dışa Aktarım Paketi Üretme

## Problem Statement

Kullanıcı kesin varlık, bağlam, kalite ve profil sürümlerini sabitleyen deterministik, motor bağımsız bir paket üretir; paket ağ olmadan doğrulanabilir. Motor bağımsız paket teslimatın temel veri sözleşmesidir.

## Solution

Kullanıcı kesin varlık, bağlam, kalite ve profil sürümlerini sabitleyen deterministik, motor bağımsız bir paket üretir; paket ağ olmadan doğrulanabilir.

Motor bağımsız paket teslimatın temel veri sözleşmesidir. Profil sürümü, seçimler ve tam kanıt geçmişi aynı paket kimliğinde sabitlenir.

Tamamlanma kanıtı: Aynı girdiler aynı paketi üretir; web ve masaüstünde yeniden okunan manifest ile çevrimdışı doğrulayıcı aynı bütünlük sonucuna ulaşır.

## User Stories

1. Bir kullanıcı olarak Oyun Motorundan Bağımsız Paket biçiminde temel teslimat çıktısı oluşturmak istiyorum; böylece paket belirli bir motor projesine bağlı olmaz.
2. Bir kullanıcı olarak kesin bağlamı, gerekli listeyi, birim ve birleşik sürümleri, kalite kanıtını, istisnaları ve profil revizyonunu pakette sabitlemek istiyorum; böylece paket girdileri sonradan değişmez.
3. Bir kullanıcı olarak seçilen Dışa Aktarım Profili ve varsa Doğrulanmış Motor Bağdaştırıcısı sürümünü pakete bağlamak istiyorum; böylece dosya düzeni ve eşleme sürümü belirgin olur.
4. Bir kullanıcı olarak aynı kesin girdilerden deterministik paket elde etmek istiyorum; böylece tekrar oluşturma aynı içerik anlamını korur.
5. Bir kullanıcı olarak manifest, dosya özetleri ve kayıt ilişkilerini yeniden okuyarak bütünlüğü doğrulamak istiyorum; böylece paket içeriği ve kaydı eşleşir.
6. Bir kullanıcı olarak Paket Doğrulama Kitini şema, checksum listesi, README ve çalıştırılamayan örneklerle almak istiyorum; böylece paket ağ olmadan doğrulanabilir.
7. Bir kullanıcı olarak Workbench ve ayrı doğrulayıcının çevrimdışı aynı bütünlük sonucunu vermesini istiyorum; böylece doğrulama uygulamaya özgü kalmaz.
8. Bir kullanıcı olarak kesin paket oluşturmanın atomik ve yinelenmeye dayanıklı olmasını istiyorum; böylece yarım veya tekrar gönderilmiş işlem ikinci paket üretmez.

## Normatif gereksinimler

- **EXP-02 — Motor bağımsız ve değişmez paket:** Oyun Motorundan Bağımsız Paket, ürünün temel dışa aktarım biçimidir. Her Dışa Aktarım Paketi değişmezdir.
- **OPS-02 — Atomik ve idempotent kesinleştirme:** Yetkili kayıt oluşturan işlemler kısmi başarı gösteremez ve aynı idempotency anahtarıyla yinelendiğinde ikinci kesin kayıt üretemez.


## Implementation Decisions

- **Dışa Aktarım Profilini Sürümleme:** Yerleşim, padding, trim, ölçek, biçim ve metadata eşlemeleri deterministik profil sürümünde sabitlenir. Profil yerleşim, padding, trim, ölçek, dosya biçimi, adlandırma ve metadata alanlarının birimlerini sabitler. Değişiklik yeni profil sürümü üretir; aynı girdiler, profil ve bağdaştırıcı sürümü aynı içerik özetlerini vermelidir. Dışa Aktarım Profili tam sözleşme sürümünü taşır. Bilinmeyen ana sürüm veya zorunlu alan yeni paket oluşturmayı durdurur; isteğe bağlı alan korunur. Profil göçü eski profili yazmadan yeni sürüm oluşturur.
- **Değişmez Paketi Oluşturma:** Seçili dosyalar, oyun içi bilgiler, bağlam, sürümler ve kanıtlar tek değişmez Dışa Aktarım Paketinde korunur. Kullanıcının başlattığı paket, özel profili olmayan Genel Varlık Desteği alan görselleri de türe özel engel uydurmadan kapsar; kesin bağlamı, Gerekli Öğeler Listesini, birim ve bileşim sürümlerini, üretim ve hak kanıtını, kalite kanıtını, istisnaları ve veri yapısı sürümünü manifestte sabitler. Son paket işareti değişebilir; tarihsel paket ve içeriği değişmez.
- **Paketi Çevrimdışı Doğrulama:** Eşleşen şema, checksum listesi, README ve çalıştırılamayan örnekler Workbench ve ayrı doğrulayıcıda aynı sonucu verir. Doğrulama kiti aynı ana sürümde şema, deterministik dosya özetleri, README ve çalıştırılamayan örnek eşlemeler taşır. Workbench ile ayrı sürümlü doğrulayıcı ağ olmadan şema, özet, yol tekilliği ve kayıt bağlantılarında aynı sonucu verir. Paket Manifesti ve Doğrulama Kiti tam sözleşme sürümlerini taşır. Bilinmeyen zorunlu alan veya ana sürüm, çelişen README ya da eksik dosya bütünlük hatasıdır; geçmiş paket göçte yerinde değiştirilmez.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Paket proje arşivi veya oyun motoru projesi değildir; çalıştırılabilir kurucu ve yetki taşıyan ajan talimatı içermez.

## Testing Decisions

- **Birincil test seam’i:** Aynı kesin girdi ve Export Profile ile iki paket üretip manifest ve checksum eşitliğini, sonra bozuk dosyayı Workbench ile ayrı çevrimdışı doğrulayıcıda aynı red sonucuyla sınama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Aynı girdiler aynı paketi üretir; web ve masaüstünde yeniden okunan manifest ile çevrimdışı doğrulayıcı aynı bütünlük sonucuna ulaşır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Paket proje arşivi veya oyun motoru projesi değildir; çalıştırılabilir kurucu ve yetki taşıyan ajan talimatı içermez.
- Kabul örnekleri: 8.1, YAS-03. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Paket proje arşivi veya oyun motoru projesi değildir; çalıştırılabilir kurucu ve yetki taşıyan ajan talimatı içermez.

## Further Notes

- Tek faz kaynağı: [`37-export-bundles/phase-context.md`](../../workflow/37-export-bundles/phase-context.md).
- Kanonik teknik adlar: Export Profile, Engine-Neutral Bundle, Package Verification Kit. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-02`](../../prd/07-export.md) — Motor bağımsız ve değişmez paket.
- [`OPS-02`](../../prd/08-platform-and-operations.md) — Atomik ve idempotent kesinleştirme.

**İlgili mimari sınırlar**

- [ADR 0004](../../adr/0004-engine-neutral-export-with-godot-first.md)
- [ADR 0011](../../adr/0011-quality-waivers-are-version-specific.md)
- [ADR 0021](../../adr/0021-keep-repeat-delivery-one-way-divergence-safe-and-static.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [YAS-03](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
