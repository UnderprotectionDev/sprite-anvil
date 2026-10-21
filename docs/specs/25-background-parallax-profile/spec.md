# Arka Plan ve Katmanlı Kaydırma Profilini Uygulama

## Problem Statement

Arka plan katmanları hedef oran, güvenli alan, göreli hareket, döngü, kırpma, kontrast ve oyuncu görünürlüğüyle gerçek kaydırma davranışında incelenir. Hedef görüntü oranı ve güvenli oyun alanı arka planın gerçek kullanımını belirler.

## Solution

Arka plan katmanları hedef oran, güvenli alan, göreli hareket, döngü, kırpma, kontrast ve oyuncu görünürlüğüyle gerçek kaydırma davranışında incelenir.

Hedef görüntü oranı ve güvenli oyun alanı arka planın gerçek kullanımını belirler. Katmanlar tek tek değil, göreli hareketleriyle beraber görülür.

Tamamlanma kanıtı: Katman sırası, hız, kırpma ve döngü ayarlarıyla kullanıcıya gerçek kaydırma sunulur; kontrast ve oyuncu görünürlüğü kayda bağlanır.

## User Stories

1. Bir kullanıcı olarak arka plan için hedef görüntü oranını ve güvenli oyun alanını belirlemek istiyorum; böylece inceleme gerçek hedef çerçevesine dayanır.
2. Bir kullanıcı olarak katmanları sıraları ve göreli hızlarıyla birlikte oynatmak istiyorum; böylece parallax davranışını tek tek durağan görsellerden ayrı değerlendirebilirim.
3. Bir kullanıcı olarak döngü ve birleşim izlerini gerçek kaydırma sırasında incelemek istiyorum; böylece süreklilik yalnız statik karede varsayılmaz.
4. Bir kullanıcı olarak hedef oranda kırpma ve güvenli alanı değerlendirmek istiyorum; böylece oyun alanı dışında kalan içerik görünür olur.
5. Bir kullanıcı olarak arka plan kontrastını ve oyuncunun görünürlüğünü kayda bağlamak istiyorum; böylece oynanış okunurluğu aile kanıtına eklenir.
6. Bir kullanıcı olarak katman sırası, göreli hareket, kırpma ve döngü ayarlarını kesin profil sürümüyle dışa aktarmak istiyorum; böylece teslim edilen sahne aynı arka plan davranışını korur.
7. Bir kullanıcı olarak durağan temas sayfasının arka planı tamamlanmış saymamasını istiyorum; böylece katmanlı kaydırma gerçek kullanım testinden geçer.

## Normatif gereksinimler

- **QLT-02 — Özel profil kapsamı:** Tam Ürün Kapsamında aşağıdaki sekiz varlık grubunun her biri için özel profil sunulur:
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Katman Düzenini ve Güvenli Alanı Kurma:** Katman sırası, doğal ölçü, hedef görüntü oranı, kırpma ve oyuncu için güvenli alan kesin sürümlerle tanımlanır. Her katman kimlik, sıra, doğal ölçü, hedef oran, kırpma ve güvenli alan bilgisi taşır. Bu bilgiler arka planın kendi Görsel Dünyası ve kesin sürümleriyle ilişkilidir; oyuncunun görünmesi için ayrılan alan kaybolmaz.
- **Gerçek Kaydırma Davranışını Sınama:** Göreli hız, döngü, birleşim izi, kontrast ve oyuncu görünürlüğü katmanlar birlikte hareket ederken incelenir. Katmanlar göreli hızlarıyla birlikte hareket eder; döngü başlangıcı, birleşim izi, kırpma, kontrast ve oyuncu silueti hedef oranlarda sınanır. Kullanım testi sonucu oynatılan kesin katman sürümlerini sabitler.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.

### Katman düzeni kaydı (#118)

- Arka Plan Katman Düzeni aynı Varlık Ailesi ve Görsel Dünya içindeki kesin arka plan Varlık Sürümlerini ve etkin Özel Profil Sözleşmesi revizyonunu sabitler. Her kaydetme yeni, değişmez bir kayıt oluşturur; aynı işlem kimliği aynı girdi için tek kayıt döndürür, farklı girdiyle yeniden kullanım reddedilir.
- Katman kimlikleri ve negatif olmayan sıralama değerleri tekildir; düşük sıra arkadadır. Doğal ölçü doğrulanmış kaynak görsel ölçüsünden alınır, kullanıcı tarafından değiştirilemez. Eksik ölçü veya okunamayan/bozuk içerik kaydetmeyi engeller.
- Hedef oran pozitif tam sayı genişlik/yükseklik çifti olarak saklanır. Kırpma bu oranı karşılayan, kaynak görselin içinde kalan pozitif bir dikdörtgendir. Oyuncu güvenli alanı kırpmanın içinde kalır. Her iki dikdörtgen kaynak görselin sol üstünden piksel koordinatlarını kullanır.
- Aile ekranı katman ekleme/kaldırma, kesin sürüm seçimi, sıra, hedef oran, kırpma ve güvenli alan girişlerini, kaynak üstünde ayırt edilebilir sınır önizlemelerini ve kaydedilmiş düzenleri sunar. Kaydetme sonrası yeniden okuma, yenileme ve geçmiş kayıtlar aynı değerleri korur.
- Görünürlük diğer özel profil kayıtlarının gizlilik sınırını izler: silinmiş veya erişilemeyen kaynak sürümü kullanan düzenin içerik taşıyan geçmiş kaydı API listesinde sunulmaz. Yeniden okuma kanıtı erişilebilir kaynaklar içindir; bu iş silme makbuzu veya içeriksiz soy işareti üretmez.
- Bu kurulum gerçek kaydırma kullanım testi, insan incelemesi, onay veya tamamlanma kanıtı oluşturmaz; hız/döngü ve kaydırma değerlendirmesi sonraki issue kapsamındadır.

### Arka Plan Kaydırma Testi (#119)

- Kullanıcı kaydedilmiş Arka Plan Katman Düzenini ve aynı projedeki `character_creature_animation` kategorisinden okunabilir, bütünlüğü doğrulanmış kesin Varlık Sürümünü oyuncu silueti olarak seçer. Oyuncu görseli bu sürümün kaynak görüntüsünden alınır; yer tutucu veya otomatik seçilmiş son sürüm kullanılmaz. Kayıt düzenin tamamını, oyuncu sürümünü/içerik özetini ve düzenin Özel Profil Sözleşmesini sabitler. Her yazma değişmezdir; aynı işlem kimliği ve girdi aynı kaydı döndürür, farklı girdi reddedilir.
- Katmanlar düşük sıradan yükseğe aynı zaman çizgisinde hareket eder. Yatay hız ilk katmanın kırpma genişliğine göre hedef çerçeve pikseli/saniye cinsindedir; negatif hız sağa hareket ettirir. Her kaynak kırpması ilk katmanın çerçevesine ölçeklenir; tüm katmanların hedef oranı aynı olmalıdır. Döngü açıkken kırpma genişliğinde kesintisiz tekrar edilir; kapalıyken katman çerçeve dışına çıkabilir. Başlangıç ofseti aynı hedef piksel birimini kullanır. Farklı oranlar ayrı kaydedilmiş düzenlerle sınanır.
- Oyuncunun konumu ve ölçüsü hedef çerçeve pikselidir, kaynak oranı korunur ve tüm katmanların ölçeklenmiş güvenli alanında kalır. Kullanıcı oyuncuyu tüm katmanların arkasına veya seçili katmanın hemen önüne koyabilir; böylece ön planın silueti gizlemesi incelenebilir.
- Oynatma kullanıcı tarafından başlatılır; duraklatma, başlangıca dönme ve zaman çizgisinde belirli bir noktayı inceleme vardır. Ayar/sürüm/düzen değişikliği oynatma kanıtını ve önceki gözlemleri sıfırlar; zaman çizgisinde atlama oynatma kanıtını sıfırlar. Süre pozitif ve en çok 120 saniyedir. En az bir katman hareket eder; kaydetmek için yapılandırılan süre gerçekten oynatılmış olmalıdır. Statik önizleme veya zaman çizgisinde atlama tek başına sonuç oluşturmaz. İstemcinin oynatma bildirimi sunucuya taşınır; sunucu fiziksel ekran gözlemini bağımsız doğruladığını iddia etmez.
- Kullanıcı döngü, birleşim izi, kırpma, kontrast ve oyuncu görünürlüğü için ayrı Geçti/Başarısız/Sonuçsuz sonucu ve gerekçe girer. Herhangi bir Başarısız tüm testin sonucunu Başarısız yapar; başarısız yokken Sonuçsuz varsa test Sonuçsuzdur, diğer durumda Geçti olur. Sanatsal eşik veya otomatik hüküm eklenmez. Bu kayıt tek başına insan onayı, aile tamamlanması ya da dışa aktarım oluşturmaz.
- Sunucu aile/proje erişimini, etkin sözleşmeyi, kaynak erişilebilirliğini ve içerik bütünlüğünü yeniden kontrol eder. Silinmiş oyuncu veya arka plan kaynaklarını kullanan içerik taşıyan geçmiş kayıtlar listelenmez. Belirsiz yazma sonucu formu kilitler; yalnız bekleyen işlem kimliği ve tam girdi yeniden okununca çözülür. Kullanıcı `Retry same scrolling test` ile aynı işlem kimliği ve tam girdiyi yeniden gönderebilir; yeniden deneme oynatma kanıtını ve gözlemleri korur. Yeniden deneme başarısı tek başına kilidi açmaz; başarısız yeniden deneme veya başarısız, boş ya da farklı girdili yeniden okuma bekleyen işlemi korur.

## Testing Decisions

- #119 için `backgroundScrollingTests.save/list` aynı PostgreSQL testinde (`apps/server/src/features/background-parallax-profile/server/tests/background-layer-layout.integration.test.ts`) bağımsız bağlantıdan yeniden okuma, kaynak/sözleşme sabitleme, idempotency, statik/hareketsiz test reddi, güvenli alan/oyuncu oranı, yetkisiz erişim ve silinmiş kaynak gizliliğini sınar. `background-scrolling-preview.test.tsx` gerçek React kontrolleri ve platform sınırında Pixi/DOM image uyarlayıcılarıyla hız/döngü/zaman çizgisi, yeniden başlatma ve okunamayan görüntü yollarını sınar. Web `background-layer-layout.spec.ts` gerçek Pixi tuvalindeki değişen pikselleri, oynatma sonrası kullanıcı sonucunu, yenileme/yeniden oynatma ve statik kanıt reddini sınar; masaüstü aynı ortak React yüzeyini kullanır. `background-scrolling-setup.test.tsx` ayar değişikliğinde gözlemlerin/oynatma kanıtının sıfırlanmasını ve belirsiz yazmanın yalnız kesin işlem yeniden okununca çözülmesini sınar. Masaüstü çalışma kanıtı ayrıca bildirilir.
- Kaydırma testi kurtarma akışı `background-scrolling-setup.test.tsx` üzerinden sunucuya ulaşmayan ilk istekten sonra aynı kimlik/tam girdiyle yeniden göndermeyi, oynatma ve gözlemlerin korunmasını, boş/başarısız/farklı girdili yeniden okumada kilidin korunmasını ve belirsiz veya kesin red veren ikinci yazma hatasının bekleyen işlemi düşürmemesini sınar.


- Belirsiz katman düzeni yazımında boş veya ilgisiz yeniden okuma formun kilidini açmaz. React testleri başarısız okumayı, bekleyen işlem kimliğiyle doğrulamayı ve aynı kimlik/girdiyle yeniden denemeyi kapsar; tarayıcı testi kaybolan yazma yanıtından sonra aynı işlemin yalnız tek kalıcı kayıt üretmesini doğrular. Masaüstü güvenli alan red senaryosu tüm zorunlu alanları doldurup özgül hata metnini doğrular.
- **Birincil test seam’i:** RAS-06 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- #118 için API seam'i `backgroundLayerLayouts.save/list`; gerçek PostgreSQL'e kaydetme ve ayrı bağlantıdan yeniden okuma `apps/server/src/features/background-parallax-profile/server/tests/background-layer-layout.integration.test.ts` ile sınanır. Geçersiz geometri, yinelenen kimlik/sıra, yanlış aile/Görsel Dünya, eksik ölçü/içerik, değişmiş sözleşme, yetkisiz erişim, silinmiş kaynakların geçmiş kayıt üzerinden sızmaması ve idempotency red yolları ayrıca kapsanır. `bun run test:e2e:background-layout` migration geçmişini geçici PostgreSQL üzerinde uygular ve aynı API testiyle `apps/web/e2e/background-layer-layout.spec.ts` tarayıcı akışını çalıştırır. Web ve masaüstünün paylaştığı React yüzeyi `background-layer-layout-manager.test.tsx` ile kullanıcı girişi, kayıt sonrası yeniden açma ve hata yollarında sınanır; `apps/web/desktop-e2e/background-layer-layouts.spec.ts` aynı güvenli alan red ve kalıcı yeniden okuma senaryosunu masaüstünde tanımlar; gerçek tarayıcı/masaüstü kanıtı ayrıca bildirilir.
- Mevcut sunucu ve yüzey test örnekleri: [`project-routes.test.ts`](../../../apps/server/src/features/projects/server/tests/project-routes.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Katman sırası, hız, kırpma ve döngü ayarlarıyla kullanıcıya gerçek kaydırma sunulur; kontrast ve oyuncu görünürlüğü kayda bağlanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.
- Kabul örnekleri: RAS-06. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Arka plan, yalnız durağan temas sayfasına bakılarak tamamlanmış sayılmaz.

## Further Notes

- Tek faz kaynağı: [`25-background-parallax-profile/phase-context.md`](../../workflow/25-background-parallax-profile/phase-context.md).
- Kanonik teknik adlar: Specialized Asset Profile. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-02`](../../prd/05-asset-profiles.md) — Özel profil kapsamı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0002](../../adr/0002-use-extensible-asset-support-levels.md)
- [ADR 0006](../../adr/0006-version-replaceable-units-and-compositions.md)

**Kabul izlenebilirliği**

- [RAS-06](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
