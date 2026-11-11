# Godot Motor Çıktısı Üretme

## Problem Statement

Kullanıcı motor bağımsız paketten desteklenen Godot sürümüne uygun çıktı alır; kare, pivot, zamanlama, olay ve geçerli karo veya arayüz alanları referans projede aynı davranışı korur. Motor bağdaştırıcısı kanonik paketin üstünde ayrı kullanıcı sonucudur.

## Solution

Kullanıcı motor bağımsız paketten desteklenen Godot sürümüne uygun çıktı alır; kare, pivot, zamanlama, olay ve geçerli karo veya arayüz alanları referans projede aynı davranışı korur.

Motor bağdaştırıcısı kanonik paketin üstünde ayrı kullanıcı sonucudur. Desteklenen Godot sürümlerinde kare alanı, pivot, süre, olay, doku ve geçerli karo ya da arayüz ayarı korunur.

Tamamlanma kanıtı: Aynı paket ve bağdaştırıcı sürümü aynı Godot çıktısını üretir; yayımlanan desteklenen motor sürümleri sürdürülen referans proje sözleşmesini geçer.

## User Stories

1. Bir kullanıcı olarak değişmez motor bağımsız paketten desteklenen Godot sürümüne uygun ayrı çıktı üretmek istiyorum; böylece temel paket motor bağdaştırıcısından bağımsız kalır.
2. Bir kullanıcı olarak kare alanı, pivot, süre ve animasyon olaylarının Godot çıktısında korunmasını istiyorum; böylece referans projedeki hareket kaynak paketle aynı anlama gelir.
3. Bir kullanıcı olarak doku yanında geçerli karo ve arayüz alanlarının desteklenen çıktıya eşlenmesini istiyorum; böylece yalnız profilin tanımladığı oyun bilgisi taşınır.
4. Bir kullanıcı olarak aynı paket ve bağdaştırıcı sürümünün aynı çıktıyı üretmesini istiyorum; böylece motor çıktısı tekrarlanabilir olur.
5. Bir kullanıcı olarak desteklenen Godot sürümlerinde çıktıyı referans projeyle sınamak istiyorum; böylece yayımlanan sürüm aralığı somut kanıta dayanır.
6. Bir kullanıcı olarak Godot çıktısını Workbench kaynağı değil paket üstünde ayrı sonuç olarak tutmak istiyorum; böylece motor projesi yetkili kayıt haline gelmez.
7. Bir kullanıcı olarak bu bağdaştırıcı kapsamının Unity doğrulaması veya sürekli proje eşitlemesi vaat etmemesini istiyorum; böylece destek sınırı açık kalır.

## Normatif gereksinimler

- **EXP-02 — Motor bağımsız ve değişmez paket:** Oyun Motorundan Bağımsız Paket, ürünün temel dışa aktarım biçimidir. Her Dışa Aktarım Paketi değişmezdir.


## Implementation Decisions

- **Godot Motor Çıktısı Üretme:** Kullanıcı motor bağımsız paketten desteklenen Godot sürümüne uygun çıktı alır; kare, pivot, zamanlama, olay ve geçerli karo veya arayüz alanları referans projede aynı davranışı korur. Motor bağdaştırıcısı kanonik paketin üstünde ayrı kullanıcı sonucudur. Desteklenen Godot sürümlerinde kare alanı, pivot, süre, olay, doku ve geçerli karo ya da arayüz ayarı korunur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Godot projesi Workbench’in kaynak gerçeği değildir; Unity doğrulaması bu ilk zorunlu bağdaştırıcının kapsamına girmez.

## Testing Decisions

- **Birincil test seam’i:** Sabit Engine-Neutral Bundle çıktısını desteklenen Godot referans projesine yükleyip kare, zaman, olay ve pivot davranışını bağdaştırıcı sürümüyle karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Sözleşme ve örnekler: Bağdaştırıcı saf `buildGodotOutput` ile saklı pakette sabitlenmiş oyun verisinden (manifest 1.1.0 `engineData`: animasyonlar, kare bölgeleri, süreler, pivotlar, olaylar, karo ve arayüz verisi) isteğe bağlı türetilir; hiçbir şey saklanmaz. Testler: [`godot-output.test.ts`](../../../packages/api/src/godot-output.test.ts) (determinizm, eşleme, karo/arayüz yalnız veri varsa, red yolları, deterministik zip), [`godot-golden.test.ts`](../../../packages/api/src/godot-golden.test.ts) (her zaman çalışan statik altın çıktı karşılaştırması ve `GODOT_BIN` ile başsız Godot 4.3–4.5 referans projesi; ikili yoksa nedeni yazılarak atlanır), [`export-bundles.test.ts`](../../../apps/server/src/features/export-bundles/server/tests/export-bundles.test.ts) (`exportBundles.godotOutput` yolu, saklı paket, başka proje ve uyumsuz bağdaştırıcı), [`export-bundle-source-reader.test.ts`](../../../apps/server/src/features/export-bundles/server/tests/export-bundle-source-reader.test.ts) (oyun verisinin oluşturulurken sabitlenmesi) ve [`godot-output-panel.test.tsx`](../../../apps/web/src/features/export-bundles/ui/components/godot-output-panel.test.tsx) ("Create Godot output" eylemi). Tam kullanıcı yolu e2e'si veritabanı gerektirir ve henüz yazılmadı.
- Desteklenen aralık Godot 4.3, 4.4 ve 4.5'tir; her sürüm altın projede ayrı çalıştırılmadıkça yayımlanan aralık sayılmaz.
- Fazın özgül başarı ve red kanıtı: Aynı paket ve bağdaştırıcı sürümü aynı Godot çıktısını üretir; yayımlanan desteklenen motor sürümleri sürdürülen referans proje sözleşmesini geçer. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Godot projesi Workbench’in kaynak gerçeği değildir; Unity doğrulaması bu ilk zorunlu bağdaştırıcının kapsamına girmez.
- Kabul örnekleri: 8.1, RAS-01, RAS-05, RAS-07. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Godot projesi Workbench’in kaynak gerçeği değildir; Unity doğrulaması bu ilk zorunlu bağdaştırıcının kapsamına girmez.

## Further Notes

- Tek faz kaynağı: [`38-godot-output/phase-context.md`](../../workflow/38-godot-output/phase-context.md).
- Kanonik teknik adlar: Verified Engine Adapter. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`EXP-02`](../../prd/07-export.md) — Motor bağımsız ve değişmez paket.

**İlgili mimari sınırlar**

- [ADR 0004](../../adr/0004-engine-neutral-export-with-godot-first.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-05](../../prd/10-acceptance-scenarios.md)
- [RAS-07](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
