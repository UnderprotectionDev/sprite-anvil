# Portre Kimliği İncelemesi — #133

## Ne eklendi

Portre ifade sürümleri, kaynak piksel kırpması, kesin kullanım boyutu, diyalog/arayüz amacı ve açık/koyu/şeffaf arka plan incelenir. Kimlik, ifade ve yüz görünürlüğü gözlemlerini kullanıcı verir. Sonuç etkin Özel Profil Sözleşmesi ve kesin Ana Tasarım/sürüm soyuyla değişmez kayda yazılır ve yeniden okunur. Ortak Varlık Kimliği başka ailelerle paylaşılabilir; Görsel Dünya ve Ana Tasarım aile sınırları korunur. Portre kullanımı oyun içi tam sayı piksel ölçeğine zorlanmaz. Belirsiz yazımda `Kaydı yeniden kontrol et` yalnız kaydı yeniden okur; yazımı tekrarlamaz.

İzlenebilirlik: Portrait Identity Review (`docs/CONTEXT.md`); QLT-02/QLT-03 (`docs/prd/05-asset-profiles.md`); RAS-08 (`docs/prd/10-acceptance-scenarios.md`); `spec.md`; `docs/workflow/27-portrait-marketing-profile/phase-context.md`. ADR 0002/0014 profil ve soy sınırlarını, 0003 iki yüzeyi, 0005 tarihsel kabulü, 0008 silinmiş içeriği, 0012 kullanıcı kararını korur. React/TanStack Query, oRPC/Zod ve Drizzle/PostgreSQL mevcut icon-family/background örneklerini izler; native fixture `packages/db/scripts/marketing-usage-e2e.ts` örneğini izler. Yeni bağımlılık yok.

UI `apps/web/src/features/portrait-marketing-profile/ui/`, kalıcılık `apps/server/src/features/portrait-marketing-profile/server/`, ortak sözleşmeler API paketi ve şema DB paketi altındadır. Tanıtım kullanım/güvenli alan incelemesi ve sahne/UI değişiklikleri bu issue’nun yeni davranışı değildir; ortak migration geçmişi için sahip kaynakları entegre edildi. Dışa aktarım ve otomatik sanat kabulü bu teslimde yok.

Ortak DB engeli giderildi. Marketing kaynağı PR #136, kanonik UI geçmişi PR #138 (`8ddad9b`), sahne kaynağı PR #140 (`c67263c`) üzerinden tam kod/şema/SQL/snapshot ile doğrulandı. Otomatik kaynak çözümleyici rename/merge geçmişini bulamayınca PR head’leri ve özgün SQL hash’leri ayrıca karşılaştırılıp tam commit’ler birleştirildi. Kendi eski uygulanmamış migration’ımız isim ve hash üzerinden tek yetkili kalıcı hedefte yokluğu doğrulandıktan sonra `20261013122153_portrait_identity_reviews` olarak yeniden üretildi; SQL bytes/hash değişmedi. `db:prepare` portre migration’ını uyguladı. Son `db:ready` 76 migration ve fiziksel şemayı doğruladı. Uygulanmış dosyalar ve DB kayıtları değiştirilmedi. Ana daldaki artık kanonik olmayan `20261013121000_reconcile_ui_marketing_snapshots` uzlaştırması, SQL hash’i ve kimliği hiçbir kalıcı hedefte uygulanmamış olduğundan kaldırıldı; uygulanmış kanonik snapshot zinciri korundu.

Canlı web doğrulaması normal giriş, proje/aile/profil oluşturma, R2 dosya yükleme, onay/soy bağı, kırpma, kaydetme ve yenileme üzerinden gerçek geliştirme DB’sinde geçti. Hazır proje `Hero Portrait Review`, aile `Hero portraits`, kayıtlar `Neutral portrait` ve `Happy portrait`. Bu otomatik fixture iki aynı 32 × 32 test görselini kullanır; ifade ve sanat kalitesi hakkında gerçek insan kabulü değildir. Native Tauri/WebKit aynı canlı web kaydını açtı, `Desktop portrait crop review.` kaydını gerçek API üzerinden yazdı ve yenilemeden sonra yeniden okudu.

Masaüstü sınırı: HTTP üzerinde normal paketlenmiş Tauri girişinde Secure cookie korunmadı. Native portre doğrulamasında tek test hesabının normal auth handler tarafından verilmiş gerçek çerezi geçici loopback taşıma adaptörü ile iletildi; sahte oturum, sahte API kaydı veya yetki atlama kullanılmadı. Üretim cookie politikası değiştirilmedi; adaptörsüz native oturum eşdeğerliği veya üretim HTTPS davranışı doğrulanmış değildir. Tekrarlanabilir yüzey komutu `bun run test:e2e:portrait-review:surfaces` geçici PostgreSQL, bellek depolama, gerçek API/auth ve gerçek Tauri/WebKit kullanır; canlı DB’yi değiştirmez.

## İnceleme

## Standards

Bağımsız son incelemede açık bağlayıcı ihlal yok. Önceki ölçek değişkeni adlandırması düzeltildi. API/SQL uygunluk tekrarları eşzamanlı sözleşme/soy değişimini atomik reddetmek için korundu. Silinmiş sürüme ait içerikli incelemenin API’den gizlenmesi tarihsel satırı değiştirmez; SQL entegrasyon testi aynı kaydın saklandığını doğrular. Silme/tombstone iş akışı ayrı kapsamdadır.

## Spec

Bağımsız incelemede açık portre kusuru yok. Profilin ortak `portrait_logo_marketing` kategorisine ek alt tür zorunluluğu bulunmadığı normatif sözleşme üzerinden kontrol edildi. Gerçek native testin taşıma sınırı yukarıda açıklandı; adaptörsüz oturum başarı iddiası yok.

Standards: 0 açık bağlayıcı ihlal. Spec: 0 açık bulgu.

Doğrulama: ilk API seam’i ve son OPS-06 düzeltmesi önce başarısız odak testlerle geliştirildi. Dört API ve beş React testi geçti. Gerçek geçici PostgreSQL entegrasyonu ikinci bağlantıdan kalıcı okuma, yabancı kullanıcı, soy/kimlik/sözleşme kayması ve silinmiş sürümü sınadı (1 test, 9 assertion). Son tam pakette DB 94 geçti/8 atlandı, web 253 geçti, server 306 geçti/35 atlandı; toplam 653 geçti/43 opt-in test atlandı. Altı tip kontrol görevi ve repo lint kontrolü geçti. Canlı Chromium 1 test geçti; kontrollü oturum taşımasıyla canlı Tauri/WebKit 1 test geçti. Tekrarlanabilir `test:e2e:portrait-review:surfaces` koşusu da geçti: bir Chromium ve bir native Tauri/WebKit senaryosu aynı geçici PostgreSQL/API üzerinde kayıt ve yenileme yaptı. İlk native fixture denemesinde Origin göndermeyen korumalı görsel istekleri cookie taşımadığı için kayıt kapalı kaldı; test adaptörünün bu isteklere gerçek oturum cookie’sini iletmesiyle son koşu geçti. Ekran görüntüleri `.context/portrait-review.png` ve `.context/portrait-review-desktop.png` altındadır. İlk source merge/snapshot ve native hazırlık denemeleri başarısız olmuş; başarılı son koşular ayrı loglarda korunmuştur.

## Nasıl test edilir

Web uygulamasında `/projects/e5b71e81-6d7a-403d-a06c-40d1d8fc87e8/asset-families` route’unu açın. Normal Run’da `/projects` sayfasındaki `Hero Portrait Review` projesinin `Varlık Aileleri` bağlantısıyla aynı sayfaya gidilir. `portrait-2e413b55-69f5-4bdb-90c7-388a543d8ab7@example.test` hesabıyla giriş yapın; deneme şifresi yalnız gitignored `.context/portrait-live-result.json` dosyasındadır. `Hero portraits`, `Neutral portrait`, `Happy portrait` ve etkin portre profili hazırdır; yeni veri hazırlamanız gerekmez.

### Hazır kaydı ve kalıcılığı kontrol etme

1. `Profil incelemeleri` düğmesine tıklayın. `Portre Kimliğini ve Kırpmayı İnceleme` bölümü görünür.
2. `Dialogue crop needs follow-up.` kaydındaki `İnceleme ayrıntılarını göster` kontrolünü açın. `Neutral portrait` için 137 × 181 px kullanım ölçüsü, 8, 0, 24 × 32 kırpma ve başarısız yüz görünürlüğü gözlemi korunur.
3. Sayfayı yenileyin.
4. `Profil incelemeleri` bölümünü yeniden açın. Aynı inceleme görünür; varsa `Desktop portrait crop review.` kaydı da native testin kalıcı sonucudur.

### Yeni inceleme

1. İlk `Portre sürümü` alanında `Neutral portrait · Sürüm 1` seçin.
2. İkinci `Portre sürümü` alanında `Happy portrait · Sürüm 1` seçin.
3. İlk `İfade adı` alanına `Neutral` yazın.
4. İkinci `İfade adı` alanına `Happy` yazın.
5. İlk `Kullanım genişliği` alanına `137` yazın.
6. İlk `Kullanım yüksekliği` alanına `181` yazın. Önizleme bu kesin ölçüde görünür.
7. `Kimlik tutarlılığı` alanında kendi kararınızı seçin.
8. `Kimlik tutarlılığı notu` alanına gözleminizi yazın.
9. `İfade tutarlılığı` alanında kendi kararınızı seçin.
10. `İfade tutarlılığı notu` alanına gözleminizi yazın.
11. `Kırpma ve yüz görünürlüğü` alanında kendi kararınızı seçin.
12. `Kırpma ve yüz görünürlüğü notu` alanına gözleminizi yazın.
13. `İnceleme gerekçesi` alanına `Manual dialogue crop review` yazın.
14. `Portre incelemesini kaydet` düğmesine tıklayın. `Portre incelemesi kaydedildi.` görünür.
15. Sayfayı yenileyin.
16. `Profil incelemeleri` bölümünü açın. Yeni gerekçe kaydedilen incelemeler arasında görünür.

### Hata ve belirsiz kayıt

1. İlk `Kırpma X` alanına `40` yazın. 32 piksel kaynağın dışına çıkan kırpma uyarı verir ve kayıt kapanır.
2. Aynı alana `0` yazın. Diğer zorunlu alanlar ve görseller uygunsa kayıt yeniden açılır.
3. Ağ hatasından sonra `Kaydı yeniden kontrol et` görünürse bu düğmeye tıklayın. Yalnız mevcut kayıt yeniden okunur; yeni yazım gönderilmez. Sonuç bulunamazsa belirsizlik ve kayıt kilidi korunur.

Kalıcı incelemeyi silme/geri alma kontrolü yoktur; yeni inceleme geçmiş kaydı değiştirmez. Normal HTTP Tauri girişindeki oturum sınırlaması nedeniyle adaptörsüz masaüstü elle giriş akışı hazır sayılmaz.
