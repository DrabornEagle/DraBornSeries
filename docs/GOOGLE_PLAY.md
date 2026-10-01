# DraBornSeries v0.7.2 · Google Play hazırlığı

Uygulama kimliği: `com.draborneagle.drabornseries`. Sürüm: `0.7.2`, Android versionCode: `1`. Geliştirici ve gizlilik iletişimi: **DraBornEagle**, **support@draborneagle.com**. Bu belgede v0.7.2’nın mevcut veri kullanımı açıklanır; Play Console’a gönderim yapılmış veya Google onayı alınmış değildir.

## Console’a girilecek bağlantılar

| Alan | Adres |
| --- | --- |
| Gizlilik Politikası | https://www.draborneagle.com/DraBornSeries/privacy.html |
| Hesap/veri silme | https://www.draborneagle.com/DraBornSeries/account-deletion.html |
| Kullanım ve topluluk kuralları | https://www.draborneagle.com/DraBornSeries/terms.html |
| Web uygulaması | https://www.draborneagle.com/DraBornSeries/ |
| Destek | support@draborneagle.com |

HTML belgeleri JavaScript, giriş veya uygulama kurulumu gerektirmez. Aynı metinler Android ve webde Ayarlar, Yardım, giriş/kayıt ve alt bağlantılardan açılır. Silme sayfasında e-posta talebi ve giriş yapılmış web hesabından doğrudan silme vardır. Sunucu hesabın sahipliğini ve onayı kontrol eder; uygulama profil fotoğrafını ve `dbs_registration` kimlik doğrulama metadata alanını da temizler. Yerel bekleyen ilerleme ve kayıt fotoğrafı temizlenir. Diğer uygulamaların ortak Auth hesabı otomatik silinmez; kapsam ve korunan asgari güvenlik kaydı her iki politikada açıkça belirtilir. Ortak giriş hesabının tamamını silme talebi aynı destek adresine yapılır.

## Data safety için mevcut veri envanteri

Google formundaki son cevaplar uygulamanın gönderilecek AAB’si ve sağlayıcı sözleşmeleriyle karşılaştırılmalıdır. Aşağıdaki veriler Supabase tarafında tutulur; HTTPS kullanılır. Konum izni, mikrofon/kamera kaydı, rehber, IMEI, reklam kimliği veya reklam profillemesi yoktur.

| Form kategorisi | Uygulamadaki veriler | Amaç / seçim |
| --- | --- | --- |
| Personal info · Email address | Kayıt/giriş e-postası | Hesap yönetimi; misafir izleme için hesap şart değil |
| Personal info · User IDs | Auth kimliği, kullanıcı adı | Hesap, sahiplik, güvenlik, senkronizasyon |
| Personal info · Name | İsteğe bağlı ad soyad | Profil |
| Photos and videos · Photos | Kullanıcının seçtiği profil görseli; Stüdyo görselleri | İsteğe bağlı; sistem fotoğraf seçicisi; profil görseli herkese açık bağlantıda saklanır |
| App activity · App interactions | İzleme/ilerleme, favori, beğeni, puan, promosyon, test BornCoins ve erişim kayıtları | Uygulama işlevleri, hesap senkronu ve kötüye kullanım önleme |
| App activity · In-app search history | Kullanıcının kaydettiği aramalar | Aramayı kolaylaştırma; geçmiş ayrı temizlenebilir |
| App activity · Other user-generated content | Yorumlar ve destek/şikayet metinleri | İsteğe bağlı; moderasyon ve destek; onaylanan yorumlar görüntülenebilir |
| Device or other IDs | Uygulamanın ürettiği rastgele cihaz kimliği, oturum kimliği | Güvenlik, cihaz/oturum yönetimi; donanım/reklam kimliği değil |
| Financial info · Purchase history | Play VIP sipariş/token hash/abonelik durumu | Satın alma doğrulama, erişim ve iade; Google Play ödeme ekranı kart bilgisini yönetir |
| AdMob SDK · Device or other IDs / App interactions / Diagnostics | SDK cihaz/uygulama ve reklam etkileşim verileri, IP bağlantı bilgisi | Test reklamlarında da sağlayıcı veri kullanımı; gerçek reklamlarda consent; AD_ID kapalı |
| Sunucu teknik kayıtları | IP, istemci bilgisi, erişim ve teknik hata kayıtları | Sağlayıcıların işletim/güvenlik kayıtları; formda diagnostics ve sağlayıcıların saklaması ayrıca doğrulanmalı |

Supabase hesap/veritabanı/depolama hizmet sağlayıcısıdır. Test medyası CloudFront üzerinden sunulur; Yeni yüklemeler Cloudflare R2 Worker üzerinden sunulur. Otomatik Türkçe altyazı için yayıncı videoları GitHub Actions üzerinde Whisper ve çeviri modeliyle işlenir. İzleyici mikrofonu kaydedilmez. Mevcut Stream bağlantıları desteklenir. Hizmet sağlayıcıya aktarım ile Google’ın “sharing” tanımı aynı değildir; sağlayıcının işlemesi geliştirici adına olduğunda formdaki istisna uygulanabilir. Kullanıcının yayımladığı yorum/profil görselinin ve dış bağlantı/paylaşımın beyanı ayrıca değerlendirilmelidir. “Veri toplanmıyor” yanıtı bu uygulama için doğru değildir.

v0.7.2 özel Android derlemesinde AdMob test SDK’sı ve Google Play VIP Billing istemcisi vardır. AdMob bağlantı/cihaz bilgisi ve reklam etkileşimlerini işleyebilir; AD_ID izni kapalıdır ve kişiselleştirilmiş reklam istenmez. Gerçek reklamlarda Google UMP consent uygulanır. Play ürünleri/hizmet hesabı harici olarak bağlandığında satın alma token hash’i, sipariş ve abonelik durumu sunucuda doğrulanır; kart bilgisi uygulamaya verilmez. Push henüz etkin değildir. [V072_KURULUM.md](V072_KURULUM.md) ürün ve callback ayarlarını içerir.

## Android ve içerik hazırlığı

- Yerel yapılandırma `android.compileSdkVersion=37`, `android.targetSdkVersion=36` ve versionCode 1 üretir. Birleşik native manifestte INTERNET, ağ/Wi-Fi durumu, WAKE_LOCK, FOREGROUND_SERVICE, uygulamanın dahili receiver izni ve Google Play BILLING bulunur. Kamera, mikrofon, geniş fotoğraf/video erişimi, harici depolama, `AD_ID`, Privacy Sandbox AdServices kimliği/konuları/atfı, overlay ve titreşim izinleri kaldırılır. Profil görseli Android sistem seçicisinden seçilir. Expo Go’nun kendi manifesti uygulama izinlerinin kanıtı değildir.
- `eas.json` üretim profili Android App Bundle için hazırlanmıştır; versionCode otomatik artırılmaz. JavaScript gömülü ve test anahtarıyla imzalı arm64 Android APK derlendi; üretim AAB’si veya Play Console yayını yapılmadı. Gönderilecek imzalı AAB’de birleşik manifest, target SDK, 16 KB sayfa boyutu desteği ve bağlı native SDK’lar son kez denetlenmelidir.
- Yorum öncesi topluluk kuralları kabulü, varsayılan onaylı yorum ve sonradan moderasyon, içerik şikayeti, kullanıcı engelleme ve Ayarlar’dan engeli kaldırma vardır. Engelleme hesabın tercihleriyle Android/web arasında eşitlenir. Kayıtta kullanım koşulları açıkça kabul edilir.
- Film kaynakları, gerçek lisans sürümleri ve uyarlamalar detay ekranında korunur. `docs/blender-film-catalog.json`, `docs/vertical-film-catalog.json` ve `assets/subtitles/README.md` kaynak envanteridir. Mağaza metni bu açık filmleri DraBornSeries’in özgün yapımı olarak tanıtmamalıdır.
- Guest katalog/ücretsiz filmler inceleme için erişilebilir. Hesapla çalışan özellikler için Play Console **App access** alanına gerçek, çalışır inceleme hesabı sağlanmalıdır; bu depoda şifre saklanmaz.

Yayın için Play Console uygulama kaydı, imzalama/EAS proje bağlantısı, imzalı AAB, gerçek Android cihaz testi, IARC içerik derecelendirmesi, hedef yaş grubu, Data safety cevapları, mağaza görselleri ve gerekiyorsa kapalı test tamamlanmalıdır. Destek posta kutusunun takibi ve sağlayıcı yedek/teknik kayıt saklama sürelerinin doğrulanması geliştiricide kalır. VIP satışı için Play Console ürünleri, hizmet hesabı ve RTDN bağlantısı tamamlanmalıdır. Bu hazırlık belgeleri Google inceleme sonucunun yerine geçmez.

## Resmî kaynaklar · 30 Eylül 2026 kontrolü

- https://support.google.com/googleplay/android-developer/answer/10144311 — User Data / gizlilik ve hesap silme
- https://support.google.com/googleplay/android-developer/answer/13327111 — uygulama içi ve dışı hesap silme
- https://support.google.com/googleplay/android-developer/answer/10787469 — Data safety ve hizmet sağlayıcı aktarımı
- https://support.google.com/googleplay/android-developer/answer/11926878 — 31 Ağustos 2026’dan sonra yeni uygulama/güncellemelerde API 36
- https://support.google.com/googleplay/android-developer/answer/9876937 — kullanıcı içeriği, kabul, moderasyon, şikayet ve engelleme
- https://docs.expo.dev/guides/permissions/ — native manifestte blockedPermissions
