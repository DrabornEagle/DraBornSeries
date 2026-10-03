# DraBornSeries 0.7.6 / Android 3

Google Play fiyatları yalnız gerçek ProductDetails/Developer API cevabından okunur. Etkin olmayan, bölgeye kapalı veya mağazada henüz yayılmamış ürün için tahmini fiyat gösterilmez. Native mağaza fiyatı kullanıcının Play bölgesine, web fiyatı TR kataloğuna aittir.

3 Ekim 2026 canlı denetimi: Google satın alma ve abonelik API'leri `drabornseries-play-billing@drabornseries.iam.gserviceaccount.com` hizmet hesabı için `permissionDenied` döndürdü. Play Console → Kullanıcılar ve izinler → bu ödeme hizmet hesabı → DraBornSeries uygulama izinlerinde `Finansal verileri, siparişleri ve iptal anketi yanıtlarını görüntüleme` ve `Siparişleri ve abonelikleri yönetme` izinleri gerekir. Google'ın resmi kurulum belgesi: https://developers.google.com/android-publisher/getting_started

İzinler uygulandıktan ve Google'a yayıldıktan sonra uygulama tekrar doğrulayabilir; yeni AAB gerekmez. Eksik yetki önbelleği en çok 30 saniyedir. Ödemesi onaylanmamış/iptal/iade olmuş makbuza hak verilmez. Test işleminin Google tarafından hâlâ geçerli tutulması gerekir; eski iade edilmiş sipariş yeniden yüklenmez.

BornCoins tüketimi yalnız güvenli sunucu doğrulaması ve tek seferlik atomik coin kaydından sonra yapılır. Kayıt tekrarı coin üretmez. Yerel yarım işlem kaydı hesapla ayrılır; cüzdan bakiyesi sunucuda kalır. Kullanıcı uygulama kapalıyken veya webden değişen cüzdan/VIP'yi yeniden bağlantı ve Realtime ile alır.

Native build, gerçek R2 ilk kare/ilerleme, imza ve 16 KiB kontrol sonucu PROGRESS.md dosyasına işlenir. AAB sahibin mevcut sabitlenen yayın sertifikasıyla imzalanmalıdır.
