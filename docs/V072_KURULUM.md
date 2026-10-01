# DraBornSeries v0.7.2 · Kod 1

Paket adı: `com.draborneagle.drabornseries`. Destek: **support@draborneagle.com**. Web, Android ve tüm sunucu değişiklikleri aynı DraBornSeries hesabını kullanır.

## Native Google girişi

Özel Android derlemesinin Google dönüşü `drabornseries` uygulama şemasını kullanır. Supabase Authentication → URL Configuration → Redirect URLs içinde bu uygulamaya ait `drabornseries://**` dönüşünü izinli tut; çalışan web adresini ve diğer DraBornEagle uygulamalarının dönüşlerini silme. Google OAuth istemcisinin Supabase callback adresi değişmez. Bu oturumda native cihazda Google hesap seçimi ve dış redirect allowlist doğrulanamadı.

Google ekranında DraBornSeries adı için bağlı OAuth projesinin Branding doğrulaması ve yayımlanması gerekir; ayrıntılar [R2_SETUP.md](R2_SETUP.md#google-e-postasında-drabornseries-adı) içindedir. Mevcut Google avatarı ve elle seçilmiş profil bilgileri korunur.

## Google Play VIP

Native Billing istemcisi, sunucu satın alma doğrulaması ve gerçek zamanlı abonelik durum bildirimleri hazırdır. Google Play’den fiyat alınmadan veya sunucu hesabı bağlanmadan ödeme başlatılmaz. Web ve Expo Go ödeme açmaz; Android’de doğrulanmış VIP bu platformlarda da kullanılabilir. BornCoins paket satışı bu sürümde kapalıdır.

Play Console → Monetize → Products → Subscriptions altında aşağıdaki ürünleri oluştur. Her üründe bir **otomatik yenilenen** temel plan oluştur ve ürün/planı etkinleştir. Ülke ve fiyatlarını kendin belirle; uygulama mağazanın gerçek fiyatını gösterir.

| Ürün kimliği | Temel plan kimliği | Dönem | Görünen ad |
|---|---|---|---|
| `dbs_vip_weekly` | `weekly` | `P1W` / 1 hafta | Haftalık VIP |
| `dbs_vip_monthly` | `monthly` | `P1M` / 1 ay | Aylık VIP |
| `dbs_vip_yearly` | `yearly` | `P1Y` / 1 yıl | Yıllık VIP |

Başlangıçta indirimli teklif eklemek gerekmez. Uygulama temel planı satın alır. Mevcut Google Play VIP aboneliği bulunan hesapta ikinci abonelik başlatılmaz; abonelik yönetimi düğmesi Google Play’e gider. İptal edilen ancak süresi bitmemiş abonelik kalan süre boyunca geçerlidir. Bekleyen ödeme, askıya alma, duraklatma ve iade yeni VIP erişimi vermez. Promosyon VIP süresi ücretli abonelikten bağımsızdır.

Google Cloud’da **Google Play Android Developer API**’yi etkinleştir. Sunucu için hizmet hesabı oluştur; Play Console → Users and permissions içinde ilgili uygulamaya abonelik/siparişleri görüntüleme ve yönetme yetkisini ver. Bu hesabın JSON anahtarını Supabase → Edge Functions → Secrets içine **`DBS_GOOGLE_SERVICE_ACCOUNT`** adıyla koy. Anahtar yalnız sunucuda tutulur; uygulamaya veya R2’ye yüklenmez.

Yenileme, iptal, iade ve ödeme durumu senkronizasyonu için:

1. Google Cloud Pub/Sub’da bir konu oluştur. `google-play-developer-notifications@system.gserviceaccount.com` hesabına bu konu için **Pub/Sub Publisher** ver.
2. Play Console’daki gerçek zamanlı geliştirici bildirimlerine bu konunun tam adını gir: `projects/PROJE_ID/topics/KONU_ADI`.
3. Konuya bir **push subscription** ekle. Endpoint:
   `https://xpdiwyxnnrmyvpcqwuyb.supabase.co/functions/v1/dbs-play-rtdn`
4. Push kimlik doğrulamasını aç ve ayrı bir hizmet hesabı seç. OIDC audience alanına endpoint’in tamamını gir. Supabase secret **`DBS_PLAY_RTDN_SERVICE_EMAIL`** bu seçilen hesabın e-posta adresi olmalıdır. İsteğe bağlı **`DBS_PLAY_RTDN_AUDIENCE`** aynı endpoint’tir; verilmezse kod bunu kullanır. Pub/Sub service agent’ına seçilen hesap için token oluşturma yetkisini Google’ın authenticated push kurulumuna göre ver.
5. Console test bildirimini gönder. Geçerli, kimliği doğrulanmış test bildirimi 204 döner. Satın alımları uygulama içinden Google Play’in test kanalı ve license tester hesabıyla dene; satın alma, geri yükleme, iptal ve durum değişikliği aynı web profilinde görünmelidir.

`dbs-play-verify` satın alma token’ını Google’ın API’sinden doğrular, hesabın SHA256 eşlemesini kontrol eder, hakları atomik kaydeder ve aboneliği acknowledge eder. RTDN imzasız bildirim kabul etmez; callback sırası yerine Google’ın güncel durumu kullanılır. Aynı token ve eski bildirimler tekrar VIP ekleyemez.

## AdMob örnek reklamları

Özel Android derlemesinde Google’ın resmi test uygulama/ödüllü reklam kimlikleri kullanılır. Reklam açılır ve gerçek SDK tamamlanma olayı alınır. **Örnek reklam gerçek BornCoins veya ücretli bölüm erişimi vermez.** Web ve Expo Go bu native SDK’yı içermez.

| Test ayarı | Değer |
|---|---|
| Android uygulama kimliği | `ca-app-pub-3940256099942544~3347511713` |
| Android ödüllü reklam birimi | `ca-app-pub-3940256099942544/5224354917` |
| Varsayılan test modu | Açık |

Kendi AdMob bilgilerin hazır olduğunda:

1. Android uygulamasını yukarıdaki paket adıyla ekle; **Rewarded** reklam birimi oluştur. Ödül **miktarı `3`**, **adı `BornCoins`** olsun.
2. Bu birimin server-side verification callback adresi:
   `https://xpdiwyxnnrmyvpcqwuyb.supabase.co/functions/v1/dbs-ad-verify`
3. Supabase secrets: **`DBS_ADMOB_MODE=production`**, **`DBS_ADMOB_AD_UNIT=ca-app-pub-.../...`**. Uygulama/SDK ve callback aynı reklam birimini kullanmalıdır.
4. Android build environment: **`EXPO_PUBLIC_ADMOB_APP_ID=ca-app-pub-...~...`**, **`EXPO_PUBLIC_ADMOB_TEST_MODE=false`**. Yeniden Android derlemesi oluştur. Bunlar herkese açık uygulama kimlikleridir; hizmet hesabı anahtarı bu değişkenlere yazılmaz.
5. AdMob Privacy & messaging içinde gereken bölgeler için consent mesajını yayımla. Uygulama UMP ekranını açar; izin verilen reklam isteği durumundan önce gerçek reklam istemez. Ayarlar → Reklam gizlilik tercihleri gerekli olduğunda tercih ekranını tekrar açar. Kişiselleştirilmiş reklam istenmez; `AD_ID` izni kapalıdır.

Gerçek ödül yalnız Google’ın ECDSA imzalı SSV isteği doğrulandığında kaydedilir. Kullanıcı ve reklam birimi, sunucunun bir defalık bileti, zaman ve işlem kimliği kontrol edilir. Günlük üst sınır Türkiye gününe göre **5 ödüllü reklam**dır. Cüzdan reklamı 3 BornCoins verir; reklamla açılan bölümde bilet ilgili bölümü açar ve ayrıca para üretmez. Tekrar gelen callback ödülü çoğaltmaz. SDK’nın istemci callback’i doğrudan cüzdan yazamaz.

## Android’i çalıştırma

`eas.json` development (Metro kullanan özel geliştirme APK’sı), preview (kurulabilir APK) ve production (Play için AAB) profillerini içerir. Billing ve AdMob için Expo Go yerine bu native derlemeler gerekir.

```sh
npm ci
npx eas-cli build --platform android --profile preview
# Google Play'e yüklenecek imzalı AAB:
npx eas-cli build --platform android --profile production
```

EAS hesabı/proje ve uygulama imzası geliştiricinin hesabında bağlanır. Depodaki Android CI ayrıca JavaScript’i gömülü, test anahtarıyla imzalanan APK üretir; Play Console’a verilecek üretim AAB’sinin yerine geçmez. Sürüm kodu istendiği gibi 1 kalır. React Native 0.88 için compile SDK 37, uygulama target SDK 36’dır.

## Test2 altyazısı ve R2 kalitesi

Test2’de altyazının sırada kalmasının nedeni gerçek video isteğinin **Cloudflare HTTP 403 / error code 1010** ile engellenmesidir. İşleyici bir dosya hata verdiğinde sıradaki videoyu işlemeye devam eder; Stüdyo işlem durumunu açık bölüm kartında otomatik yeniler. Mevcut manuel Türkçe altyazılar korunur.

Cloudflare hesabında [R2_SETUP.md](R2_SETUP.md) içindeki mevcut Worker güncellemesini uygula ve yetkili altyazı işlemcisini engelleyen erişim kuralını düzelt. Account ID ve S3 adresi dağıtım yetkisi sağlamaz. Bu oturumda Cloudflare hesabına dağıtım token’ı sağlanmadığı ve panel erişimi engellendiği için bu adım canlıda tamamlanmış değildir. Engel kaldırıldığında Stüdyo bölüm kartında **yeniden dene**; GitHub altyazı işleyicisi konuşmayı tanır ve Türkçeye çevirir. Kuyruk GitHub zamanlamasına bağlıdır; tam 5 dakikada başlama garantisi yoktur.

1080p olarak yüklenen tek MP4 zaten orijinal çözünürlüğünde oynar. Menüde video metadata’sından gerçek **1080p · Orijinal** ve Otomatik gösterilir. R2 otomatik olarak 720p/480p kopya üretmez; aynı dosyaya sahte çözünürlük etiketleri konmaz. Daha düşük kaliteler için ayrı kodlanmış video dosyaları gerekir. Mevcut çoklu kalite film dosyaları ve HLS trackleri seçilebilir kalır.

Tears of Steel’in mevcut dikey dosyaları korunur; dizi yatay seçildiğinde aynı beş kesimin kırpılmamış 720p yatay kopyaları kullanılır. Altyazı saatleri, beğeniler ve izleme ilerlemesi aynı bölüm kimliğinde kalır. Fragmanın yana yatır animasyonu yalnız tam ekran açıldıktan sonra görünür. Oynatıcıda **Görüntünün tamamı** ve **Ekranı doldur** yerleşimleri de seçilebilir.

## Kaynaklar

- https://docs.expo.dev/guides/in-app-purchases/
- https://hyochan.github.io/expo-iap/
- https://developer.android.com/google/play/billing/lifecycle/subscriptions
- https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions
- https://developers.google.com/admob/android/ssv
- https://docs.page/invertase/react-native-google-mobile-ads/european-user-consent
