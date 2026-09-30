# R2 ile dizi ekleme · v0.7

Videolar için Worker: `https://drabornseries.draborneagle.workers.dev`.

## Kullanım

1. R2 bucket’ında dizi adında bir klasör oluştur: örneğin `Son Gece`.
2. Bölümleri `Son Gece/Bolum-01.mp4`, `Son Gece/Bolum-02.mp4` olarak yükle. H.264/AAC MP4 web ve Android için uygundur; `.webm` ve `.m4v` dosyalarını yayınlamadan önce hedef cihazda önizle. R2 dosyanın codec’ini değiştirmez veya kalite varyasyonları üretmez.
3. Profil → DraBornSeries Stüdyo → Yeni dizi. Dizi adı, açıklama, tür, bütün bölümlerin video yönü ve görselleri ayarla.
4. **Bölümler ve R2** sekmesinde klasör adını yazıp **Klasördeki videoları bul** seç. Videoları seçip bölüm olarak ekle. Dosya adları doğal sırada listelenir; numaralar mevcut en yüksek bölüm numarasından devam eder.
5. İstersen aynı alana her satıra bir dosya yolu ya da mevcut Worker’ın tam `/media/` bağlantısını yapıştır. Klasör adı yazılıysa sadece `Bolum-01.mp4` de kullanılabilir. Örnek: `Test/VID-20260910-WA0010.mp4`. Worker hesabı henüz güncellenmediyse bu yöntem ücretsiz bölümlerde çalışır.
6. Bölüm adına dokunarak başlık, sezon, süre, erişim ve yayın durumunu düzenle. Önizleme gerçek dosyayı kontrol eder. Süre video metadata’sından okunur; okunamazsa saniye olarak gir. Bir kayıtta en fazla 50 yeni/düzenlenmiş bölüm gönderilir; daha sonra yeni bölümler eklenebilir.
7. **Yayın ayarları** bölümünden dizi durumunu seç. İstenirse aynı durum bütün bölümlere tek düğmeyle uygulanır. **Diziyi ve bölümleri kaydet** ile dizi/sezon/bölüm/video birlikte kaydedilir. Kayda girilmeyen mevcut bölümler silinmez veya başka videoya çevrilmez.

Altyazılar Stüdyo’nun Altyazılar bölümünden bölüm/dil için SRT veya WebVTT HTTPS bağlantısıyla eklenir. R2’ye MP4 yüklemek kendiliğinden çeviri/altyazı üretmez. Mevcut altyazılar ve oynatma ilerlemesi aynı ortak oynatıcıda devam eder.

## Mevcut Worker’ı güncelleme

Bucket ve mevcut dosyalar korunur. Kullanıcının verdiği test dosyası HEAD ve Range 206 ile çalışıyor. Ancak eski Worker’ın `/health` yanıtı düz metindir; klasör tarama ve ücretli/VIP medya için aşağıdaki modül dağıtılmalıdır.

1. Cloudflare → Workers & Pages → mevcut **drabornseries** Worker → Edit code. [cloudflare/r2-worker.js](../cloudflare/r2-worker.js) dosyasının tamamını mevcut kodun yerine koyup dağıt.
2. Worker’ın mevcut R2 bucket binding’ini koru. Kod binding adını otomatik tanır; yeni bucket açmak veya dosyaları taşımak gerekmez. Sadece bir medya bucket binding’i olmalıdır.
3. Worker Settings → Variables and Secrets altında `SIGNING_SECRET` adında güçlü rastgele bir secret tanımla. Varsa desteklenen `SIGNING_SECRET`, `MEDIA_SIGNING_SECRET` veya `DBS_MEDIA_SIGNING_SECRET` yeniden kullanılır. Secret uygulama koduna ya da sohbet mesajına yazılmaz.
4. `/health` JSON olarak `ok:true`, `provider:"r2"`, `version:"0.7.0"`, `listing:true`, `privateMedia:true` göstermeli. Stüdyo bu yetenekleri otomatik algılar; tekrar uygulama sürümü çıkarmak gerekmez.
5. Ücretli medya için bucket’ın ayrı **r2.dev public access** ve public custom domain erişimlerini kapalı tut. Güncel Worker ham `/media/` isteğini imzasız reddeder; kullanıcıya yayımlanmış ücretsiz veya hesabının erişim hakkı olan bölümler için süreli URL verir. Ücretsiz R2 fragmanları yayımlanmış dizi üzerinden çözülür.

Alternatif otomatik dağıtım: GitHub DraBornSeries repository → Settings → Environments → production altında mevcut hesabın **Workers Scripts Edit** yetkili `CLOUDFLARE_API_TOKEN` secret’ı. `CLOUDFLARE_ACCOUNT_ID` verilmezse `073b0f4e7f33bf2ce56fe8f60dbe6067` kullanılır. **DraBornSeries service deployment** workflow’u mevcut binding ve secret’ları korur; signing secret eksikse oluşturur. Account ID ve S3 adresi tek başına Worker dağıtım yetkisi sağlamaz.

R2 S3 API `https://073b0f4e7f33bf2ce56fe8f60dbe6067.r2.cloudflarestorage.com` yükleme araçları içindir. Stüdyo’ya S3 API adresi veya access key girilmez. Worker’dan video oynatma, normal ilerleme kaydı ve altyazı aynı web/Android API’sini kullanır. İleri sarma byte-range ile çalışır. Bir MP4 yalnızca kendi gerçek çözünürlüğünü sunar; Stream’in otomatik HLS/çoklu kalite kodlaması R2’de kendiliğinden bulunmaz.

## Google e-postasında DraBornSeries adı

Google’ın “bu uygulamada oturum açtınız” bildirimi Google tarafından üretilir. Supabase proje adını değiştirmek veya uygulamadaki bir yazıyı değiştirmek bu bildirimin adını düzeltmez.

Bağladığın Google OAuth istemcisinin bulunduğu Cloud projesinde **Google Auth Platform → Branding** aç. **App name** alanını `DraBornSeries` yap. Ana sayfa `https://www.draborneagle.com/DraBornSeries/`, gizlilik `https://www.draborneagle.com/DraBornSeries/privacy.html`, koşullar `https://www.draborneagle.com/DraBornSeries/terms.html`. Kullanıcı destek ve geliştirici e-postasını kendi yönetilen adresinle doldur. Mevcut Supabase callback URL’si ve diğer uygulamaların OAuth ayarlarını koru.

Google’ın güncel akışında marka değişiklikleri önce Draft Branding olur. **Verify Branding** ile doğrula; **Ready to publish** sonrası **Publish branding** ile canlıya al. Alan adı sahipliği veya manuel inceleme istenirse o projenin sahibi tamamlar. Yeni Google girişinde ve Google bildiriminde görünen adı kontrol et; eski gönderilmiş e-postalar değişmez. Bu görevde Google Console bu tarayıcıya açılamadığı için dış marka ayarı tamamlandı olarak raporlanmaz.

Uygulama tarafında ise Google kayıtlarında kullanıcı adı tam e-posta, profil resmi Google avatarı olarak hazırlanır. Önceden otomatik `viewer_...` adıyla oluşturulmuş Google hesabı sonraki girişte düzelir. Sonradan elle değiştirilen ad veya profil fotoğrafı yeniden ezilmez.

Google’ın resmi marka doğrulama/yayın akışı: https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification
