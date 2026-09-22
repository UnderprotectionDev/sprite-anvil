> [PRD içindekiler](README.md)

## 12. Doğrulama aşamaları

Doğrulama Aşamaları ürün sürümü, MVP, yayın vaadi veya kapsam önceliği değildir. Tam Ürün Kapsamındaki bütün zorunlu gereksinimler önemini korur. Aşamalar yalnız sonraki kanıtın dayanacağı temeli ve güvenli doğrulama sırasını gösterir. Bir aşamanın geçilmesi ürünü tamamlanmış ya da genel kullanıma hazır yapmaz; [Bölüm 10](12-completion-criteria.md)’daki bütün koşullar karşılanmadan Tam Ürün Kapsamı tamamlanmış sayılmaz.

### Aşama 1 — Domain omurgası ve referans uçtan uca akış

- Proje Bağlamı, kullanıcı etkinleştirmesi ve Üretim Bağlamı Kopyası çalışır.
- Bir karakter/animasyon ailesinde Ana Tasarım, Üretim Paketi, manuel içe aktarma, İnceleme Kaydı ve kalite kanıtı uçtan uca korunur.
- Tek bir hatalı Birim Sürümü değiştirilir; eski Birleşik Sürüm ve ilgisiz birimler değişmeden kalır.
- Aynı girdiler motor bağımsız ve çevrimdışı doğrulanabilir Dışa Aktarım Paketi üretir.

### Aşama 2 — Destek seviyeleri ve sekiz özel profil

- Genel Varlık Desteği, özel profil bulunmayan 2D Görsel Varlıklarda saklama, sürümleme, ilişkilendirme, inceleme ve dışa aktarmayı kanıtlar.
- Sekiz Özel Varlık Profilinin her biri sürümlü Özel Profil Sözleşmesi, kural sınıfları, insan incelemesi, kullanım testi ve dışa aktarım eşlemesiyle RAS senaryosunu geçer.
- Gerekli Öğeler Listesi aile içi tamamlanmayı, Teslimat Hedefi aileler arası kabulü ve Koleksiyon yalnız kullanıcı düzenlemesini temsil eder.

### Aşama 3 — Platform eşdeğerliği ve çevrimdışı hazırlık

- Web ve masaüstü aynı yetkili kayıt ve paket anlamına farklı arayüz adımlarıyla ulaşabilir.
- Çevrimdışı taslaklar bulut kaydını sessizce ezmez; çakışma kullanıcı kararıyla yeni değişmez kayıt üretir.
- Erişilebilirlik, klavye ve yardımcı teknoloji yolları temel üretim akışını tamamlar.

### Aşama 4 — Arşiv, teslimat ve oyun motoru doğrulaması

- Proje Arşivi bağımsız projeye ilişki ve kanıt bütünlüğünü koruyarak geri yüklenir.
- Teslimat Hedefi, Hazırlık Planı, Dışa Aktarım Paketi, Teslimat Gerçekleşmesi ve Teslimat Farkı ayrımı kanıtlanır.
- Ayrışma güvenli tek yönlü yenileme, Paket Doğrulama Kiti ve Godot referans proje sözleşmesi geçer.

### Aşama 5 — Operasyonel ve tam kabul matrisi

- Dayanıklı Arka Plan İşlemleri kesinti, yinelenen teslim, yeniden deneme, başarısız işler alanı, iptal ve uzlaştırma senaryolarını geçer.
- Operasyonel Kabul Profili, Desteklenen Platformlar Tablosu, performans/bellek sınırları, depolama ve silme takvimi gerçek ölçümle kapanır.
- [Bölüm 9](11-open-validations.md)’daki engelleyici açık doğrulamalar ve [Bölüm 11](13-decision-gates-and-research.md)’deki zorunlu karar kapıları sonuçlandırılır.
- [Bölüm 10](12-completion-criteria.md)’daki tamamlanma ölçütleri gereksinim kimlikleri ve kabul senaryolarıyla izlenebilir biçimde karşılanır.

