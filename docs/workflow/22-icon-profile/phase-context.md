# İkon Profilini Uygulama

İkonlar gerçek kullanım boyutlarında, açık ve koyu arka planlarda siluet, okunurluk, iç boşluk, renk ve aile içi nesne ölçeğiyle sınanır.

İkonun kaynağı ile oyunda veya arayüzde görüleceği gerçek boyut farklı olabilir. Aile incelemesi bu boyut ve arka plan koşullarını birlikte tutar.

## Alt Fazlar

### İkonu Kullanım Boyutunda Önizleme

İkon kaynak ve mantıksal ölçülerinde, açık ve koyu arka planlarda siluet, okunurluk ve iç boşlukla gösterilir.

Kaynak ve mantıksal ölçü ile gerçek kullanım çeşidi ayrı kayıtlanır; ikon hedef ölçüde ve gri tonlamada da görülebilir. Açık veya koyu arka planda siluet ve iç boşluk kaybı insan incelemesine sunulur.

### İkon Ailesi Tutarlılığını İnceleme

Nesne ölçeği, ışık, kontur, ayrıntı yoğunluğu ve durum ya da nadirlik renginin kimliği bozup bozmadığı karşılaştırılır.

Aynı ailede nesne ölçeği, ışık yönü, kontur ve ayrıntı yoğunluğu yan yana izlenir. Nadirlik veya durum rengi nesne kimliğini sessizce değiştiremez; seçilen ikonun kesin sürümü dışa aktarım eşlemesine girer.

Bu issue'ın inceleme arşivi JSON'u, yapılandırılmış `Icon Family Review` kaydını, şema sürümünü, etkin sözleşme kopyasını, kesin Varlık Sürümü kimliklerini ve sürüm özetlerini taşır; görsel baytlarını taşımaz. Bu kapsam genel Dışa Aktarım Paketi veya Proje Arşivi değildir.

## Tamamlanma Ölçütleri

- Hedef boyut, okunurluk, renk ve aile ölçeği kesin ikon sürümünde değerlendirilir; kullanım çeşidi ile mantıksal ölçü paketlenir.
- Kalıcı inceleme kaydı farklı bir bağlantıdan okunur ve web görünümünden JSON arşivi indirilebilir; arşivde şema sürümü, kesin sürüm kimlikleri ve özetleri bulunur.
- Bu issue'ın arşiv kanıtı tek başına PRD'deki RAS-03'ün tam Dışa Aktarım Paketi ve web/masaüstü kabul ölçütlerini kapatmaz.

## Kapsam Sınırları

- Tek bir ışık veya nadirlik rengi bütün proje için yeni evrensel sanat kuralı oluşturmaz.
- Arşiv görsel dosyalarını içermez, projeyi geri yüklemez ve genel oyun motoru paketi yerine kullanılamaz.
