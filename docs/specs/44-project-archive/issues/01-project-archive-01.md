# 01 — Temel Proje Kayıtlarını Arşive Alma

**What to build:** Kullanıcı **Temel Proje Kayıtlarını Arşive Alma** adımını baştan sona tamamlar: Sürümlü Proje Arşivi Bağlam Sürümlerini, varlık ilişkilerini ve dosyalarını, referans rollerini ve seçilmiş çalışma dosyalarını taşır. Arşive alınmayan büyük ikili kanıt kimlik ve özet bilgisiyle belirtilir; sırlar arşive girmez.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Arşiv yeniden okunduğunda Bağlam Sürümleri, varlık ilişkileri ve dosyaları, referans rolleri ve seçilmiş çalışma dosyaları aynı kaynak kayıtlarına bağlı kalır.
- [ ] Arşiv dışında bırakılan büyük ikili kanıtın kimliği, dosya özeti ve eksikliği manifestte görünür; ikili kanıt arşive kopyalanmış gibi sunulmaz.
- [ ] Şifreleme anahtarı, erişim belirteci ve sunucu sırrı arşiv içeriğinde ve manifestte bulunmaz.
- [ ] Arşiv oluşturma etkileşimli istekte güvenle tamamlanamıyorsa OPS-01 yetkili işlem kaydı kullanılır; kesinleştirme OPS-02 uyarınca atomik ve idempotenttir.

Kaynak spec: [spec.md](../spec.md).
