# Sprite Anvil — Tasarım Sistemi

Bileşenlerin nasıl göründüğünü ve davrandığını anlatır. Ürün davranışı [PRD](docs/prd/README.md) belgesindedir, ürün karakteri [PRODUCT.md](PRODUCT.md) belgesindedir.

## Kaynaklar

| Konu | Doğru kaynak |
| --- | --- |
| Renk, yazı, köşe token'ları ve yüzey utility'leri | [globals.css](packages/ui/src/styles/globals.css) |
| Bileşen tarifleri | [packages/ui/src/components](packages/ui/src/components) |
| Görsel tasarım | Paper [Components](https://app.paper.design/file/01M7MA7YASC563847JH22KGM6T/p-T-0) dosyası (`00`–`10` artboard'ları) |

Kaynaklar çelişirse değiştirmeden önce çelişkiyi açıkça belirt.

## Temel kurallar

- Tek tema vardır: koyu. Açık palet yoktur.
- Bileşenler token adı kullanır; ham hex yazılmaz.
- Aynı rengi paylaşan iki şey aynı anlamı paylaşır.
- Yükselen yüzey yalnız basılabilen kontroller içindir. Rozet, avatar, sayaç, tuş etiketi, ikon karesi ve veri paneli düzdür.
- Durum yalnız renkle anlatılmaz: ikon biçimi ve metin birlikte kullanılır.
- Arayüz metni İngilizcedir ve [sözlükteki](docs/CONTEXT.md) adları kullanır.

## Renk rolleri

Adların başında `--color-` vardır. Tam liste `globals.css` içindedir.

### Zemin ve metin

| Token | Değer | Kullanım |
| --- | --- | --- |
| `workbench-preview` | `#141414` | Çukur yüzey: alan, menü, önizleme |
| `workbench-sidebar` | `#191919` | Yan panel |
| `workbench-strip` | `#1C1C1C` | İnce şerit |
| `workbench-background` | `#232323` | Sayfa, panel, dialog |
| `pixel-utility-low` | `#2A2A2A` | `Card` zemini, standart alt kenar, pasif buton |
| `workbench-panel` | `#333333` | Vurgulanan satır, araç şeridi |
| `workbench-control` | `#3F3F3F` | Nötr buton yüzü |
| `workbench-text` | `#F2F2F2` | Ana metin |
| `workbench-muted-text` | `#C9C9C9` | İkincil metin |
| `workbench-faint-text` | `#ABABAB` | Yardımcı metin ve placeholder |
| `workbench-link` | `#FFB67A` | Bağlantı |

### Anlam renkleri

| Rol | Token | Değer |
| --- | --- | --- |
| Ana eylem | `workbench-action` | `#FF7B38` |
| Editör seçimi | `workbench-selection` | `#2563EB` |
| Klavye odağı | `workbench-focus` | `#6F9AFF` |
| Seçili sekme, segment ve gezinme çipi | `workbench-nav` | `#EBEBEB` |
| Hata ve yıkıcı eylem | `workbench-danger` | `#FF3B6B` |
| Başarı | `workbench-success` | `#C8F03A` |
| Uyarı | `workbench-warning` | `#FFC93C` |
| Veri ve ilerleme | `workbench-data` | `#3CCBEA` |
| İnceleme | `workbench-review` | `#C3AEFF` |
| Hazırlık özeti bloğu | `workbench-hero` | `#5B2FE3` |

### Durum renkleri

| Durum | Token | Değer |
| --- | --- | --- |
| Export Ready | `status-export-ready` | `#C8F03A` |
| Ready with Waivers | `status-ready-with-waivers` | `#1FD6A0` |
| Not Assessed | `status-not-assessed` | `#B0CBF2` |
| Blocked | `status-blocked` | `#FF3B6B` |

## Yazı

| Aile | Kullanım |
| --- | --- |
| Inter (`font-sans`) | Arayüz metni |
| Bricolage Grotesque (`font-heading`) | Ekran ve bölüm başlığı |
| Geist Mono (`font-mono`) | Değer, ölçü, dosya adı |

| Boyut token'ı | Boyut / satır |
| --- | --- |
| `text-metric` | 64 / 64 |
| `text-heading` | 34 / 40 |
| `text-heading-compact` | 20 / 28 |
| `text-subhead` | 16 / 24 |
| `text-body` | 15 / 24 |
| `text-action` | 15 / 20 |
| `text-data` | 14 / 20 |
| `text-label` | 13 / 18 |

13px altı yalnız tuş etiketi ve kısayol içindir.

## Köşe

| Token | Değer | Kullanım |
| --- | --- | --- |
| `radius-overlay` | 12px | Dialog ve büyük katman |
| `radius-card`, `radius-control` | 8px | Kart, buton, alan |
| `radius-control-sm` | 6px | Küçük kontrol, menü satırı |
| `radius-tag` | 4px | Rozet ve tuş etiketi |
| `radius-preview` | 0 | Sprite önizlemesi |

## Yüzeyler

### Yükselen (`bevel`)

Düz dolgu, 1px üst ışık ve koyu alt kenar. Alt kenar 3px'tir; 28px kontrolde 2px'tir. Basınca yüz 2px iner ve kenar 1px olur.

| Utility | Kullanım |
| --- | --- |
| `bevel-utility` | Nötr buton |
| `bevel-action` | Ana eylem |
| `bevel-danger` | Yıkıcı eylem |
| `bevel-selection` | Editör seçimi |
| `bevel-nav` | Seçili açık çip |
| `bevel-edge` | Siyah kenar; 28px küçük butonlar |

Nötr butonun standart alt kenarı gridir (`#2A2A2A`). Gri kenar zeminde kayboluyorsa kenarı siyaha çevirme; zemini `workbench-panel` yap.

Bitişik buton grupları basılınca aşağı kaymaz.

### Çukur (`well`)

`#141414` zemin, 1px `#0A0A0A` kenar, üstte iç gölge ve altta ince ışık. Alan, seçim listesi, menü, popover ve segment yuvası için kullanılır. Sınıfların ezilmesi gerekiyorsa [well-surface.ts](packages/ui/src/lib/well-surface.ts) kullanılır.

### Yüzen (`floating`)

`#232323` zemin, 1px `#3A3A3A` halka ve güçlü gölge; alt kenar yoktur. Dialog, sheet, drawer ve toast için kullanılır. Dialog arkası düz `workbench-scrim` ile karartılır.

### Veri paneli

Tablo, takvim ve liste düz yüzeydir: 1px halka ve 8px köşe. Okuma listesi satırları basılabilir görünmez.

## Bileşen tarifleri

### Button

- Yükseklik: 44px (`default`, `lg`), 36px (`sm`), 28px (`xs`).
- Ana eylemler turuncu olabilir; bir ekranda sayıları bire indirilmez.
- `ghost` ve `link` düşük vurgu içindir.
- Pasif buton düz `#2A2A2A` zemin ve `#7A7A7A` metindir.

### Badge ve durum etiketi

Rozet buton gibi görünmez: kabartma ve dolu renk yoktur.

- 24px yükseklik, 4px köşe, Inter 13 600.
- Durum etiketi: durum renginin %14 tonu zemin; ikon ve metin durum renginde. Renk `--badge-tone` ile değiştirilir.
- Hata metni okunaklılık için rengin beyaza açılmış tonudur (`#FF89A6`).
- Nötr rozet ve sayaç: metin renginin %8 tonu zemin, `workbench-muted-text` metin.
- `+3` gibi açılabilen taşma düğmesi gerçek butondur ve kabartmalı kalır.

### Filtre çipi

36px tek çukur çip: alan adı ve `is` düz soluk yazı, değer seçenekleri açan düz 28px `#333333` buton, kaldırma düğmesi düz. Şerit `#232323` zemin ve 1px halkadır.

### Araç çubuğu

Yükselen butonlar `#333333` şeritte durur; gri alt kenar burada görünür. Buton üstündeki sayaç düz açık tondur (`workbench-text` %8).

### Hesap tetikleyicisi

44px düz yüzey (`#2A2A2A`, 1px halka), üzerine gelince ve açıkken `#333333`. Avatar 28px düz dairedir; kabartma yoktur.

### Action bar

Koyu yüzen şerit (`#141414`, 1px halka, yumuşak gölge, 12px köşe). Solda düz temizleme butonu ve sayılı seçim metni, sağda 36px eylemler; ana eylem en sonda.

### Seçili satır

Seçim veya hata halkası kap köşesini izler (7px); düz köşeli halka yuvarlak panelde kesilmez.

### Alanlar

- 40px çukur yüzey; kompakt ve dialog yükseklikleri çağıran yerden verilir.
- Sayı ve parola alanı mono yazılır.
- Sayı alanında ince, ikiye bölünmüş tek kontrol görünür (22×30, üst artırır, alt azaltır; kalın alt kenar yoktur). İmlecin altındaki yarı açılır, basılı tutunca değer tekrar eder. Okların SVG arka planı CSS değişkeni okuyamadığı için renkleri sabit yazılıdır; ilgili token değişirse [globals.css](packages/ui/src/styles/globals.css) içinde birlikte güncellenir. Büyük düğme gerekiyorsa `NumberField` kullanılır.
- Hata: 2px `workbench-danger` dış çizgi ve alanın altında `workbench-danger-soft` açıklama. Odaktayken de kırmızı kalır.
- Pasif seçim kontrolü soluk görünür; boş olanla karıştırılmaz.
- `NativeSelect` gerçek bir `select` olarak kalır; fare ve klavye ile açılan liste işletim sisteminin menüsü yerine `Select` panelidir.

### Menüler

Dropdown, context menu, menubar, navigation menu ve command tek tarifi paylaşır ([menu-recipe.ts](packages/ui/src/lib/menu-recipe.ts)): çukur panel, 8px iç boşluk, 36px satır, 16px ikon sütunu, sağda Inter 13 kısayol (mono yazıda tuş sembolleri yoktur). Vurgulanan satır düz `#333333` yüzeydir.

### Card

`#2A2A2A` zemin, 8px köşe, 1px `#3A3A3A` halka, kabartmasız. Görsel varsa kenardan kenara ve en üstte durur; gövde boşluğu 16px'tir.

## Klavye odağı

- Standart: 2px `workbench-focus` dış çizgi, 2px dışarıda (`focus-ring`).
- Her hedefte tek bir gösterge vardır; çift çizgi bırakılmaz.
- Kenarda kesilen hedefte çizgi içeri alınır veya kaydırma alanına boşluk verilir.
- Menü satırı ve açılan panel odağı satır vurgusuyla gösterir.
- Uygulamadaki genel `:focus-visible` kuralı [index.css](apps/web/src/index.css) içinde katmansızdır. Bir bileşen bunu bastıracaksa kendi göstergesini sağlamalı ve utility'yi `!` ile yazmalıdır.

## Hareket ve erişilebilirlik

- Geçişler kısadır (100–120ms).
- `prefers-reduced-motion` açıkken geçiş ve animasyonlar durur; durum metni kalır.
- Hedef düzey WCAG 2.2 AA'dır.
- Kontroller semantiktir, klavyeyle kullanılır ve ekran okuyucu adı taşır. Sürükleme işlemlerinin klavye karşılığı vardır.
- Dar ekranda sayfa yatay kaymaz; geniş içerik kendi alanında kayar.

## Bileşen eklerken veya değiştirirken

1. `packages/ui` içindeki mevcut bileşeni ve ortak tarifi yeniden kullan.
2. Yeni renk gerekiyorsa önce token ekle.
3. Paper çizimini birlikte güncelle.
4. Bu belgedeki ilgili kuralı güncelle.

## Açık konular

- Paper'daki `Button` açıklaması ekran başına tek ana eylem diyor; bu belge güncel karar olan "sınır yok" kuralını yazar.
- [Arayüz Tasarım Planı](docs/interface-areas.md) hâlâ eski Paper Design System dosyasına bağlanıyor.
- `Time picker` milisaniye aralığı ve `Slider` tutamacı için karar bekleniyor.
