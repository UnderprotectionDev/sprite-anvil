# Son Dokunuş Piksel Düzenleme

## Problem Statement

Kullanıcı mevcut bir sürümdeki küçük piksel, palet, şeffaflık, hizalama ve kare yapısı sorunlarını kaynağı bozmadan giderip yeni Aday Sürüm oluşturur. Düzenleyici dar kapsamlı son dokunuşları ve yapısal kare düzeltmelerini destekler.

## Solution

Kullanıcı mevcut bir sürümdeki küçük piksel, palet, şeffaflık, hizalama ve kare yapısı sorunlarını kaynağı bozmadan giderip yeni Aday Sürüm oluşturur.

Düzenleyici dar kapsamlı son dokunuşları ve yapısal kare düzeltmelerini destekler. Çalışma taslağı ile kabul edilen Aday Sürüm birbirinden ayrılır.

Tamamlanma kanıtı: Kullanıcı bir piksel veya kare kusurunu kaynak ve ilgisiz birimleri değiştirmeden düzeltir; üretime yönlendirdiği onarım yeni paket ve aday döngüsüne girer.

## User Stories

1. Bir kullanıcı olarak mevcut Varlık veya Birim Sürümünden Son Dokunuş Piksel Düzenleyicisini açmak istiyorum; böylece değişikliği doğru kaynak ve aile bağlamında yapabilirim.
2. Bir kullanıcı olarak piksel kalemi, silgi, renk seçici, çizgi ve kesin renk eşleşmeli doldurmayı kullanmak istiyorum; böylece küçük düzeltmeler deterministik olur.
3. Bir kullanıcı olarak seçim, kesme, kopyalama, yapıştırma, piksele oturan taşıma, çevirme ve 90 derece döndürme araçlarını kullanmak istiyorum; böylece ızgara korunarak yapısal düzeltme yapabilirim.
4. Bir kullanıcı olarak kırpma, tuval ölçüsü ve tam sayı ölçeklemeyi en yakın komşuyla düzenlemek istiyorum; böylece mantıksal pikseller yumuşatılmaz.
5. Bir kullanıcı olarak palet dışı renkleri ve toplu renk değişikliğinin etkileyeceği piksel sayısını önizlemek istiyorum; böylece palet düzeltmesi ölçülebilir ve geri alınabilir olur.
6. Bir kullanıcı olarak doğal 1× boyutu, tam sayı yakınlaştırmayı ve farklı şeffaflık arka planlarını birlikte görmek istiyorum; böylece hem piksel ayrıntısını hem gerçek boyut görünümünü denetleyebilirim.
7. Bir kullanıcı olarak görsel sayfası için hücre boyutu, satır, sütun, ofset, boşluk ve okuma sırasını girip dilimlemeyi önizlemek istiyorum; böylece kaynak dosya değişmeden doğru kare sınırlarını seçebilirim.
8. Bir kullanıcı olarak kareleri eklemek, çoğaltmak, silmek, değiştirmek ve sıralamak; kare başına süre, ofset ve dönüş noktası düzenlemek istiyorum; böylece animasyon yapısını hedefli biçimde onarabilirim.
9. Bir kullanıcı olarak önceki/sonraki kareyi, zemin çizgisini ve dönüş noktasını karşılaştırmak istiyorum; böylece hizalama hatasını ilgili karede düzeltebilirim.
10. Bir kullanıcı olarak koru işaretli karelerin sessizce değişmesini engellemek istiyorum; böylece onaylı komşu içerik üretim veya düzenleme sırasında korunur.
11. Bir kullanıcı olarak farkları yan yana, üst üste veya durdurabildiğim geçişle görüp değişen piksel ve kareleri incelemek istiyorum; böylece düzenlemenin etkisi yalnız renkle anlatılmaz.
12. Bir kullanıcı olarak görseli değiştirmeyen ok, bölge, çizgi ve notları yeni Üretim Paketine eklemek istiyorum; böylece üretim gerektiren onarım hedefi ve korunacak birimler açık kalır.
13. Bir kullanıcı olarak harici üretim sonucunu mevcut taslağın üstüne yazmadan karşılaştırılabilir seçenek olarak almak ve kabulümle yeni Aday Sürüm oluşturmak istiyorum; böylece kaynak ve geçmiş sürümler korunur.
14. Bir kullanıcı olarak çalışma taslağını kurtarılabilir tutup kesinleştirdiğimde tek değişmez Aday Sürüm oluşturmak istiyorum; böylece taslak yetkili sürümle karıştırılmaz.
15. Bir kullanıcı olarak tam çizim paketi, katman birleştirme, serbest açılı dönüş veya iskelet animasyonu beklememek istiyorum; böylece düzenleyicinin dar kapsamı anlaşılır kalır.

## Normatif gereksinimler

- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.
- PRD 06-scene-quality-and-pixel-editor.md §4.11 bölümü ayrıca bu fazın davranışını belirler.

## Implementation Decisions

- **Deterministik Piksel ve Palet Düzeltme:** Piksel ızgarasını koruyan dar araçlarla yapılan değişiklikler önizlenir, geri alınabilir ve kaynak dosyadan ayrı tutulur. Mantıksal piksel ızgarasını koruyan dar araçlar renk, palet, şeffaflık ve hizalama düzeltmesini karşılaştırmalı önizler. Geri alma çalışma taslağını etkiler; kabul edilen değişiklik kaynak dosyayı değiştirmek yerine yeni Aday Sürüm oluşturur.
- **Kare ve Görsel Sayfası Yapısını Düzenleme:** Dilimleme, sıra, süre, ofset, pivot, hücre ve bileşim değişiklikleri yalnız etkilenen birimleri yenileyerek sürümlenir. Kare dilimleme, sıra, süre, ofset ve pivot düzenlemeleri etkilenen Birim Sürümlerini yeniden kurar. Yeni Birleşik Sürüm bu birimleri sabitler; seçilmemiş kareler ve önceki görsel sayfası korunur.
- **Üretimle Seçici Düzeltme Hazırlama:** Yeniden çizim gereken bölge, sorun notu ve korunacak birimler yeni Üretim Paketine aktarılır; dönen seçenek taslağı sessizce ezmez. Çizim gerektiren bölge ve korunacak birimler yeni Üretim Paketine açık kısıt olarak aktarılır. Gelen alternatif mevcut taslağı veya onaylı birimi otomatik değiştirmez; kullanıcı yeni sonucu ayrıca içe alıp inceler.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tam çizim paketi, katman birleştirme veya iskelet animasyonu bu çalışma alanının sonucu değildir.

## Testing Decisions

- **Birincil test seam’i:** 8.1, RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Kullanıcı bir piksel veya kare kusurunu kaynak ve ilgisiz birimleri değiştirmeden düzeltir; üretime yönlendirdiği onarım yeni paket ve aday döngüsüne girer. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tam çizim paketi, katman birleştirme veya iskelet animasyonu bu çalışma alanının sonucu değildir.
- Kabul örnekleri: 8.1, RAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tam çizim paketi, katman birleştirme veya iskelet animasyonu bu çalışma alanının sonucu değildir.

## Further Notes

- Tek faz kaynağı: [`29-pixel-editor/phase-context.md`](../../workflow/29-pixel-editor/phase-context.md).
- Kanonik teknik adlar: Last-Mile Pixel Editor, Working Draft. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.
- [PRD §4.11](../../prd/06-scene-quality-and-pixel-editor.md) — bu alt bölümde ayrı gereksinim kimliği yok; kapsamı doğrudan bölüm metni belirler.

**İlgili mimari sınırlar**

- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
