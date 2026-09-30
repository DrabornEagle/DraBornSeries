# DraBornSeries · v0.5.0 · versionCode 1

Android (Expo Go 58) + web kısa dizi platformunun **erken erişim test sürümü**. Web: https://www.draborneagle.com/DraBornSeries/

Bu sürüm resmi ticari lansman değildir. Ticari içerik hakları, Cloudflare hesabı, Google OAuth, Play Console/Billing, RTDN/iade sistemi, AdMob SSV ve Android push bağlantıları henüz tamamlanmadı. Ayrıntılı durum: [FEATURE_STATUS.md](docs/FEATURE_STATUS.md).

## v0.5 güncel düzenlemeler

- Android önizlemesi her tamponlama olayında tekrar seek yapmaz; afiş ilk çözülmüş video karesine kadar kalır. Keşfet sesi açık başlar; kullanıcı ses tercihi kaydırırken korunur.
- Yatay videoda tam ekran, tek seferlik animasyonlu “Cihazını yana çevir” ipucu ve cihazın yönüne göre kırpılmadan sığan oynatma. Tam ekrandan çıkınca normal dikey kilit geri yüklenir.
- Google renklerinde animasyonlu giriş düğmesi; daha büyük ve modern hesap oluşturma / şifre sıfırlama düğmeleri.
- 14 eksik Blender açık filmi tam ve yatay hâliyle eklendi. Katalog: 18 film, 28 oynatılabilir bölüm. [Tam film kaynakları ve lisanslar](docs/blender-film-catalog.json).
- Sezon/bölüm kaydında doğal benzersiz anahtarlar kullanılır. Cloudflare tus yüklemesi, ilerleme, yeniden deneme, imzalı bildirim ve işlenince otomatik UID bağlantısı eklendi. GitHub hizmet dağıtımı hesap bilgileri tanımlıysa kurulumu ve katalog aktarımını otomatik yürütür.
- Cloudflare hesabı henüz bağlı değil: canlı API `cloudflare/uploads/webhook=false` döndürüyor. Kurulum bekleme durumunu ve gereken secret adlarını [INTEGRATIONS.md](docs/INTEGRATIONS.md) açıklar.

## Önceki v0.4 düzenlemeleri

- Keşfet v0.3'teki doğal, ivmeli ve sayfalı dikey listeye döndü. Tek video / hareket kısıtı ve mor oklar yok.
- Ana sayfa vitrininde sadece üç afiş penceresi yatay parmak hareketine tepki verir; afişler animasyonla yer değiştirir. Tüm hero alanı kaydırılmaz. Kategori seçimi ilgili içeriklere aşağı kaydırır.
- Premium ortak oynatıcı: video üstünde kaybolan kontroller, ilerleme çubuğu, ±10 saniye, ses, fullscreen, desteklenen PiP ve gerçek kaynak çözünürlükleri. Dikey fullscreen alanı orantıları koruyarak doldurur. Bölümler düğmesi bölüm listesini açar; fragman uygulama içinde oynar.
- **Tears of Steel (5), Spring (3), Charge (3), Coffee Run (3)**: açık lisanslı gerçek çekim / profesyonel 3D kısa filmlerin **9:16 test uyarlamaları**. Özgün bölümlü TV dizileri veya DraBornSeries yapımı olarak sunulmaz. Önceki iki vektör hikâyesi arşivlendi. Lisans, yapımcı ve değişiklik bilgileri dizi detayında gösterilir; jenerikler son bölümde tam kadrajda korunur.
- Seçili VIP paket düğmesi animasyonlu; detay penceresinde 1080p FULL HD (içeriğin sunduğu kalite), VIP kapsamı için sınırsız izleme, reklamsız kullanım ve hesap senkronu. **Hemen Ödeme Yap**, gerçek ödeme bağlantısı eksikse açık bilgi verir; hiçbir demo ödeme/coin/VIP tanımlamaz.
- Stüdyo 10 kayıtla açılır, Daha Fazla 5 kayıt yükler. Kayıt sayısı ayrı satırdadır. Aktif oturumlar 5 + 5 gösterilir.
- Stüdyo afiş, banner ve thumbnail için cihazdan görsel yükleme; fragman ve bölüm videosu için Cloudflare Direct Creator Upload hazırlığı. Video API anahtarı istemciye aktarılmaz; gerçek hazır durumu ve signed erişim sunucudan doğrulanır.
- Dizi → sezon → bölüm → video → yayın adımlarını açan Stüdyo yönlendirmeleri.
- Kayıtta isteğe bağlı Ad Soyad ve profil fotoğrafı; modern geniş kayıt / Google düğmeleri. Ad ve fotoğraf hesapla Android ve webde senkron olur.

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

Uygulama tabloları `dbs_` ile başlar ve RLS açıktır. Ayrıcalıklı yardımcılar, API'ye açılmayan `dbs_series_private` şemasındadır. Mevcut `public` tabloları değiştirilmedi.

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

Kendi e-posta hesabını oluştur. Ödüller'den doğrulanmış e-posta hesabına bir defa 80 BornCoins karşılama ödülü, ilk favori ve kişiselleştirilmiş profil için ayrı görev ödülleri alabilirsin. Cüzdanda **DBS2026** kodu bir defa 30 BornCoins verir; günlük ödül de aktiftir. Test kataloğunda **18 lisanslı gerçek film / 28 oynatılabilir bölüm** vardır: Tears of Steel (5), Spring (3), Charge (3) ve Coffee Run (3) kronolojik 9:16 uyarlamalar olarak korunur; diğer 14 film tam ve yatay hâliyle eklenmiştir. Bunlar özgün dikey TV dizileri veya DraBornSeries yapımları değildir; lisans ve değişiklik bilgileri dizi detayında görünür. Agent 327 özgün hâliyle oynatılır ve kısa döngülü önizlemeye alınmaz. Altı özgün dizi konsepti **Yakında** durumundadır. Neon Postası/Yıldız Tohumu vektör testleri yayından arşive alındı; kullanıcı geçmişi ve işlem kayıtları korundu.

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

İstemci yalnızca publishable anahtarı içerir. Service role, Google hizmet hesabı, Stream anahtarı veya başka secret repo içinde yoktur. Coin/VIP/purchase tablolarında client write grant yoktur. Ödeme doğrulama adaptörü, ürünler ve servis sırları etkinleştirilene kadar kapalıdır. Stüdyo içerik formları, kullanıcı ayrıntıları, yönetici işlem kayıtları ve gerçek veriye dayalı temel istatistikleri sunar. Mağaza örnek fiyatlarını gösterir; ödeme açmaz. [Hizmet bağlantıları ve üretim entegrasyonu sınırları](docs/INTEGRATIONS.md) belgelendi.
