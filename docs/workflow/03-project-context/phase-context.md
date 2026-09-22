# Proje Kurallarını Sürümleme ve Etkinleştirme

Sistem kullanıcı kararlarını kapsamı ve dayanağı belli kural önerilerine dönüştürür; yalnız kullanıcının doğruladığı çakışmasız sürüm üretimde yetkili olur.

Yeni proje yalnız ad ve genel sanat yaklaşımıyla başlayabilir. Etkin kurallar işlem kapsamına göre çözülür ve sonraki üretimlerde yeniden sorulmadan kullanılabilir.

## Alt Fazlar

### Kural Değişikliği Önerme

Kullanıcı kararları ve gözlenen değişiklikler, dayanak sürümü ve kanıtı belli yapılandırılmış bir Bağlam Önerisine dönüşür.

Öneri taban Bağlam Sürümünü, ajan veya yapılandırılmış kontrolün kaynağını ve her ekleme, değiştirme ya da kaldırmanın dayanağını taşır. Serbest açıklama tek başına etkin kural değildir; ajan kullanılamadığında yapılandırılmış yaygın kararlar yine hazırlanabilir.

### Kural Sürümünü Doğrulama ve Etkinleştirme

Kapsam önceliği, açık istisnalar ve çakışmalar doğrulanır; yalnız kullanıcının onayladığı geçerli set yeni Etkin Bağlam Sürümü olur.

Sistem önerinin dayandığı Bağlam Sürümünü güncel sürümle karşılaştırır. Bağımsız kural değişiklikleri anlamları korunarak uzlaştırılabilir; aynı kuralı veya kapsamı etkileyen değişiklikler kullanıcı çözmeden etkinleşmez. Kullanıcı geçerli öneriyi inceleyip etkinleştirir. Veri yapısı, aynı kapsam düzeyindeki çelişki ve referans sınırları doğrulanır; dar kapsamın geniş kapsamı geçmesi ile gerekçeli istisnanın kaynağı yeni sürümde izlenir.

Palet, kontur ve benzeri kurallar sürümlü Stil Modüllerinde gruplanabilir. Başka projeye kopyalanan modül orada bağımsız Bağlam Önerisi olarak incelenir; kaynak projeyle canlı eşitlenmez. Bağlam Kuralı ve Bağlam Ajanı sözleşmelerinin tam sürümü korunur; bilinmeyen zorunlu alan veya ana sürüm etkinleştirmeyi durdurur. Göç eski sürümü yazmaz ve yeni sürüm kullanıcı etkinleştirmeden üretime girmez.

## Tamamlanma Ölçütleri

- Kullanıcı onayıyla oluşan etkin sürüm, çakışmasız kural zincirini ve üretime alınacak bağlam kopyasını aynı anlamla verir.

## Kapsam Sınırları

- Ajan öneriyi etkinleştiremez; ham context.md metni kullanıcıya yetkili kural düzenleme yolu olarak açılmaz.
