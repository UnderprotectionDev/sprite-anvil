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

### Yazma ve eşleme uygulama sözleşmesi (#84)

- Varlık Kaydı ayrıntısındaki **Oyun İçi Bilgileri Yazma ve Eşleme** alanı web ve masaüstünün ortak React yüzeyidir. Hedef, mevcut bir Kare Birim Sürümünün anahtarı veya tamamlanmış Kaynak Metadata Eşlemesindeki kare anahtarı ile kesin Varlık Sürümüdür. Liste sırası değiştiğinde seçili kare değiştirilmez.
- Kullanıcı kullanım bağlamını yazar ve projede etkin bir Özel Profil Sözleşmesi seçer. Görülen kesin sözleşme revizyonu gönderilir; kayıt öncesi etkin revizyon değişmişse yeni kayıt çakışma olarak reddedilir. Sözleşmenin desteklediği dönüş, zemin/sıralama, sabitleme, çarpışma, efekt başlangıcı/katman ve olay alanları ile dışa aktarım hedefi, eksik değer davranışı ve yeniden okuma kontrolü gösterilir. Vuruş ve hasar alma alanları `collision_areas` içinde kullanıcı girdisi olarak korunur. Alanların JSON değeri sözleşmedeki türle doğrulanır; kayıt fizik benzetimi veya sanatsal onay değildir.
- Mevcut kaynak okuyucunun desteklediği dönüş noktası, yalnız hedef kare ve sürüm için tamamlanmış eşlemeden kullanıcı tarafından seçilir. Çakışmalı kaynak alanında yalnız kesinleştirilen aday kullanılabilir; eksik karar Bilinmiyor kalır. Kaynak önerisi veya görsel alfa veri kaynağı değildir.
- Her kayıtta kesin sözleşme revizyonu, kare/sürüm, kullanım bağlamı, alanın birimi/koordinat sistemi ve kullanıcı girdisi ya da kaynak referansı korunur. Boş isteğe bağlı alan `unknown`/`null` olarak yeniden okunur; zorunlu oyun içi bilgi alanı eksikse kayıt reddedilir.
- Yazma `gameplayMetadata.write`, yeniden okuma `gameplayMetadata.list` API yoludur. Kayıtlar geçmiş girdiyi değiştirmeden eklenir. Aynı işlem kimliğiyle aynı içerik yeniden gönderilirse mevcut kayıt döner; farklı içerik çakışma olarak reddedilir. Belirsiz yazma sonucunda arayüz yeni işlem oluşturmadan kaydı kontrol eder veya aynı işlemi yeniden gönderir.
- Görsel üstü katman incelemesi, düzenleme ve paket roundtrip'i #84'ün teslimi değildir; #85'in **Bilgileri İnceleme ve Koruma** adımında ayrıca doğrulanır.

### Bilgileri İnceleme ve Koruma — #85

- Varlık Kaydı ekranındaki `Bilgileri incele`, aynı kesin Varlık Sürümünün doğrulanmış görselini PixiJS önizlemesinde açar. `Görsel katmanlar` seçimleri yalnız önizlemeyi değiştirir. `px` ve `source_image_top_left` alanlarındaki noktalar ve çarpışma dikdörtgenleri kullanıcı verisinden çizilir; olay bağlantıları aynı karenin görseli üzerinde ayrı bir bilgi katmanında gösterilir. Diğer JSON değerleri metin olarak korunur. Bu alan çok varlıklı Sahne Kalite Kontrol Alanının yerine geçmez; animasyon, kamera ve fizik çalıştırmaz.
- `İncelemeyi kaydet` yalnız görsel yüklenmiş ve kesin kare, sözleşme alanları ile kesinleştirilmiş kaynak bağlantıları doğrulanmışsa kullanılabilir. Sunucu açık kullanıcı kararını yeni kayıt olarak ekler; kaynak kaydı değiştirmez. İşlem kimliğiyle tekrar aynı karar döner; bağlantı kaybolduysa tekrar da bütünlük hatası verir. Bu karar Varlık Sürümünün sanatsal onayını değiştirmez.
- Yeni yazılan kayıt kesin Özel Profil Sözleşmesini taşır. Eski kayıtta sözleşme bulunmuyorsa yalnız aynı etkin revizyondan alınabilir; başka revizyonla sessiz eşleme yapılmaz. İncelenmiş kayıt sonraki profil etkinleştirmelerinden bağımsızdır.
- `Bilgileri düzenle`, aynı kare, kesin sürüm, kullanım bağlamı, isteğe bağlı değerler ve kaynak seçimiyle formu açar. Kaydetme yeni, incelenmemiş kayıt üretir; eski inceleme korunur. `Düzenlemeyi iptal et` kalıcı kayıt yazmaz. Kare veya seçili kaynak kaybolursa kullanıcıya hata gösterilir; başka hedefe otomatik taşınmaz. Yazma etkin sözleşme revizyonu kontrolünü korur.
- `Oyun içi bilgiler paketini indir`, incelenmiş kaydın tamamını, kesin sözleşmesini, kaynaklarını ve SHA-256 içerik özetini sürümlü `sprite-anvil.gameplay-metadata` JSON dosyası olarak indirir. `Paketi yeniden oku`, en fazla 512 KiB dosyayı aynı yetkili kalıcı kayıtla karşılaştırır; kare, zorunlu bağlantı veya incelenmiş isteğe bağlı alan kaybı/değişimi bütünlük hatasıdır. Yeniden okuma kayıtları değiştirmez.
- Bu taşıma biçimi yalnız Oyun İçi Bilgileri içindir: görselleri, `context.md` veya kalite manifestini içeren tam Dışa Aktarım Paketi henüz teslim edilmez. EXP-02 ve RAS-01/RAS-02'nin bütün sahne/paket kabulü bu değişiklikle tamamlanmış sayılmaz. Veri mevcut JSONB kayıt alanında tutulur; yeni tablo, bağımlılık veya platform sınırı eklenmez.
- Ortak şemalar, bütünlük doğrulaması ve oRPC kayıtları `packages/api/src/` altında kalır. Kalıcı incelemenin sözleşme çözümleme ve yeniden okuma iş akışı `apps/server/src/features/gameplay-metadata/server/gameplay-metadata-review.ts`, paket hedefinin kalıcı katalogdan çözümlemesi aynı dizindeki `gameplay-metadata-package-target.ts` sahibindedir; sunucu context'i bu akışları korumalı API'ye sağlar. Görsel yüzey `apps/web/src/features/gameplay-metadata/ui/` altındadır.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Ürün görsel alfa değerinden oyun fiziği veya yetkili çarpışma bilgisi üretmez.

## Testing Decisions

- **Birincil test seam’i:** RAS-01, RAS-02 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Yazma/eşleme API seam'i: [`gameplay-metadata.test.ts`](../../../apps/server/src/gameplay-metadata.test.ts), kesin hedef, etkin sözleşme, seçimden sonra revizyon değişimi, kayıt sonrası etkin sözleşme değişse de aynı işlemin yeniden okunması, kullanıcı/kaynak girdisi, Bilinmiyor, yetkisiz erişim, eksik hedef, başarısız yazma ve yeniden okumayı sınar. [`gameplay-metadata.integration.test.ts`](../../../apps/server/src/gameplay-metadata.integration.test.ts), opt-in `GAMEPLAY_TEST_DATABASE_URL` ile gerçek PostgreSQL üzerinde bağımsız bağlantıdan yeniden okumayı, işlem kimliği tekrarını, tamamlanmış kaynak eşlemesini ve silinmiş (erased) Varlık Kaydında okuma ile yazmanın reddedilmesini doğrular.
- Ortak React form seam'i: [`gameplay-metadata-form.test.tsx`](../../../apps/web/src/features/gameplay-metadata/ui/forms/gameplay-metadata-form.test.tsx), kullanıcı girdisini, görülen sözleşme revizyonunun gönderilmesini, dışa aktarım eşlemesinin gösterilmesini, açık kaynak seçimini, bozuk JSON reddini ve liste yeniden sıralandığında kesin kare/kaynak bağının korunmasını sınar. Bu kanıt tek başına native masaüstü çalıştırma veya sahne/paket roundtrip kanıtı değildir.
- Web görünür sonuç seam'i: [`gameplay-metadata.spec.ts`](../../../apps/web/e2e/gameplay-metadata.spec.ts), gerçek route ve form üzerinde bozuk JSON reddini, belirsiz yazma sonrasında düzenlemenin kilitlenmesini, kaydı kontrol ederek açılmasını ve kesin hatayla sonuçlanan yeniden denemenin düzenlemeyi yeniden açmasını, kullanıcı eylemi ile sayfa yenilemesinden sonraki görünür yeniden okumayı kontrollü API yanıtlarıyla sınar. Bu ağ-fixture testi gerçek PostgreSQL kalıcılık testinin yerine geçmez.
- #85 API seam'i aynı dosyada değişmez inceleme ve işlem tekrarı, yetkisiz erişim, kaybolan kare/kaynak/inceleme üst kaydı, değişen etkin sözleşme, başarısız kalıcı yeniden okuma, isteğe bağlı iç içe JSON korunması ve bozuk paket reddini sınar. Opt-in PostgreSQL senaryosu inceleme ve paket yeniden okumasını bağımsız bağlantıyla da sınar; veritabanı verilmediğinde atlanır.
- #85 ortak form seam'i düzenlemenin kesin kare ve değiştirilmemiş isteğe bağlı iç içe değerleri korumasını sınar. Web seam'i PixiJS tuvali, katman seçimi, açık inceleme kararı, JSON indirme/yeniden okuma, bozuk paket, düzenleme iptali, yeni kaydın yeniden inceleme gerektirmesi, görsel yükleme hatası ve kaybolan kare uyarısını sınar. Native masaüstü eşitliği ve tam Sahne Kalite Kontrol Alanı/Dışa Aktarım Paketi roundtrip'i ayrı kabul kanıtı gerektirir.
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
- [ADR 0003](../../adr/0003-require-web-and-desktop-product-surfaces.md)
- [ADR 0004](../../adr/0004-engine-neutral-export-with-godot-first.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [RAS-01](../../prd/10-acceptance-scenarios.md)
- [RAS-02](../../prd/10-acceptance-scenarios.md)
- #84 yalnız yazma/eşleme ve kalıcı kayıt yeniden okumasını teslim eder; fazın sahne ve paket kabul ölçütlerinin tamamlandığı iddia edilmez. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
