# Değişmez Sürümlerle Seçici Düzeltme

## Problem Statement

Kullanıcı kabul edilmiş işi kaybetmeden tek bir kareyi, yönü, karoyu veya durumu değiştirir; yeni bileşim kesin birim sürümlerini sabitler. Sürümleme, seçici onarımın ve tekrar üretilebilir dışa aktarımın temelidir.

## Solution

Kullanıcı kabul edilmiş işi kaybetmeden tek bir kareyi, yönü, karoyu veya durumu değiştirir; yeni bileşim kesin birim sürümlerini sabitler.

Sürümleme, seçici onarımın ve tekrar üretilebilir dışa aktarımın temelidir. Değiştirilebilir birim ile onu kullanan bileşimin kimlikleri ayrı korunur.

Tek kare veya karo değiştiğinde eski Birim ve Birleşik Sürümler değişmez. Yeni bileşim hangi kesin birimi kullandığını kaydeder; eski birim global olarak yerini yenisi almış sayılmaz ve diğer bileşimlerdeki kullanımı korunur.

Tamamlanma kanıtı: Tek sorunlu birim düzeltilip yeni bileşim kurulduğunda eski bileşim ve ilgisiz birimler aynı kalır; Birim Sürümünün onayı Birleşik Sürümü kendiliğinden onaylamaz.

## User Stories

1. Bir kullanıcı olarak tek bir kare, yön, karo veya durumu düzenlediğimde yeni Birim Sürümü oluşturmak istiyorum; böylece mevcut sürümün içeriği değişmez kalır.
2. Bir kullanıcı olarak yeni Birleşik Sürümün içerdiği kesin Birim Sürümlerini seçmek istiyorum; böylece hangi birimin hangi bileşime girdiği bilinir.
3. Bir kullanıcı olarak tek sorunlu birimi değiştirip ilgisiz birimleri önceki sürümlerinde tutmak istiyorum; böylece seçici onarım gereksiz işi yeniden açmaz.
4. Bir kullanıcı olarak eski Birleşik Sürümün üyeliğinin yeni bileşimden etkilenmemesini istiyorum; böylece geçmiş üretim aynı kalır.
5. Bir kullanıcı olarak birimin yeni bileşimdeki değişimini yalnız o Birleşik Sürümün Bileşim Üyeliğinde görmek istiyorum; böylece eski birime küresel Yerini Yeni Sürüm Aldı durumu verilmez.
6. Bir kullanıcı olarak Birim Sürümü ile Birleşik Sürümü ayrı ayrı inceleyip onaylamak istiyorum; böylece birimin kabulü bileşimin kabulü sayılmaz.
7. Bir kullanıcı olarak her düzenlemenin kaynak Varlık Sürümünü koruyup yeni Aday Sürüm üretmesini istiyorum; böylece değişiklikler geriye dönük yazılmaz.

## Normatif gereksinimler

- **AST-06 — Bileşim Üyeliği:** Bir Birim Sürümünün daha yeni bir Birleşik Sürümde başka bir birimle değiştirilmesi, eski birime global “Yerini Yeni Sürüm Aldı” durumu vermez. Ürün değişimi kesin Birleşik Sürüm içindeki Bileşim Üyeliği olarak gösterir.
- **VER-01 — Değişmez sürümler:** Varlık Sürümü değiştirilemez. Bağımsız olarak değiştirilebilen kare, yön, karo ve durumlar Birim Sürümü olarak saklanır.


## Implementation Decisions

- **Birim Sürümünü seçici düzeltme:** Tek kare, yön, karo veya durum düzeltmesi yeni değişmez Birim Sürümü üretir. Eski birim ve ilgisiz birimler korunur.
- **Yeni Birleşik Sürümü kesin birimlerle kurma:** Yeni Birleşik Sürüm yalnız seçilen kesin Birim Sürümlerini sabitler; eski bileşim kalır. Bileşim Üyeliği eski birimi küresel olarak geçersiz kılmaz ve birim onayı bileşiği onaylamaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Yeni bileşim üyeliği eski birimi küresel olarak geçersiz kılmaz; her düzenleme kaynak sürümü yazmadan yeni Aday Sürüm oluşturur.

## Testing Decisions

- **Birincil test seam’i:** 8.1, RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Tek sorunlu birim düzeltilip yeni bileşim kurulduğunda eski bileşim ve ilgisiz birimler aynı kalır; Birim Sürümünün onayı Birleşik Sürümü kendiliğinden onaylamaz. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Yeni bileşim üyeliği eski birimi küresel olarak geçersiz kılmaz; her düzenleme kaynak sürümü yazmadan yeni Aday Sürüm oluşturur.
- Kabul örnekleri: 8.1, RAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Yeni bileşim üyeliği eski birimi küresel olarak geçersiz kılmaz; her düzenleme kaynak sürümü yazmadan yeni Aday Sürüm oluşturur.

## Further Notes

- Tek faz kaynağı: [`09-immutable-versioning/phase-context.md`](../../workflow/09-immutable-versioning/phase-context.md).
- Kanonik teknik adlar: Unit Version, Composite Version, Composition Membership. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`AST-06`](../../prd/03-project-and-asset-foundations.md) — Bileşim Üyeliği.
- [`VER-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Değişmez sürümler.

**İlgili mimari sınırlar**

- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
