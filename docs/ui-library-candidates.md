# UI kütüphanesi aday listesi

## A. ReUI: ek bağımlılık gerektirmeyenler

| Bileşen | Kullanılacağı akış | Not | Bağlantı |
|---|---|---|---|
| Stepper | Sürüm yaşam döngüsü (03.2, 05.1), yeni proje, Delivery adımları (06), işlem adımları (07.2) | Yalnız `@base-ui/react` | [galeri](https://reui.io/components/stepper), [docs](https://reui.io/docs/components/base/stepper) |
| Timeline | Review Event, karar ve sürüm geçmişi (05.1, 03.2.2) | Yalnızca gösterim | [galeri](https://reui.io/components/timeline), [docs](https://reui.io/docs/components/base/timeline) |
| Trace | İşlem izi (07.2, 08.2.7) | Docs 404, bağımlılık doğrulanmadı | [galeri](https://reui.io/components/trace) |
| Sortable | Asset sekmeleri sıralama (00.2), kural sırası, referans panosu | dnd-kit v6 | [galeri](https://reui.io/components/sortable), [docs](https://reui.io/docs/components/base/sortable) |
| File Type | Import Inbox satırları, sürümler ve dosyalar | CVA | [galeri](https://reui.io/components/file-type), [docs](https://reui.io/docs/components/base/file-type) |
| Icon Tile | Boş durum medyası, liste satırı ikonları | | [galeri](https://reui.io/components/icon-tile), [docs](https://reui.io/docs/components/base/icon-tile) |
| Frame | Asset detail ve Project Context panelleri | | [galeri](https://reui.io/components/frame), [docs](https://reui.io/docs/components/base/frame) |
| Number Field | Editör tuval boyutu ve zoom, ölçü alanları (03.2.6) | | [galeri](https://reui.io/components/number-field), [docs](https://reui.io/docs/components/base/number-field) |
| Radio Group | Kart seçimi: Visual World/Theme, Delivery formatı | Yerleşim tarifleri | [galeri](https://reui.io/components/radio-group) |
| Tabs | Asset detail sekmeleri, sayaçlı ve dikey varyantlar | | [galeri](https://reui.io/components/tabs) |
| Toggle Group | Library görünüm anahtarı | | [galeri](https://reui.io/components/toggle-group) |
| Sidebar | 00.1 kabuk: ikon rayı, alan sütunu, yükleme/boş durum | | [galeri](https://reui.io/components/sidebar) |
| Skeleton | 08 yükleme durumları | | [galeri](https://reui.io/components/skeleton) |
| Spinner | 08 yükleme durumları | | [galeri](https://reui.io/components/spinner) |
| Progress | Import ve operasyon yüzdesi | | [galeri](https://reui.io/components/progress) |
| Empty | Boş ve sonuç yok durumları | | [galeri](https://reui.io/components/empty) |
| Alert | Satır içi uyarı + eylem | | [galeri](https://reui.io/components/alert) |
| Alert Dialog | Kaydedilmemiş değişiklik, yıkıcı onay | | [galeri](https://reui.io/components/alert-dialog) |
| Select | Filtre alanları | | [galeri](https://reui.io/components/select) |
| Switch | İzin satırları | | [galeri](https://reui.io/components/switch) |
| Slider | Zoom, fırça boyutu | | [galeri](https://reui.io/components/slider) |
| Scroll Area | Yoğun tablolar, kare şeridi | | [galeri](https://reui.io/components/scroll-area) |
| Resizable | Editör panelleri, alan sütunu | | [galeri](https://reui.io/components/resizable) |
| Autocomplete | Öneriyle arama (03), hedef seçici (08.3) | | [galeri](https://reui.io/components/autocomplete), [docs](https://reui.io/docs/components/base/autocomplete) |
| Date Selector | Tarih filtreleri, teslimat pencereleri | | [galeri](https://reui.io/components/date-selector), [docs](https://reui.io/docs/components/base/date-selector) |
| File Upload | Import Inbox: doğrulama, bekleyen dosya tabloları (04.2) | Hook + tarifler | [galeri](https://reui.io/components/file-upload), [docs](https://reui.io/docs/components/base/file-upload) |
| Attachment | Import Inbox bekleyen dosya satırları (idle, uploading, processing, error, done) | | [galeri](https://reui.io/components/attachment) |
| Scrollspy | Project Context'te uzun kural listelerinde kapsama atlama | | [galeri](https://reui.io/components/scrollspy), [docs](https://reui.io/docs/components/base/scrollspy) |
| Checkbox | Toplu inceleme seçimi (05.1.1), Required Set, indeterminate | | [galeri](https://reui.io/components/checkbox) |
| Dropdown Menu | 00.1 proje değiştirici, hesap menüsü | | [galeri](https://reui.io/components/dropdown-menu) |
| Command | Ctrl K paletinde son kullanılanlar ve sabitlenenler (00.1.1) | cmdk | [galeri](https://reui.io/components/command) |
| Input Group | Library araması: sonuç sayacı, filtre, kısayol ipucu | | [galeri](https://reui.io/components/input-group) |
| Sonner | "View operation" bağlantılı işlem toast'ı, geri alma | | [galeri](https://reui.io/components/sonner) |
| Breadcrumb | Aile → Varlık → Sürüm yolu | | [galeri](https://reui.io/components/breadcrumb) |
| Item | Sürümler ve dosyalar sekmesi dosya satırı | | [galeri](https://reui.io/components/item) |

## B. ReUI: ek bağımlılık getirenler

| Bileşen | Kullanılacağı akış | Bağımlılık | Bağlantı |
|---|---|---|---|
| Tree | Asset Family ve Türetilmiş Varlık ilişkileri (03.1.3), bağımlılık bağlantıları (03.2.5) | `@headless-tree/core`, `@headless-tree/react` | [galeri](https://reui.io/components/tree), [docs](https://reui.io/docs/components/base/tree) |
| Data Grid | Library Assets listesi (03.1), teslimat tabloları (06), toplu inceleme (05.1.1) | `@tanstack/react-table` v9 | [galeri](https://reui.io/components/data-grid), [docs](https://reui.io/docs/components/base/data-grid) |
| Cascader | Hiyerarşik filtre, hedef ilişkilendirme (04.2.2), hedef proje seçici (08.3) | `@tanstack/react-virtual` (kurulu) | [galeri](https://reui.io/components/cascader), [docs](https://reui.io/docs/components/base/cascader) |
| Filters | Library filtre çubuğu (03.1): alan, operatör, değer | `@reui/cascader` | [galeri](https://reui.io/components/filters), [docs](https://reui.io/docs/components/base/filters) |
| Code Block | İşlem günlüğü (07), dışa aktarma farkı (06), bağlam önerisi farkı (02.1.1) | `shiki`, `@shikijs/transformers` (yalnız renklendirme) | [galeri](https://reui.io/components/code-block), [docs](https://reui.io/docs/components/base/code-block) |
| Time Picker | Teslimat zamanlaması, geçmiş filtresi | | [galeri](https://reui.io/components/time-picker), [docs](https://reui.io/docs/components/base/time-picker) |
| Kanban | Pano görünümü | dnd-kit (kurulu) | [galeri](https://reui.io/components/kanban), [docs](https://reui.io/docs/components/base/kanban) |
| Pagination | Library ve operasyon listeleri | | [galeri](https://reui.io/components/pagination) |
| Button Group | Zoom kontrolü, split düğme, görünüm anahtarı | | [galeri](https://reui.io/components/button-group) |
| Color Picker | Piksel editörü paleti (05.3), Visual World/Theme renkleri (02.2) | | [galeri](https://reui.io/components/color-picker), [docs](https://reui.io/docs/components/base/color-picker) |

## C. ReUI'de olmayanlar: diğer kaynaklar

| Bileşen | Kullanılacağı akış | Kaynak | Bağlantı |
|---|---|---|---|
| Compare Slider | Sürüm karşılaştırma (03.2.2.3), editör compare görünümü | Dice UI | [docs](https://diceui.com/docs/components/base/compare-slider) |
| Key Value | Oyun içi metadata özel alanları, kaynak metadata eşleme (04.2.1) | Dice UI | [registry](https://diceui.com/r/key-value.json) |
| Badge Overflow | Yoğun satırlarda etiket taşması | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Editable | Asset adı ve metadata satır içi düzenleme | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Segmented Input | Ölçü girişi (G×Y), hex/RGB | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Color Swatch | Palet ve şeffaflık dama deseni | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Action Bar | Toplu inceleme seçim çubuğu (05.1.1) | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Cropper | Editör ve referans panosu kırpma | Dice UI | [llms.txt](https://diceui.com/llms.txt) |
| Hotkey | Ctrl K, Kbd ipuçları | HextaUI | [docs](https://hextaui.com/docs/hotkey) |
| use-pagination | Sabit genişlikte sayfa numaraları | HextaUI | [docs](https://hextaui.com/docs/use-pagination) |
| use-delayed-loading | Hızlı isteklerde yükleme göstergesi yanıp sönmesin | HextaUI | [docs](https://hextaui.com/docs/use-delayed-loading) |
| HoldButton | Basılı tutarak yıkıcı onay (07, 08) | Evil Buttons | [kod](https://www.evilbuttons.com/r/hold-button.json), [repo](https://github.com/radiumcoders/evil-buttons) |
| Filter Panel | Facet sayaçlı filtre rayı | Shadcnblocks | [bileşen](https://www.shadcnblocks.com/components/filter-panel) |
| Data Toolbar | Araç çubuğu iskeleti | Shadcnblocks | [bileşen](https://www.shadcnblocks.com/components/data-toolbar) |
| Scrollable Tabslist | Taşan asset sekmeleri | Shadcnblocks | [bileşen](https://www.shadcnblocks.com/components/scrollable-tabslist) |
| Toolbar | Editör araç çubuğu | COSS UI (referans) | [docs](https://coss.com/ui/docs/components/toolbar.md) |
| Meter | QA Readiness, Required Set kapsamı | COSS UI (referans) | [docs](https://coss.com/ui/docs/components/meter.md) |
| Segmented Control | Görünüm seçimi | COSS UI (referans) | [docs](https://coss.com/ui/docs/components/segmented-control.md) |

## D. Pro bloklar (yerleşim referansı)

| Blok | Neden | Bağlantı |
|---|---|---|
| Sheet | Sağ detay çekmecesi: zaman çizelgesi, diff, trace | https://reui.io/blocks/application/sheet |
| Chart → Status Tracker | Çalışma geçmişi şeritleri, aşama ölçerleri | https://reui.io/blocks/chart/status-tracker |
| App Shell | Proje rayı + alan sütunu + sekmeli içerik | https://reui.io/blocks/application/app-shell |
| Şablonlar | Kabuk düzenleri | https://reui.io/templates |
