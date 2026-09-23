# 02 — Çatışan aktarım kuralıyla paketi durdurma

**What to build:** Kullanıcı **Çatışan aktarım kuralıyla paketi durdurma** adımını baştan sona tamamlar: Eş kapsamlı çözülmemiş referans çatışması gösterilir ve Üretim Paketi oluşmaz. Kullanıcı kuralı çözdükten sonra yeni kesin paket oluşturabilir.

**Blocked by:** 01 — Üretim Bağlamı Kopyasını pakete sabitleme; [03-project-context / 02 — Kural Sürümünü Doğrulama ve Etkinleştirme](../../03-project-context/issues/02-project-context-02.md); [10-reference-production / 01 — Referans Aktarım Kurallarını Yönetme](../../10-reference-production/issues/01-reference-production-01.md).

**Status:** ready-for-agent

- [ ] Eş kapsamlı çözülmemiş referans çatışması gösterilir ve Üretim Paketi oluşmaz. Kullanıcı kuralı çözdükten sonra yeni kesin paket oluşturabilir.
- [ ] Kullanıcı çelişkisiz, tek denemeye bağlı paketi inceleyip dış üretimde kullanır; paket ve bağlam kopyası sonradan değişmez.
- [ ] Kapsam sınırları korunur: Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.

Kaynak spec: [spec.md](../spec.md).
