# DraBornSeries Stüdyo · Dizi ve video ekleme

Web ve Android aynı Stüdyo kayıtlarını, aynı `drabornseries.dbs_*` tablolarını kullanır.

1. Profil → **DraBornSeries Stüdyo** → **İçerik → Diziler → Yeni Dizi**. Ad, bağlantı adı (örneğin `yeni-hikaye`), tanıtım, tür ve ekip alanlarını doldur. Afiş / banner için HTTPS URL yaz veya **Cihazdan görsel seç** kullan. Fragman için URL ya da **Cihazdan fragman seç** vardır. Başlangıçta **Taslak** seç; **Değişiklikleri kaydet**.
2. Kaydedildi kartındaki **Bu diziye sezon ekle** düğmesine bas. Dizi seçili gelir. Sezon numarası ve adını yaz, kaydet. Kısa dizilerde ilk sezon için `1` kullan.
3. **Bu sezona bölüm ekle** düğmesine bas. Bölüm numarası / adı, tanıtımı, süre, dikey yön ve thumbnail gir. Ücretsiz / BornCoins / reklam / VIP / VIP veya BornCoins erişimini seç; gerekli BornCoins fiyatını yaz. Bölümü henüz **Taslak** bırak, kaydet.
4. **Bölüme video yükle / bağla** düğmesine bas. Bölüm seçili gelir. **Cihazdan bölüm videosu seç** ile dosya yükle; sayfayı açık tut. Alternatif: Cloudflare panelinden yüklediğin videonun **Stream UID** değerini gir ya da bağlı hesap listesinden seç.
5. Cloudflare işledikten sonra **Hazır durumunu kontrol et** düğmesine bas ve **Değişiklikleri kaydet**. Hazır durumu istemciden kabul edilmez, sunucudan doğrulanır. Bölüm süresi ve yönü hazır videonun gerçek bilgisinden güncellenir; episode video `requireSignedURLs: true` ile bağlanır.
6. **Bölüm ayarları / Yayınla** düğmesiyle bölümü aç; **Yayında** seçip kaydet. İleride çıkacak bölüm için **Planlı** ve zaman dilimli yayın tarihi gir (örneğin `2026-10-01T21:00:00+03:00`). **Diziler** ekranından diziyi de **Yayında** yap. Ana sayfa / Keşfet yayınlanmış içerikleri alır.
7. Diğer bölümler için **Sıradaki bölümü ekle** veya **Bölümler → Yeni Bölüm** kullan; 3–5. adımları tekrarla. Numara aynı dizi içinde benzersiz olmalı. Altyazı ve ses için ilgili Stüdyo sekmesinde bölüm, dil, etiket ve medya anahtarını ekle.

## Hesap bağlantıları

Görsellerin cihazdan yüklenmesi hazırdır: `dbs_series_artwork` bucket'ı yalnızca aktif owner/editor yöneticinin kendi klasörüne yazmasına izin verir. Görseller JPEG olarak hazırlanır; en fazla 8 MB. URL alanları da kullanılabilir.

Cihazdan video yükleme ve Stream listesi için:

1. Cloudflare Dashboard → hesabın → **Stream**. Hizmeti etkinleştir ve **Account ID** değerini al.
2. **My Profile → API Tokens → Create Custom Token**. Yalnızca bu hesap için **Account → Stream → Edit** yetkisi ver; token'ı sakla.
3. Supabase → **DraBorn-Park-Garage-Series → Edge Functions → Secrets**. `CLOUDFLARE_ACCOUNT_ID` ve `CLOUDFLARE_API_TOKEN` ekle. Token'ı Expo env, uygulama kodu veya GitHub dosyasına yazma.
4. Stüdyo → **Videolar → Yenile**. Hesap listesi görünmeli; cihazdan yükleme doğrudan Stream'e gider, dosya GitHub veya Supabase Storage'a aktarılmaz.
5. Bu yükleyici 200 MB altı ve en fazla 60 dakikalık dosyalar içindir. Büyük dosyalar veya kesintili bağlantıda Cloudflare panelinin resumable/tus yükleyicisini kullan; çıkan Stream UID'yi Stüdyo'ya bağla.
6. Ücretli içerik için [OWNER_SETUP_TR.md](OWNER_SETUP_TR.md) içindeki Worker, R2 ve güvenli oynatma adımlarını da tamamla. Bu test kataloğunun açık lisanslı videoları halka açık test CDN'indedir.

Cloudflare hesabı henüz bağlı değilse cihazdan video seçimi sonrasında anlaşılır bağlantı bilgisi gösterilir; yüklenmiş veya hazır video varmış gibi kayıt oluşturulmaz.

VIP ekranındaki örnek fiyat ödeme değildir. Expo Go native Google Play Billing çalıştırmaz; gerçek ödeme için Play Console ürünleri, sunucu doğrulaması ve development build / Play sürümü gerekir. **Hemen Ödeme Yap** bu bağlantı eksikse ücret almadan bilgi verir. Billing, RTDN/iade, AdMob SSV ve Google OAuth adımları [OWNER_SETUP_TR.md](OWNER_SETUP_TR.md) içindedir.
