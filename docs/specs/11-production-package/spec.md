# Üretim Paketi Hazırlama

## Problem Statement

Kullanıcı tek bir dış üretim denemesi için etkin proje kurallarını, hedefi ve korunacak özellikleri değişmez ve incelenebilir Üretim Paketinde bir araya getirir. Açık Varlık Kaydında bağlam, Görsel Dünya, Tema, ölçüler, Ana Tasarım ve iş hedefi birlikte görülebilir.

## Solution

Kullanıcı tek bir dış üretim denemesi için etkin proje kurallarını, hedefi ve korunacak özellikleri değişmez ve incelenebilir Üretim Paketinde bir araya getirir. Açık Varlık Kaydında bağlam, Görsel Dünya, Tema, ölçüler, Ana Tasarım ve iş hedefi birlikte görülebilir.

Paket etkin Üretim Bağlamı Kopyasını, hedef görev ve ölçüleri, kesin Ana Tasarımı, referans amaçlarını, korunacak ve değişecek özellikleri, dokunulmayacak birimleri ve beklenen çıktı yapısını sabitler. Eş kapsamlı çözülmemiş referans çatışması paket oluşumunu durdurur.

Tamamlanma kanıtı: Kullanıcı çelişkisiz, tek denemeye bağlı paketi inceleyip dış üretimde kullanır; paket ve bağlam kopyası sonradan değişmez.

## User Stories

1. Bir kullanıcı olarak tek harici deneme için değişmez Üretim Paketi hazırlamak istiyorum; böylece bir denemenin girdileri başka denemelerle karışmaz.
2. Bir kullanıcı olarak pakette kullanılacak etkin bağlamın kopyasını ve hedef görevi görmek istiyorum; böylece deneme hangi kurallara ve amaca dayandığını taşır.
3. Bir kullanıcı olarak hedef ölçüleri ve kesin Ana Tasarımı pakete bağlamak istiyorum; böylece çıktı boyutu ve kimlik dayanağı bellidir.
4. Bir kullanıcı olarak referansların kullanım amaçlarını pakette ayrı görmek istiyorum; böylece referansların hangi yönünün aktarılabileceği korunur.
5. Bir kullanıcı olarak korunacak, değiştirilecek ve kaçınılacak özellikleri belirtmek istiyorum; böylece üretim talebi mevcut tasarımı yanlışlıkla genişletmez.
6. Bir kullanıcı olarak değiştirilmeyecek birimleri ve beklenen çıktı yapısını sabitlemek istiyorum; böylece denemenin sınır ve teslim biçimi anlaşılır.
7. Bir kullanıcı olarak eş kapsamlı çözülmemiş referans çatışması varsa paketin oluşturulmasının durmasını istiyorum; böylece çelişki üretim girdisine gizlice taşınmaz.
8. Bir kullanıcı olarak paketi inceleyip talimatı harici üretim yüzeyinde kendim yazmak istiyorum; böylece Workbench üretim API'si veya otomatik sanat kararı gerektirmez.

## Normatif gereksinimler

- **IMP-02 — Üretim Paketi:** Sistem bu bilgileri tek bir harici üretim denemesi için değişmez ve incelenebilir Üretim Paketi içinde toplar. Paket şunları içerir:


## Implementation Decisions

- **Üretim Bağlamı Kopyasını pakete sabitleme:** Kullanıcı tek deneme için etkin bağlamı, hedefi, ölçüleri, Ana Tasarımı, referans rollerini ve beklenen çıktıyı değişmez Üretim Paketinde inceler.
- **Çatışan aktarım kuralıyla paketi durdurma:** Eş kapsamlı çözülmemiş referans çatışması gösterilir ve Üretim Paketi oluşmaz. Kullanıcı kuralı çözdükten sonra yeni kesin paket oluşturabilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.

## Testing Decisions

- **Birincil test seam’i:** 8.1 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı çelişkisiz, tek denemeye bağlı paketi inceleyip dış üretimde kullanır; paket ve bağlam kopyası sonradan değişmez. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.

## Further Notes

- Tek faz kaynağı: [`11-production-package/phase-context.md`](../../workflow/11-production-package/phase-context.md).
- Kanonik teknik adlar: Generation Package, Production Context Snapshot. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-02`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim Paketi.

**İlgili mimari sınırlar**

- [ADR 0013](../../adr/0013-make-reference-transfer-boundaries-deterministic.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
