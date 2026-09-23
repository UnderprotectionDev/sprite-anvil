# 02 — Silme İşlemini Tamamlama

**What to build:** Kullanıcı **Silme İşlemini Tamamlama** adımını baştan sona tamamlar: Değişmez kapsayıcı kısmen yazılmaz; etkin ve yedek depodan temizleme izlenir, içeriksiz makbuz ve gerekiyorsa Silme Kaydı bırakılır. Seçilen paket veya arşiv bütünüyle kaldırılır ya da kapsam dışında kalır; manifest veya checksum listesi kısmen yeniden yazılmaz.

**Blocked by:** 01 — Silme Etki Dökümü Hazırlama; [34-durable-operations / 01 — Yetkili İşlem Yaşam Döngüsü](../../34-durable-operations/issues/01-durable-operations-01.md); [34-durable-operations / 02 — Güvenli İptal](../../34-durable-operations/issues/02-durable-operations-02.md); [37-export-bundles / 02 — Değişmez Paketi Oluşturma](../../37-export-bundles/issues/02-export-bundles-02.md).

**Status:** ready-for-agent

- [ ] Değişmez kapsayıcı kısmen yazılmaz; etkin ve yedek depodan temizleme izlenir, içeriksiz makbuz ve gerekiyorsa Silme Kaydı bırakılır. Seçilen paket veya arşiv bütünüyle kaldırılır ya da kapsam dışında kalır; manifest veya checksum listesi kısmen yeniden yazılmaz.
- [ ] Onaylanan kopyalar ve seçilen bütün kapsayıcılar etkin depodan ve yayımlanan takvim içinde yedeklerden temizlenir; kapsam dışı içerik açıkça belirtilir ve içeriksiz makbuzla sonuç doğrulanır.
- [ ] Silme işi geri döndürülemez sınırdan önce güvenle iptal edilebiliyorsa iptal sonucu yetkili kayda yazılır; güvenle durdurulamıyorsa iş gerçek tamamlanma sonucunu bildirir. Yinelenen teslim ikinci silme makbuzu oluşturmaz.
- [ ] Kapsam sınırları korunur: Harici kopyalar geri çağrılmış gibi sunulmaz; değişmez paket veya arşiv tek varlık için kısmen yazılmaz.
- [ ] Yayımlanmış yedek temizleme süresi ve operasyonel kanıt OV-08'i kapatmadan kalıcı silme kabulü tamamlanmış veya ürün desteği iddia edilmiş sayılmaz; fixture ve geliştirme çalışması bu parametreyi varsaymadan ilerleyebilir.

Kaynak spec: [spec.md](../spec.md).
