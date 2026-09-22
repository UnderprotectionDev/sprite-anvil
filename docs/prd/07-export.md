> [PRD içindekiler](README.md)

## 5. Dışa aktarım

**EXP-01 — Aileler arası teslimat hedefi.** Kullanıcı demo, bölüm, güncelleme veya başka bir teslimat amacı için birden fazla Varlık Ailesini kapsayan sürümlü bir Teslimat Hedefi tanımlayabilir. Teslimat Hedefi gerekli Varlık Ailelerini, aile içindeki gerekli öğeleri, kullanım testlerini ve kabul koşullarını tanımlar; aile içi Gerekli Öğeler Listesinin yerine geçmez. Hedef tamamlanmamış olabilir ve kendi başına teslim edilmiş içerik kanıtı sayılmaz. Planlama sırasında kesin Varlık Sürümlerini sabitlemez; sürümler Dışa Aktarım Paketi oluşturulunca sabitlenir. Bir veya daha fazla Dışa Aktarım Paketi hangi Teslimat Hedefi sürümünü gerçekleştirdiğini belirtir. Ajanlar ve kurallı sistem hedef taslağı hazırlayabilir; taslak, kullanıcı hedef sürümünü etkinleştirene kadar Hazırlık Planını veya resmî Hedef Hazırlığını değiştiremez.

Her Teslimat Hedefi sürümü, değerlendirmede kullanılacak Bağlam Sürümü’nü, ilgili Gerekli Öğeler Listesi sürümlerini ve hedef politikalarını sabitler. Etkin bağlam veya listeler değiştiğinde hedef sessizce yeni kuralları izlemez. Kullanıcı hedefi yeni tabana taşımayı seçerse yeni bir Teslimat Hedefi sürümü oluşur; ürün eski ve yeni taban arasındaki kapsam, kural ve tamamlanma farklarını gösterir.

Teslimat Hedefi, kapsamındaki hangi öğelerin tam Üretim Paketi geçmişi gerektirdiğini, hangilerinde Geçmiş Varlık Beyanı kabul edildiğini ve hangilerinde eksik geçmişin yalnız görünür uyarı olduğunu belirleyen bir Üretim Kanıtı Politikası taşıyabilir. Politika hedefe özgüdür; onaylanmış bir geçmiş varlığın başka hedeflerde kullanılmasını kendiliğinden engellemez.

Teslimat Hedefi, kapsamındaki hangi referanslar ve sonuçlar için Hak Kaydı gerektiğini ve kullanıcının kabul ettiği kayıt durumlarını tanımlayabilir. Hedefin Hak Kanıtı Politikası’nı karşılamayan öğe hedefin tamamlanmasını engeller, fakat başka bir hedefe veya genel dışa aktarıma evrensel engel oluşturmaz. Ürün politikanın karşılanıp karşılanmadığını hesaplar; lisansın hukuki yeterliliğine kendisi hükmetmez.

Ürün, Teslimat Hedefi için engelleri, bu engellere bağlı işleri, bir karar veya düzeltmenin açacağı işleri ve beklenen yeniden doğrulama etkisini gösteren bir Hazırlık Planı üretir. Önerilen sıra; hedef zorunluluğunu, açılacak bağımlı işleri, kullanıcı önceliğini ve beklenen yeniden doğrulama maliyetini ayrı gerekçeler olarak gösterir. Bunlar gizli tek bir puana indirgenmez. Kullanıcı sıralamayı değiştirebilir. Sistem sonraki işi ve gerekçesini önerebilir; üretimi, onayı, bağlam etkinleştirmeyi veya başka bir kullanıcı kararını kendiliğinden başlatamaz.

Bir Teslimat Hedefi birden fazla Dışa Aktarım Paketi ile karşılandığında kullanıcı değişmez bir Teslimat Gerçekleşmesi oluşturur. Gerçekleşme, hedefteki her gereksinimi karşılayan kesin paket ve Varlık Sürümlerine eşler. Aynı gereksinimi karşılayan paketler arasında çakışma varsa kullanıcı hangisinin geçerli olduğunu belirlemeden gerçekleşme tamamlanamaz. Sonraki paket veya seçim değişikliği geçmiş gerçekleşmeyi değiştirmez; yeni bir Teslimat Gerçekleşmesi oluşturur.

Sistem Teslimat Gerçekleşmesi için eşleme taslağı hazırlayabilir ve eksik ya da çakışan kapsamı gösterebilir; değişmez gerçekleşmeyi yalnız kullanıcı oluşturur. Teslimat Hedefinin sistem tarafından hesaplanan Hedef Hazırlığı ile Teslimat Gerçekleşmesine dayanan Teslim Durumu ayrı tutulur. Bütün kabul koşullarının karşılanması hedefi Hazır yapabilir, ancak geçerli bir Teslimat Gerçekleşmesi olmadan hedef Teslim Edildi sayılmaz.

Yeni bir Hak Kaydı sürümü geçmiş bir Teslimat Gerçekleşmesinin sabitlediği hedef politikasıyla uyuşmayan yeni bir risk gösterirse ürün gerçekleşmeye değişmez bir Tarihsel Risk Bildirimi bağlar. Bildirim teslimatın tarihsel Teslim Edildi durumunu değiştirmez; riskli kaynağı, yeni Hak Kaydı sürümünü, etkilenen kullanımı ve saptama zamanını gösterir. Aynı içeriğin yeni hedef veya dışa aktarımda kullanılması güncel Hak Kaydı ve hedef politikasıyla yeniden değerlendirilir.

Kullanıcı iki Teslimat Gerçekleşmesini karşılaştırabilir. Teslimat Farkı; eklenen, çıkarılan ve değişen Varlık Sürümlerini, Bağlam Sürümlerini, kalite kanıtı ve istisnalarını, Hak Kaydı sürümlerini, çalışma zamanı kanıtlarını ve paket eşlemelerini ayrı ayrı gösterir. Fark geçmiş gerçekleşmelerden hiçbirini kendiliğinden geçersiz kılmaz.

**EXP-02 — Motor bağımsız ve değişmez paket.** Oyun Motorundan Bağımsız Paket, ürünün temel dışa aktarım biçimidir. Her Dışa Aktarım Paketi değişmezdir. Paket; Proje Bağlamı sürümünü, Gerekli Öğeler Listesi sürümünü, seçilen Birim ve Birleşik Sürümleri, kalite kanıtlarını ve istisnaları, veri yapısı sürümünü, kullanılan Dışa Aktarım Profili sürümünü ve varsa doğrulanmış motor bağdaştırıcısının sürümünü sabitler.

**Dışa Aktarım Profili**, yerleşim, padding, trim, ölçek, dosya biçimi ve metadata eşleme seçimlerinin sürümlü kümesidir. Kullanıcı yeni paket için bir profil sürümü seçer. Profil değişikliği geçmiş paketi veya profil sürümünü değiştirmez; yeni profil sürümü ve onu kullanan yeni Dışa Aktarım Paketi oluşturur. Aynı girdiler, aynı profil ve aynı bağdaştırıcı sürümü aynı dosya yerleşimi ve içerik özetlerini üretmelidir.

Son dışa aktarım işareti değiştirilebilir; ancak her zaman belirli bir değişmez Dışa Aktarım Paketi’ni gösterir.

Paket; seçilen görsel dosyalarını ve kare bölümlerini, dönüş noktalarını, kare sürelerini, yön ve durum bilgilerini, animasyon olaylarını, doku ve ölçekleme tercihlerini, ayrıca kullanıcı tarafından incelenmiş isteğe bağlı oyun içi bilgileri taşır. Kullanıcı PNG, ayrı kareler, animasyon karelerini içeren görsel sayfası ve profilin desteklediği diğer biçimleri seçebilir.

Her Oyun Motorundan Bağımsız Paket bir **Paket Doğrulama Kiti** taşır. Kit, paket veri yapısı sürümüyle tam eşleşen JSON Schema’yı, bütün teslim dosyalarının deterministik checksum listesini, insan tarafından okunabilir kısa README’yi ve çalıştırılabilir olmayan statik örnek eşlemeleri içerir. Workbench aynı paketi ağ erişimi olmadan yeniden okuyup schema, checksum ve ilişki bütünlüğünü doğrulayabilir. Ayrı sürümlenmiş doğrulayıcı aynı sonucu üretmelidir. Pakete çalıştırılabilir betik, kurucu veya karar yetkisi taşıyan ajan talimatı konmaz.

**EXP-03 — Ayrışma güvenli yenileme.** Bir Dışa Aktarım Paketi bir teslimat konumuna uygulandığında **Teslimat Yenileme Kilidi**, Sprite Anvil’in yazdığı göreli yolları, içerik özetlerini, paket kimliğini ve Dışa Aktarım Profili sürümünü hedefle eşler. Kilit yalnız Sprite Anvil’in önceki teslimatta sahiplendiği yollar için karşılaştırma yapar; tanımadığı dosyaları değiştirmez veya silmez. Yenileme yalnız kullanıcı tarafından başlatılır ve seçilen değişmez paketten hedefe doğru tek yönlüdür.

Yenileme öncesinde hedef dosyalar kilitle karşılaştırılır. Değişmemiş, güncellenecek, bayat, hedefte eksik ve **ayrışmış** yollar ayrı gösterilir. Ayrışmış yol, önceki teslimattan sonra hedefteki içeriğin açıklanamayan biçimde değiştiği yoldur. Etkilenen yenileme kapalı durumda kalır; kullanıcı hedef dosyayı koruyabilir, yeni bir teslimat konumu seçebilir veya farkı gördükten sonra açıkça değiştirmeyi onaylayabilir. Çözüm işlemi geçmiş Dışa Aktarım Paketini değiştirmez, hedefi Workbench’in yetkili kaynağı yapmaz ve ayrı bir Tüketim Makbuzu oluşturmaz.

Web ve masaüstü aynı Dışa Aktarım Profili, kilit biçimi ve ayrışma sınıflarını üretir. Web uygulaması indirilebilir değişiklik paketi, kilit ve ayrışma raporu sunar. Masaüstü uygulaması ayrıca kullanıcı tarafından seçilmiş klasöre açık dosya sistemi izniyle uygulayabilir. Haricî bir aracın CLI komutunu keşfetme veya otomatik çalıştırma Tam Ürün Kapsamının önkoşulu değildir.

Geçmiş bir Proje Bağlamı sürümü veya Ana Tasarım kullanılarak da dışa aktarım paketi üretilebilir. Bunun için bütün bağımlılıklar açıkça sabitlenmelidir. Uyumluluk raporunda istisna verilmemiş, çözülmemiş bir Yeniden Doğrulama Gerekli öğesi bulunmamalıdır.

Godot için doğrulanmış motor bağdaştırıcısı, desteklediğini duyurduğu Godot sürümlerinde sürdürülen referans projelerle sınanır. Sınamalar kare alanlarını, dönüş noktalarını, zamanlamayı, olayları, doku ayarlarını ve geçerliyse karo ya da arayüz davranışlarını kapsar. Her dışa aktarım kullanılan bağdaştırıcı sürümünü belirtir.

Unity ancak kendi referans proje sözleşmesini geçtiğinde doğrulanmış motor bağdaştırıcısı sayılır.


