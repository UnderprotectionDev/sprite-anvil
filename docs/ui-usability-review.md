# Mevcut arayüz incelemesi

Seçili issue veya kanonik GitHub eki bulunmadı. Genel görev. Başlangıç çalışma ağacı temiz.

## Orient ve Stack

Terimler: Project, Project Context, Context Proposal, Visual World, Theme, Asset Record, Subject Identity, Asset Family, Collection, Required Set, Asset Version, Gameplay Metadata, Generation Package, Rights Record — `docs/CONTEXT.md`.

| Alan | PRD sahibi | Spec | Workflow | Etkilenen ADR |
|---|---|---|---|---|
| Proje ve ortak gezinme | OPS-04/05/06, `docs/prd/08-platform-and-operations.md` | `docs/specs/48-platform-equivalence/spec.md` | `docs/workflow/48-platform-equivalence/phase-context.md` | `docs/adr/0003-require-web-and-desktop-product-surfaces.md` |
| Bağlam/kapsam | CTX-01/02/03, `docs/prd/03-project-and-asset-foundations.md` | `docs/specs/03-project-context/spec.md`, `docs/specs/04-visual-worlds/spec.md` | `docs/workflow/03-project-context/phase-context.md`, `docs/workflow/04-visual-worlds/phase-context.md` | 0001, 0012 |
| Varlık listesi/ayrıntısı | AST-03/05, DIM-03, `docs/prd/03-project-and-asset-foundations.md` | `docs/specs/06-asset-records/spec.md`, `docs/specs/07-asset-discovery/spec.md` | `docs/workflow/06-asset-records/phase-context.md`, `docs/workflow/07-asset-discovery/phase-context.md` | 0002, 0006 |
| Aile ve inceleme | AST-04, AST-07, `docs/prd/03-project-and-asset-foundations.md`, `docs/prd/04-ingestion-lifecycle-and-quality.md` | `docs/specs/05-asset-families/spec.md`, `docs/specs/15-family-readiness/spec.md`, `docs/specs/16-quality-evidence/spec.md`, `docs/specs/18-dependency-revalidation/spec.md` | aynı adlı `docs/workflow/` fazları | 0002, 0005, 0006, 0012, 0014 |
| Koleksiyonlar | AST-05 | `docs/specs/08-collections/spec.md` | `docs/workflow/08-collections/phase-context.md` | none (kontrol edildi) |
| Gelen kutusu | IMP-03/04, `docs/prd/04-ingestion-lifecycle-and-quality.md` | `docs/specs/12-import-mapping/spec.md` | `docs/workflow/12-import-mapping/phase-context.md` | 0006, 0012 |
| İzinler | OPS-03 | `docs/specs/02-tool-permissions/spec.md` | `docs/workflow/02-tool-permissions/phase-context.md` | 0010, 0012 |
| Kayıt alt işleri | IMP-01/02/03, VER-01 ve aynı dosyanın Hak Kaydı hükümleri (`docs/prd/04-ingestion-lifecycle-and-quality.md`); QLT-02/03 ve karakter profilindeki Oyun İçi Bilgiler hükümleri (`docs/prd/05-asset-profiles.md`) | `docs/specs/09-immutable-versioning/spec.md`, `docs/specs/11-production-package/spec.md`, `docs/specs/14-rights-evidence/spec.md`, `docs/specs/19-gameplay-metadata/spec.md` | aynı adlı workflow fazları | 0005, 0006, 0012 |

Etkilenen ADR yolları:

- `docs/adr/0001-agent-maintained-project-context-is-authoritative.md`
- `docs/adr/0002-use-extensible-asset-support-levels.md`
- `docs/adr/0003-require-web-and-desktop-product-surfaces.md`
- `docs/adr/0005-separate-historical-approval-from-current-applicability.md`
- `docs/adr/0006-version-replaceable-units-and-compositions.md`
- `docs/adr/0010-external-visual-analysis-is-explicit-opt-in.md`
- `docs/adr/0012-reserve-consequential-decisions-for-the-user.md`
- `docs/adr/0014-scope-canonical-designs-by-visual-world.md`

Kural kararları, etkinleştirme, onay ve sürüm sınırları değişmiyor. Spec'lerde eski “ürün sözleşmesi bulunmuyor” notları mevcut çalışan bileşenlerle çelişiyor; bunlar teslim iddiası olarak kullanılmadı. Arayüz düzeni PRD gereksinimi kabul edilmedi.

Stack: `docs/tech-stack.md` Frontend React, TanStack Router/Query, Tailwind CSS 4, Base UI; Testing Vitest/Testing Library/Playwright. `apps/web/package.json` incelendi. Yakın örnekler: `components/header.tsx`, `features/projects/ui/views/projects-view.tsx` (dialog), `features/asset-records/ui/views/asset-records-view.test.tsx`, `e2e/projects-navigation.spec.ts`. Yeni bağımlılık/platform yok.

Ownership: `structure.md` uygulandı. Ortak çalışma alanı gezinmesi `apps/web/src/components/`, özellik düzeni kendi `features/*/ui/` sahiplerinde, route kayıtları `routes/` içinde. Route ağacı elle düzenlenmedi. Sunucu/şema/API ve veri yetkisi değişmiyor.

## Öncelikli bulgular

1. Yüksek — ana giriş teknik API durumunu gösteriyor; başlangıç ve dashboard gerçek işe götürmüyor.
2. Yüksek — proje alanları arasında tutarlı gezinme yok; Bağlam ana bağlantısı proje seçimini yitiriyor.
3. Yüksek — kayıt ayrıntısı dönüşü root grid'e üçüncü satır ekliyor; sabit viewport ve sayfa kaydırması çakışıyor.
4. Yüksek — ailelerde bütün ailelerin bütün incelemeleri ve bağımsız formlar bir sayfada; kayıt ayrıntısında metadata, ölçü, sürüm, üretim, haklar birbirini gölgeliyor.
5. Yüksek — kütüphane oluşturma → liste → aynı kayıtların ayrı arama sonuçları sırası; arama sayfanın sonunda.
6. Orta — Proje Bağlamı kapsam formları, öneri yazımı ve öneri incelemesi aynı anda; öneriler ayrıca kaydırılıyor.
7. Orta — aile katalog hatasında içerik boş kayboluyor; önkoşuldan bağlam/kayıt/özel profil alanına doğrudan geçiş eksik.
8. Orta — profil sözleşmelerinde bütün profillerin etkinleştirme formları aynı anda uzun liste; koleksiyonlar ve gelen kutusunda listeler içerik arttığında uzuyor.

## İncelenen mevcut ekran ve akışlar

`/`, `/login` (sign-in/sign-up), `/dashboard`, `/projects` (oluşturma, yükleme, boş, belirsiz yazma), `/context-proposals` (proje seçimi, dünya/tema, öneri oluşturma/inceleme/etkinleştirme), `/projects/$projectId/assets` (oluşturma, liste, arama/filtre, sürüm bağlantısı), `/projects/$projectId/assets/$assetRecordId` (arşiv/geri alma, metadata, ölçü, sürüm/dosya, aile/türev, oyun içi bilgiler, animasyon metadata, üretim paketi/referans, elle içe aktarma, haklar), `/collections` (seçim, üyelik, kayıt açma), `/asset-families` (kimlik/aile/ilişki, katalog, gerekli öğeler, profil incelemeleri, birim/bileşim/sürüm/bağımlılık), `/import-inbox` (yükleme, bekleyen dosyalar, kaynak metadata eşleme), `/profile-contracts` (sözleşme inceleme/etkinleştirme), `/access` (izin verme/geri alma, harici analiz).

Arşiv, teslimat, bağımsız piksel stüdyosu gibi PRD'de planlanan fakat mevcut route olmayan ekranlar eklenmedi. Profil testleri ilgili mevcut aile alt alanları üzerinden incelendi; her profilin gerçek verili kabul senaryosu ayrı doğrulama gerektirir.

## Uygulanan iyileştirmeler

Yüksek öncelikli bulgular için başlangıç, ortak proje gezinmesi, kayıt dönüşü ve tek belge kaydırması değiştirildi. Kütüphanede bulma/oluşturma; kayıt ayrıntısında inceleme/düzenleme/üretim/haklar; bağlamda öneri hazırlama/inceleme/kapsam; ailede katalog/ilişki/tamamlanma/profil/sürüm görevleri ayrıldı. Gizli alanlar mounted kaldığından aynı ekranda görev değişimi taslağı korur. Referans panosu üretim alanına taşındı. Ayrıntılı filtreler açılır bölümde kaldı. Katalog üyeleri kendi kayıt ayrıntısına açılır. Profil sözleşmeleri tek bir yerde seçilerek yönetilir. Gelen Kutusu yükleme ve bekleyen dosya görevlerini ayırır. Koleksiyon oluşturma listeyi gölgelemez. Okuma hataları yeniden deneme, bilinmeyen sayfa ve render hataları projelere dönüş sunar.

## Sınırlar ve kalan işler

- Alan seçimi URL'de saklanmaz; geri dönüş/yenileme varsayılan görevle başlar. Taslak koruması aynı ekranın görev geçişleri içindir, route değişimi veya tarayıcı yenilemesi için değildir.
- Gizli görevler mounted kalır ve mevcut sorgularını çalıştırır. Büyük proje/listelerin sayfalama ve performans ölçümü ayrı iş olarak kalır.
- Gelen Kutusunda Kaynak Metadata Eşleme Önerisi olan dosyaların hedef kayıt seçimi ve kesinleştirme formu mevcut. Böyle bir önerisi olmayan sıradan dosyalar için genel hedef ilişkilendirme yolu eksik; bu çalışma yeni API/DB yeteneği eklemedi.
- Sürüm, kanıt, aile ilişkileri ve üretim görevlerinde ayrıntılı formlar gerekliliğini korur. Tüm profil kabul senaryoları ve yoğun gerçek veriyle kullanılabilirlik tekrar incelenmelidir.
- Bazı spec son notlarındaki genel “yalnız temel kabuk” ve “ürün sözleşmesi bulunmuyor” ifadeleri mevcut uygulamaya göre eskidir. Yeni görünüm kararları ve test seam'leri eklendi; bu notlar tam ürün kabulü iddiası sayılmadı.
- Canlı DB, native masaüstü, ekran okuyucu, destek matrisi, yüksek veri hacmi ve tüm PRD kabul senaryoları bu UI testleriyle doğrulanmış değildir.

## Gerçek doğrulama

- `bun run --cwd apps/web test`: 50 dosyada 236 test geçti. Görev değişiminde taslak koruma, kayıt bağlantıları, başlangıç eylemleri, filtre görünürlüğü ve mevcut özellik testleri dahil.
- `DIRECTIONAL_E2E_WEB_PORT=4311 DIRECTIONAL_E2E_API_PORT=4312 bun run --cwd apps/web test:e2e --workers=1`: 27 test geçti, özel test veritabanı/depo gerektiren 15 test atlandı. İlk çalışmada yeni görev seçimine uyarlanmamış üç Oyun İçi Bilgiler testi başarısızdı; görev seçimi eklenince doğrulandı. Depoya bağımlı texture senaryosuna diğer kalıcılık testlerindeki açık önkoşul eklendi.
- Tam paketten sonra eklenen dar pencere görev taraması ayrıca çalıştırıldı: altı alandaki bütün görev panelleri için bir ek test geçti.
- Yeni `workspace-usability.spec.ts`: dokuz ekran 1440 ve 390 px genişlikte, yatay taşma ve main içinde ek kaydırma olmadan; proje alanları arasında gidiş/dönüş; oluşturma dialogunu Escape ile kapatma ve odağın dönüşü; kayıt taslağı; okuma hatası/yeniden deneme; filtre ayrıntıları; Bağlamın proje seçimini URL'ye yazması; bilinmeyen route ve render hatasından kurtulma; dolu katalogda kaydı açma ve yalnız seçili ailenin kanıtları.
- `bun run check`: Ultracite kontrolü geçti. `bun run --cwd apps/web check-types`: TypeScript ve production build geçti. Build'de mevcut 500 kB üzeri bundle uyarısı sürüyor. `git diff --check` geçti.
- Router üretim kontrolünün tam suite içindeki mevcut 5 saniyelik sınırı kaynak yarışında aşıldı. Tek başına geçen aynı testin timeout'u 15 saniyeye çıkarıldı; assertion değişmedi ve tam suite geçti.
- Native masaüstü senaryolarının görev/gezinme adımları güncellendi. Tauri/WebDriver çalıştırılmadı. Canlı DB/R2 yazması, yükleme ve kalıcılık kabulü çalıştırılmadı; bir migration veya schema değişimi yapılmadı.
- Ek geçici E2E TypeScript kontrolü geçmedi: native test ortamı tipleri/Browser global tanımları ve mevcut fixture `kind`/AccountFixture uyuşmazlıkları var. Bu ek kontrol repo'nun standart `check-types` kapsamının dışındadır; E2E dosyaları için tüm tip kontrollerinin geçtiği iddia edilmez.
- Ekran görüntüleri gerçek tarayıcıdan alındı; Moonlit Vale/Ash Knight kontrollü test yanıtlarıdır, kullanıcının canlı veritabanına eklenmedi. Dokuz desktop ekranın tamamı ve dar kütüphane, kayıt, bağlam, profil, gelen kutusu, izin ekranları; dolu aile kataloğu ve seçili aile kanıt ekranı görsel olarak incelendi. Görüntüler development araçlarının göstergelerini içerir.
- Ayrı bağımsız code review istenmedi ve çalıştırılmadı. Bu kayıt uygulama/test özdenetimidir.
