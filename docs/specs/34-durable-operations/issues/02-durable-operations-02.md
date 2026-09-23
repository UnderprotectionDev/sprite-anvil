# 02 — Güvenli İptal

**What to build:** Kullanıcı **Güvenli İptal** adımını baştan sona tamamlar: Kullanıcı geri döndürülemez sınırdan önce iptal isteyebilir; güvenle durmayan iş tamamlanıp sonucu dürüstçe bildirilir. Kullanıcı geri döndürülemez sınırdan önce iptal ister ve kesin iptal sonucunu görür.

**Blocked by:** 01 — Yetkili İşlem Yaşam Döngüsü; [33-atomic-records / 01 — Kesin kaydı atomik yayımlama](../../33-atomic-records/issues/01-atomic-records-01.md).

**Status:** ready-for-agent

- [ ] Kullanıcı geri döndürülemez sınırdan önce iptal isteyebilir; güvenle durmayan iş tamamlanıp sonucu dürüstçe bildirilir. Kullanıcı geri döndürülemez sınırdan önce iptal ister ve kesin iptal sonucunu görür.
- [ ] Kesinti ve yinelenen teslim altında her iş tek kesin sonuç üretir; kullanıcı ilerleme, hata, yeniden deneme ve güvenli iptal sonucunu görebilir.
- [ ] Kapsam sınırları korunur: Kuyruk veya worker sağlayıcısı kendi başına ürün fazı değildir; taşınma mesajı yetkili iş kaydının yerine geçmez.

Kaynak spec: [spec.md](../spec.md).
