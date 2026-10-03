# DraBornSeries v0.7.5 · Android versionCode 2

Paket: `com.draborneagle.drabornseries`. VIP otomatik yenilenen aboneliktir. BornCoins paketleri **tek seferlik, tüketilebilir uygulama içi üründür**; abonelik veya otomatik yenilenen coin ödemesi oluşturulmaz.

## Play Console ürün eşlemesi

| Ürün kimliği | Play ürün türü | Temel plan / satın alma seçeneği | Hesaba verilen toplam |
| --- | --- | --- | --- |
| `dbs_vip_weekly` | Abonelik | `weekly` · P1W | Haftalık VIP |
| `dbs_vip_monthly` | Abonelik | `monthly` · P1M | Aylık VIP |
| `dbs_vip_yearly` | Abonelik | `yearly` · P1Y | Yıllık VIP |
| `dbs_coins_50` | Tek seferlik ürün | `buy` | 50 BornCoins |
| `dbs_coins_100` | Tek seferlik ürün | `buy` | 100 + 10 = 110 |
| `dbs_coins_250` | Tek seferlik ürün | `buy` | 250 + 30 = 280 |
| `dbs_coins_500` | Tek seferlik ürün | `buy` | 500 + 80 = 580 |
| `dbs_coins_1000` | Tek seferlik ürün | `buy` | 1000 + 200 = 1200 |
| `dbs_coins_2500` | Tek seferlik ürün | `buy` | 2500 + 600 = 3100 |

VIP temel planlarını `weekly`, `monthly`, `yearly` olarak etkin tut. Coin ürünlerini **Tek seferlik ürünler** bölümünde yukarıdaki kimliklerle oluştur; `buy` satın alma seçeneğini, Türkiye fiyatını ve satış bölgelerini etkinleştir. `buy` seçeneğini eski Billing akışıyla uyumlu yap; çoklu adet ve kiralama açma. Başlangıçta indirim/trial teklifi gerekmez. Ürün kimliğinde bonus toplamını kullanma: 1200 coin paketi `dbs_coins_1000` kimliğini kullanır. Uygulama ve sunucunun dokuz ürün kaydı aktiftir; gerçek satış, Console etkinliği ve mağazadan dönen ProductDetails ile açılır.

## Otomatik fiyatlar

Android, oturum açılmadan da Google Play ProductDetails sorgular. Tam seçilen VIP temel planı ve coin satın alma seçeneğinin mağaza fiyatı gösterilir; ödeme başlatılmadan önce ProductDetails ve teklif belirteci yeniden sorgulanır. Mağaza ekranını açma, uygulamaya dönüş ve uygulama açıkken beş dakika aralık fiyatları yeniler. Kayıtlı mağaza hesabının bölgesi Google Play tarafından belirlenir.

Web, sunucunun Google Play Developer API üzerinden okuduğu **Türkiye (TR)** fiyatını gösterir. Abonelikte doğru ve aktif temel planın TR fiyatı; coinde aktif `buy` seçeneğinin TR fiyatı kullanılır. Sunucu beş dakika, istemci en çok bir dakika önbellek tutar. Console yayılımı da süre alabilir; değişiklik anında tüm istemcilere itilmez. Sunucu anahtarı veya Console fiyat izni olmadığında tahmini/örnek fiyat üretilmez. Webde ödeme başlatılmaz; Android'de yapılan satın alım aynı DraBornSeries hesabının VIP ve cüzdanına webde de yansır.

Sunucu için `DBS_GOOGLE_SERVICE_ACCOUNT` Edge Functions secret'ı kullanılır. Hizmet hesabının Google Play Developer API erişimi yanında ilgili uygulamanın ürün/fiyat kataloğunu okumak, sipariş ve abonelikleri doğrulamak/yönetmek için gerekli Play Console izinleri bulunmalı. Fiyatı kodda veya veritabanında elle güncellemek gerekmez.

## Doğrulama, geri yükleme ve iadeler

Her satın alım hesabın SHA-256 kimliğine bağlanır. Google API doğrulaması, doğru ürün/hesap ve tek adet kontrolü geçmeden bakiye/VIP verilmez. Bekleyen ödemeler hak vermez. Coin ve bonus toplamı atomik olarak yalnız bir kez yüklenir, ardından Google token'ı sunucuda tüketilir. Tüketme kesilirse aynı token ile geri yükleme tekrar denenebilir; ikinci kez coin yüklenmez. Tüketilmiş coin alışverişi Play'in sahip olunan ürün listesinden kaybolur; kalıcı bakiye sunucuda kalır. Geri yükleme bekleyen/tamamlanmamış satın alımları ve VIP'yi doğrular; harcanmış coinleri yeniden üretmez.

`dbs-play-rtdn` Pub/Sub kimliğini doğrular. VIP yenileme, hold, pause, expiry ve refund durumları mevcut sunucu doğrulamasını kullanır. Coin voided purchase bildirimi mevcut kullanılmamış bakiyeden iade edilen paketi bir kez geri alır ve token'ın yeniden coin vermesini engeller. İade edilen coinlerin önceden harcanmış kısmı özel makbuzda `coinRefund.reviewRequired` ile denetime kaydedilir; bakiye eksiye düşürülmez ve kazanılmış başka uygulama verisi silinmez.

Pub/Sub push ve Play RTDN kurulumunun güncel adresi/kimlik doğrulaması için [V072_KURULUM.md](V072_KURULUM.md) içindeki `DBS_PLAY_RTDN_SERVICE_EMAIL` ve `DBS_PLAY_RTDN_AUDIENCE` adımlarını kullan. Gerçek test ödemelerini AAB'yi iç test kanalına yükleyip lisans test hesabıyla yap. Expo Go'nun içinde Play Billing bulunmaz.

## APK ve AAB imzası

Otomatik derleme mevcut yayın sertifikasını korur; farklı bir anahtar üretmez. GitHub Actions repository Secrets:

- `DBS_RELEASE_KEYSTORE_BASE64`: mevcut `DraBornSeries-release.jks` dosyasının tek satırlık base64 verisi.
- `DBS_RELEASE_SIGNING_JSON`: mevcut `signing.json` içeriği (`alias`, `storePassword`, `keyPassword`, `storeFile: "DraBornSeries-release.jks"`).

Sertifika SHA-256: `ad35ced92a96551d972e2c44d4e9c34985a76528631c75a520981cc0f88f8ead`. Özel anahtarı veya şifresini kaynak koda yazma. Anahtar eksikse CI yalnız **unsigned** APK/AAB çıkarır ve ayrı geçici imzalı emülatör APK'sıyla davranışı doğrular. Bu geçici test imzası kullanıcıya yayın APK'sı olarak sunulmaz. Google Play yüklemesi mevcut upload key ile imzalanmış AAB gerektirir; anahtar değişiminde Console upload key sıfırlama süreci gerekir.

## Video ve ortak kaynak

R2/native v0.7.4 düzeltmesi korunur. Android kaynak tanımı `auto`, özgün signed URI, varsayılan HTTP başlıkları ve güvenli create/release yaşam döngüsünü kullanır. R2 URL imzalama ve altyazı hazırlama paraleldir. Bölüm açıldıktan sonra yalnız erişim hakkı bulunan sonraki bölümün kısa URL metadata'sı hazırlanır; videoların tamamı arka planda indirilmez. Normal bölüm/Keşfet altyazı yerleşimleri bu sürümde değiştirilmez.
