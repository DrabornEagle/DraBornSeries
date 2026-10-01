# Kapsam ve gerçek durum — 2026-10-01

Bu dosya, 49 maddelik ürün hedefi ile şu anda teslim edilen sürümü ayırır. Hiçbir test/demonstrasyon gerçek ticari yayın olarak kabul edilmez.

| Alan | Durum |
|---|---|
| Android + Web ortak arayüz/backend | Uygulandı; web tarayıcı ve Android export ile kontrol edilir. Fiziksel Expo Go testi burada yapılmadı. |
| Marka, ikon, splash, neon tasarım | Özgün görseller ve animasyonlu splash; Mağaza/VIP/cüzdan/ödüller/profil ve beşli alt menü yenilendi. |
| E-posta kayıt/giriş, profil, oturumlar | Uygulandı. Ortak Auth ayarları korunur. |
| Google giriş | Kullanıcı OAuth bağlantısını yaptı. İlk girişte tam e-posta kullanıcı adı ve Google profil fotoğrafı alınır. Google e-postasının uygulama adı için dış Branding doğrulama/yayın ayarı gerekir. |
| Şifre sıfırlama | İstemci akışı mevcut; SMTP/redirect e-posta teslimi canlı olarak doğrulanmadı. |
| Profil fotoğrafı | Google hesabından otomatik fotoğraf alma ve cihazdan seçim/Supabase Storage yüklemesi; hesapla senkronlanır. Elle yapılan değişiklikler korunur. |
| Katalog, türler, detaylar, erişim etiketleri | 18 lisanslı açık film / 28 bölüm korunur; sahibin R2 Test içeriğiyle toplam yayında 19 içerik / 29 bölüm vardır. 6 özgün gelecek konsepti ayrı tutulur. |
| Featured, devam, öneri, arama, favoriler | Uygulandı. Ana sayfada rastgele dönüşümlü sessiz kısa video önizlemesi, ekran dışına çıkınca duraklatma ve kullanıcı tercihi var. Öneriler favori türlerine dayalı temel sıralama. |
| Dikey Keşfet | Yayımlanmış içerikler yön filtresi olmadan listelenir; videolar gerçek sürelerinin ortasından başlar, bitince yine ortadan döner. Ana izleme ilerlemesini değiştirmez. Ses tercihi kaydırırken korunur; favori/paylaşım ve bölüm listesi var. |
| Ana sayfadaki 16 ayrı editoryal koleksiyon | Temel raylar var; tüm koleksiyonların ayrı veri/istatistik akışları tamamlanmadı. |
| Video, seek, ses, fullscreen, resume | Normal oynatma tüm videolarda dikey 9:16. Yatay seçilmiş videoda her tam ekran girişinde yana çevir animasyonu yeniden görünür; yalnızca bu videolar yatay dönüşe izin verir. Tam ekranda video/ekran yönü aynı olduğunda oran korunarak ekran doldurulur; gerektiğinde kenarlardan kırpılır. Yönler farklıyken dönüş öncesi tüm kare gösterilir. Kaliteler gerçek dosyalar/tracklerdir. Dikey tam ekran altyazıları v0.7’de 46 px yukarıda ve güvenli alana göre; fragman yönü aynı oynatıcıda izlenir. Fiziksel Android kontrolü bekliyor. |
| Altyazı ve çoklu ses | Beş konuşmalı açık film için 9 Türkçe WebVTT track / 377 zamanlı satır hazır; oynatıcı ve Keşfet otomatik Türkçe açar. SRT/WebVTT Android/web ortak parser ve zamanlamayla gösterilir. Player altyazıyı kapatabilir ve gömülü ses tracklerini seçebilir. Yeni R2 bölümleri OIDC ile yetkilendirilmiş GitHub Actions kuyruğunda Whisper/çeviri modeliyle otomatik Türkçe altyazı alır. Manuel Türkçe korunur; konuşmasız videoya altyazı eklenmez. Kalıcı özel-video servis önizlemesi için Worker v0.7.1 hesabın içinde dağıtılmalıdır; geçişte iki saatlik sahip önizlemesi kullanılabilir. |
| BornCoins cüzdan/defter/coin ile unlock | Gerçek Supabase işlemleri; server-only, idempotent, atomik. Altı mağaza paketi taslak/inactive. Kartlarda açıkça örnek olarak işaretli TL fiyatları görünür; ödeme kapalıdır. Kullanıcı onayıyla otomatik coin ile açma tercihi var. |
| Günlük ödül, streak, promosyon | Aktif; Türkiye saatine göre. Stüdyo promosyonları BornCoins/VIP günü/ikisini birlikte, elle girilen miktar, kullanım sınırı ve son tarih ile kaydeder. Hesap başına bir kez kullanılır. |
| Görev/başarım sistemi | Karşılama, ilk favori ve profil görevleri server-side koşul ve tek seferlik ledger ile çalışıyor. İzleme görevleri, XP/davet/badge claim motoru bekliyor. |
| VIP erişim kontrolü | Server-side aktif subscription kontrolü ve haftalık/aylık/yıllık plan kartları var. Örnek TL fiyatları görünür; gerçek VIP satışı açılmadı. Yönetici yalnızca kayıtlı gerekçeyle 7/30/365 gün VIP tanımlayabilir. |
| Google Play Billing | Server verifier kaynak/deploy hazır fakat kapalı. Native Billing, Play ürünleri ve RTDN/refund/chargeback lifecycle bekliyor. |
| Rewarded Ads | Şema/erişim türü var. Native SDK, ECDSA SSV ve ödül claim akışı tamamlanmadı; coin veren sahte reklam yok. |
| Cloudflare | Yeni videolar R2 Worker üzerinden alınır. Canlı Worker v0.7.0 yetkili klasör tarama, imzalı oynatma ve Range desteği verir. v0.7.1 sunucu API key önizleme düzeltmesi hazır; Cloudflare hesabı erişimi olmadığından bu modülün dağıtımı bekler. Mevcut katalog kaynakları korunur. |
| Yorum, spoiler, puan, şikayet | Uygulandı; yorumlar moderasyonda başlar, tekrar/sıklık sınırı var. Topluluk kuralları kabulü, yorum yazarını engelleme ve Ayarlar’dan engeli kaldırma var. Otomatik gelişmiş küfür sınıflandırıcı yok. |
| Bildirim | Uygulama içi bildirim, tercihler, scheduled yayın bildirimi var. Android push/token/teslim worker yok. |
| Admin | Renkli Stüdyo özeti, tek sekmeli dizi/bölüm editörü, R2 klasör seçimi veya toplu dosya yolları, otomatik numara/süre, önizleme ve atomik kayıt. Video yönü dizi bazlıdır; yayınlama adımları kaldırıldı. Kullanıcı/rapor/altyazı/vitrin yönetimi korunur. Dosyalar kullanıcı tarafından R2’ye yüklenir. Stüdyo araması tüm katalogda sunucudan yapılır; tam ad eşleşmesi ilk sıradadır. Önizleme düğmesi videoya bir kez kaydırır. |
| Analytics | Günlük/haftalık/aylık aktif kullanıcılar, son ilerleme kayıtları, tamamlama, BornCoins ve tekil izleyici sıralamaları veritabanından hesaplanır. Oynatma sayısı, gerçek gelir ve retention için olay ve ödeme atfı henüz yok; bunlar tahmin edilmez. |
| Scheduled yayın | pg_cron dakikada bir hazır videolu scheduled bölümleri yayınlar. |
| TR/EN | Temel navigasyon/başlıklar ve model alanları var. Tüm alt ekran metinleri henüz eksiksiz çevrilmedi. |
| Deep links | Web query linkleri ve Android intent filter var; signed-release assetlinks doğrulaması bekliyor. |
| Offline | Progress kuyruğu ve katalog cache; offline video yok. |
| Güvenlik | RLS, session revocation, ledger kilidi, ownership, privilege testleri var. Üretim abuse/red-team ve pentest tamamlanmadı. |
| Official Launch | Hazır değil. Gerçek içerikler, üretim hizmet bağlantıları, ödeme/reklam lifecycle ve cihaz testleri zorunlu. |

İleri geliştirmede tüm yeni tablolar aynı `drabornseries` şemasında `dbs_` adıyla oluşturulmalıdır; mevcut DraBornStyle dbs_ tabloları kullanılmamalıdır.

V0.6: 18 lisanslı gerçek film / 28 oynatılabilir bölüm canlı veritabanında doğrulandı. Önceki vektör testleri arşivdedir. Profil fotoğrafı cihazdan seçilir ve ortak Supabase hesabıyla senkronlanır. Stüdyo silme, bölüm içeren yayınlanmış dizilerde owner rolü ve adla onay ile çalışır. Ticari Cloudflare/ödeme/reklam bağlantıları henüz üretim değildir.

V0.6 Google Play hazırlığı: ortak gizlilik/koşullar/hesap silme ekranları ve JavaScript gerektirmeyen web HTML sayfaları; gerçek Data safety envanteri; API 36 ve minimal native izinler; AAB üretim profili. Play Console gönderimi, imzalı AAB ve fiziksel cihaz kontrolü henüz yapılmadı. Bkz. [GOOGLE_PLAY.md](GOOGLE_PLAY.md).

V0.7: mevcut katalog seri/bölüm/medya fingerprint’leri değişmedi. 29 birim testi, TypeScript/lint, web ve Android JavaScript export, rollback R2/Google/ledger güvenlik testleri geçti. R2 Worker dağıtımı ve Google Branding için [R2_SETUP.md](R2_SETUP.md).

V0.7.1: 33 birim testi, TypeScript/lint, web ve Android JavaScript export ile promosyon/altyazı/search rollback SQL kontrolleri geçti. Canlı web v0.7.1 Kod 1 ve support@draborneagle.com iletişimini gösterir. Google marka doğrulama/yayın ve Worker v0.7.1 dağıtımı dış hesap adımlarıdır; [PROGRESS.md](PROGRESS.md) canlı işlem sonucunu kaydeder.
