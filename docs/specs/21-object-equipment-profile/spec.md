# Obje, Ekipman ve Durum Profilini Uygulama

## Problem Statement

Objeler, silahlar ve ekipmanlar durum ve yön aileleri olarak ortak ölçek, perspektif, malzeme, pivot ve sıralama davranışlarıyla incelenir. Bu profil obje ve ekipmanı bağımsız resimler yerine durum ve yön aileleri olarak ele alır.

## Solution

Objeler, silahlar ve ekipmanlar durum ve yön aileleri olarak ortak ölçek, perspektif, malzeme, pivot ve sıralama davranışlarıyla incelenir.

Bu profil obje ve ekipmanı bağımsız resimler yerine durum ve yön aileleri olarak ele alır. Kesin sözleşme yerleşim alanlarını ve kullanımdaki testi tanımlar.

Tamamlanma kanıtı: Durum kimlikleri ve sıralama noktaları roundtrip korunur; aile içi ölçek ile gerçek sahne yerleşimi kullanıcı kanıtına bağlanır.

## User Stories

1. Bir kullanıcı olarak objeleri, silahları ve ekipmanları bağımsız görseller yerine durum ve yön ailesi olarak düzenlemek istiyorum; böylece durumlar ortak kullanımlarında karşılaştırılır.
2. Bir kullanıcı olarak durumları ortak ızgara, perspektif, ölçek ve malzeme kurallarıyla yan yana incelemek istiyorum; böylece aile içi tutarsızlık görünür olur.
3. Bir kullanıcı olarak görsel merkezden ayrı zemin, pivot ve sıralama noktalarını incelemek istiyorum; böylece gerçek sahne yerleşimi değerlendirilebilir.
4. Bir kullanıcı olarak kapalı/açık veya sağlam/hasarlı gibi durum kimliklerini profil kapsamında tutmak istiyorum; böylece gerekli ve isteğe bağlı durumlar karışmaz.
5. Bir kullanıcı olarak objeyi proje ızgarasında, onaylı karakterle ve farklı zeminlerde denemek istiyorum; böylece ölçek ve yerleşim gerçek kullanıma yakın sınanır.
6. Bir kullanıcı olarak durum geçişi ve sabitleme noktası bilgisini doğrulamak istiyorum; böylece profil testi ve dışa aktarım aynı eşlemeyi kullanır.
7. Bir kullanıcı olarak her olası karakter-ekipman birleşimi için otomatik uyumluluk hükmü verilmemesini istiyorum; böylece desteklenmeyen kombinasyon kararı varmış gibi görünmez.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Durum ve Yön Ailesini Karşılaştırma:** Durumlar ve yönler ortak ölçek, perspektif, malzeme dili ve ayrışma açısından aile olarak incelenir. Kapalı, açık veya hasarlı gibi durumlar ve yönler tek aile içinde karşılaştırılır; gerekli durumlar ayrı Gerekli Öğeler Listesinde izlenir. Durum kimliği, yön ve sıralama bağlantısı paketlenip yeniden okunduğunda kaybolamaz.
- **Yerleşim ve Kullanım Noktalarını Sınama:** Doğal ölçü, pivot, zemin ve sıralama noktaları onaylı karakter, proje ızgarası ve farklı zeminlerle sınanır. Obje proje ızgarasında, onaylı karakterin yanında ve farklı zeminlerde denenir. Görsel merkez ile pivot, zemine oturma ve Y sıralama noktası ayrı tutulur; yerleşim kusuru kesin sürümde kullanıcıya gösterilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Her olası karakter ve ekipman birleşimi için otomatik uyumluluk hükmü üretilmez; bu ayrı bir özellik adayıdır.

## Testing Decisions

- **Birincil test seam’i:** RAS-02 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Durum kimlikleri ve sıralama noktaları roundtrip korunur; aile içi ölçek ile gerçek sahne yerleşimi kullanıcı kanıtına bağlanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Her olası karakter ve ekipman birleşimi için otomatik uyumluluk hükmü üretilmez; bu ayrı bir özellik adayıdır.
- Kabul örnekleri: RAS-02. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Her olası karakter ve ekipman birleşimi için otomatik uyumluluk hükmü üretilmez; bu ayrı bir özellik adayıdır.

## Further Notes

- Tek faz kaynağı: [`21-object-equipment-profile/phase-context.md`](../../workflow/21-object-equipment-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-02](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
