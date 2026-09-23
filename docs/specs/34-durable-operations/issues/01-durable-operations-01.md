# 01 — Yetkili İşlem Yaşam Döngüsü

**What to build:** Kullanıcı **Yetkili İşlem Yaşam Döngüsü** adımını baştan sona tamamlar: Bekleyen, çalışan, tamamlanan, başarısız ve iptal durumları taşıma altyapısından bağımsız kalıcı kayıtta izlenir. Her uzun iş için yetkili kayıt tetikleyiciyi, durum geçişini, ilerlemeyi ve kesin sonucu gösterir.

**Blocked by:** [33-atomic-records / 01 — Kesin kaydı atomik yayımlama](../../33-atomic-records/issues/01-atomic-records-01.md).

**Status:** ready-for-agent

- [ ] Bekleyen, çalışan, tamamlanan, başarısız ve iptal durumları taşıma altyapısından bağımsız kalıcı kayıtta izlenir. Her uzun iş için yetkili kayıt tetikleyiciyi, durum geçişini, ilerlemeyi ve kesin sonucu gösterir.
- [ ] Yetkili İşlem Yaşam Döngüsü sonucu kalıcı kayıttan yeniden okunur.
- [ ] Kapsam sınırları korunur: Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.

Kaynak spec: [spec.md](../spec.md).
