# DraBornSeries · v0.1.0

Android (Expo Go 58) + web kısa dizi platformunun **erken erişim test sürümü**. Web: https://www.draborneagle.com/DraBornSeries/

Bu sürüm resmi ticari lansman değildir. Gerçek dizi hakları ve videoları, Cloudflare hesabı, Google OAuth, Play Console/Billing, RTDN/iade sistemi, AdMob SSV ve Android push bağlantıları henüz tamamlanmadı. Ayrıntılı durum: [FEATURE_STATUS.md](docs/FEATURE_STATUS.md).

## Çalışan özellikler

- Özgün koyu/neon arayüz, oluşturulmuş uygulama ikonu, splash ve Gece Hattı konsept görseli; telefon/tablet/masaüstü düzeni.
- Ortak Supabase Auth e-posta hesabı; profil, dil tercihleri, oturum listesi ve uygulama verisi silme.
- Canlı katalog, dizi/bölüm detayları, tür/isim/oyuncu/etiket arama, geçmiş ve filtreler.
- Expo Video (Android) ve HTML5/HLS.js (web) oynatıcı: devam, ileri/geri, ses, fullscreen, cihazın desteklediği PiP ve kaynağın sunduğu kalite seçenekleri.
- BornCoins defteri, atomik ve tekrarlanabilir güvenli bölüm satın alma, günlük ödül, 7 günlük streak, promosyon kodu.
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
git clone https://github.com/DrabornEagle/DraBornSeries.git
cd DraBornSeries
npm ci
npx expo start --localhost --clear
```

Aynı telefondaki Expo Go'da `exp://127.0.0.1:8081` adresini aç. Başka cihaz aynı Wi-Fi'da bağlanacaksa `npx expo start --lan --clear` kullan. Termux'ta Android uygulama derleyicileri gerekmez; APK üretilmez.

Güncelleme: `cd "$HOME/DraBornSeries" && git pull --ff-only && npm ci && npx expo start --localhost --clear`

Expo SDK `58.0.0-preview.7`, React Native `0.88.0-rc.1`, React `19.3.0` sürümleri Expo Go 58 paket eşlemelerine göre sabitlendi. Bu hâlâ preview SDK'dır. Yerel gerçek Android cihazda dokunmatik/video testi kullanıcı tarafından Expo Go ile yapılmalıdır.

## Test hesabı ve içerik

Kendi e-posta hesabını oluştur. Cüzdan ekranında **DBS2026** kodunu kullanarak bir kez 30 BornCoins alabilirsin. Günlük ödül de aktiftir. Big Buck Bunny test koleksiyonu, aynı açık lisanslı film üzerinden ücretsiz/coin/reklam/VIP erişim türlerini gösterir. Özgün dizi konseptleri **Yakında** durumundadır; yayınlanmış gerçek dizi gibi gösterilmez.

Yönetici: doğrulanmış `draborneagle@gmail.com` hesabı. Profil → **DraBornSeries Stüdyo**, veya `?page=admin`. Bu yalnızca UI gizleme değildir; backend role kontrolü yapar.

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

İstemci yalnızca publishable anahtarı içerir. Service role, Google hizmet hesabı, Stream anahtarı veya başka secret repo içinde yoktur. Coin/VIP/purchase tablolarında client write grant yoktur. Ödeme doğrulama adaptörü, ürünler ve servis sırları etkinleştirilene kadar kapalıdır. `docs/INTEGRATIONS.md` kalan üretim bağlantılarını açıklar.
