# Üretim Kaynağını ve Kanıtını Kaydetme

## Problem Statement

Her sonuç, kaynağın gerçekte sunabildiği kanıtla izlenir; bilinmeyen geçmiş tahmin edilmeden görünür kalır. Manuel üretim, bağlantılı üretim ve geçmiş varlık aynı kanıt adı altında sahte eşitliğe zorlanmaz.

## Solution

Her sonuç, kaynağın gerçekte sunabildiği kanıtla izlenir; bilinmeyen geçmiş tahmin edilmeden görünür kalır.

Manuel üretim, bağlantılı üretim ve geçmiş varlık aynı kanıt adı altında sahte eşitliğe zorlanmaz. Her yol gerçekten erişebildiği alanları korur.

Tamamlanma kanıtı: Her Aday Sürüm kaynağı ve mevcut kanıt düzeyiyle izlenebilir; manuel eksik kanıt onayı durdurur, eski varlığın bilinmeyeni açık kalır ve yönetilen çalışma dosyası geri bulunur.

## User Stories

1. Bir kullanıcı olarak ChatGPT'de elle oluşturduğum sonucu kopyalayıp yapıştırmak, sürüklemek veya dosya yüklemek istiyorum; böylece üretim için zorunlu sağlayıcı bağlantısı gerekmez.
2. Bir kullanıcı olarak her Aday Sürümün gerçek kaynağını ve mevcut üretim kanıtını görmek istiyorum; böylece farklı kaynak yolları sahte biçimde eşitlenmez.
3. Bir kullanıcı olarak elle içe aktarılan yeni sonuç için Üretim Paketi kimliği, gerçek talimat, kaynak ve sonuç dosyasını kaydetmek istiyorum; böylece yeni üretimin asgari kanıtı tamamlanabilir.
4. Bir kullanıcı olarak sağlayıcı bağlantısının sunduğu üretim parametrelerini ve sağlayıcı/model bilgisini Sağlayıcı Üretim Kaydında korumak istiyorum; böylece karşılaştırma mevcut kanıta dayanır.
5. Bir kullanıcı olarak elle kullanılan arayüzün veya eski dosyanın sunmadığı sağlayıcı ayrıntılarını Bilinmiyor görmek istiyorum; böylece erişilemeyen geçmiş tahmin edilmez.
6. Bir kullanıcı olarak kullandığım sağlayıcının arayüzünde gördüğüm üretim ayrıntılarını web formuna girebilmek ve bunların kullanıcı bildirimi olduğunun açıkça gösterilmesini istiyorum; böylece gerçek entegrasyon verisiyle karıştırılmaz.
7. Bir kullanıcı olarak API anahtarlarının, yetkilendirme başlıklarının ve geçici erişim adreslerinin üretim geçmişine girmemesini istiyorum; böylece kaynak kanıtı sır taşımaz.
8. Bir kullanıcı olarak harici araç çalışma dosyasını Yönetilen Kopya olarak korumak istiyorum; böylece üretim kanıtı dış dosya yoluna bağlı kalmaz.
9. Bir kullanıcı olarak eski proje varlığının bilinmeyen geçmişini Geçmiş Varlık Beyanında açıkça kaydetmek istiyorum; böylece bilinmeyen talimat sonradan tarihsel gerçek gibi gösterilmez.
10. Bir kullanıcı olarak Geçmiş Varlık Beyanı ile Hak Kaydının ayrı kalmasını istiyorum; böylece üretim geçmişi beyanı kullanım hakkı kanıtı yerine geçmez.

## Normatif gereksinimler

- **IMP-03 — Üretim kaynakları:** ChatGPT’yi elle kullanma yolu her zaman geçerli bir üretim yoludur. Kullanıcı sonucu kopyalayıp yapıştırabilir, sürükleyebilir veya dosya olarak yükleyebilir.


## Implementation Decisions

- **Elle İçe Aktarma Kanıtı:** Manuel sonuç onaydan önce paket kimliği, kaynak yüzeyi, gerçek talimat ve sonuç dosyasıyla bağlanır. Onay kapısı, paket kimliği, gerçek üretim talimatı, kullanılan yüzey ve sonuç dosyası olmadan geçilmez. Tam konuşma arşivi zorunlu değildir; henüz tamamlanmamış kanıtla dosya gelen kutusunda tutulabilir.
- **Sağlayıcı Üretim Kaydı:** Bağlantının sunduğu model ve üretim parametreleri sırlar hariç kayıpsız, temizlenmiş ve değişmez kanıt olur. Bağlantının gerçekten sunduğu model, sürüm, istenen ve gerçekleşen ölçü, tohum ve diğer parametreler ortak alanlar ile sürümlü temizlenmiş anlık kayda ayrılır. Sır, yetkilendirme başlığı ve geçici erişim adresi dışlanır; bağlantı üzerinden gelen sonucun mevcut alanları kaybolamaz. Kullanıcı, sağlayıcı arayüzünde gördüğü değerleri de aynı kayıt formuna girebilir; bu değerler `user_reported_provider` kaynağıyla Kullanıcının Bildirdiği Sağlayıcı Ayrıntıları olarak gösterilir, sağlayıcı entegrasyon payload’u veya doğrulanmış veri sayılmaz. Bu bildirim eksik diye onay engellenmez; `connected_provider` kaynağı ve onay kapısı yalnızca güvenilir entegrasyon yoluna aittir.
- **Geçmiş Varlık Beyanı:** Eski bir varlığın bilinen kaynağı ve bilinmeyen geçmişi kullanıcı beyanıyla ayrıca kaydedilir; kayıp tarih uydurulmaz. Eski proje dosyasının bilinen kaynağını, kullanıcıyla ilişkisini, eksik üretim geçmişini ve destekleyici kanıtı kullanıcı beyan eder. Bu kayıt gerçek Üretim Paketinin veya manuel talimatın yerine geçmez ve bilinmeyen ayrıntıları tahmin etmez.
- **Harici Çalışma Dosyasını Kanıtla Bağlama:** Harici araç dosyasının yönetilen kopyası ve özeti üretim geçmişinde taşınabilir kaynak kanıtı olur. Canlı yerel dosya bağlantısı açma ve değişikliği fark etme kolaylığı sağlar; tek başına kaynak kanıtı veya onay değildir. Algılanan değişiklik içe alınırsa yeni yönetilen kopya ve Aday Sürüm oluşur; webde aynı sonuç dosya seçme, sürükleyip bırakma veya yapıştırmayla alınır.
- **Canlı Bağlantıdan Aday Sürüm:** Düzenlenebilir harici çalışma dosyasında algılanan değişiklik içe alınırken özgün dosya Managed Snapshot olarak korunur. Kullanıcı, yeni Aday Sürümün görsel içeriği olarak o değişikliğin PNG veya WebP dışa aktarımını seçer. Managed Snapshot bu Aday Sürüme bağlanır; dış çalışma dosyasının kendisi PNG/WebP Aday Sürüm içeriği yerine geçmez. Bu yol Production Source Kind olarak External Working File Edit sınıflandırılır; ürün etiketi Harici Çalışma Dosyası Düzenlemesidir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Sağlayıcı parametresi kaydı aynı görselin yeniden üretileceğini garanti etmez; erişim sırları veya tahmin edilmiş geçmiş saklanmaz.

## Testing Decisions

- **Birincil test seam’i:** YAS-01 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma. Sağlayıcı arayüzünden elle girilen alanlarda kaynak sınıfının `user_reported_provider` kaldığını, arayüzün doğrulanmamış bildirimi belirttiğini ve bu kaynağın tek başına onayı engellemediğini de sınama. Tarayıcı yüklemesinin `connected_provider` iddiasını reddettiğini ve güvenilir entegrasyon yolunun eksik kaydı onaya kapattığını doğrula.
- API yazma sınırında sağlayıcı parametrelerinin serileştirilmiş UTF-8 boyutunun 50.000 baytı aşmadığını doğrula; bu yeni sınırın önceden saklanmış daha büyük ve güvenli snapshot’ların okunmasını bozmamasını ayrıca sınama.
- Sır temizliği için `x-amz-security-token`, iç içe ve serileştirilmiş JSON ile geçici imzalı adresleri sınama; saklı eski satırlar için migration backfill’inin güvenli alanları koruyup sırları kaldırdığını doğrula.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Canlı dosya değişikliği testinde panel ve yazma akışı testleri, seçilen dış çalışma dosyasının baytlarının Managed Snapshot isteğine; seçilen PNG/WebP dışa aktarımının da Aday Sürüm isteğine gittiğini doğrular. İki yükleme rotası kendi dosya baytlarını kaydedip yeniden okutmalı; Production Evidence Level testi Yönetilen Kopya oluşmadan onayın engellendiğini doğrular. Web yüzeyindeki dosya seçme, sürükleyip bırakma ve yapıştırma yollarının aynı Managed Snapshot yükleme yolunu kullandığını doğrula.
- İlgili test seam'leri: [`live-file-change.test.ts`](../../../apps/web/src/features/production-provenance/ui/services/live-file-change.test.ts), [`live-file-link-panel.test.tsx`](../../../apps/web/src/features/production-provenance/ui/components/live-file-link-panel.test.tsx), [`use-asset-version-writes.test.tsx`](../../../apps/web/src/features/asset-versions/ui/hooks/use-asset-version-writes.test.tsx), [`version-production-evidence-panel.test.tsx`](../../../apps/web/src/features/production-provenance/ui/components/version-production-evidence-panel.test.tsx), [`asset-version-routes.test.ts`](../../../apps/server/src/asset-version-routes.test.ts), [`managed-snapshot-routes.test.ts`](../../../apps/server/src/features/production-provenance/server/managed-snapshot-routes.test.ts) ve [`production-provenance-api.test.ts`](../../../apps/server/src/production-provenance-api.test.ts).
- Fazın özgül başarı ve red kanıtı: Her Aday Sürüm kaynağı ve mevcut kanıt düzeyiyle izlenebilir; manuel eksik kanıt onayı durdurur, kullanıcı bildirimi bağlantıyla doğrulanmış gibi sunulmaz, eski varlığın bilinmeyeni açık kalır ve yönetilen çalışma dosyası geri bulunur. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Sağlayıcı parametresi kaydı aynı görselin yeniden üretileceğini garanti etmez; erişim sırları veya tahmin edilmiş geçmiş saklanmaz.
- Kabul örnekleri: YAS-01. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Sağlayıcı parametresi kaydı aynı görselin yeniden üretileceğini garanti etmez; erişim sırları veya tahmin edilmiş geçmiş saklanmaz.

## Further Notes

- Tek faz kaynağı: [`13-production-provenance/phase-context.md`](../../workflow/13-production-provenance/phase-context.md).
- Kanonik teknik adlar: Manual Import Evidence, Provider Generation Record, User-Reported Provider Details, Legacy Asset Attestation, Managed Snapshot. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`IMP-03`](../../prd/04-ingestion-lifecycle-and-quality.md) — Üretim kaynakları.

**İlgili mimari sınırlar**

- [ADR 0009](../../adr/0009-managed-snapshots-are-provenance.md)

**Kabul izlenebilirliği**

- [YAS-01](../../prd/10-acceptance-scenarios.md)
- Bu spec davranış sözleşmesini tanımlar; teslimat durumu issue close-out ile raporlanır. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
