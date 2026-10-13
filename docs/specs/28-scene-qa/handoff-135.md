# #135 — Sahne Kalite Kontrolü Yapma

## Ne eklendi

`/projects/$projectId/scene-qa` ekranında kesin Varlık Sürümleri karo, arka plan, karakter, obje, gölge ve efekt olarak birlikte denenebilir. Kare alanları/süreleri, tam sayı ölçek, katman, Y sıralaması, hareket, isabet anı, kamera ve kontrast ayarlanır. Kullanıcı yazımlı noktalar ve alanlar görsel kılavuz olarak gösterilir. Altı ayrı gözlem; kaynak özeti, ölçüler, profil sözleşmesi snapshot’ı ve kullanım testi kimliğiyle değişmez sahne kanıtına kaydedilir ve yeniden okunur. Belirsiz kaydetme sonucu aynı kimlikle okunarak uzlaştırılır.

Sahne Kalite Kontrol Alanı seviye düzenleyicisi, fizik benzetimi, otomatik sanat/hukuk kabulü veya Çalışma Zamanı Doğrulama Kaydı üretmez. Gameplay Metadata kayıtlarını değiştirmez. Yeni bağımlılık eklenmedi.

İzlenebilirlik: `docs/CONTEXT.md` içindeki Scene QA Playground; `docs/prd/04-ingestion-lifecycle-and-quality.md` QLT-01; `docs/prd/06-scene-quality-and-pixel-editor.md` §4.10; `docs/specs/28-scene-qa/spec.md`; `docs/workflow/28-scene-qa/phase-context.md`; ADR 0003, 0006, 0012 ve 0017. Yığın: React/TanStack Query, PixiJS 8, oRPC/Zod ve Drizzle/PostgreSQL. Dosyalar `scene-qa-playground` özellik dizinlerinde, route kaydı `apps/web/src/routes/` altında; ortak sözleşme/API ve DB şeması ilgili paketlerde.

**Kaynak uzlaştırması:** Paylaşılan DB’nin uygulanmış geçmişi PR [#136](https://github.com/UnderprotectionDev/sprite-anvil/pull/136), [#138](https://github.com/UnderprotectionDev/sprite-anvil/pull/138) ve [#139](https://github.com/UnderprotectionDev/sprite-anvil/pull/139) kaynaklarından owning kod/şema/özgün SQL/snapshot birlikte entegre edilerek uzlaştırıldı. `20261013120647_ui_stretch_tests` için PR #138’in `8ddad9b` head’i; `20261013122153_portrait_identity_reviews` için PR #139’un `b55e92c` head’i origin üzerinden doğrulandı. Sahne migration’ının eski kimliği ve SQL hash’i tek yetkili kalıcı hedefte uygulanmamıştı. Bu doğrulamadan sonra migration `20261013122547_scene_qa_playgrounds` olarak kanonik generator ile yeniden üretildi; SQL bytes/hash (`5006e2461903ccdc76739cd70bdc608c270017b0a92ace10088619d6e01af400`) değişmedi, snapshot güncel şema ve parent zincirine bağlandı. Uygulanmış migration dosyaları veya DB kayıtları değiştirilmedi.

**Canlı doğrulama:** `db:validate` 76 migration’ın kaynak/şema doğrulamasını ve paylaşılan katalog ile pending SQL karşılaştırmasını geçti. Kilit bırakıldıktan sonra `db:prepare` bir sahne migration’ını uygulayıp geçmişi ve fiziksel şemayı yeniden doğruladı. Başka workspace sonlandırılmadı. Normal uygulama API’leriyle gerçek hesap, Görsel Dünya, Varlık Kimliği, Varlık Ailesi, altı aileye bağlı Varlık Kaydı ve altı 32×32 PNG/R2 dosyası oluşturuldu; beş profil etkinleştirildi. İlk hazırlıktaki altı aileye bağlanmamış deneme kaydı da aynı deneme projesinde korunuyor; sahne seçimi için aşağıdaki `Scene QA` kayıtlarını kullanın.

Gerçek tarayıcıda `Live six-role evidence 1791894890365` kaydı (`ef8dbe1b-7e5e-4a53-8637-9073c8d5e2be`) kaydedildi. Ayrı HTTP API okuması altı digest/ölçü/sürüm pini ve beş profil snapshot’ını doğruladı; sayfa yenilendi, kayıt yeniden açılıp oynatıldı. Oturumsuz okuma `401` verdi. Canlı test R2/Neon kullandı; bellek adaptörü veya disposable PostgreSQL kullanılmadı. Bu düz renkli dosyalar kalıcılık/ölçek/hareket kanıtıdır; sanatsal kabul değildir. Son `db:ready` geçti: 76 migration ve gerçek şema doğrulandı. Doğrulama için başlatılan API/web süreçleri kapatıldı; başka workspace süreçlerine dokunulmadı.


## İnceleme

### Standards

Adlar, dosya sahipliği, mevcut yığın ve kaynak üretme sınırları kontrol edildi. Yetki, kaynak pinleri, kategori ve etkin profil snapshot’ı DB ekleme sınırında yeniden doğrulanıyor. SQL yeni tablo/index/FK ile sınırlı. Aynı ajan tarafından inceleme yapıldı; alt ajan araçları sunulmadığı için bağımsız paralel inceleme yapılamadı. Açık kod bulgusu yok.

### Spec

QLT-01 ve §4.10’un bu issue’ya ait sahne kullanım dilimi karşılaştırıldı. Altı rol, hareket/geçiş, isabet efekti, katman/Y sıralaması, kamera, görsel kılavuzlar ve kullanıcı gözlemleri uygulanmış. İncelemede bulunan isteğe bağlı obje animasyonunun son karesini kaldırma sorunu, önce başarısız olan görünür bileşen testiyle düzeltildi. Açık kod bulgusu yok; canlı DB kalıcılığı normal API/R2/Neon akışında doğrulandı. Tauri/WebKit ve PixiJS üzerinde kontrollü masaüstü akışı geçti; native dropdown etkileşimi embedded driver sınırlaması nedeniyle DOM `change` sınırından sınandı.

Doğrulama: API testleri 6 geçti; sahne web testleri 3 geçti; kontrollü API yanıtlarıyla gerçek Chromium/PixiJS uçtan uca testleri 3 geçti. Son geniş koşuda web 57 dosyada 251 geçti; DB 94 geçti/8 atlandı; sunucu 306 geçti/35 atlandı. Atlananlar çevresel entegrasyon testleridir. `check-types`, `check` (738 dosya) ve `git diff --check` geçti. Son merge sonrası sahne/portre API doğrulamasında 22 test geçti.

Gerçek Tauri/WebKit test derlemesi ve tek sahne WebDriver senaryosu geçti: altı rol, tamamlanmış oynatma, altı gözlem, kaydetme, sayfayı yenileme, kayıt/pinleri yeniden açma ve PixiJS replay. Test loopback HTTP üzerinde kontrollü veriler kullanır; bulut kalıcılığı değildir. `SCENE_QA_DESKTOP_API_PORT=4323` ile çalıştırıldı; test binary’si `VITE_SERVER_URL=http://localhost:4323` ile derlendi. Diğer özelliklerin masaüstü entegrasyon paketleri çalıştırılmadı.

Kaynak entegrasyonu sırasında eski snapshot ile iki DB kaynak testi başarısız oldu; kanonik sahne migration’ı yeniden üretildikten sonraki tam DB koşusunda bütün 94 test geçti. Masaüstü test hazırlığında auth mock ve native select driver sınırları çözüldü; son refresh/readback senaryosu geçti.

İnceleme özeti: Standards 0 açık kod bulgusu; Spec 0 açık kod bulgusu. Canlı migration uygulaması, fixture ve DB kalıcılığı doğrulandı. Bağımsız alt ajan incelemesi yapılmadı; masaüstünün HTTP sınırı kontrollüdür, canlı bulut testi web yüzeyinde yapıldı.


## Nasıl test edilir

Web uygulamasında `/projects/9e9fd815-8e7b-4fa9-82bb-3bbf539e9852/scene-qa` route’unu açın. Canlı doğrulama `http://localhost:4321` yüzeyinde yapıldı; normal Run’da aynı route’u uygulamanın web adresinde kullanın. `scene-qa-bfbaa500-bcfe-4a2b-8f69-d50e906aa08c@example.test` hesabıyla giriş yapın. Deneme şifresi bu workspace’in gitignored `.context/scene-qa-live-fixture.json` dosyasındadır; kaynak koda veya GitHub’a eklenmedi. `Scene QA #135 live verification` projesi, `Scene QA six-role family` ailesi ve aşağıdaki altı kayıt hazırdır. Yeni veri oluşturmanız gerekmez.

| Varlık Kaydı | Role |
| --- | --- |
| Scene QA tile | tile |
| Scene QA background | background |
| Scene QA character | character |
| Scene QA object | object |
| Scene QA shadow | shadow |
| Scene QA effect | effect |

### Hazır kanıtı açma

1. `Saved scene evidence` bölümündeki `Live six-role evidence 1791894890365` kaydını açın; altı gözlem, kesin sürümler ve profil sözleşmeleri görünür.
2. `Replay saved scene` düğmesine tıklayın.
3. `Play scene` düğmesine tıklayın; karakter hareket eder, idle → walk → attack → idle geçişi ve isabet anında efekt görülür. Oynatma `4000 / 4000 ms` değerine ulaşır.
4. Sayfayı yenileyin; aynı kanıt listede kalır.

### Yeni sahne kaydetme

1. `Scene name` alanına `Six-role manual review` yazın.
2. `Role` alanında `character` seçin.
3. `Exact Asset Version` alanında `Scene QA character · v1` ile başlayan sürümü seçin.
4. `Profile usage test` alanından kullanım testini seçin.
5. `Add to scene` düğmesine tıklayın; karakter yerleşimi görünür.

Rol, sürüm, kullanım testi ve ekleme adımlarını tablodaki diğer beş kayıt için tekrarlayın. Hazır dosyalar 32×32 olduğu için varsayılan kare alanları uygundur. `Integer scale`, `Position X`, `Position Y`, `Layer` ve `Animation frames` ile farklı kullanım koşulları denenebilir.

1. `Camera` alanında `Follow character` seçin.
2. `Contrast background` alanında `Light` seçin.
3. `Play scene` düğmesine tıklayın; oynatma `4000 / 4000 ms` değerine ulaşmalıdır.
4. `Scale and perspective` alanına ölçek gözleminizi yazın.
5. `Layering and Y-sort` alanına örtüşme gözleminizi yazın.
6. `Animation transitions` alanına geçiş gözleminizi yazın.
7. `Hit event and effect` alanına isabet/efekt gözleminizi yazın.
8. `Camera behavior` alanına kamera gözleminizi yazın.
9. `Contrast and readability` alanına okunurluk gözleminizi yazın.
10. `Save scene evidence` düğmesine tıklayın; `Scene evidence saved: Six-role manual review.` görünür.
11. Sayfayı yenileyin; yeni kayıt `Saved scene evidence` listesinde kalır.
12. `Six-role manual review` kaydını açın; gözlemler ve kaynak pinleri kaydettiğiniz değerlerle görünür.

### Durdurma, değişiklik ve hata

1. Sahne oynarken `Pause scene` düğmesine tıklayın; görüntü durur.
2. `Reset playback` düğmesine tıklayın; süre sıfırlanır ve tamamlanmış yeni oynatma olmadan kaydetme kapalıdır.
3. `Walk displacement X` değerini değiştirin; yeni ayarlar yeniden oynatılmalıdır.

İsteğe bağlı obje `walk`/`attack` kareleri `Remove frame` ile tamamen kaldırılabilir. Karakterin zorunlu klipleri ve yerleşimlerin son `idle` karesi korunur. Okunamayan görsel hata verir ve tamamlanmış oynatma oluşturmaz. Kaydetme yanıtı belirsiz kaldığında `Check saved evidence` aynı kayıt kimliğini yeniden okur; bulunamazsa belirsizlik mesajı sürer. Kalıcı kanıt silme/geri alma akışı yoktur.
