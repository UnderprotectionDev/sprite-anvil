# 03 — Paketi Çevrimdışı Doğrulama

**What to build:** Kullanıcı **Paketi Çevrimdışı Doğrulama** adımını baştan sona tamamlar: Eşleşen şema, checksum listesi, README ve çalıştırılamayan örnekler Workbench ve ayrı doğrulayıcıda aynı sonucu verir. Doğrulama kiti aynı ana sürümde şema, deterministik dosya özetleri, README ve çalıştırılamayan örnek eşlemeler taşır.

**Blocked by:** 02 — Değişmez Paketi Oluşturma; [09-immutable-versioning / 01 — Birim Sürümünü seçici düzeltme](../../09-immutable-versioning/issues/01-immutable-versioning-01.md); [16-quality-evidence / 02 — Kalite Kurallarını Değerlendirme](../../16-quality-evidence/issues/02-quality-evidence-02.md).

**Status:** ready-for-agent

- [ ] Eşleşen şema, checksum listesi, README ve çalıştırılamayan örnekler Workbench ve ayrı doğrulayıcıda aynı sonucu verir. Doğrulama kiti aynı ana sürümde şema, deterministik dosya özetleri, README ve çalıştırılamayan örnek eşlemeler taşır.
- [ ] Aynı girdiler aynı paketi üretir; web ve masaüstünde yeniden okunan manifest ile çevrimdışı doğrulayıcı aynı bütünlük sonucuna ulaşır.
- [ ] Kapsam sınırları korunur: Paket proje arşivi veya oyun motoru projesi değildir; çalıştırılabilir kurucu ve yetki taşıyan ajan talimatı içermez.

Kaynak spec: [spec.md](../spec.md).
