# 03 — Tarihsel Bileşimi Sabitleme

**What to build:** Kullanıcı **Tarihsel Bileşimi Sabitleme** adımını baştan sona tamamlar: Kullanıcı geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtlarını tek kesin bileşim için seçer. Uyumluluk raporu tarihsel seçimi ve çözülememiş engelleri gösterir.

**Blocked by:** 01 — Değişiklik Etkisini Belirleme; [05-asset-families / 02 — Ana Tasarımı Seçme ve Türetilmiş Varlıkları Bağlama](../../05-asset-families/issues/02-asset-families-02.md); [09-immutable-versioning / 01 — Birim Sürümünü seçici düzeltme](../../09-immutable-versioning/issues/01-immutable-versioning-01.md).

**Status:** ready-for-agent

- [ ] Kullanıcı geçmiş Bağlam Sürümü, Ana Tasarım, bağımlılıklar ve kalite kanıtlarını tek kesin bileşim için seçer. Uyumluluk raporu tarihsel seçimi ve çözülememiş engelleri gösterir.
- [ ] Etkilenen Türetilmiş Varlıklar güncel kullanım için yeni kanıt ister, etkilenmeyenler korunur; tarihsel bileşim yalnız bütün bağımlılıkları ve kalite kanıtı sabitlenince paketlenir.
- [ ] Kapsam sınırları korunur: Kalite İstisnası bağlama uygunluğu değiştirmez; birim değişimi eski bileşimi küresel olarak geçersiz kılmaz.

Kaynak spec: [spec.md](../spec.md).
