# 02 — Block a Generation Package on conflicting transfer rules

**What to build:** Kullanıcı **Çatışan aktarım kuralıyla paketi durdurma** adımını baştan sona tamamlar: Aynı Varlık Kaydının referans kuralları aynı özelliğe hem izin verip hem yasaklıyorsa pano çelişen kuralları gösterir ve Üretim Paketi oluşmaz. Kullanıcı bir kuralı çözdükten sonra yeni, değişmez bir paket oluşturabilir.

**Blocked by:** 01 — Üretim Bağlamı Kopyasını pakete sabitleme; [03-project-context / 02 — Kural Sürümünü Doğrulama ve Etkinleştirme](../../03-project-context/issues/02-project-context-02.md); [10-reference-production / 01 — Referans Aktarım Kurallarını Yönetme](../../10-reference-production/issues/01-reference-production-01.md).

**Status:** implemented

- [x] Eş kapsamlı izin-yasak çelişkisi referans panosunda gösterilir ve Üretim Paketi oluşmaz. Kullanıcı kuralı çözdükten sonra yeni, değişmez paket oluşturabilir.
- [x] Kullanıcı çelişkisiz, tek denemeye bağlı paketi inceleyip dış üretimde kullanır; paket ve bağlam kopyası sonradan değişmez.
- [x] Kapsam sınırları korunur: Kullanıcı doğal dil talimatını ChatGPT veya başka üretim yüzeyinde yazar; manuel yol geçerlidir. Workbench kendi görsel üretim modelini veya zorunlu üretim API'sini sunmaz.

Kaynak spec: [spec.md](../spec.md).
