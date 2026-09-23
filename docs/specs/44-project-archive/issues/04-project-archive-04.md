# 04 — Bağımsız Projeye Geri Yükleme

**What to build:** Kullanıcı **Bağımsız Projeye Geri Yükleme** adımını baştan sona tamamlar: Arşiv ilişki ve dosya bütünlüğünü koruyarak yeni bulut kimliklerine eşlenir; mevcut projenin üzerine yazılmaz veya otomatik birleşmez. Geri yükleme dosya özetlerini ve iç ilişkileri doğrular, ardından yeni bulut kimlikleriyle bağımsız proje kurar.

**Blocked by:** [03 — Teslimat ve Doğrulama Geçmişini Arşive Ekleme](03-project-archive-03.md).

**Status:** ready-for-agent

- [ ] Bağımsız geri yükleme bağlam, varlık/dosya, üretim/değerlendirme ve teslimat/doğrulama kayıtlarının ilişkilerini ve dosya özetlerini tutarlı kurar.
- [ ] Geri yükleme yeni bulut kimliklerini ayrı eşleme kaydında tutar; kaynak arşiv değişmez kalır ve mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.
- [ ] Geçersiz arşiv doğrulama hatası verir ve kısmi proje bırakmaz.
- [ ] Geri yükleme etkileşimli istekte güvenle tamamlanamıyorsa OPS-01 uyarınca yetkili arka plan işlem kaydıyla sürer; süre/boyut eşiği varsayılmaz.
- [ ] OV-09 desteklenecek arşiv/yükleme boyutu ve OV-10 operasyonel performans/bellek kanıtı kapanmadan arşiv kabulü tamamlanmış sayılmaz; fixture ve geliştirme çalışması bu değerleri varsaymadan ilerleyebilir.
- [ ] Kapsam sınırları korunur: Sırlar arşive konmaz; mevcut projeye sessiz üzerine yazma veya otomatik birleşme yapılmaz.

Kaynak spec: [spec.md](../spec.md).
