> [PRD içindekiler](README.md)

## 10. Tam Ürün Kapsamının tamamlanma ölçütleri

Ürün yalnızca dosya yükleme veya animasyon oynatma çalıştığında tamamlanmış sayılmaz. Aşağıdaki kanıtların tamamı gerekir:

- Sekiz özel profilin her biri etkin ve sürümlü Özel Profil Sözleşmesiyle kabul senaryosunu web ve masaüstünde baştan sona tamamlar; her kuralın sınıfı, kanıtı, istisna uygunluğu ve dışa aktarım eşlemesi doğrulanır.
- En az bir kabul akışında tek Birim Sürümü seçici biçimde değiştirilir. Eski, kabul edilmiş Birleşik Sürüm korunur. Yeni birleşik sürüm yalnızca seçilen birimi sabitler ve yalnızca etkilenen türevler yeniden doğrulanır.
- Etkin Gerekli Öğeler Listesi’ndeki tüm gerekli öğelerin Bağlama Uygun ve Dışa Aktarıma Hazır olduğu gösterilir.
- YAS-02 web ve masaüstünde tamamlanır; desteklenen JSON sidecar verisinden aynı Kaynak Metadata Eşleme Önerisi üretilir, zorunlu çakışmalar kullanıcı tarafından çözülür ve bilinmeyen geçmiş öneriden türetilmez.
- Proje Arşivi bağımsız yeni bir projeye geri yüklenir. Sürüm ilişkileri, inceleme kayıtları, kalite kanıtları ve istisnalar, Kaynak Metadata Eşleme Önerileri ve kullanıcı kararları, Sağlayıcı Üretim Kayıtları, üretim deneyleri ve tarifleri, Dışa Aktarım Profilleri ve Teslimat Yenileme Kilitleri, hak ve teslimat kayıtları, çalışma zamanı doğrulamaları ile dışa aktarım paketi bilgileri korunur; dahil edilen ve dışarıda bırakılan dosyaların özetleri doğrulanır.
- Aynı değişmez Dışa Aktarım Paketi sabitlenmiş bağlam ve varlık sürümleri, istisnalar, veri yapısı, Dışa Aktarım Profili ve motor bağdaştırıcısı bilgileriyle yeniden doğrulanır. Paket Doğrulama Kiti çevrimdışı doğrulamayı geçer ve çalıştırılabilir içerik taşımaz.
- OPS-01 kabul testinde yinelenen mesaj ikinci sonuç oluşturmaz; taşıma yayını veya yürütücü kesintisinden sonra outbox/uzlaştırma işlemi işi kaybetmeden yeniden teslim eder; deneme sınırını aşan iş başarısız işler alanına taşınır ve kullanıcıya başarısız durum gösterilir.
- YAS-05 beklenmeyen sunucu hatalarını Destek Referansı ile ilişkilendirir; güvenli okuma yeniden denemesi, belirsiz yazma sonucu, erişilebilir bildirim ve referanssız bağlantı hatası web/masaüstünde aynı anlamı korur.
- YAS-01 web ve masaüstünde tamamlanır; etkin Teslimat Hedefi, hesaplanan Hedef Hazırlığı, kullanıcı tarafından oluşturulan Teslimat Gerçekleşmesi, Teslimat Farkı ve Tarihsel Risk Bildirimi geçmişi değiştirmeden doğrulanır.
- YAS-03 web ve masaüstünde tamamlanır; hedef ayrışması kullanıcı kararı olmadan üzerine yazılmaz, tanınmayan dosya korunur ve iki yüzey aynı profil, kilit ve ayrışma sonucunu üretir.
- YAS-04 web ve masaüstünde tamamlanır; çevrimdışı taslak bulut kaydının üzerine yazılmaz, kullanıcı seçimi yeni ve idempotent kayıt üretir, silme etki dökümü gömülü bütün kopyaları gösterir ve değişmez paket ya da arşiv kısmen yeniden yazılmaz.
- [Bölüm 6](08-platform-and-operations.md)'daki bütün sözleşme aileleri için desteklenen aynı ana sürüm okuma, bilinmeyen zorunlu/ana sürümü reddetme, bilinmeyen isteğe bağlı alanı koruma ve yerinde değişiklik yapmayan idempotent göç fixture'ları web, masaüstü ve ilgili worker/doğrulayıcıda aynı sonucu verir.
- RAS-01, metadata roundtrip kaybını aşılamaz Bütünlük Denetimi olarak yakalar; zemin çizgisi ve loop değerlendirmesini profil sınıfına göre tamamlar.
- İlk doğrulanmış Godot motor bağdaştırıcısı, Desteklenen Platformlar Tablosu’nda yayımlanan referans proje sözleşmesini geçer.
- Desteklenen Platformlar Tablosu’ndaki her web ve masaüstü birleşimi temel üretim akışını ve ilgili kabul senaryolarını geçer.
- Operasyonel Kabul Profili’ndeki performans ve ölçek sınırları karşılanır.
- Web uygulamasındaki temel üretim akışı WCAG 2.2 AA kabulünü geçer. Masaüstü uygulaması eşdeğer klavye ve yardımcı teknoloji kontrollerini geçer.
- PRD, [CONTEXT.md](../CONTEXT.md) ve doğrudan ilgili ADR’ler arasında bilinen terim veya davranış çelişkisi kalmaz; İngilizce teknik ad ile Türkçe ürün etiketi eşlemeleri korunur.
- Tamamlanmayı engelleyen açık doğrulama kayıtları için gereken kanıt ve değer PRD’de yayımlanır. Yalnızca tabloda Tam Ürün Kapsamının tamamlanmasını engellemediği belirtilen kayıtlar çözümsüz kalabilir; doğrulanmamış özellikler destekleniyor diye sunulmaz.

Unity doğrulaması, telefon ve tablet uygulamaları, kendi sunucusunda barındırma ve tam çevrimdışı çalışma Tam Ürün Kapsamının tamamlanma kanıtlarına dahil değildir.
