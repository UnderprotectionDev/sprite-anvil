# Portre Kimliği İncelemesi — #133

## Ne eklendi

Portre ifade sürümleri, kaynak piksel kırpması, kesin kullanım boyutu, diyalog/arayüz amacı ve açık/koyu/şeffaf arka plan yan yana incelenir. Kimlik, ifade ve yüz görünürlüğü gözlemlerini kullanıcı verir. Sonuç etkin Özel Profil Sözleşmesi ve kesin Ana Tasarım/sürüm soyuyla değişmez kayda yazılır ve yeniden okunur. Ortak Varlık Kimliği diğer ailelerle paylaşılabilir; ailelerin Görsel Dünya ve Ana Tasarım sınırları korunur. Portre kullanımı oyun içi tam sayı piksel ölçeğine zorlanmaz.

Sahiplik: QLT-02/QLT-03 (`docs/prd/05-asset-profiles.md`), RAS-08 (`docs/prd/10-acceptance-scenarios.md`), bu dizindeki `spec.md`, `docs/workflow/27-portrait-marketing-profile/phase-context.md`, `docs/CONTEXT.md` içindeki Portrait Identity Review. ADR 0002/0014 profil ve soy sınırlarını, 0003 iki yüzeyi, 0005 tarihsel kabulü, 0008 silinmiş içeriği, 0012 kullanıcı kararını korur. React/TanStack Query ve oRPC/Zod mevcut icon-family/background örneklerini izler; Drizzle/PostgreSQL kaydı sunucuda atomik doğrular. Yeni bağımlılık yok.

UI `apps/web/src/features/portrait-marketing-profile/ui/` altında, kalıcılık `apps/server/src/features/portrait-marketing-profile/server/` altında; ortak sözleşmeler API paketinde ve şema DB paketindedir. Logo/tanıtım incelemesi, kalite kanıtından otomatik onay ve dışa aktarım bu teslimde yok.

**Ortak ortam teslimi engelli.** Ortak veritabanında uygulanmış `20261013111405_rare_mattie_franklin` migration’ının doğrulanmış Git kaynağı bulunamadı. Kendi `20261013111409_broad_puma` migration’ımız uygulanmadı. `db:prepare` geçmiş uyuşmazlığı nedeniyle tamamlanamadı; `db:validate` kaynak kimliklerini/snapshot’ı doğruladıktan sonra ortak geçmiş uyuşmazlığını bildirdi; `db:ready` başarısız. Diğer migration’ın sahip kodu/şeması/SQL’i/snapshot’ı birlikte entegre edilmeden ortak DB uygulaması ve canlı veri hazırlığı yapılamaz. Uygulanmış geçmiş değiştirilmedi. Ortak ortamda hazır test hesabı veya portre kaydı oluşturulmadı.

Kaynak yeniden kontrol edildi: migration’ın sahibi #134 (`feat/logo-marketing-usage-evidence`), yerel sahip commit `511f0f20e1b1899fab91a3637d73841acb8df72f` (`feat: add logo and marketing usage reviews (#134)`). Commit uygulama kodunu, `packages/db/src/schema/marketing-usage-reviews.ts`, özgün migration SQL’ini ve snapshot’ı birlikte içerir. Commit’teki SQL’in SHA-256 değeri ortak DB’deki `c565cb9eff83fc03e6f867d82c7bdf3b6241e47f24da9dae765d5eeef3573f2a` ile eşleşir. Bu yerel eşleşme güvenilir uzak kaynak koşulunu karşılamaz: güncel `origin/main`, açık PR listesi ve sahip dalın uzak ref kontrolünde yayımlanmış kaynak bulunmadı. Son `db:doctor` ve `db:sync --check` kaynağı `unresolved` bildirdi; son `db:ready` uygulanmamış portre migration’ı nedeniyle başarısız oldu.

Engelin giderilmesi için #134 sahibi kod/şema/SQL/snapshot’ı içeren commit’i aynı repository’de PR olarak yayımlamalıdır. Ardından bu workspace’te temiz çalışma ağacından `bun run db:sync` ile sahip commit bütünüyle entegre edilmeli; snapshot soy çatışmaları çözüldükten sonra `bun run db:prepare`, ilgili testler ve `bun run db:ready` tamamlanmalıdır. Bu yeniden kontrolde DB uygulaması, ortak ortam veri hazırlığı veya canlı portre testi çalıştırılmadı.


## İnceleme

## Standards

Ayrı inceleyici bağlayıcı standart ihlali bulmadı. İki olası koku bildirdi: ölçek değişkenlerinin kısa adı düzeltildi; API ve SQL’deki uygunluk tekrarları eşzamanlı değişikliği atomik reddetmek için korundu ve gerekçesi kodda açıklandı.

## Spec

Ayrı inceleyici #133 portre kapsamı için eksik veya yanlış davranış bulmadı. Ortak ortam teslimi ve masaüstü doğrulaması hâlâ tamamlanmış sayılmaz.

Standards: 0 bağlayıcı ihlal, 2 değerlendirme önerisi (1 düzeltildi, 1 gerekçeyle korundu). Spec: 0 bulgu.

Doğrulama: API önce başarısız testle, ardından başarılı testle geliştirildi. Dört API ve dört React testi geçti. Yerel geçici PostgreSQL testi kaydı ikinci bağlantıdan yeniden okudu; yabancı kullanıcı, soy/kimlik/sözleşme kayması ve silinmiş sürümü sınadı. Tam paket iki worker ile 617 test geçti; 40 opt-in test atlandı. Tip kontrolü ve repo lint kontrolü geçti. Masaüstü native akışı çalıştırılmadı. Chromium tarayıcı testi de geçti: gerçek dosya yükleme, onay/soy bağı, geçersiz kırpma, 137 × 181 kullanım ölçüsü, başarısız kullanıcı gözlemi ve yenilemeden sonra kalıcı ayrıntılar doğrulandı. Ekran görüntüsü `.context/portrait-review.png` dosyasındadır. Önceki koşularda test sunucusunda Bun çökmesi görüldü; başarılı son koşu varsayılan Bun ayarlarıyla yapıldı.

## Nasıl test edilir

Web uygulamasında `/projects` sayfasından başlayın ve projenin sahibi olarak giriş yapın. Aşağıdaki akış ortak DB geçmişi uzlaştırılıp bu migration uygulandıktan sonra kullanılabilir. `Hero portraits`, `Neutral portrait` ve `Happy portrait` isimleri hazırlıkta oluşturulacak örneklerdir; ortak ortamda hazır oldukları iddia edilmez. İki ifadeyi gösteren, kaynakları bilinen PNG/WebP dosyalarınızı hazırlayın.

### Veri hazırlığı

Giriş yaptıktan sonra `/context-proposals` sayfasını açın.

1. `Proje adı` alanına `Hero Portrait Review` yazın.
2. `Genel sanat yaklaşımı` alanına `Illustrated character portraits` yazın.
3. `Projeyi oluştur` düğmesine tıklayın.
4. `Görsel Dünyalar ve Temalar` düğmesine tıklayın.
5. `Görsel Dünya adı` alanına `Illustrated portraits` yazın.
6. `Görsel Dünya ekle` düğmesine tıklayın; yeni dünya listelenir.
7. `/projects` sayfasını açın.
8. `Hero Portrait Review` projesindeki `Varlık Aileleri` bağlantısına tıklayın.
9. `Aile ve temsil ilişkileri` düğmesine tıklayın.
10. `Varlık Kimliği adı` alanına `Hero` yazın.
11. `Varlık Kimliği oluştur` düğmesine tıklayın.
12. `Varlık Ailesi adı` alanına `Hero portraits` yazın.
13. `Görsel Dünya` alanında `Illustrated portraits` seçin.
14. `Kullanım bağlamı` alanına `Dialogue` yazın.
15. `Varlık Ailesi oluştur` düğmesine tıklayın.
16. `Bağımsız ürün anlamı` kutusunu işaretleyin.
17. `Varlık Kaydı adı` alanına `Neutral portrait` yazın.
18. `Varlık Kaydı ekle` düğmesine tıklayın.
19. `Sürüm ve bağımlılık işlemleri` düğmesine tıklayın.
20. `Neutral portrait` kaydındaki `Varlık Sürümü yükle` bağlantısını açın.
21. `Kayıt bilgileri` düğmesine tıklayın.
22. `Varlık kategorisi` alanında `Portreler, logolar ve tanıtım görselleri` seçin.
23. `Metadata’yı kaydet` düğmesine tıklayın.
24. `Sürümler ve dosyalar` düğmesine tıklayın.
25. `PNG veya WebP dosyası` alanında ifadesiz portre dosyanızı seçin.
26. `Bilinmeyen üretim geçmişi` alanına bu dosyanın bilmediğiniz üretim geçmişini dürüstçe yazın.
27. `Bilinen kaynak` alanına dosyanın gerçek kaynağını yazın.
28. `Varlıkla ilişkiniz` alanında dosyanız için doğru ilişkiyi seçin.
29. `Aday sürümü kaydet` düğmesine tıklayın; `Aday Sürüm kaydedildi.` görünür.
30. Projenin `Varlık Aileleri` bağlantısını açın.
31. `Aile ve temsil ilişkileri` bölümünü açın.
32. İkinci ifadeyi `Happy portrait` adıyla oluşturmak için 16–30 arasındaki adımları ikinci dosyanızla tekrarlayın.
33. `Sürüm ve bağımlılık işlemleri` bölümünü açın.
34. `Neutral portrait` kaydındaki `İnceleme gerekçesi` alanına onay gerekçenizi yazın.
35. Aynı kayıttaki `Onayla` düğmesine tıklayın; sürüm `Onaylandı` olur.
36. Aynı kayıttaki `Ana Tasarım olarak seç` düğmesine tıklayın; `Ana Tasarım seçildi.` görünür.
37. `Aile ve temsil ilişkileri` bölümünü açın.
38. `İlişki türü` alanında `Türetilmiş Varlık` seçin.
39. `İlgili Varlık Kaydı` alanında `Happy portrait` seçin.
40. `İlişki ekle` düğmesine tıklayın; `İlişki kaydedildi.` görünür.
41. `Özel profil sözleşmeleri` bağlantısını açın.
42. `Portre, logo ve tanıtım görseli` düğmesine tıklayın.
43. Bu profilin `Sözleşmeyi etkinleştir` düğmesine tıklayın; etkin sözleşme görünür.

### Ana akış

Projenin `Varlık Aileleri` bağlantısı `/projects/<proje>/asset-families` sayfasını açar.

1. `Profil incelemeleri` düğmesine tıklayın; `Portre Kimliğini ve Kırpmayı İnceleme` bölümü görünür.
2. İlk `Portre sürümü` alanında `Neutral portrait · Sürüm 1` seçin.
3. İkinci `Portre sürümü` alanında `Happy portrait · Sürüm 1` seçin.
4. İlk `İfade adı` alanına `Neutral` yazın.
5. İkinci `İfade adı` alanına `Happy` yazın; iki önizleme kendi kullanım ölçülerinde görünür.
6. İlk `Kullanım genişliği` alanına `137` yazın.
7. İlk `Kullanım yüksekliği` alanına `181` yazın; tam sayı ölçek zorunluluğu olmadan bu ölçüde önizleme görünür.
8. `Kimlik tutarlılığı` alanında görsellere göre kararınızı seçin.
9. `Kimlik tutarlılığı notu` alanına gözleminizi yazın.
10. `İfade tutarlılığı` alanında kararınızı seçin.
11. `İfade tutarlılığı notu` alanına gözleminizi yazın.
12. `Kırpma ve yüz görünürlüğü` alanında kararınızı seçin.
13. `Kırpma ve yüz görünürlüğü notu` alanına gözleminizi yazın.
14. `İnceleme gerekçesi` alanına `Dialogue crop review` yazın.
15. `Portre incelemesini kaydet` düğmesine tıklayın; `Portre incelemesi kaydedildi.` görünür.

### Kalıcılık

1. Sayfayı yenileyin.
2. `Profil incelemeleri` bölümünü açın; `Kaydedilen portre incelemeleri` altında gerekçeniz görünür.
3. `İnceleme ayrıntılarını göster` kontrolünü açın; ifadeler, kırpmalar, ölçüler ve kendi gözlemleriniz korunur.

### Hata ve belirsiz kayıt

1. İlk `Kırpma X` alanına kaynak genişliğini aşan bir değer yazın; kırpma uyarısı görünür ve kayıt düğmesi kapanır.
2. Aynı alana `0` yazın; diğer zorunlu alanlar ve görseller uygunsa kayıt yeniden açılır.
3. Ağ hatasından sonra `Kaydı yeniden kontrol et` görünürse bu düğmeye tıklayın; aynı kayıt isteği kontrol edilir, farklı bir inceleme üretilmez.

Kaydedilmiş incelemeyi geri alma/silme kontrolü bu akışta yok; yeni inceleme geçmiş kaydı değiştirmez.
