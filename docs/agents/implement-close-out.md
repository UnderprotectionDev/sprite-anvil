# Implement close-out

Final user message after implementation — Turkish, three sections in order.

## When

Run after the work and relevant tests are complete. Finish a commit or separate code review before close-out when the task calls for one.

## 1. Ne eklendi

Görevden veya ilgili PRD gereksiniminden ne çıktı — yapılan işin özeti:

- Teslim edilen davranış veya yetenek (ürün değişikliği) ya da süreç/kural değişikliği (agent doc, skill)
- Dokunan ana dosya, route, API veya şema — yönlendirme için yeterli, ham diff değil
- Kapsam dışı: bilinçli olarak yapılmayan

**Done when** okuyucu diff açmadan “ne teslim edildi?” sorusunu yanıtlayabilir.

## 2. İnceleme

Ayrı kod incelemesi yapıldıysa çıktısını taşı — yeniden sıralama yok:

- `## Standards` ve `## Spec` başlıkları aynen kalır; bulgular Türkçe özetlenebilir
- İncelemenin tek satırlık özetiyle bitir (eksen başına bulgu sayısı, varsa en kötü bulgu)

Bu işin ürün gereksinimi yoksa `Spec` altında belirt. İnceleme atlandıysa nedenini yaz — uydurma. Çalıştırılan ilgili testleri ve sonuçlarını kısa biçimde bildir; komut çıktısını kopyalama.

**Done when** her iki eksen raporlandı veya incelemenin atlanma gerekçesi açıklandı; test durumu da görünür.

## 3. Nasıl test edilir

Bu bölüm, değişikliği uygulamada elle deneyen kişiye doğrudan yol gösterir. Diff'i görmemiş biri hangi sayfayı açacağını, hangi işlemi yapacağını ve işlemin sonucunu anlayabilmelidir. Metin kısa bir kullanıcı kılavuzu gibi yazılır; komut, terminal çıktısı veya otomatik test raporu içermez.

### Başlangıç

İlk paragrafta uygulamanın başlangıç adresini veya route'unu, web/masaüstü yüzeyini, giriş durumunu ve kullanılacak kaydı yaz. Kayıt hazır değilse ana akıştan önce `Veri hazırlığı` başlığı aç ve kaydı arayüzde oluşturmayı aynı konuşma diliyle numaralı adımlara böl. Bu adımlarda görünen giriş alanını, yazılacak değeri, kullanılacak düğmeyi ve her işlemden sonra beklenen sonucu cümle içinde belirt. Test ortamında veri önceden yüklenmişse yalnızca kullanıcının görebildiği kayıt adını yaz; test altyapısı terimlerini kullanıcıya dönük metne taşıma. Elinde yalnızca route varsa tam alan adı uydurma; route'u ve o ekrana uygulama içinden nasıl gidileceğini yaz.

### Ana akış

Her numaralı adım tek bir kullanıcı eylemi içersin. Kullanıcıya hangi ekranda olduğunu ve hangi gerçek kontrolü kullanacağını doğrudan söyle. Eylemin sonucu zaten açıksa aynı bilgiyi tekrarlama; yalnızca kullanıcı ayrıca doğrulaması gereken bir durum, kayıt, hata veya kalıcılık varsa kısa bir sonuç cümlesi ekle. Örneğin: “`Pixel studio` ekranında `Save local draft` düğmesine tıklayın. `Draft saved on this device.` bildirimi görünür.”

Gerçek UI etiketlerini owning PRD gereksinimi açıkça belirtiyorsa oradaki biçimiyle, aksi halde üründe gerçekten göründüğü gibi backtick içine al. Yeni bir etiket uydurma. Adımları iç kontrol alanlarıyla değil, doğrudan konuşma cümleleriyle yaz.

### Kalıcılık ve diğer yollar

Bir işlem kalıcı veri yazıyorsa, sonucu sayfayı yenileyerek, kaydı yeniden açarak veya ilgili listeye dönerek ayrı bir adımda doğrula. Yalnızca geçici seçim, önizleme veya diyalog açılıyorsa yenileme adımı ekleme.

Değişiklik başka bir seçimi, iptali, doğrulama/hata durumunu, geri almayı veya kayıt türünü etkiliyorsa, o yolu ayrı bir başlık ve kısa adımlarla anlat. İlgili bir yol yoksa bunu doğal bir cümleyle belirt; örneğin `Bu değişiklikte iptal, hata veya geri alma akışı yok.` İç durum adlarını veya hazırlaması açıklanmamış ifadeleri tek başına kullanma.

Örnek (etiketler mevcut [Studio ekranından](../../apps/web/src/routes/studio.tsx) alınmıştır):

Başlangıç: Web uygulaması açık. Yerel taslak için giriş gerekmiyor; üst menüdeki `Studio` bağlantısı `/studio` sayfasını açar.

1. Üst menüde `Studio` bağlantısını açın. `Pixel studio` başlığı görünür.
2. Çizim tuvalindeki bir hücreye tıklayın. Hücre seçili renkle boyanır.
3. `Save local draft` düğmesine tıklayın. `Draft saved on this device.` bildirimi görünür.
4. Sayfayı yenileyin. `Local drafts` bölümünde en son kaydedilen `Frame 1` taslağı görünür.
5. Listenin en üstündeki `Frame 1` taslağını açın. Boyadığınız hücre tuvalde yeniden görünür.

Bu örnekte kullanıcı her adımda nereye gideceğini, ne yapacağını ve ne göreceğini doğrudan anlar. Gerçek değişiklik bir hata veya iptal akışını etkiliyorsa, örnekteki başarı akışının yanına yalnızca o ilgili akışı ekle.

Uygulamada görünen bir davranış yoksa bu bölümün tamamına yalnızca `Not applicable` yaz.

**Done when** Başlangıç bölümü uygulamayı ve veriyi hazırlamayı açıklıyor; kayıt önceden hazır değilse `Veri hazırlığı` altında oluşturma adımları yer alıyor. Her adım tek eylem içeriyor, gerekli yerlerde beklenen sonucu kısa biçimde belirtiyor ve aynı bilgiyi tekrarlamıyor. İlgili kalıcı yazmalar ile değişiklikten etkilenen diğer kullanıcı yolları ayrı ayrı doğrulanıyor; ilgili başka yol yoksa bu durum doğal bir cümleyle belirtiliyor — veya uygulamada görünen davranış yoksa yalnızca `Not applicable` kullanılıyor.

## Voice

- Anlaşılır, günlük Türkçe — kısa cümleler; jargon, iç şaka ve gereksiz teknik terim yok.
- Gerçek English UI etiketleri üründeki biçimiyle English kalır ve backtick içinde yazılır.
- Proportional length — a one-file fix gets short sections; a feature gets more detail in **Ne eklendi** and **Nasıl test edilir**, not in **İnceleme**.
