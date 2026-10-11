# #114 — Efekt Görünümünü ve Taşmasını Sınama

## Ne eklendi

Varlık Aileleri ekranı etkin efekt sözleşmesi bulunan efekt ailelerinde dört zeminli oynatma sunar. Karelerin kesin sürümü, kaynak alanı, hücre yerleşimi, süresi, döngüsü, opacity değeri, gerçek sahne sürümü, taşma izni ve kullanıcının gerekçeli sonucu değişmez inceleme kaydına yazılır ve yeniden okunur. Taşma kaynak kare alanından ölçülür; okunamayan görüntü/alpha ve kaynak dışı kırpım istisnayla geçemez. Mevcut Kalite İstisnası kesin Unit/Composite Version, kural ve ölçümle eşleşmelidir.

Sahip/olay eşzamanlama ve dışa aktarım #114 kapsamına dahil değildir. Yeni bağımlılık eklenmedi. Web ve masaüstü aynı React görünümünü kullanır; masaüstü uçtan uca çalıştırılmadı.

İzlenebilirlik: `docs/CONTEXT.md` içindeki Specialized Asset Profile / Quality Waiver; QLT-02 ve QLT-03 için `docs/prd/05-asset-profiles.md`; uygulama sahibi `docs/specs/23-vfx-profile/spec.md`; faz `docs/workflow/23-vfx-profile/phase-context.md`; mimari sınırlar ADR 0002, 0003, 0011 ve 0012. Seçilen yığın `docs/tech-stack.md` içindeki React/PixiJS, oRPC/Zod ve Drizzle/PostgreSQL. Yakın örnekler `packages/api/src/routers/animation-timing-reviews.ts`, `apps/server/src/features/character-animation-profile/server/animation-timing-review-store.ts` ve `apps/web/src/features/character-animation-profile/ui/components/animation-timing-review-manager.tsx`.

Ortak geliştirme veritabanının migration geçmişi bu dalın kaynağından ayrışıyor: `20261011092251_thick_donald_blake`. Güvenilir yayımlanmış kaynak bulunamadı. `db:prepare` ve `db:ready` ortak hedefi hazırlayamadı. Ortak hedefe migration uygulanmadı, canlı deneme kaydı oluşturulmadı; teslim hazır değildir. Yeni SQL ve snapshot bu issue ile birlikte korunmuştur. Yerel geçici PostgreSQL doğrulaması ortak hedef doğrulaması değildir.

## İnceleme

### Standards

Dosya sahipliği `structure.md` ile, adlar `docs/CONTEXT.md` ile, bağımlılıklar `docs/tech-stack.md` ile karşılaştırıldı. Yetki ve kesin sözleşme/sürüm kontrolleri atomik yazım sınırında korunur. Üretici SQL ve snapshot birlikte incelendi. İki inceleme ekseni aynı ajan tarafından yürütüldü; bu oturumda alt ajan araçları sunulmadığı için bağımsız paralel inceleme yapılamadı.

### Spec

QLT-02/QLT-03, RAS-04 ve spec'in görünüm/taşma dilimi karşılaştırıldı. İzin yalnız taşma kararına uygulanır; zamanlama, kaynak ve alpha bütünlüğü gevşetilmez. İnsan okunurluk kararını kullanıcı verir. Ortak veritabanı hazırlığı ve masaüstü eşdeğerlik doğrulaması açık sınırlamalardır.

Doğrulama: ilgili API/PNG testlerinde 7 test ve 33 assertion, web form/yönetici testlerinde 5 test, geçici PostgreSQL testinde 1 test ve 8 assertion geçti. Tüm sunucu paketinde 243 test geçti, 27 çevresel entegrasyon testi atlandı. Veritabanı paketinin ilk çalıştırmasında iki süreç testi zaman aşımına uğradı; 60 saniye sınırıyla yeniden çalıştırmada 68 test geçti, 3 test atlandı. `check-types` ve production build geçti. Gerçek Chromium'da dört tuval, Play/Pause, döngü, 300 ms sonunda duran tek seferlik oynatma ve hatalı kaynak kırpımının kaydetmeyi engellemesi doğrulandı. Tarayıcı gerçek UI/renderer harness'ini kullandı; API kalıcılığı ayrı PostgreSQL testiyle doğrulandı. Masaüstü uçtan uca ve ortak hedef canlı akışı çalıştırılmadı.

Genel web paketinde 192 test geçti, 5 test başarısız oldu: family-readiness, asset-records, rights-record-panel ve project-access testleri. Zaman aşımı ve sonrasında karışan kullanıcı olayları görüldü. Bu dört dosya tek worker ve 60 saniye test sınırıyla yeniden çalıştırıldığında 56 testin tamamı geçti. İlk genel çalıştırma tam yeşil değildir; hata veren dosyaların tekrar doğrulaması yeşildir. Son ilgili dosyaların Ultracite kontrolü ve `git diff --check` geçti.

Kod incelemesi özeti: Standards 0 açık kod bulgusu; Spec 0 açık kod bulgusu. Ortak DB hazır teslim engeli ve masaüstü doğrulama açığı devam ediyor.

## Nasıl test edilir

Projenin sahibi hesabıyla web uygulamasında `/projects` sayfasını açın ve deneyeceğiniz projenin `Varlık Aileleri` bağlantısını kullanın. Hedef route `/projects/$projectId/asset-families`. Projede bir Görsel Dünya bulunmalıdır. Ortak veritabanı engeli giderilmeden aşağıdaki kaydetme akışı hazır değildir; önceden oluşturulmuş canlı test hesabı veya kayıt yoktur.

### Veri hazırlığı

Örnek olarak `Fire effects` ailesi, `Fire burst` efekt kaydı ve `Forest scene` sahne kaydı kullanın. Efekt için en az 24×16 piksel, şeffaf PNG; sahne için bir PNG/WebP seçin. Mevcut uygun kayıtlarınız varsa hazırlığı atlayabilirsiniz.

1. `Varlık Kimliği adı` alanına `Fire magic` yazın.
2. `Varlık Kimliği oluştur` düğmesine tıklayın.
3. `Varlık Ailesi adı` alanına `Fire effects` yazın.
4. `Görsel Dünya` alanında projenizin Görsel Dünyasını seçin.
5. `Kullanım bağlamı` alanına `Combat effects` yazın.
6. `Varlık Ailesi oluştur` düğmesine tıklayın; aile listede görünür.
7. `Bağımsız ürün anlamı` seçeneğini işaretleyin.
8. `Varlık Kaydı adı` alanına `Fire burst` yazın.
9. `Varlık Kaydı ekle` düğmesine tıklayın.
10. `Fire burst` kaydının `Varlık Sürümü yükle` bağlantısını açın.
11. `PNG veya WebP dosyası` alanından şeffaf efekt dosyanızı seçin.
12. `Bilinmeyen üretim geçmişi` alanına dosyanızın gerçek üretim geçmişini yazın.
13. `Bilinen kaynak` alanına dosyanızın gerçek kaynağını yazın.
14. `Varlıkla ilişkiniz` alanında gerçek ilişkinizi seçin.
15. `Aday sürümü kaydet` düğmesine tıklayın; `Aday Sürüm kaydedildi.` görünür.

Projenin Varlık Kayıtları ekranında `Fire burst` kaydının `Varlık kaydı metadata’sı` bölümünü açın. `Varlık kategorisi` alanından `Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri` seçin; ayrı bir eylem olarak `Metadata’yı kaydet` düğmesine tıklayın. Sahne için aynı kayıt oluşturma ve yükleme adımlarını `Forest scene` adıyla tekrarlayın; sahne kaydını efekt kategorisine çevirmek gerekmez.

Varlık Aileleri ekranındaki `Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri` sözleşme bölümünde `Sözleşme v… etkinleştir` düğmesine tıklayın. `Fire effects · Efekt Görünümünü ve Taşmasını Sınama` bölümü görünür.

### Ana akış

1. `Effect name` alanına `Fire burst review` yazın.
2. `Effect version` alanından `Fire burst · v1` seçin.
3. `Frame width` alanına `24` yazın.
4. `Offset x` alanına `-4` yazın; ölçülen taşma `4 px` olur.
5. `Scene version` alanından `Forest scene · v1` seçin; `light`, `dark`, `transparent`, `scene` tuvalleri görünür.
6. `Duration (ms)` alanına `200` yazın.
7. `Opacity` alanına `0.5` yazın; yarı şeffaf efekt dört zeminde görünür.
8. `Loop playback` seçeneğini işaretleyin.
9. `Play` düğmesine tıklayın; oynatma sürer.
10. `Pause` düğmesine tıklayın; oynatma durur.
11. `Permit intentional cell overflow` seçeneğini işaretleyin.
12. `Result` alanından gördüğünüz sonuca uygun kararı seçin.
13. `Review notes` alanına dört zemindeki görünüm ve taşma gerekçenizi yazın.
14. `Save VFX review` düğmesine tıklayın; `İnceleme kalıcı kayıttan doğrulandı.` görünür.

### Kalıcılık

1. Sayfayı yenileyin; listede `Fire burst review` görünür.
2. Listeden bu incelemeyi açın; kaydedilmiş değerler korunur ve düzenleme alanları kilitlidir. `Play`, `Pause`, `Restart` ile eski kaydı izleyebilirsiniz.

### Hata ve yeni inceleme

1. `Yeni inceleme` düğmesine tıklayın; boş bir inceleme açılır.
2. Yukarıdaki sürümleri seçip `Source x` alanına görüntü genişliğinden büyük bir sayı yazın; önizleme hata verir ve `Save VFX review` devre dışı kalır.

Taşan bir kareyle `Passed` kaydetmek için açık taşma izni veya ölçümü ve kesin sürümü karşılayan mevcut bir `Cell overflow Quality Waiver` gerekir. Kaydetmenin sonucu belirsizse form kilitlenir. `Güncel kayıtları kontrol et` ile aynı inceleme kalıcı kayıttan bulunana kadar yeniden gönderilemez. Kaydedilmiş incelemeyi değiştirme veya silme akışı eklenmedi.
