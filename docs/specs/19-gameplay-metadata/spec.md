# Oyun İçi Bilgileri Yönetme

## Problem Statement

Kullanıcı görsel varlığa bağlı pivot, zemin, sıralama, efekt başlangıcı, çarpışma alanı ve olay bilgilerini yazar veya içe aktarıp inceler. Bilgiler kesin kare ve varlık sürümüyle ilişkilendirilir; sahne önizlemesi ve dışa aktarım aynı incelenmiş anlamı kullanır.

## Solution

Kullanıcı görsel varlığa bağlı pivot, zemin, sıralama, efekt başlangıcı, çarpışma alanı ve olay bilgilerini yazar veya içe aktarıp inceler.

Bilgiler kesin kare ve varlık sürümüyle ilişkilendirilir; sahne önizlemesi ve dışa aktarım aynı incelenmiş anlamı kullanır.

Tamamlanma kanıtı: Aynı kesin sürümün incelenmiş oyun bilgileri sahnede görünür ve paket yeniden okumasında kaybolmaz.

## User Stories

1. Bir kullanıcı olarak pivot, zemin, sıralama, efekt başlangıcı, çarpışma alanı ve olay bilgisini yazmak veya desteklenen kaynaktan içe almak istiyorum; böylece görselin oyun içi anlamı açıkça kaydedilir.
2. Bir kullanıcı olarak Oyun İçi Bilgileri kesin kareye ve Varlık Sürümüne bağlamak istiyorum; böylece metadata hangi görüntü ve sürüm için geçerli olduğu belli olur.
3. Bir kullanıcı olarak bu bilgileri görselin üzerinde katman olarak incelemek istiyorum; böylece yerleşim ilişkisini görsel bağlamında değerlendirebilirim.
4. Bir kullanıcı olarak metadata'yı düzenleme ve paket yeniden okumasında aynı ilişkiyle korumak istiyorum; böylece roundtrip sırasında oyun içi anlam kaybolmaz.
5. Bir kullanıcı olarak çarpışma bilgisini ben yazmak veya içe aktarmak istiyorum; böylece ürün görsel alfa değerinden yetkili fizik bilgisi çıkarmaz.
6. Bir kullanıcı olarak profilin hangi metadata alanını desteklediğini ve nasıl dışa aktardığını görmek istiyorum; böylece kayıt ve paket aynı sözleşme anlamını taşır.
7. Bir kullanıcı olarak metadata eksik veya kare bağlantısı geçersiz olduğunda sorunu kesin sürüm üzerinde görebilmek istiyorum; böylece eksik bilgi tamamlanmış oyun verisi sanılmaz.

## Normatif gereksinimler

- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.
- PRD 06-scene-quality-and-pixel-editor.md §4.10 bölümü ayrıca bu fazın davranışını belirler.

## Implementation Decisions

- **Oyun İçi Bilgileri Yazma ve Eşleme:** Kullanıcının girdiği veya kaynak metadata’dan kesinleştirdiği alanlar ilgili kareye ve kullanım bağlamına bağlanır. Hitbox, hurtbox, collision, pivot ve olay alanları görsel şeffaflıktan yetkili gerçek olarak çıkarılmaz; eksik isteğe bağlı alan Bilinmiyor kalabilir.
- **Bilgileri İnceleme ve Koruma:** Kullanıcı bilgi katmanlarını görselin üzerinde inceler ve düzenleme ile paket yeniden okumasında bağlantı kaybını görür. Kare kimliği veya zorunlu bağlantının kaybolması bütünlük hatasıdır; incelenmiş isteğe bağlı alanlar paket ve yeniden okuma boyunca korunur.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Ürün görsel alfa değerinden oyun fiziği veya yetkili çarpışma bilgisi üretmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-02 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Aynı kesin sürümün incelenmiş oyun bilgileri sahnede görünür ve paket yeniden okumasında kaybolmaz. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Ürün görsel alfa değerinden oyun fiziği veya yetkili çarpışma bilgisi üretmez.
- Kabul örnekleri: RAS-01, RAS-02. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Ürün görsel alfa değerinden oyun fiziği veya yetkili çarpışma bilgisi üretmez.

## Further Notes

- Tek faz kaynağı: [`19-gameplay-metadata/phase-context.md`](../../workflow/19-gameplay-metadata/phase-context.md).
- Kanonik teknik adlar: Gameplay Metadata. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.
- [PRD §4.10](../../prd/06-scene-quality-and-pixel-editor.md) — bu alt bölümde ayrı gereksinim kimliği yok; kapsamı doğrudan bölüm metni belirler.

**İlgili mimari sınırlar**

- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-02](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
