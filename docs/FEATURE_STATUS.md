# Kapsam ve gerçek durum — 2026-09-30

Bu dosya, 49 maddelik ürün hedefi ile şu anda teslim edilen sürümü ayırır. Hiçbir test/demonstrasyon gerçek ticari yayın olarak kabul edilmez.

| Alan | Durum |
|---|---|
| Android + Web ortak arayüz/backend | Uygulandı; web tarayıcı ve Android export ile kontrol edilir. Fiziksel Expo Go testi burada yapılmadı. |
| Marka, ikon, splash, neon tasarım | Özgün görseller ve animasyonlu splash; Mağaza/VIP/cüzdan/ödüller/profil ve beşli alt menü yenilendi. |
| E-posta kayıt/giriş, profil, oturumlar | Uygulandı. Ortak Auth ayarları korunur. |
| Google giriş | Google renklerinde animasyonlu düğme ve istemci akışı mevcut; Supabase Google sağlayıcısı kapalı. |
| Şifre sıfırlama | İstemci akışı mevcut; SMTP/redirect e-posta teslimi canlı olarak doğrulanmadı. |
| Profil fotoğrafı | Cihazdan seçim ve Supabase Storage yüklemesi; hesapla senkronlanır. |
| Katalog, türler, detaylar, erişim etiketleri | 18 lisanslı gerçek açık film / 28 bölüm; 14 yeni film yatay ve tam hâliyle yayında. 6 özgün gelecek konsepti ayrı tutulur. |
| Featured, devam, öneri, arama, favoriler | Uygulandı. Ana sayfada rastgele dönüşümlü sessiz kısa video önizlemesi, ekran dışına çıkınca duraklatma ve kullanıcı tercihi var. Öneriler favori türlerine dayalı temel sıralama. |
| Dikey Keşfet | Yayımlanmış 18 içerik yön filtresi olmadan listelenir; videolar gerçek sürelerinin ortasından başlar, bitince yine ortadan döner. Ana izleme ilerlemesini değiştirmez. Ses tercihi kaydırırken korunur; favori/paylaşım ve bölüm listesi var. |
| Ana sayfadaki 16 ayrı editoryal koleksiyon | Temel raylar var; tüm koleksiyonların ayrı veri/istatistik akışları tamamlanmadı. |
| Video, seek, ses, fullscreen, resume | Normal oynatma tüm videolarda dikey 9:16. Yatay seçilmiş videoda her tam ekran girişinde yana çevir animasyonu yeniden görünür; yalnızca bu videolar yatay dönüşe izin verir. Tam ekranda tüm kare sığar. Kaliteler gerçek dosyalar/tracklerdir. Tam ekran altyazıları daha aşağıda ve güvenli alana göre; fragman yönü aynı oynatıcıda izlenir. Fiziksel Android kontrolü bekliyor. |
| Altyazı ve çoklu ses | Beş konuşmalı açık film için 9 Türkçe WebVTT track / 377 zamanlı satır hazır; oynatıcı ve Keşfet otomatik Türkçe açar. SRT/WebVTT Android/web ortak parser ve zamanlamayla gösterilir. Player altyazıyı kapatabilir ve gömülü ses tracklerini seçebilir. Yeni yüklemeler için konuşma tanıma hizmeti, özel R2 yükleme ve URL imzalama henüz bağlı değil. |
| BornCoins cüzdan/defter/coin ile unlock | Gerçek Supabase işlemleri; server-only, idempotent, atomik. Altı mağaza paketi taslak/inactive. Kartlarda açıkça örnek olarak işaretli TL fiyatları görünür; ödeme kapalıdır. Kullanıcı onayıyla otomatik coin ile açma tercihi var. |
| Günlük ödül, streak, promosyon | Aktif; Türkiye saatine göre. |
| Görev/başarım sistemi | Karşılama, ilk favori ve profil görevleri server-side koşul ve tek seferlik ledger ile çalışıyor. İzleme görevleri, XP/davet/badge claim motoru bekliyor. |
| VIP erişim kontrolü | Server-side aktif subscription kontrolü ve haftalık/aylık/yıllık plan kartları var. Örnek TL fiyatları görünür; gerçek VIP satışı açılmadı. Yönetici yalnızca kayıtlı gerekçeyle 7/30/365 gün VIP tanımlayabilir. |
| Google Play Billing | Server verifier kaynak/deploy hazır fakat kapalı. Native Billing, Play ürünleri ve RTDN/refund/chargeback lifecycle bekliyor. |
| Rewarded Ads | Şema/erişim türü var. Native SDK, ECDSA SSV ve ödül claim akışı tamamlanmadı; coin veren sahte reklam yok. |
| Cloudflare | tus yükleme, imzalı webhook, otomatik UID bağlama ve doğrudan imzalı playback kodu/canlı API hazır. Hesap erişimi/secrets eksik; canlı bağlantı false. GitHub kurulumu mevcut hesap bilgileriyle otomatik yürütür. |
| Yorum, spoiler, puan, şikayet | Uygulandı; yorumlar moderasyonda başlar, tekrar/sıklık sınırı var. Topluluk kuralları kabulü, yorum yazarını engelleme ve Ayarlar’dan engeli kaldırma var. Otomatik gelişmiş küfür sınıflandırıcı yok. |
| Bildirim | Uygulama içi bildirim, tercihler, scheduled yayın bildirimi var. Android push/token/teslim worker yok. |
| Admin | Stüdyo; etiketli dizi, sezon, bölüm, medya, vitrin formları, kullanıcı arama/detay/hesap işlemleri, raporlar, işlem kayıtları ve metriklere ayrıldı. Boş taslak dizi silme yalnızca owner. HTTPS medya adresi veya hazır Stream UID girilir; doğrudan R2 dosya yükleme henüz yok. Gelişmiş vitrin ayarları isteğe bağlı JSON. |
| Analytics | DAU/WAU/MAU, son ilerleme kayıtları, tamamlama, BornCoins ve tekil izleyici sıralamaları veritabanından hesaplanır. Oynatma sayısı, gerçek gelir ve retention için olay ve ödeme atfı henüz yok; bunlar tahmin edilmez. |
| Scheduled yayın | pg_cron dakikada bir hazır videolu scheduled bölümleri yayınlar. |
| TR/EN | Temel navigasyon/başlıklar ve model alanları var. Tüm alt ekran metinleri henüz eksiksiz çevrilmedi. |
| Deep links | Web query linkleri ve Android intent filter var; signed-release assetlinks doğrulaması bekliyor. |
| Offline | Progress kuyruğu ve katalog cache; offline video yok. |
| Güvenlik | RLS, session revocation, ledger kilidi, ownership, privilege testleri var. Üretim abuse/red-team ve pentest tamamlanmadı. |
| Official Launch | Hazır değil. Gerçek içerikler, üretim hizmet bağlantıları, ödeme/reklam lifecycle ve cihaz testleri zorunlu. |

İleri geliştirmede tüm yeni tablolar aynı `drabornseries` şemasında `dbs_` adıyla oluşturulmalıdır; mevcut DraBornStyle dbs_ tabloları kullanılmamalıdır.

V0.6: 18 lisanslı gerçek film / 28 oynatılabilir bölüm canlı veritabanında doğrulandı. Önceki vektör testleri arşivdedir. Profil fotoğrafı cihazdan seçilir ve ortak Supabase hesabıyla senkronlanır. Stüdyo silme, bölüm içeren yayınlanmış dizilerde owner rolü ve adla onay ile çalışır. Ticari Cloudflare/ödeme/reklam bağlantıları henüz üretim değildir.

V0.6 Google Play hazırlığı: ortak gizlilik/koşullar/hesap silme ekranları ve JavaScript gerektirmeyen web HTML sayfaları; gerçek Data safety envanteri; API 36 ve minimal native izinler; AAB üretim profili. Play Console gönderimi, imzalı AAB ve fiziksel cihaz kontrolü henüz yapılmadı. Bkz. [GOOGLE_PLAY.md](GOOGLE_PLAY.md).
