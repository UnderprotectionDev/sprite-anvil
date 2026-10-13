# #135 — Sahne Kalite Kontrolü Yapma

## Ne eklendi

`/projects/$projectId/scene-qa` ekranında kesin Varlık Sürümleri karo, arka plan, karakter, obje, gölge ve efekt olarak birlikte denenebilir. Kare alanları/süreleri, tam sayı ölçek, katman, Y sıralaması, hareket, isabet anı, kamera ve kontrast ayarlanır. Kullanıcı yazımlı noktalar ve alanlar görsel kılavuz olarak gösterilir. Altı ayrı gözlem; kaynak özeti, ölçüler, profil sözleşmesi snapshot’ı ve kullanım testi kimliğiyle değişmez sahne kanıtına kaydedilir ve yeniden okunur. Belirsiz kaydetme sonucu aynı kimlikle okunarak uzlaştırılır.

Sahne Kalite Kontrol Alanı seviye düzenleyicisi, fizik benzetimi, otomatik sanat/hukuk kabulü veya Çalışma Zamanı Doğrulama Kaydı üretmez. Gameplay Metadata kayıtlarını değiştirmez. Yeni bağımlılık eklenmedi.

İzlenebilirlik: `docs/CONTEXT.md` içindeki Scene QA Playground; `docs/prd/04-ingestion-lifecycle-and-quality.md` QLT-01; `docs/prd/06-scene-quality-and-pixel-editor.md` §4.10; `docs/specs/28-scene-qa/spec.md`; `docs/workflow/28-scene-qa/phase-context.md`; ADR 0003, 0006, 0012 ve 0017. Yığın: React/TanStack Query, PixiJS 8, oRPC/Zod ve Drizzle/PostgreSQL. Dosyalar `scene-qa-playground` özellik dizinlerinde, route kaydı `apps/web/src/routes/` altında; ortak sözleşme/API ve DB şeması ilgili paketlerde.

**Canlı teslim engeli:** Paylaşılan geliştirme DB’sinde uygulanmış `20261013111405_rare_mattie_franklin` migration’ı için güvenilir kaynak bulunamadı (hash `c565cb9eff83fc03e6f867d82c7bdf3b6241e47f24da9dae765d5eeef3573f2a`). `db:sync --check` kaynak ve ref bulamadı. Kendi `20261013111450_scene_qa_playgrounds` SQL/snapshot dosyaları korunuyor; migration uygulanmadı. `db:prepare`, `db:validate` ve son `db:ready` başarılı değil. Owning kod/şema/özgün SQL/snapshot birlikte güvenilir Git kaynağından uzlaştırılmadan canlı kayıt akışı hazır değildir. Canlı test hesabı veya deneme kaydı hazırlanmadı.

## İnceleme

### Standards

Adlar, dosya sahipliği, mevcut yığın ve kaynak üretme sınırları kontrol edildi. Yetki, kaynak pinleri, kategori ve etkin profil snapshot’ı DB ekleme sınırında yeniden doğrulanıyor. SQL yeni tablo/index/FK ile sınırlı. Aynı ajan tarafından inceleme yapıldı; alt ajan araçları sunulmadığı için bağımsız paralel inceleme yapılamadı. Açık kod bulgusu yok.

### Spec

QLT-01 ve §4.10’un bu issue’ya ait sahne kullanım dilimi karşılaştırıldı. Altı rol, hareket/geçiş, isabet efekti, katman/Y sıralaması, kamera, görsel kılavuzlar ve kullanıcı gözlemleri uygulanmış. İncelemede bulunan isteğe bağlı obje animasyonunun son karesini kaldırma sorunu, önce başarısız olan görünür bileşen testiyle düzeltildi. Açık kod bulgusu yok; canlı DB kalıcılığı ve masaüstü eşdeğerliği doğrulanmadı.

Doğrulama: API testleri 6 geçti; sahne web testleri 3 geçti; kontrollü API yanıtlarıyla gerçek Chromium/PixiJS uçtan uca testleri 3 geçti. DB paketi 94 geçti/8 atlandı; sunucu paketi 285 geçti/31 atlandı. Atlananlar çevresel entegrasyon testleridir. `check-types`, `check` ve `git diff --check` geçti. Tarayıcı kanıtı canlı PostgreSQL/R2 doğrulaması değildir.

Geniş web paketinin dört worker ile koşusunda 223 test geçti, 14 test başarısız oldu; zaman aşımları ve sonrasında karışan kullanıcı olayları görüldü. Hata veren 11 dosya ve sahne testlerinin tamamı tek worker ile yeniden çalıştırıldı: 45 test geçti. Ardından tüm web paketi tek worker ile yeniden çalıştırıldı: 52 dosyada 239 testin tamamı geçti. Son tarayıcı tekrarında da üç sahne senaryosu geçti.

İnceleme özeti: Standards 0 açık kod bulgusu; Spec 0 açık kod bulgusu. DB hazır teslim engeli ve masaüstü doğrulama açığı sürüyor.

## Nasıl test edilir

Web uygulamasında proje sahibi hesabıyla giriş yapıp `/projects` sayfasını açın. Kendi uygun projenizi kullanın. Aşağıdaki akış DB engeli giderilip sahne tablosu hazırlandıktan sonra denenebilir; bu çalışmada önceden oluşturulmuş canlı kayıt yoktur. `Forest usage check` yalnız otomatik tarayıcı testinin verisidir.

### Veri hazırlığı

Projede uygun kayıtlar ve etkin profiller varsa bu hazırlığı atlayabilirsiniz. Yeni deneme için `Scene QA manual` projesi ve kendi PNG/WebP dosyalarınız kullanılabilir. Dosyalar en fazla 5 MiB olmalı; karakter atlasındaki idle/walk/attack kare alanlarını bilmelisiniz.

1. `/projects` sayfasında `Yeni oyun projesi` düğmesine tıklayın.
2. `Oyun projesi adı` alanına `Scene QA manual` yazın.
3. `Genel sanat yaklaşımı` alanına `Pixel art scene comparison` yazın.
4. `Proje oluştur` düğmesine tıklayın; proje listede görünür.
5. Bu projenin `Varlık kayıtları` bağlantısını açın.
6. `Yeni varlık kaydı` düğmesine tıklayın.
7. `Varlık adı` alanına `QA character` yazın.
8. Deneme karakteri için `Bağımsız ürün anlamı` seçeneğini işaretleyin.
9. `Varlık kaydı oluştur` düğmesine tıklayın; kayıt listede görünür.
10. `QA character` kaydını açın.
11. `Sürümler ve dosyalar` bölümünde `PNG veya WebP dosyası` alanından karakter atlasınızı seçin.
12. `Bilinmeyen üretim geçmişi` alanına dosyanızın bilinmeyen üretim bilgilerini doğru biçimde yazın.
13. `Aday sürümü kaydet` düğmesine tıklayın; aday sürüm listede görünür.
14. `Kayıt bilgileri` bölümünü açın.
15. `Varlık kategorisi` alanında `Karakterler, yaratıklar ve animasyonlar` seçin.
16. `Metadata’yı kaydet` düğmesine tıklayın; kaydedildi bildirimi görünür.

Aynı kayıt ve dosya adımlarını aşağıdaki beş deneme kaydı için tekrarlayın. Her dosya kendi rolüne uygun olsun.

| Kayıt | Varlık kategorisi | Sahne rolü |
| --- | --- | --- |
| QA tile | Karo setleri, arazi ve kesintisiz dokular | tile |
| QA background | Arka planlar ve katmanlı kaydırma | background |
| QA object | Objeler, silahlar, ekipmanlar ve durum aileleri | object |
| QA shadow | Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri | shadow |
| QA effect | Görsel efektler, fırlatılan nesneler, gölgeler ve yüzey işaretleri | effect |

1. Proje menüsünden `Özel profil sözleşmeleri` bağlantısını açın.
2. Karakter profilinin bölümünü seçin.
3. `Sözleşmeyi etkinleştir` düğmesine tıklayın; `Bu projede etkin` görünür.

Son iki adımı karo, arka plan, obje ve görsel efekt profilleri için tekrarlayın. Gölge ve efekt aynı profili kullanır.

### Ana akış

1. Projenin `Sahne Kalite Kontrol Alanı` bağlantısını açın; `Scene QA Playground` görünür.
2. `Scene name` alanına `Six-role scene review` yazın.
3. `Role` alanında `character` seçin.
4. `Exact Asset Version` alanında `QA character · v1` ile başlayan sürümü seçin.
5. `Profile usage test` alanından denemek istediğiniz kullanım testini seçin.
6. `Add to scene` düğmesine tıklayın; karakter yerleşimi görünür.
7. Karakterin `Animation frames` bölümünde `idle`, `walk` ve `attack` için atlasınıza uygun kare alanlarını ve sürelerini ayarlayın; her alan ayrı bir kullanıcı eylemidir.

Rol/sürüm/kullanım testi seçme ve ekleme adımlarını tablodaki diğer beş kayıt için tekrarlayın. `Integer scale`, `Position X`, `Position Y` ve `Layer` ile yerleşimleri düzenleyebilirsiniz.

1. `Camera` alanında `Follow character` seçin.
2. `Contrast background` alanında `Light` seçin.
3. `Play scene` düğmesine tıklayın; idle → walk → attack → idle geçişi, hareket ve isabet anındaki efekt görünür. Oynatma `4000 / 4000 ms` değerine ulaşmalıdır.
4. `Scale and perspective` alanına gördüğünüz ölçek/perspektif sonucunu yazın.
5. `Layering and Y-sort` alanına örtüşme sonucunu yazın.
6. `Animation transitions` alanına geçiş sonucunu yazın.
7. `Hit event and effect` alanına isabet/efekt sonucunu yazın.
8. `Camera behavior` alanına kamera sonucunu yazın.
9. `Contrast and readability` alanına okunurluk sonucunu yazın.
10. `Save scene evidence` düğmesine tıklayın; `Scene evidence saved: Six-role scene review.` görünür.

### Kalıcılık

1. Sayfayı yenileyin; `Saved scene evidence` bölümünde `Six-role scene review` görünür.
2. Kaydı açın; gözlemler, kesin sürümler ve profil sözleşmeleri görünür.
3. `Replay saved scene` düğmesine tıklayın.
4. Açılan önizlemede `Play scene` düğmesine tıklayın; kaydedilen sahne yeniden oynar.

### Durdurma, değişiklik ve hata

1. Sahne oynarken `Pause scene` düğmesine tıklayın; görüntü durur.
2. `Reset playback` düğmesine tıklayın; süre sıfırlanır ve yeni tamamlanmış oynatma olmadan kaydetme kapalıdır.
3. `Walk displacement X` değerini değiştirin; yeni ayarlar yeniden oynatılmalıdır.

Obje için eklediğiniz isteğe bağlı `walk` veya `attack` karesini `Remove frame` ile tamamen kaldırabilirsiniz. Karakterin zorunlu kliplerinin ve tüm yerleşimlerin `idle` klibinin son karesi korunur. Okunamayan görsel önizleme hatası verir ve tamamlanmış oynatma kanıtı oluşturmaz. Kaydetme yanıtı belirsiz kaldığında `Check saved evidence` düğmesine tıklayın; bulunan aynı kayıt doğrulanır, bulunamazsa belirsizlik mesajı sürer. Kalıcı kanıt silme/geri alma akışı bu değişiklikte yoktur.
