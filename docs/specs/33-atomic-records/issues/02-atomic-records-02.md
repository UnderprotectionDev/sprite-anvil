# 02 — Yinelenen isteği aynı sonuca bağlama

**What to build:** Kullanıcı **Yinelenen isteği aynı sonuca bağlama** adımını baştan sona tamamlar: Aynı idempotency anahtarıyla yinelenen kesinleştirme aynı kayıt kimliğini verir. Kesinti ve özet uyuşmazlığı ikinci sonuç veya sahte başarı üretmez.

**Blocked by:** 01 — Kesin kaydı atomik yayımlama.

**Status:** ready-for-agent

- [ ] Aynı idempotency anahtarıyla yinelenen kesinleştirme aynı kayıt kimliğini verir. Kesinti ve özet uyuşmazlığı ikinci sonuç veya sahte başarı üretmez.
- [ ] Kesinti ve tekrar fixture’larında kesin kayıt tek kez oluşur; yarım işlem görünür başarısız veya yeniden denenebilir durumda kalır.
- [ ] Kapsam sınırları korunur: Arka plan taşıma mesajı yetkili kayıt yerine geçmez; işin yürütülmesi ayrı uzun işlem akışıdır.

Kaynak spec: [spec.md](../spec.md).
