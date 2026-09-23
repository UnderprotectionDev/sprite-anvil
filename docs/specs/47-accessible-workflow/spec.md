# Temel Üretim Akışını Erişilebilir Kılma

## Problem Statement

Kullanıcı web ve masaüstünde temel üretim akışını klavye ve yardımcı teknolojiyle tamamlayabilir. İnceleme, düzenleme, kalite, onay ve dışa aktarımın durumu yalnız renk veya hareket üzerinden aktarılmaz.

## Solution

Kullanıcı web ve masaüstünde temel üretim akışını klavye ve yardımcı teknolojiyle tamamlayabilir.

İnceleme, düzenleme, kalite, onay ve dışa aktarımın durumu yalnız renk veya hareket üzerinden aktarılmaz.

Tamamlanma kanıtı: Temel üretim akışı webde WCAG 2.2 AA, masaüstünde eşdeğer klavye ve yardımcı teknoloji kabulünü geçer.

## User Stories

1. Bir kullanıcı olarak temel üretim akışını webde WCAG 2.2 AA düzeyinde tamamlamak istiyorum; böylece erişilebilir yol ana ürün akışında bulunur.
2. Bir kullanıcı olarak aynı akışı masaüstünde klavye ve yardımcı teknolojiyle tamamlamak istiyorum; böylece yüzey değişse de görev erişilebilir kalır.
3. Bir kullanıcı olarak görünür odak ve ekran okuyucu adlarını görmek istiyorum; böylece hangi denetimde olduğumu anlayıp klavyeyle gezebilirim.
4. Bir kullanıcı olarak inceleme, bağlam uygunluğu, kalite, kayıt, hata ve uyarı durumlarını metin ve durum bildirimiyle öğrenmek istiyorum; böylece anlam yalnız renge bağlı olmaz.
5. Bir kullanıcı olarak görsel farkları yalnız renkle sunulmayan eşdeğer biçimde incelemek istiyorum; böylece renk algısı görev bilgisini kaybettirmez.
6. Bir kullanıcı olarak animasyon ve yanıp sönme önizlemesini durdurmak ve azaltılmış hareket tercihimi kullanmak istiyorum; böylece hareket içeriği erişimi engellemez.
7. Bir kullanıcı olarak piksel, karo ve sahne görevlerini klavyeyle veya erişilebilir özellik paneliyle tamamlamak istiyorum; böylece görsel çalışma araçlarının temel işleri erişilebilir kalır.
8. Bir kullanıcı olarak erişilebilirlik kapsamının temel iş akışını kapsadığını, tam oyun erişilebilirliği sertifikası iddiası olmadığını bilmek istiyorum; böylece kabul sınırı doğru anlaşılır.

## Normatif gereksinimler

- **OPS-04 — Erişilebilir temel akış:** Web uygulamasındaki temel üretim akışı WCAG 2.2 AA düzeyini karşılamalıdır. Masaüstü uygulamasında aynı akış için eşdeğer klavye erişimi, görünür odak, ekran okuyucu adı ve durum bildirimi sağlanır.


## Implementation Decisions

- **Karar ve Durumları Erişilebilir Sunma:** İnceleme, uygunluk, kalite, kayıt, hata ve uyarı anlamları ad, metin ve durum bildirimiyle anlaşılır. Odak görünürdür; web WCAG 2.2 AA, masaüstü aynı akışta eşdeğer klavye ve ekran okuyucu sonucunu sağlar.
- **Görsel Çalışma Araçlarına Eşdeğer Yol Sağlama:** Piksel, karo ve sahne görevleri klavye veya erişilebilir özellik paneliyle tamamlanır. Animasyon durdurulabilir; azaltılmış hareket tercihinde oynatma ve geçişler görevi anlaşılmaz kılmaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Erişilebilir görev yolu tam oyun erişilebilirliği sertifikası anlamına gelmez.

## Testing Decisions

- **Birincil test seam’i:** Gerçek web ve Tauri temel akışını klavye ve ekran okuyucu durumlarıyla dolaşma; durdurulabilir oynatma ve azaltılmış hareket örneklerini doğrulama.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Temel üretim akışı webde WCAG 2.2 AA, masaüstünde eşdeğer klavye ve yardımcı teknoloji kabulünü geçer. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Erişilebilir görev yolu tam oyun erişilebilirliği sertifikası anlamına gelmez.
- Kabul örnekleri: 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Erişilebilir görev yolu tam oyun erişilebilirliği sertifikası anlamına gelmez.

## Further Notes

- Tek faz kaynağı: [`47-accessible-workflow/phase-context.md`](../../workflow/47-accessible-workflow/phase-context.md).
- Kanonik teknik adlar: Core Production Lifecycle. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`OPS-04`](../../prd/08-platform-and-operations.md) — Erişilebilir temel akış.

**İlgili mimari sınırlar**

- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
