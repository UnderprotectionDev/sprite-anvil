# 02 — Açık yasağı üretim paketine uygulama

**What to build:** Kullanıcı **Açık yasağı üretim paketine uygulama** adımını baştan sona tamamlar: Bir Referans Kullanım Amacı bir özelliğe izin verirken başka biri açıkça yasaklarsa Üretim Paketi oluşur, iki rolün sınırlarını saklar ve özelliği yasaklı tutar.

**Blocked by:** 01 — Üretim Bağlamı Kopyasını pakete sabitleme; [03-project-context / 02 — Kural Sürümünü Doğrulama ve Etkinleştirme](../../03-project-context/issues/02-project-context-02.md); [10-reference-production / 01 — Referans Aktarım Kurallarını Yönetme](../../10-reference-production/issues/01-reference-production-01.md).

**Status:** ready-for-agent

- [ ] Bir Referans Kullanım Amacı bir özelliğe izin verirken başka biri açıkça yasaklarsa Üretim Paketi oluşur; yeniden okunan pakette her iki rolün sınırı korunur ve yasaklı özellik aktarılmaz.
- [ ] Kullanıcı çelişkisiz, tek denemeye bağlı paketi inceleyip dış üretimde kullanır; paket ve bağlam kopyası sonradan değişmez.
- [ ] Kapsam sınırları korunur: Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.

Kaynak spec: [spec.md](../spec.md).
