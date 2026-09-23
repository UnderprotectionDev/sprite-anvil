# İçe Aktarma ve Kaynak Metadata Eşleme

## Problem Statement

Kullanıcı hedefli veya toplu görsel girdileri güvenle alır; desteklenen sidecar gerçeklerinden gelen önerileri alan bazında kesinleştirerek yetkili ilişkiye dönüştürür. Hedefli üretim sonucu ile hedefsiz toplu dosya farklı yetki düzeyindedir.

## Solution

Kullanıcı hedefli veya toplu görsel girdileri güvenle alır; desteklenen sidecar gerçeklerinden gelen önerileri alan bazında kesinleştirerek yetkili ilişkiye dönüştürür.

Hedefli üretim sonucu ile hedefsiz toplu dosya farklı yetki düzeyindedir. Sidecar bilgisi kaynak gerçeği sunar; varlık ailesi veya onay kararı vermez.

Tamamlanma kanıtı: Desteklenen JSON biçimlerinden aynı alan önerisi iki uygulama yüzeyinde üretilebilir; kullanıcı kararından sonra kesin ve izlenebilir Aday Sürüm oluşur.

## User Stories

1. Bir kullanıcı olarak açık bir üretim hedefi varken yüklediğim sonucu doğrudan o hedefin Aday Sürümü yapmak istiyorum; böylece bilinen ilişki kaybolmaz.
2. Bir kullanıcı olarak hedefsiz toplu dosyaların İçe Aktarma Gelen Kutusu Girdisi olarak saklanmasını istiyorum; böylece ilişkilendirilmemiş kopya onaylanabilir varlık sayılmaz.
3. Bir kullanıcı olarak desteklenen Aseprite ve TexturePacker JSON sidecar alanlarını kaynak değerleri ve tanılamalarıyla öneri olarak görmek istiyorum; böylece kaynak gerçekleri korunur.
4. Bir kullanıcı olarak tanınan kare, tag, slice, pivot, 9-slice ve palet alanlarını alan bazında incelemek istiyorum; böylece metadata tek toplu karar olarak sunulmaz.
5. Bir kullanıcı olarak sistemin kaynak metadata'dan Varlık Ailesi, üretim geçmişi, hak durumu veya onay uydurmamasını istiyorum; böylece öneri yetkili ilişki sayılmaz.
6. Bir kullanıcı olarak zorunlu alan çakışmalarını çözmeden eşlemeyi kesinleştirememek istiyorum; böylece çelişkili kaynak değerleri onaylanmış bilgi olmaz.
7. Bir kullanıcı olarak isteğe bağlı bilinmeyen alanı açıkça Bilinmiyor bırakmak istiyorum; böylece eksik metadata tahminle doldurulmaz.
8. Bir kullanıcı olarak eşlemeyi kesinleştirdiğimde kaynak metadata ile kendi kararımı ayrı izlemek istiyorum; böylece öneri ve yetkili sonuç ayırt edilebilir.
9. Bir kullanıcı olarak değişen sidecar içeriğinin önceki ilişkiyi değiştirmeyip yeni öneri oluşturmasını istiyorum; böylece kaynak güncellemesi geçmiş kesin kararı sessizce yazmaz.

## Normatif gereksinimler

- **IMP-04 — Gelen Kutusu yetkisi:** Belirli bir animasyon, yön, durum ya da başka hedef açıksa içe aktarılan sonuç doğrudan o hedefin Aday Sürümü olur. Hedef çalışma yoksa veya dosyalar bağlam dışından topluca eklenirse sistem yönetilen kopyayı ilişkilendirme bekleyen bir İçe Aktarma Gelen Kutusu Girdisi olarak saklar.


## Implementation Decisions

- **İçe Aktarma Gelen Kutusuna Alma:** Hedefi belirsiz dosyalar onaylanabilir varlık sayılmadan yönetilen kopya ve kaynak gerçekleriyle bekletilir. Açık hedefe gelen dosya aday sürüm olabilir; hedefsiz toplu dosya yalnız yönetilen İçe Aktarma Gelen Kutusu Girdisidir. Kullanıcı ilişkiyi kesinleştirene kadar bu girdi onaylanamaz ve dışa aktarılamaz.
- **Metadata Eşleme Önerisi Hazırlama:** Desteklenen Aseprite ve TexturePacker JSON alanları, kaynak değerleri ve çakışmalarıyla izlenebilir bir öneriye dönüşür. PNG veya düzenli görsel sayfasıyla gelen Aseprite ve TexturePacker JSON array/hash biçimleri dosya adına değil kök yapı ve zorunlu alanlara göre okunur. Kare kimliği ve dikdörtgeni zorunludur; süre, tag, slice, pivot, dokuz parça ve palet yalnız kaynakta varsa önerilir. Alanların kaynağı ile çakışması gösterilir; tanınmayan alan korunur, eksik geçmiş uydurulmaz.
- **Alan Bazında Eşleme Kesinleştirme:** Kullanıcı zorunlu çakışmaları çözer, isteğe bağlı bilinmeyenleri korur ve hedef kayıtta yeni Aday Sürüm oluşturur. Zorunlu alan çakışmasını kullanıcı alan bazında çözer; isteğe bağlı alan Bilinmiyor kalabilir. Kesin ilişki kaynak değerini kullanıcı kararından ayırır; değişen sidecar eski ilişkiyi yazmaz, yeni öneri üretir. Kaynak Metadata Eşleme sözleşmesinin tam sürümü öneriye yazılır. Bilinmeyen zorunlu alan veya ana sürüm kesinleştirmeyi durdurur; tanınmayan isteğe bağlı alan korunur. Sözleşme göçü eski öneriyi değiştirmeden yeni kayıt üretir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Yerel .aseprite dosyasını kayıpsız ayrıştırma veya dosya adından üretim geçmişi çıkarma taahhüdü yoktur.

## Testing Decisions

- **Birincil test seam’i:** Aynı PNG/sidecar özetlerini web ve masaüstü girişinden geçirip alan önerisini, kullanıcı kararını ve yeniden içe almada yeni öneriyi karşılaştırma; YAS-02 çelişki fixture’ı kullanma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Desteklenen JSON biçimlerinden aynı alan önerisi iki uygulama yüzeyinde üretilebilir; kullanıcı kararından sonra kesin ve izlenebilir Aday Sürüm oluşur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Yerel .aseprite dosyasını kayıpsız ayrıştırma veya dosya adından üretim geçmişi çıkarma taahhüdü yoktur.
- Kabul örnekleri: YAS-02, 8.1. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Yerel .aseprite dosyasını kayıpsız ayrıştırma veya dosya adından üretim geçmişi çıkarma taahhüdü yoktur.

## Further Notes

- Tek faz kaynağı: [`12-import-mapping/phase-context.md`](../../workflow/12-import-mapping/phase-context.md).
- Kanonik teknik adlar: Import Inbox Entry, Source Metadata Mapping Proposal. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-04`](../../prd/04-ingestion-lifecycle-and-quality.md) — Gelen Kutusu yetkisi.

**İlgili mimari sınırlar**

- [ADR 0009](../../adr/0009-managed-snapshots-are-provenance.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [YAS-02](../../prd/10-acceptance-scenarios.md)
- [8.1](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
