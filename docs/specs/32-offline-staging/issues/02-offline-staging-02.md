# 02 — Çakışma Kaydını Çözme

**What to build:** Kullanıcı **Çakışma Kaydını Çözme** adımını baştan sona tamamlar: Taban, güncel bulut ve yerel taslak karşılaştırılır; kullanıcı yeni Aday Sürüm, taslağı koruma veya açık bırakma kararı verir. Yeniden bağlanınca taban sürüm güncelse normal kesinleştirme yürür; bulut ilerlediyse üç sürümlü Çakışma Kaydı açılır.

**Blocked by:** 01 — Çevrimdışı Hazırlık Yapma.

**Status:** ready-for-agent

- [ ] Taban, güncel bulut ve yerel taslak karşılaştırılır; kullanıcı yeni Aday Sürüm, taslağı koruma veya açık bırakma kararı verir. Yeniden bağlanınca taban sürüm güncelse normal kesinleştirme yürür; bulut ilerlediyse üç sürümlü Çakışma Kaydı açılır.
- [ ] Bağlantı kesilip geri geldiğinde taslak kaybolmaz veya bulut sürümünü sessizce ezmez; kullanıcı seçimi yeni ve idempotent sonuç oluşturur.
- [ ] Kapsam sınırları korunur: Tam çevrimdışı onay, bağlam etkinleştirme veya doğrulanmış dışa aktarım bu özelliğin kapsamı değildir.

Kaynak spec: [spec.md](../spec.md).
