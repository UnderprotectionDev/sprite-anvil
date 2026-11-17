Title: Complete audit remediation across product workflows and architecture

## Summary

API ve sözleşme düzeyinde kalan üretim, paketleme, arşiv ve silme yeteneklerini kullanıcı ekranlarına ve gerçek worker yaşam döngüsüne bağlar. Form hatalarını, hazırlık/kanıt hesaplamasını, tasarım ve modül sınırlarını düzeltir.

```text
Project screens
  → typed API and visible validation
  → immutable records / durable Background Operation
  → managed object ownership and verified publication
  → authorized readback and explicit failure/retry
```

Kapsam ve PRD izleri: [remediation spec](https://github.com/UnderprotectionDev/sprite-anvil/blob/review/spec-completion-audit/docs/audit-remediation-spec.md). İnceleme: [Standards / Spec](https://github.com/UnderprotectionDev/sprite-anvil/blob/review/spec-completion-audit/docs/audit-remediation-review.md).

## Evidence

- **Before:** Restore kayıtları yalnız envanterde kalabiliyor; aynı anahtar yarışında bir girişim diğerinin dosyasını silebiliyor; ZIP silme kapsamı dışında kalabiliyordu.
  **After:** Gerçek canonical transaction readback, girişim başına anahtar, PUT öncesi kalıcı sahiplik ve owner silme kapısı. Yarış ve hata testleri önce başarısız, sonra başarılı; sekiz PostgreSQL testi / 57 assertion geçti.
- **Before:** Geçersiz formlarda görünür açıklama eksikti; profil/paket, deney ve tarif API'ları uygulamadan tamamlanamıyordu.
  **After:** Gerçek routed ekranlar, TanStack Form, doğrulama/çatışma/belirsiz sonuç yolları ve güvenli yeniden deneme.
- Ana test zinciri: 1.935 başarılı, 79 atlanan; tür, lint ve conventions geçti, yalnız üç eski baseline istisnası kaldı.
- Gerçek Chromium: 49 başarılı, DB gerektiren 23 atlanan; Godot 4.3/4.4/4.5 stable macOS arm64 golden testleri geçti; Tauri build ve üç smoke testi geçti. Native klavye iki testi, güvenilir girdi sürücüsü olmadığından açıkça atlandı.
- Tek expansion-only migration üretildi; eski özel migration'ların bütün ilan edilmiş kalıcı hedeflerde uygulanmadığı SQL hash'leriyle doğrulandı. Uygulanmış geçmiş değiştirilmedi. Kaynak ve ortak DB şeması salt okunur doğrulandı; ortak hedefte migration uygulanmadı.

Açık kabul sınırları: [verification record](https://github.com/UnderprotectionDev/sprite-anvil/blob/review/spec-completion-audit/docs/audit-remediation-verification.md). Shared DB prepare/ready, gerçek R2/Queue ve operatör envanteri, ekran okuyucu, tam platform matrisi ve operasyonel sınırlar bekliyor. Ağsız doğrulama ölçülmez; yalnız bağlantılı koşular server start/end kaydı kullanır.

## Merge Danger

**Door:** one-way

Yeni silme arayüzü açık kullanıcı onayıyla geri alınamayan dosya silme işlemi başlatabilir. Belirsiz PUT kayıtları otomatik süre aşımıyla temizlenmez; güvenli operatör doğrulamasına kadar silmeyi bloke eder. Eski doğrulanmamış restore projeleri normal erişime açılmaz.

**Blast Radius:** application

Web/desktop kabuğu, özel proje servisleri, queue worker, R2 yaşam döngüsü ve eklemeli DB şeması etkilenir. Eski worker'ların koordineli durdurulması ve aynı kaynağın migration ile birlikte yayımlanması gerekir. Tam HEAD kullanıcı tarafından trusted Git kaynağına yayımlandıktan sonra repo workflow'u ile db:prepare ve db:ready tamamlanmalıdır.

Closes #224
