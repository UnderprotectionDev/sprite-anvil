# 01 — Referans Aktarım Kurallarını Yönetme

**What to build:** Kullanıcı **Referans Aktarım Kurallarını Yönetme** adımını baştan sona tamamlar: Kullanıcı bir referansın kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema için neyi aktarabileceğini ve hangi özelliklerden kaçınacağını açıkça belirler. Referans panosu yapıştırma, sürükleyip bırakma, yan yana düzenleme ve not eklemeyi destekler.

**Blocked by:** [03-project-context / 02 — Kural Sürümünü Doğrulama ve Etkinleştirme](../../03-project-context/issues/02-project-context-02.md).

**Status:** ready-for-agent

- [ ] Kullanıcı bir referansın kimlik, poz, stil, palet, ekipman, kompozisyon veya Tema için neyi aktarabileceğini ve hangi özelliklerden kaçınacağını açıkça belirler. Referans panosu yapıştırma, sürükleyip bırakma, yan yana düzenleme ve not eklemeyi destekler.
- [ ] Her referansın amacı ve izinli veya yasak aktarımı üretim geçmişinde izlenir; bir referanstaki açık yasak başka bir referanstaki izne üstün gelir.
- [ ] Kapsam sınırları korunur: Referansların eklenme sırası veya üretim modelinin yorumu sonucu değiştirmez; aktarım kurallarını kaydetmek tek başına Üretim Paketi oluşturmaz.

**Sonraki karar:** [#43](https://github.com/UnderprotectionDev/sprite-anvil/issues/43), aynı özellik için izin-yasak örtüşmesinin ele alınışını güncelledi: kullanıcı bir kuralı düzenleyene kadar çelişki çözülmüş sayılmaz ve bu sırada Üretim Paketi oluşturulamaz. Güncel sözleşme için [`11-production-package/spec.md`](../../11-production-package/spec.md) dosyasına bakın.

Kaynak spec: [spec.md](../spec.md).
