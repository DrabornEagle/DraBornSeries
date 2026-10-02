# DraBornSeries v0.7.3 teslim bilgileri

Paket: `com.draborneagle.drabornseries`. Sürüm: **0.7.3**, versionCode: **2**.

## Kurulum ve imza

`DraBornSeries-v0.7.3-release.apk` bağımsız release uygulamasıdır; Metro veya Expo Go gerekmez. `DraBornSeries-v0.7.3-release.aab` Google Play iç test kanalına yüklemek içindir. İkisi aynı RSA4096 release anahtarıyla imzalanır. Eski test APK'sı farklı anahtarla imzalandığı için Android imza çakışması verirse eski uygulamayı kaldırıp bu APK'yı kur. Hesaba kayıtlı içerikler yeniden girişte eşitlenir.

`DraBornSeries-v0.7.3-keystore.zip` içindeki `DraBornSeries-release.jks` imza anahtarıdır. Alias ve iki şifre `signing.json` içindedir. İmzalama için bu dosyaları birlikte kullan. Anahtarı, şifreleri ve ZIP'i gizli sakla; kaynak depoya veya web sitesine yükleme. Play App Signing kullanıldığında bu dosya upload key olarak kullanılabilir. Play Console'da daha önce tanımlanmış başka bir upload key varsa Console'un anahtar sıfırlama süreci gerekir.

Sertifika SHA256: `ad35ced92a96551d972e2c44d4e9c34985a76528631c75a520981cc0f88f8ead`. Bu sertifika `release-certificate.json` dosyasında sabitlenir. İlk derlemedeki anahtar emekliye ayrılmıştır; teslim edilen APK/AAB yeni anahtarı kullanır.

Kaynak depo herkese açıktır. Actions yalnız AES256 CMS ile sahibin RSA4096 alıcı sertifikasına şifrelenmiş yedeği saklar; eski açık keystore çıktıları silinir. Teslim edilen ZIP'in `signing.json` ve keystore dosyaları yalnız kullanıcıya özel teslim edilir.

Sonraki Actions derlemeleri için GitHub Settings → Secrets and variables → Actions bölümünde iki repository secret gerekir: `DBS_RELEASE_KEYSTORE_BASE64`, JKS dosyasının satır sonu içermeyen base64 karşılığı; `DBS_RELEASE_SIGNING_JSON`, signing.json içeriği. Şifreleri değişkenlere veya kaynak dosyalara koyma. Workflow sertifika kontrolü yapar ve sabitlenen anahtar yoksa farklı bir anahtar üretmeyi reddeder. Android Studio/Gradle ile yerel derlemede teslim edilen keystore ve şifreler kullanılabilir.

## Google Play VIP

AAB'yi iç test kanalına yükle, ürünleri ve otomatik yenilenen temel planları etkinleştir. Fiyat ve ülke ayarlarını Play Console'da yap. Uygulama Google Play'den gerçek fiyatları alır; eksik ürünleri ön plana dönüşte ve 60 saniyede bir yeniden sorgular.

| Ürün | Temel plan | Dönem |
|---|---|---|
| `dbs_vip_weekly` | `weekly` | 1 hafta |
| `dbs_vip_monthly` | `monthly` | 1 ay |
| `dbs_vip_yearly` | `yearly` | 1 yıl |

Sunucu hizmet hesabı ve üç VIP ürün kaydı etkin. Satın alma hesabı sunucuda doğrulanır; doğrulanmış üyelik Android ve webde aynı hesapta kullanılabilir. Satın alımları geri yükleme hazır. Yenileme/iptal/iade RTDN fonksiyonu yalnız doğrulanmış Google bildirimlerini kabul eder. Gerçek satın alma, Console ürün durumu ve Google'dan gelen gerçek RTDN bildirimi bu teslimde canlı bir ödeme hesabıyla denenmedi. Lisans test kullanıcısı ile Google Play test kanalından doğrulanmalı. Pub/Sub ve Console bildirim eşleştirmesi için `V072_KURULUM.md` içindeki RTDN adımlarını kullan.

## Reklam testi

APK'da resmi Google AdMob test modu açıktır. Android Ödüller ekranından **Reklamı izle** ile hesabına giriş yapmadan test edebilirsin. Test reklamları gerçek BornCoins veya ücretli bölüm erişimi eklemez. Gerçek ödüller yalnız üretim reklamları ve doğrulanmış SSV ile verilir. Webde reklam düğmesi ve AdMob ödül alanı yoktur.

## v0.7.3 değişiklikleri

- Dizi detayının üst köşesinde amber bölüm ve mint izlenme sayaçları.
- Logo ve koyu arka planlı native splash, ardından animasyonlu yükleme ekranı.
- Varsayılan Ekranı doldur; Akıllı sığdır kaldırıldı.
- Yalnız dikey tam ekranda 24px daha yüksek altyazı.
- BornCoins harcamasından önce açık onay ve bakiye bilgisi.
- Promosyon sonucunda kazanılan BornCoins/VIP günlerini gösteren Tebrikler penceresi.
- VIP üyelerine altın rozet ve renkli, animasyonlu bölüm erişim kartları.
- İzleme ilerlemesi 5 saniyede ve video bitişi/kapatmada kaydedilir; ilk sayılan izlenme sonrası katalog yenilenir. Sunucu bir hesap/bölüm için tek izlenme sayar; tekrar oynatma yeni izlenme üretmez.
- Okunabilir dizi/sezon/bölüm yolları. Eski UUID bağlantıları korunur ve yeni yola geçer. Doğrudan açılış ve sayfa yenileme desteklenir.

## Doğrulanan teslim

Bu APK API36 Google APIs / x86_64 Pixel 6 emülatörüne kurulup soğuk başlangıçta katalog ve gezinmeyi gösterdi; resmi AdMob test reklamı yüklenip açıldı. Native derleme ve emülatör testi: https://github.com/DrabornEagle/DraBornSeries/actions/runs/36947390884 . Fiziksel cihaz kurulumu ve gerçek Google Play ödemesi bu çalışmada denenmedi.

APK/AAB imzaları aynı teslim edilen keystore sertifikasıyla eşleşir. 36 native kütüphanenin ELF ve APK konumları 16 KB hizalıdır. AAB Google bundletool ile doğrulandı. Uygulama/SQL güvenlik CI geçti. Ayrıntılar ve dosya SHA256 değerleri ZIP içindeki DraBornSeries-v0.7.3-verification.json dosyasındadır.
