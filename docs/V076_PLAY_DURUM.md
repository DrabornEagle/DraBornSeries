# DraBornSeries 0.7.6 / Android 3

Google Play fiyatları yalnız gerçek ProductDetails/Developer API cevabından okunur. Etkin olmayan, bölgeye kapalı veya mağazada henüz yayılmamış ürün için tahmini fiyat gösterilmez. Native mağaza fiyatı kullanıcının Play bölgesine, web fiyatı TR kataloğuna aittir.

3 Ekim 2026 son canlı denetimi: `drabornseries-play-billing@drabornseries.iam.gserviceaccount.com` hizmet hesabında önceki `permissionDenied` artık dönmüyor; uygulamanın doğrulama erişim kontrolü `ready: true` verdi. Coin, productsv2, subscriptionsv2, coin consume ve abonelik acknowledge uçları kasıtlı olarak geçersiz test token'ına beklenen `400 / Invalid Value / invalid` yanıtını verdi. Bu, önceki yetki engelinin kalktığını doğrular; gerçek satın alma makbuzu testi yerine geçmez. Geçerli satın alma veya abonelik değiştirilmedi ve geçici özel tanılama dalları canlı servisten kaldırıldı.

Canlı TR kataloğunda üç VIP ve altı BornCoins fiyatı doğrulandı. Geçici ürün sorgusu hatası eksik kardeş ürünlerin yeniden sorgulanmasını tetikler; eksik sunucu sonucu en çok 30 saniye önbelleklenir. Yeni ödeme öncesi erişim kontrolü sürer; eksik yetki önbelleği de en çok 30 saniyedir. Ödemesi onaylanmamış/iptal/iade olmuş makbuza hak verilmez. Test işleminin Google tarafından hâlâ geçerli tutulması gerekir; eski iade edilmiş sipariş yeniden yüklenmez.

BornCoins tüketimi yalnız güvenli sunucu doğrulaması ve tek seferlik atomik coin kaydından sonra yapılır. Kayıt tekrarı coin üretmez. Yerel yarım işlem kaydı hesapla ayrılır; cüzdan bakiyesi sunucuda kalır. Kullanıcı uygulama kapalıyken veya webden değişen cüzdan/VIP'yi yeniden bağlantı ve Realtime ile alır. Satın alma sonrası zorunlu bakiye yenilemesi, eski arka plan isteği hata verse bile yeni sorguyu tamamlar; normal yenilemeler tek isteği paylaşır ve hesap değişiminde eski cevap yayınlanmaz.

Native build, gerçek R2 ilk kare/ilerleme, imza ve 16 KiB kontrol sonucu PROGRESS.md dosyasına işlenir. AAB sahibin mevcut sabitlenen yayın sertifikasıyla imzalanmalıdır.
