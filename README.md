# DraBornSeries · v0.4.0 · versionCode 1

Android (Expo Go 58) + web kısa dizi platformunun **erken erişim test sürümü**. Web: https://www.draborneagle.com/DraBornSeries/

Bu sürüm resmi ticari lansman değildir. Ticari içerik hakları, Cloudflare hesabı, Google OAuth, Play Console/Billing, RTDN/iade sistemi, AdMob SSV ve Android push bağlantıları henüz tamamlanmadı. Ayrıntılı durum: [FEATURE_STATUS.md](docs/FEATURE_STATUS.md).

## v0.4 değişiklikleri

- Yardım, uygulama, API ve Android sürümü `0.4.0`; `versionCode: 1`.
- Keşfet okları kaldırıldı. Her parmak hareketi veya mouse/trackpad kaydırma hareketi bir video değiştirir; ivme birkaç videoyu birden atlamaz. Klavye ve erişilebilirlik desteği devam eder.
- Ana sayfa vitrininde sağa/sola parmak kaydırma; gerçek hesaba bağlı izlenme ve beğeni göstergeleri. Örnek sayaç üretilmez.
- Eski Big Buck Bunny, Sintel ve Pexels örnekleri katalogdan kaldırıldı. Özgün vektör animasyon **Neon Postası (5 bölüm)** ve **Yıldız Tohumu (3 bölüm)** eklendi. Her bölüm 24 saniye, 540×960, Türkçe hikâye yazıları ve özgün müzik içerir. AI videosu değildir.
- Web fullscreen videonun boyut sınırı kaldırıldı. Chrome/Android'in geçici tam ekrandan çıkış güvenlik bildirimi tarayıcıya aittir; site kodu bunu kapatamaz.
- Bağlantı/hesap hataları anlaşılır popup; profil ve isteğe bağlı kayıt fotoğrafını cihazdan seçme, kare 512 px hazırlama ve hesapla senkron kaydetme.
- Stüdyo'da yayınlanmış dizi, sezon ve bölümleri atomik silme; dizi adıyla onay, yalnızca owner yetkisi, finansal kayıtları ve rapor/audit izini koruma. Cloudflare dosyalarını silmez.

## Çalışan özellikler

- Özgün Miami neon arayüz; 1,7 saniyelik animasyonlu splash/loading, logo, Gece Hattı konsept afişi ve BornCoins hediye illüstrasyonu; telefon/tablet/masaüstü düzeni.
- Ana sayfada sırayla değişen dikey afişler ve sesiz kısa video önizlemeleri; Keşfet'te ekran boyunda yukarı/aşağı kaydırılan dikey sahneler, favori, ses ve “Tümünü izle”. Düşük bağlantıda afişe dönüş ve ayarlardan otomatik önizlemeyi kapatma.
- Ana Sayfa / Keşfet / Listem / Ödüller / Profil alt menüsü; özgün Mağaza, VIP, cüzdan, görevler ve profil ekranları.
- Ortak Supabase Auth e-posta hesabı; profil, dil tercihleri, oturum listesi ve uygulama verisi silme.
- Canlı katalog, dizi/bölüm detayları, tür/isim/oyuncu/etiket arama, geçmiş ve filtreler.
- Expo Video (Android) ve HTML5/HLS.js (web) oynatıcı: devam, ileri/geri, ses, fullscreen, cihazın desteklediği PiP ve kaynağın sunduğu kalite seçenekleri.
- BornCoins defteri, atomik ve tekrarlanabilir güvenli bölüm satın alma, günlük ödül, 7 günlük streak, promosyon kodu ve doğrulanan tek kullanımlık karşılama/favori/profil görevleri.
- Mağazada altı BornCoins paketi ve haftalık, aylık, yıllık VIP plan kartları örnek fiyatlarla gösterilir. Kartlarda fiyatın örnek olduğu belirtilir; Expo Go üzerinden gerçek satın alma yapılmaz.
- Hesap bazlı favoriler, puan, moderasyona gönderilen yorumlar, spoiler, beğeni/şikayet.
- İzleme ilerlemesinin cihazlar arası senkronizasyonu ve bağlantı sonrası yerel progress kuyruğunun gönderilmesi.
- Katalog/medya/kullanıcı/cüzdan/rapor/yorum/altyazı/ana sayfa yönetimi için web admin paneli.
- Dakikalık otomatik scheduled bölüm yayınlama ve uygulama içi yeni bölüm bildirimleri.

## Önemli veritabanı ayrımı

Supabase projesi: **DraBorn-Park-Garage-Series** (`xpdiwyxnnrmyvpcqwuyb`).

DraBornStyle daha önce `public.dbs_profiles`, `public.dbs_notifications` ve başka `dbs_` tablolarını kullandığı için DraBornSeries ayrı **drabornseries** şemasına kuruldu. Böylece istenen adlar aynen korunur:

- `drabornseries.dbs_profiles`
- `drabornseries.dbs_series`
- `drabornseries.dbs_episodes`
- `drabornseries.dbs_borncoins_wallet`
- `drabornseries.dbs_episode_unlocks`
- `drabornseries.dbs_vip_subscriptions`

Tüm 59 tablo `dbs_` ile başlar ve RLS açıktır. Ayrıcalıklı yardımcılar, API'ye açılmayan `dbs_series_private` şemasındadır. Mevcut `public` tabloları değiştirilmedi.

## Termux · Expo Go 58.0.0

```bash
pkg update -y && pkg install -y nodejs-lts git
cd "$HOME"
[ -d DraBornSeries/.git ] || git clone https://github.com/DrabornEagle/DraBornSeries.git
cd DraBornSeries
git pull --ff-only
npm ci
npx expo start --localhost --clear
```

Aynı telefondaki Expo Go'da `exp://127.0.0.1:8081` adresini aç. Başka cihaz aynı Wi-Fi'da bağlanacaksa `npx expo start --lan --clear` kullan. Termux'ta Android uygulama derleyicileri gerekmez; APK üretilmez.

Güncelleme: `cd "$HOME/DraBornSeries" && git pull --ff-only && npm ci && npx expo start --localhost --clear`

Expo SDK `58.0.0-preview.7`, React Native `0.88.0-rc.1`, React `19.3.0` sürümleri Expo Go 58 paket eşlemelerine göre sabitlendi. Bu hâlâ preview SDK'dır. Termux'ta React Native DevTools `arm64` kurulumu uyarısı çıksa da `Android Bundled` ve QR görünüyorsa Metro çalışıyor; gerçek uygulama hatasını Expo Go kırmızı ekranı ve bundling sonrası kayıtla belirleyin. Yerel gerçek Android cihazda dokunmatik/video testi kullanıcı tarafından Expo Go ile yapılmalıdır.

## Test hesabı ve içerik

Kendi e-posta hesabını oluştur. Ödüller'den doğrulanmış e-posta hesabına bir defa 80 BornCoins karşılama ödülü, ilk favori ve kişiselleştirilmiş profil için ayrı görev ödülleri alabilirsin. Cüzdanda **DBS2026** kodu bir defa 30 BornCoins verir; günlük ödül de aktiftir. İlk bakış kataloğunda **4 koleksiyon / 8 lisanslı 9:16 demo sahnesi** vardır. Bunlar tamamlanmış diziler değildir. Altı özgün dizi konsepti **Yakında** durumundadır. Eski yatay test filmleri arşivlendi; eski kullanıcı geçmişi silinmedi.

Yönetici: doğrulanmış `draborneagle@gmail.com` hesabı. Profil → **DraBornSeries Stüdyo**, veya `?page=admin`. Bu yalnızca UI gizleme değildir; backend role kontrolü yapar.

Admin hesabının istenen şifreyle gerçek giriş ve backend rol testi yapıldı. Şifre kaynak koda, dokümanlara veya otomasyona yazılmadı. Supabase Auth aynı projedeki diğer uygulamalar tarafından da paylaşıldığı için bu hesabın şifresi o oturumlarda da güncellendi.

## Geliştirme

```bash
npm ci
npm run check
npm run lint
npm run build:web
npm run export:android
npm run sync:web
```

`apps/mobile` ortak uygulama, `apps/web` web davranışı, `apps/admin` yönetim paneli; ortak servisler `packages/api`, bileşenler `packages/ui`. Backend migration/seed/Edge Functions `supabase`, video gateway `cloudflare/workers` altında.

GitHub Actions uygulama kontrollerini, web export ve Android JS export'u çalıştırır. Native APK build veya Play release tetiklenmez. Ayrı veritabanı işi local Supabase üzerinde migration/seed/RLS testini çalıştırır. Web reposundaki sync işi en son doğrulanmış ana kaynak commit'ini `/DraBornSeries/` altına yayınlar.

## Güvenlik

İstemci yalnızca publishable anahtarı içerir. Service role, Google hizmet hesabı, Stream anahtarı veya başka secret repo içinde yoktur. Coin/VIP/purchase tablolarında client write grant yoktur. Ödeme doğrulama adaptörü, ürünler ve servis sırları etkinleştirilene kadar kapalıdır. Stüdyo içerik formları, kullanıcı ayrıntıları, yönetici işlem kayıtları ve gerçek veriye dayalı temel istatistikleri sunar. Mağaza örnek fiyatlarını gösterir; ödeme açmaz. [Hesap bağlantılarını adım adım kurma](docs/OWNER_SETUP_TR.md) ve [üretim entegrasyonu sınırları](docs/INTEGRATIONS.md) ayrı belgelendi.
