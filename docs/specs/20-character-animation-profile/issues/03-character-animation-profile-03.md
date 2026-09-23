# 03 — Animasyon Metadata Bütünlüğünü Doğrulama

**What to build:** Kullanıcı **Animasyon Metadata Bütünlüğünü Doğrulama** adımını baştan sona tamamlar: Pivot, zemin noktası, mount point, çarpışma alanı ve olay bağlantıları kare kimlikleriyle roundtrip kaybı olmadan korunur. Kareye bağlı pivot, zemin çizgisi, mount point, çarpışma alanı ve olay bilgisi içe aktarma, düzenleme, paketleme ve yeniden okumada aynı kimliği korur.

**Blocked by:** [16-quality-evidence / 01 — Özel Profil Sözleşmesini Etkinleştirme](../../16-quality-evidence/issues/01-quality-evidence-01.md).

**Status:** ready-for-agent

- [ ] Pivot, zemin noktası, mount point, çarpışma alanı ve olay bağlantıları kare kimlikleriyle roundtrip kaybı olmadan korunur. Kareye bağlı pivot, zemin çizgisi, mount point, çarpışma alanı ve olay bilgisi içe aktarma, düzenleme, paketleme ve yeniden okumada aynı kimliği korur.
- [ ] Farklı süreli yön ve kareler, olay ve bağlantı bilgileriyle incelenir; sorunlu tek kare düzeltilip eski bileşim korunarak paketlenebilir.
- [ ] Kapsam sınırları korunur: Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.

Kaynak spec: [spec.md](../spec.md).
