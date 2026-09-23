# 01 — Değişiklik Etkisini Belirleme

**What to build:** Kullanıcı **Değişiklik Etkisini Belirleme** adımını baştan sona tamamlar: Doğrudan ve dolaylı Türetilmiş Varlıklar ile eksik tanımlanmış bağlantılar Yeniden Doğrulama Gerekli olarak görünür. Yalnız değişiklik tanımıyla eşleşen açık bağımlılıklar etkilenir; eksik bağımlılık güvenli tarafta işaretlenir.

**Blocked by:** [05-asset-families / 02 — Ana Tasarımı Seçme ve Türetilmiş Varlıkları Bağlama](../../05-asset-families/issues/02-asset-families-02.md); [09-immutable-versioning / 01 — Birim Sürümünü seçici düzeltme](../../09-immutable-versioning/issues/01-immutable-versioning-01.md).

**Status:** ready-for-agent

- [ ] Doğrudan ve dolaylı Türetilmiş Varlıklar ile eksik tanımlanmış bağlantılar Yeniden Doğrulama Gerekli olarak görünür. Yalnız değişiklik tanımıyla eşleşen açık bağımlılıklar etkilenir; eksik bağımlılık güvenli tarafta işaretlenir.
- [ ] Değişiklik Etkisini Belirleme sonucu kalıcı kayıttan yeniden okunur.
- [ ] Kapsam sınırları korunur: Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.

Kaynak spec: [spec.md](../spec.md).
