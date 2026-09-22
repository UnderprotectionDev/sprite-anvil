# Karakter ve Animasyon Profilini Uygulama

Karakter, yaratık ve animasyon sürümleri kimlik, yön, zamanlama, zemin, olay ve kareye bağlı oyun bilgileriyle birlikte karşılaştırılır ve kullanımda sınanır.

Bu ilk özel profil karakter ve animasyon ailesinin üretimden kullanım kanıtına kadar yürütülmesini sağlar. Kesin Profil Sözleşmesi metadata, kural ve dışa aktarım eşlemesini belirler.

## Alt Fazlar

### Kimlik ve Yön Tutarlılığını İnceleme

Yönler Ana Tasarıma göre siluet, oran, ekipman tarafı, palet, perspektif, ölçek ve zemine temas açısından eşzamanlı karşılaştırılır.

Dört veya sekiz yön birlikte gösterilip eşzamanlı oynatılabilir; dönüş arası farklar ve doğal 1× görünüm incelenir. Öznel kimlik kararı kullanıcı incelemesidir, kesin kare kimliği ve bozuk bağlantı ise bütünlük kuralıdır.

### Animasyon Zamanlamasını ve Geçişlerini İnceleme

Kare sırası, değişken süreler, hareket evreleri, döngü sınırı ve yönler arası oynatma gerçek hızda karşılaştırılır.

Her karenin süresi bağımsızdır; yürüyüş veya saldırı tek hız ya da zorunlu evre şablonuna sıkıştırılmaz. Önceki ve sonraki kare, soluk kareler, loop geçişi ve yönler arası olay zamanı aynı oynatma konumunda karşılaştırılır.

### Animasyon Metadata Bütünlüğünü Doğrulama

Pivot, zemin noktası, mount point, çarpışma alanı ve olay bağlantıları kare kimlikleriyle roundtrip kaybı olmadan korunur.

Kareye bağlı pivot, zemin çizgisi, mount point, çarpışma alanı ve olay bilgisi içe aktarma, düzenleme, paketleme ve yeniden okumada aynı kimliği korur. Kopuk kare bağlantısı bütünlük engelidir; zemin veya loop sapması sözleşmedeki tolerans ve inceleme sınıfına göre ele alınır.

## Tamamlanma Ölçütleri

- Farklı süreli yön ve kareler, olay ve bağlantı bilgileriyle incelenir; sorunlu tek kare düzeltilip eski bileşim korunarak paketlenebilir.

## Kapsam Sınırları

- Kimlik veya hareket hakkında otomatik sanatsal hüküm verilmez; zemin ve loop sapması evrensel engel değil profil kuralıyla değerlendirilir.
