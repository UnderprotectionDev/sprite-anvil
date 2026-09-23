# Görsel Dünyaları ve Temaları Tanımlama

## Problem Statement

Kullanıcı bir projedeki farklı sunum rejimlerini ve her birinin Tema kapsamını ayrı tanımlar. Oyun içi piksel sanatı, portre, arayüz ve tanıtım aynı projede kendi görsel kurallarıyla yaşayabilir.

## Solution

Kullanıcı bir projedeki farklı sunum rejimlerini ve her birinin Tema kapsamını ayrı tanımlar.

Oyun içi piksel sanatı, portre, arayüz ve tanıtım aynı projede kendi görsel kurallarıyla yaşayabilir.

Tamamlanma kanıtı: Bir projede birden fazla Görsel Dünya ve bunların Temaları tutulur; bir dünyaya ait kural başka dünyaya sessizce uygulanmaz.

## User Stories

1. Bir kullanıcı olarak aynı projede oyun içi piksel sanatı, portre, arayüz ve tanıtım gibi birden çok Görsel Dünya tanımlamak istiyorum; böylece farklı sunum rejimleri tek proje kimliğinde yaşayabilir.
2. Bir kullanıcı olarak her Görsel Dünyanın kendi görsel kurallarını tutmasını istiyorum; böylece bir dünyanın çözünürlük ve sunum kararları diğerini yönetmez.
3. Bir kullanıcı olarak bir Görsel Dünya içinde birden çok Tema oluşturmak istiyorum; böylece dünya düzeyindeki kurallarla bölge veya motif düzeyindeki kararları ayırabilirim.
4. Bir kullanıcı olarak Bağlam Kurallarını doğru Görsel Dünya ve Tema kapsamına bağlamak istiyorum; böylece kurallar yalnız seçildikleri sunum rejiminde uygulanır.
5. Bir kullanıcı olarak benzer adlı Temaların farklı Görsel Dünyalarda ayrı kapsam taşımasını istiyorum; böylece ad benzerliği kural aktarımı yaratmaz.
6. Bir kullanıcı olarak Görsel Dünya ile Varlık Ailesi ve Ana Tasarım arasındaki ayrımı korumak istiyorum; böylece sunum rejimi varlık soyu yerine geçmez.
7. Bir kullanıcı olarak tema veya dünya kurallarının başka kapsama sessizce taşınmadığını görebilmek istiyorum; böylece proje içindeki görsel kararların etkisi anlaşılır kalır.

## Normatif gereksinimler

- **DIM-01 — Görsel Dünya kapsamı:** Bir projede, her biri kendi görsel kurallarına sahip birden fazla Görsel Dünya bulunabilir. Örneğin oyun içi piksel sanatı, resimli portreler, arayüz ve tanıtım görselleri ayrı Görsel Dünyalar olabilir.
- **CTX-01 — Yetkili proje bağlamı:** Proje Bağlamı, tek bir oyun projesinin onaylanmış görsel kurallarını, istisnalarını ve üretim kararlarını tutar. Kuralın kimliği, kapsamı ve değeri yapılandırılmış biçimde kaydedilir. `context.md` dosyasını ajanlar yönetir; kullanıcı ham metni düzenlemez.


## Implementation Decisions

- **Görsel Dünyaları ve Temaları Tanımlama:** Kullanıcı bir projedeki farklı sunum rejimlerini ve her birinin Tema kapsamını ayrı tanımlar. Oyun içi piksel sanatı, portre, arayüz ve tanıtım aynı projede kendi görsel kurallarıyla yaşayabilir.

- **Yetki ve sürüm sınırı:** Aşağıdaki PRD hükümleri normatiftir. Fazın iş kırılımı, başka bir özelliğin kararını bu kapsama eklemez. Kesin kullanıcı kararları ajan veya otomasyon tarafından verilmez.
- **Kapsam sınırı:** Görsel Dünya bir Varlık Ailesi veya Ana Tasarım değildir; tema başka dünyaya kendiliğinden taşınmaz.

## Testing Decisions

- **Birincil test seam’i:** RAS-08 örneklerinde kesin girdiyi kullanıcı eyleminden kalıcı kayda ve yeniden okumaya taşıyan sunucu/API yolunu sınama; web ve masaüstü görünür sonuçlarını karşılaştırma.
- Davranışı mümkün olan en yüksek kullanıcı yolunda doğrula: aynı kesin girdiyi oluştur, kullanıcı eylemini uygula, kalıcı sonucu yeniden oku ve başarısız/eksik yolu ayrıca sınama. İç yardımcıların çağrılma sırasını test etme.
- Bugün repoda bu faza ait ürün sözleşmesi bulunmuyor. Mevcut sunucu ve yüzey test örnekleri: [`account-access.test.ts`](../../../apps/server/src/account-access.test.ts), [`app-shell.spec.ts` (web)](../../../apps/web/e2e/app-shell.spec.ts) ve [`app-shell.spec.ts` (desktop)](../../../apps/web/desktop-e2e/app-shell.spec.ts). Bunlar bu özelliğin test edildiği anlamına gelmez.
- Fazın özgül başarı ve red kanıtı: Bir projede birden fazla Görsel Dünya ve bunların Temaları tutulur; bir dünyaya ait kural başka dünyaya sessizce uygulanmaz. Kapsam dışı davranışın yanlışlıkla oluşmadığını sınama: Görsel Dünya bir Varlık Ailesi veya Ana Tasarım değildir; tema başka dünyaya kendiliğinden taşınmaz.
- Kabul örnekleri: RAS-08. Görsel veya öznel hükümler kullanıcı incelemesi olarak kalır; deterministik bütünlük ve sözleşme kontrolleri ayrı kanıtlanır.

## Out of Scope

Görsel Dünya bir Varlık Ailesi veya Ana Tasarım değildir; tema başka dünyaya kendiliğinden taşınmaz.

## Further Notes

- Tek faz kaynağı: [`04-visual-worlds/phase-context.md`](../../workflow/04-visual-worlds/phase-context.md).
- Kanonik teknik adlar: Visual World, Theme. Ürün etiketleri ve kaçınılacak eşanlamlar için [`docs/CONTEXT.md`](../../CONTEXT.md) bağlayıcıdır.
**Normatif PRD sahipliği**

- [`DIM-01`](../../prd/03-project-and-asset-foundations.md) — Görsel Dünya kapsamı.
- [`CTX-01`](../../prd/03-project-and-asset-foundations.md) — Yetkili proje bağlamı.

**İlgili mimari sınırlar**

- none (ilgili ADR kayıtları kontrol edildi).

**Kabul izlenebilirliği**

- [RAS-08](../../prd/10-acceptance-scenarios.md)
- Mevcut uygulama yalnız temel web/masaüstü kabuğu ve sınırlı sunucu yükleme yolunu içeriyor; bu spec teslim edilmiş ürün iddiası değildir. Yeni bağımlılık, depolama veya platform sınırı bu belgeyle seçilmez.
