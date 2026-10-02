# Kalite Profillerini ve Kanıtını Yönetme

## Problem Statement

Sistem sürümlü Özel Profil Sözleşmesini, teknik bütünlüğü, ölçülebilir gereksinimleri ve açıklanabilir uyarıları kesin Varlık Sürümünde ayrı değerlendirir. Genel Varlık Desteği temel inceleme olanağını korur.

## Solution

Sistem sürümlü Özel Profil Sözleşmesini, teknik bütünlüğü, ölçülebilir gereksinimleri ve açıklanabilir uyarıları kesin Varlık Sürümünde ayrı değerlendirir.

Genel Varlık Desteği temel inceleme olanağını korur. Özel profile özgü tamamlanma ve kullanım kanıtı için etkin sözleşme gerekir; Kalite Kontrol Durumu sanatsal İnceleme Kararının yerine geçmez.

Tamamlanma kanıtı: Kesin sürümün bütünlük, ölçülebilir gereksinim, uyarı ve zorunlu test sonuçları ayrı kanıtlanır. Tüm zorunlu kanıtlar karşılandığında Dışa Aktarıma Hazır, yalnız izinli gereksinime geçerli istisna verildiğinde İstisnalarla Hazır sonucu hesaplanır.

## User Stories

1. Bir kullanıcı olarak her Özel Varlık Profilini sürümlü ve değişmez Özel Profil Sözleşmesiyle etkinleştirmek istiyorum; böylece kalite değerlendirmesinin kullandığı kesin kural sürümü bilinir.
2. Bir kullanıcı olarak özel sözleşmesi olmayan türü Genel Varlık Desteğiyle temel incelemek istiyorum; böylece özel profil kanıtı olmayan varlık için tamamlanma iddiası üretilmez.
3. Bir kullanıcı olarak kesin Varlık Sürümünü Bütünlük Denetimleriyle değerlendirmek istiyorum; böylece dosya, birim ve referans bozuklukları istisnasız engel olarak görünür.
4. Bir kullanıcı olarak ölçülebilir gereksinimleri, açıklanabilir Kalite Uyarılarını ve profilin kullanım testlerini ayrı sonuçlarda görmek istiyorum; böylece farklı kalite kanıtları tek puana indirgenmez.
5. Bir kullanıcı olarak zorunlu insan incelemesi ve kullanım testi kanıtını ayrı tamamlamak istiyorum; böylece otomatik denetim kullanıcı kararının yerine geçmez.
6. Bir kullanıcı olarak yalnız açıkça istisnaya izin veren gereksinime gerekçeli ve sürüme özgü Kalite İstisnası vermek istiyorum; böylece bütünlük, zorunlu inceleme veya test engeli aşılamaz.
7. Bir kullanıcı olarak kalite kanıtının kesin Varlık Sürümü ve profil revizyonuna bağlanmasını istiyorum; böylece başka sürümün sonucu bu sürüme taşınmaz.
8. Bir kullanıcı olarak sözleşme değiştiğinde etkilenen yeni zorunlu kurallar için yeniden kanıt istenmesini istiyorum; böylece eski sonuç yeni sözleşme karşılandı sanılmaz.
9. Bir kullanıcı olarak Dışa Aktarıma Hazır sonucunu yalnız sabitlenmiş bağlam ve profil koşulları karşılandığında görmek istiyorum; böylece kalite durumu sanatsal kabul veya hukuki uygunluk iddiası oluşturmaz.

## Normatif gereksinimler

- **QLT-01 — Kalite kanıtı ve kullanıcı kararı:** Kalite tek bir puana indirgenmez ve ürün sanatsal mükemmellik veya hukuki uygunluk hükmü vermez. Teknik bütünlük, ölçülebilir toleranslar, açıklanabilir uyarılar ve kullanım testi kanıtı sunar; sanatsal uygunluk ve nihai kabul kararını kullanıcı verir. “Dışa Aktarıma Hazır” yalnız sabitlenmiş bağlam ve profil koşullarının karşılandığını belirtir.
- **QLT-03 — Özel Profil Sözleşmesi:** Her özel profil sürümlü ve değişmez bir **Özel Profil Sözleşmesi** ile etkinleştirilir. Profil uzun ömürlü ürün kabiliyetidir; sözleşmenin kesin revizyonu metadata alanlarını, kural kimliklerini, kalite sınıflarını, kullanım testlerini ve dışa aktarım eşlemelerini tanımlar.


## Implementation Decisions

- **Özel Profil Sözleşmesini Etkinleştirme:** Metadata alanları, kural kimlikleri, insan incelemesi, kullanım testleri ve dışa aktarım eşlemeleri değişmez sözleşme sürümünde etkinleşir. Her kuralın sınıfı, girdisi, gözlenebilir sonucu, kanıtı, kapsamı ve dışa aktarım etkisi belirlenir. Etkin sözleşmesi olmayan tür özel profil diye sunulmaz; geçmiş değerlendirmeler kullandıkları sürümü korur. Bilinmeyen zorunlu alan veya ana sürüm değerlendirmeyi durdurur; göç geçmiş kanıtı yerinde değiştirmez.
- **Kalite Kurallarını Değerlendirme:** Bütünlük Denetimi, İstisna Verilebilir Gereksinim, Kalite Uyarısı ve kullanım testi kesin sürüm için ayrı sonuç ve kanıt üretir. Zorunlu insan incelemesinin yapılıp yapılmadığı ayrıca denetlenir; İnceleme Kararını kullanıcı ayrı akışta verir. Bütünlük hatası ve eksik zorunlu kanıt dışa aktarımı engeller. Ölçülebilir gereksinim yalnız sözleşme izin veriyorsa istisna alabilir; açıklanabilir görsel uyarı kendi başına ret veya otomatik engel oluşturmaz. Yeni sözleşme kuralının etkilediği öğe yeniden değerlendirilir, etkilenmeyen kanıt korunur.
- **Sürüme Özgü Kalite İstisnası Verme:** Kullanıcı yalnız istisna kabul eden ölçülebilir profil kuralına gerekçeli karar verir. İstisna tam kuralı, gözlenen değeri, Birim veya Birleşik Sürümü, kullanım kapsamını, Bağlam Sürümünü ve Ana Tasarımı sabitler. Yeni sürüme otomatik aktarılmaz; Bütünlük Denetimi, zorunlu insan incelemesi ve zorunlu kullanım testi istisna alamaz.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Tek kalite puanı veya harici görsel analiz sanatsal kabul kararı değildir. Harici analiz varsa proje ve kategori izni ayrı izin akışında alınır; izin yokken yerel denetim ve insan incelemesi sürer.

## Testing Decisions

- **Birincil test seam’i:** 8.1, RAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Ürün sözleşmesi [`family-readiness.ts`](../../../packages/api/src/family-readiness.ts) üzerinden sunulur. Sunucu/API ve kalıcı yeniden okuma seam’i [`family-readiness.integration.test.ts`](../../../apps/server/src/family-readiness.integration.test.ts); sözleşme sınıfları ve hazır olma sonuçları [`family-readiness.test.ts`](../../../apps/server/src/family-readiness.test.ts) ile [`specialized-profile-contracts.test.ts`](../../../apps/server/src/specialized-profile-contracts.test.ts); görünür kullanıcı eylemi [`family-readiness-manager.test.tsx`](../../../apps/web/src/features/family-readiness/ui/components/family-readiness-manager.test.tsx) üzerinden sınanır. Kalıcı test ayrı, geçici bir veritabanıyla çalıştırılır. Paylaşılan bileşen testi, tarayıcı veya masaüstü uçtan uca eşdeğerliğinin çalıştırıldığı anlamına gelmez.
- Sürüme Özgü Kalite İstisnası için önce güncel, başarısız veya sonuçsuz ölçüm kaydedilir. Kullanıcı bu ölçümün kuralını, gözlenen değerini, yöntemini, Birim veya Birleşik Sürümünü ve diğer kapsam sabitlemelerini değiştirmeden gerekçe verir. API sahte veya daha yeni kanıtla geçersizleşmiş ölçümü, değişmiş gözlemi, başka projeye ait hedefi ve değişmiş kullanım kapsamını reddeder. Yeniden okumada gerekçe, karar veren kullanıcı ve kesin sürüm sabitlemeleri korunur. Yeni Birim veya Birleşik Sürümü eski kanıtı tarihsel bırakır; yeni sürüme istisna aktarılmaz. Boş gerekçe ve sürümsüz istisna giriş sınırında reddedilir; yetkisiz erişim sınanır.
- Görünür akışta ölçümden önce veya eski ölçüm için istisna seçeneği sunulmaz. Kullanıcı ölçüm sırasında Birim veya Birleşik Sürümünü seçer; istisna sırasında gözlenen değer ve yöntem salt okunurdur, kapsam görünürdür ve gerekçe zorunludur. Kalıcı kanıt ayrıntıları kesin Birim veya Birleşik Sürümünü gösterir. Kaydetme hatası hazır olma durumunu iyimser biçimde değiştirmez. Harici analiz çağrısı veya sanatsal kabul kararı bu akışa eklenmez.
- Aynı Gerekli Öğeler Listesi öğesindeki farklı kesin sürümlere açıkça sabitlenmiş kalite kuralları bir hazır olma sonucunda birleştirilmez. En son seçilen kesin sürüm için diğer sürümün kuralları güncel sayılmaz; aynı hedefin gerekli kuralları yeniden kaydedilmeden İstisnalarla Hazır sonucu oluşmaz. Kesin sürüm hedefi olmayan önceki kanıtlar kendi Varlık Sürümü ve bağlam kapsamlarıyla denetlenmeye devam eder.
- Eski, Birim veya Birleşik Sürümü sabitlenmemiş istisna kayıtları otomatik hedef atanarak taşınmaz; geçmişte görünür kalır ancak güncel hazır olma hesabına katılmaz. Görünür kalıcı kanıt kaydeden kullanıcıyı ve kayıt zamanını da gösterir.
- Fazın özgül başarı ve red kanıtı: Kesin sürümün bütünlük, ölçülebilir gereksinim, uyarı ve zorunlu test sonuçları ayrı kanıtlanır. Tüm zorunlu kanıtlar karşılandığında Dışa Aktarıma Hazır, yalnız izinli gereksinime geçerli istisna verildiğinde İstisnalarla Hazır sonucu hesaplanır. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Tek kalite puanı veya harici görsel analiz sanatsal kabul kararı değildir. Harici analiz varsa proje ve kategori izni ayrı izin akışında alınır; izin yokken yerel denetim ve insan incelemesi sürer.
- Kabul örnekleri: 8.1, RAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Tek kalite puanı veya harici görsel analiz sanatsal kabul kararı değildir. Harici analiz varsa proje ve kategori izni ayrı izin akışında alınır; izin yokken yerel denetim ve insan incelemesi sürer.

## Further Notes

- Tek faz kaynağı: [`16-quality-evidence/phase-context.md`](../../workflow/16-quality-evidence/phase-context.md).
- Kanonik teknik adlar: Specialized Profile Contract, Quality Profile, Quality Waiver. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`QLT-01`](../../prd/04-ingestion-lifecycle-and-quality.md) — Kalite kanıtı ve kullanıcı kararı.
- [`QLT-03`](../../prd/05-asset-profiles.md) — Özel Profil Sözleşmesi.

**İlgili mimari sınırlar**

- [ADR 0011](../../adr/0011-quality-waivers-are-version-specific.md)
- [ADR 0012](../../adr/0012-reserve-consequential-decisions-for-the-user.md)

**Kabul izlenebilirliği**

- [8.1](../../prd/10-acceptance-scenarios.md)
- [RAS-01](../../prd/10-acceptance-scenarios.md)
- Fazın kalite kanıtı ve istisna akışı mevcut aile kanıtları ekranı ile sunucu/API yolunda uygulanır; tüm fazların teslim edildiği iddia edilmez. Yeni bağımlılık veya platform sınırı bu belgeyle seçilmez.
