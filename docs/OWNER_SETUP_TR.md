# Hesap bağlantıları: adım adım

Durum: 29 Eylül 2026. Bu rehber **DraBorn-Park-Garage-Series** Supabase projesindeki `drabornseries` şeması ve **com.draborneagle.drabornseries** Android paket adı içindir. Stüdyo ve Expo Go web/Android JS testleri kullanılabilir. Mağaza fiyatları yalnızca örnektir; satın alma düğmesi kapalıdır. Şifreleri, JSON hizmet hesabını ve gizli anahtarları GitHub'a yüklemeyin.

## 1. Google ile giriş

1. [Google Cloud Console](https://console.cloud.google.com/apis/credentials) içinde bir proje ve OAuth izin ekranı açın. Ürün adı DraBornSeries, destek e-postası ve kullanıcı türünü belirleyin; test modundaysa test kullanıcılarını ekleyin.
2. **OAuth Client ID → Web application** oluşturun. Authorized JavaScript origins içine `https://www.draborneagle.com` ve gerekiyorsa `https://draborneagle.com` yazın. Authorized redirect URI olarak tam `https://xpdiwyxnnrmyvpcqwuyb.supabase.co/auth/v1/callback` ekleyin. Bu Google istemcisi Supabase sağlayıcısına bağlanır; uygulamanın `/DraBornSeries/` sayfası Google callback'i değildir.
3. [Supabase Dashboard → Authentication → Sign In / Providers → Google](https://supabase.com/dashboard/project/xpdiwyxnnrmyvpcqwuyb/auth/providers) bölümünde Google istemci kimliği ve gizli anahtarını girip etkinleştirin. Bu Auth ayarı **paylaşılan proje** düzeyindedir. Diğer uygulamaların OAuth ayarlarını silmeyin.
4. **Authentication → URL Configuration** altında mevcut Site URL'yi ve diğer uygulamaların redirect allow list kayıtlarını koruyun. Ek olarak `https://www.draborneagle.com/DraBornSeries/**` ve gerekirse `https://draborneagle.com/DraBornSeries/**` ekleyin. Native test için Expo Go'nun gerçek `Linking.createURL("/")` callback adresini Expo Go'da gözleyip izin listesine ekleyin; `drabornseries://**` şeması ancak kendi native build'inde kullanılır.
5. Webde Google girişini ve aynı Supabase hesabının Android'de e-posta oturumunu test edin. Android Google OAuth callback'i Expo Go proxy/özel scheme farklarından ötürü gerçek cihazda ayrıca denenmelidir; çalıştığını görmeden tamamlandı saymayın. Google ile e-posta girişinin aynı kişide hesap birleştirme davranışını test edin.

Kaynak: [Supabase Google Auth](https://supabase.com/docs/guides/auth/social-login/auth-google), [React Native Auth](https://supabase.com/docs/guides/auth/quickstarts/react-native).

## 2. Cloudflare Stream, R2 ve oynatma Worker'ı

1. [Cloudflare Dashboard](https://dash.cloudflare.com/) hesabında **Stream**'i açın, hesap kimliğini kaydedin. Stream'e hakkınız olan kısa **9:16** videoları yükleyin, işlenip `readyToStream` olduğunu bekleyin. Her ücretli/vip video için **requireSignedURLs** özelliğini açın; aksi halde UID tek başına herkese açık olabilir.
2. **R2 → Create bucket** ile özel bir kaynak medya kovası oluşturun. Ham videolar, altyazılar, ses ve görseller için varsayılan public access açmayın. R2 erişim anahtarını yalnızca gereken kovaya ve yetkilere sınırlayın. Stüdyo halen doğrudan dosya yüklemez; bugün Stream UID ve var olan HTTPS görsel adresi girilir. R2 ingest/özel dosya bağlantıları ayrı bir uygulama işi gerektirir.
3. Cloudflare **API Tokens** bölümünde Stream video listeleme/ayrıntı ve imzalı token işlemlerine yetecek sınırlı izinli token oluşturun. `CLOUDFLARE_ACCOUNT_ID` ve `CLOUDFLARE_API_TOKEN` değerlerini Supabase Edge Function `dbs-api` secrets bölümüne eklediğinizde Stüdyo'da hesap videoları seçilebilir. `CLOUDFLARE_API_TOKEN`'ı Expo/React istemcisine vermeyin.
4. `cloudflare/workers/wrangler.toml` dosyası Worker adını ve güvenli olmayan genel ayarları içerir. Cloudflare hesabınızla `npx wrangler login`, ardından `cd cloudflare/workers && npx wrangler secret put SUPABASE_SECRET_KEY`, aynı şekilde `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `STREAM_CUSTOMER_CODE` secret'larını tanımlayın. `SUPABASE_SECRET_KEY` sunucuda saklanır. `npx wrangler deploy` ile Worker'ı yayınlayın.
5. Supabase `dbs-api` secret'larına Worker'ın gerçek HTTPS temel adresini `DBS_WORKER_URL` olarak koyun. Stüdyo → İçerik → Videolar'da ilgili bölümü ve Stream UID'yi bağlayıp hazır işaretleyin. Ücretsiz/vip/coin/kilitli durumları **iki ayrı hesapta** test edin: kilitli kullanıcıya HLS dönmemeli, yetkili kullanıcıya kısa süreli token dönmeli. 30 dakikayı aşan oynatmalarda token yenileme henüz ele alınmalıdır.

Kaynak: [Stream özel video](https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/), [Stream yükleme](https://developers.cloudflare.com/stream/uploading-videos/), [R2 özel erişim](https://developers.cloudflare.com/r2/).

## 3. Google Play Billing, yenileme ve iade

**Expo Go'da Billing kütüphanesi çalışmaz.** Bu adımlar daha sonra native **development build** gerektirir; kullanıcı bugün APK istemediğinden gerçek ödeme açılmayacak.

1. [Play Console](https://play.google.com/console/) uygulamasını `com.draborneagle.drabornseries` paket adıyla oluşturun. Play ödeme profilini ve gerekli mağaza/test ayarlarını tamamlayın. Test kullanıcılarını lisans testine ekleyin.
2. **Monetize → Products → In-app products** içinde `dbs_coins_50`, `dbs_coins_100`, `dbs_coins_250`, `dbs_coins_500`, `dbs_coins_1000`, `dbs_coins_2500` ürünlerini oluşturun. **Subscriptions** içinde `dbs_vip_weekly`, `dbs_vip_monthly`, `dbs_vip_yearly` ve uygun temel plan/teklifleri oluşturun. Gerçek TL fiyatlarını, vergi ve ülke varyantlarıyla Console'da belirleyin. İstemci fiyatı Billing ProductDetails'tan almalı; ekrandaki “Örnek” rakamlar checkout verisi değildir.
3. **Google Cloud → Google Play Android Developer API**'yi etkinleştirin. Play Console API erişiminde sınırlı izinli hizmet hesabını yetkilendirin. JSON anahtarını güvenli bir secret olarak Supabase Edge Function `dbs-play-verify` içinde `DBS_GOOGLE_SERVICE_ACCOUNT` adına kaydedin; kaynak depoya yazmayın.
4. Native development build'e Billing modülünü ekleyin. `obfuscatedAccountId` değerini Supabase kullanıcı UUID'sinin SHA-256 özeti yapın. `PENDING` durumunda erişim vermeyin; `PURCHASED` tokenını oturumla backend'e gönderin. Server `purchases.products:get` / `purchases.subscriptionsv2:get` ile token, ürün, sahiplik, durum ve süreyi kontrol etsin; tekrar kullanım tek bir defter işlemi doğursun. İlk kredilendirmeden sonra tüketilebilir coin ürünü consume, abonelik acknowledge akışını tamamlayın.
5. [Real-time developer notifications](https://developer.android.com/google/play/billing/rtdn-reference) için Cloud Pub/Sub topic ve kimliği doğrulanmış push abonesi kurun. Her bildirimin tokenını Play Developer API'den **yeniden** sorgulayarak yeni abonelik süresini, iptal, grace, hold, expire, refund ve voided durumunu hesaplayın. [Voided Purchases API](https://developer.android.com/google/play/billing/voided-purchases) ve zamanlanmış yeniden uzlaştırma ile kaçırılan mesajları yakalayın. Refund/chargeback sonrası VIP hakkını geri alın ve coin borcu/harcama politikasını açıkça belirleyin.
6. Satın alma, tekrar callback, pending→paid, yenileme, iptal ama süre sonuna dek erişim, iade, chargeback ve ağ tekrar denemelerini lisans testleriyle doğrulayın. **Ancak sonra** `dbs_google_play_products.active` alanlarını açın ve gerçek checkout UI'sini bağlayın. Bu repo şu anda 4 ve 5. adımların tamamını içermez.

Kaynak: [Expo IAP](https://docs.expo.dev/guides/in-app-purchases/), [Play backend](https://developer.android.com/google/play/billing/backend), [satın alma yaşam döngüsü](https://developer.android.com/google/play/billing/lifecycle).

## 4. Ödüllü reklam doğrulaması

1. [AdMob](https://admob.google.com/) uygulama kaydını ve Android rewarded ad unit'i oluşturun. Önce Google'ın test reklam birimini kullanın.
2. Native development build'e Mobile Ads SDK uyumlu modülü ekleyin. Expo Go bunu yükleyemez. Reklamı göstermeden önce backend'den oturum sahibi, bölüm/ödül türü, kullanım süresi ve tek kullanımlık nonce içeren ödül niyeti alın. `custom_data` alanına sunucunun verdiği tek kullanımlık kimliği bağlayın.
3. AdMob'da **Server-side verification callback URL**'yi kendi HTTPS endpoint'inize ayarlayın. Endpoint Google'ın yayınladığı ECDSA public key/key id ile **orijinal imzalı sorgu baytlarını** doğrulasın, timestamp'i ve ad unit/reward tutarını kontrol etsin. Sadece `onUserEarnedReward` istemci callback'ine dayanmayın.
4. Benzersiz `transaction_id` ve nonce'yi atomik kilitle; kullanıcı, bölüm ve günlük limite göre tek kez `dbs_borncoins_transactions` veya `dbs_episode_unlocks` yaz. Yeniden oynatma, sahte callback, bitmemiş video ve günlük kota testlerini geçmeden ödülleri açmayın. Şu anda SSV endpoint'i ve gerçek ödüllü reklam akışı mevcut değildir.

Kaynak: [AdMob SSV](https://developers.google.com/admob/android/ssv), [Rewarded ads](https://developers.google.com/admob/android/rewarded).

## 5. Termux ekranındaki uyarı

Gönderdiğiniz ekranda React Native DevTools kurulumu `arm64` uyarısı üretmiş; **Android Bundled** satırı ve QR kodu da görünmüş. Dolayısıyla Metro JavaScript paketi oluşmuş, uyarı tek başına uygulamanın açılmadığını kanıtlamıyor. Güncel kaynak için:

```bash
cd "$HOME/DraBornSeries"
git pull --ff-only
npm ci
npx expo start --localhost --clear
```

Aynı telefonda Expo Go 58 ile `exp://127.0.0.1:8081` açın. Hata çıkarsa Expo Go'daki kırmızı ekranın tam metnini ve Termux'taki **bundling sonrasındaki** hata satırlarını paylaşın. Preview sürümlerini rastgele yükseltmeyin; repo `58.0.0-preview.7` ve eşleşen native paketlere sabitlidir.
