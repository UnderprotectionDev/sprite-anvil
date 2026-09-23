# 02 — Toplu incelemede kararları ayırma

**What to build:** Kullanıcı **Toplu incelemede kararları ayırma** adımını baştan sona tamamlar: Toplu inceleme her uygun sürüm için ayrı İnceleme Kaydı üretir; engelli öğe sessizce atlanmaz. Geçmiş kararlar ve diğer durum eksenleri korunur.

**Blocked by:** 01 — Kesin sürüme İnceleme Kaydı yazma; [16-quality-evidence / 02 — Kalite Kurallarını Değerlendirme](../../16-quality-evidence/issues/02-quality-evidence-02.md).

**Status:** ready-for-agent

- [ ] Toplu inceleme her uygun sürüm için ayrı İnceleme Kaydı üretir; engelli öğe sessizce atlanmaz. Geçmiş kararlar ve diğer durum eksenleri korunur.
- [ ] Kullanıcının her kesin sürüm için verdiği son karar, zamanı ve gerekçesi geçmiş kararları silmeden izlenir; toplu işlemde her onay ayrı İnceleme Kaydıdır.
- [ ] Kapsam sınırları korunur: Onay geçmişi daha sonraki bağlam değişikliğinde silinmez; onay tek başına Bağlama Uygun veya Dışa Aktarıma Hazır sonucu değildir. Ajan ve bağlantı kullanıcı adına karar oluşturamaz.

Kaynak spec: [spec.md](../spec.md).
