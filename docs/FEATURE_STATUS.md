# Kapsam ve gerçek durum — 2026-09-29

Bu dosya, 49 maddelik ürün hedefi ile şu anda teslim edilen sürümü ayırır. Hiçbir test/demonstrasyon gerçek ticari yayın olarak kabul edilmez.

| Alan | Durum |
|---|---|
| Android + Web ortak arayüz/backend | Uygulandı; web tarayıcı ve Android export ile kontrol edilir. Fiziksel Expo Go testi burada yapılmadı. |
| Marka, ikon, splash, neon tasarım | Uygulandı. Görsellerin metinlerini UI oluşturur. |
| E-posta kayıt/giriş, profil, oturumlar | Uygulandı. Ortak Auth ayarları korunur. |
| Google giriş | İstemci akışı mevcut; Supabase Google sağlayıcısı kapalı. |
| Şifre sıfırlama | İstemci akışı mevcut; SMTP/redirect e-posta teslimi canlı olarak doğrulanmadı. |
| Profil fotoğrafı | HTTPS URL ile; R2 dosya yükleme arayüzü bekliyor. |
| Katalog, türler, detaylar, erişim etiketleri | Uygulandı; 6 özgün gelecek konsepti, 2 açık lisanslı test koleksiyonu. |
| Featured, devam, öneri, arama, favoriler | Uygulandı. Öneriler favori türlerine dayalı temel sıralama; gelişmiş davranış modeli yok. |
| Ana sayfadaki 16 ayrı editoryal koleksiyon | Temel raylar var; tüm koleksiyonların ayrı veri/istatistik akışları tamamlanmadı. |
| Video, seek, ses, fullscreen, resume | Uygulandı. Kalite seçenekleri kaynağa göre; tek MP4'e sahte 360/480/720/1080 listesi gösterilmez. |
| Altyazı ve çoklu ses | Player kaynak tracklerini okuyabilir. Özel R2 altyazı/ses yükleme, SRT dönüştürme ve URL imzalama bekliyor. |
| BornCoins cüzdan/defter/coin ile unlock | Gerçek Supabase işlemleri; server-only, idempotent, atomik. |
| Günlük ödül, streak, promosyon | Aktif; Türkiye saatine göre. |
| Görev/başarım sistemi | Tanım tabloları ve temel profil göstergeleri var; doğrulanmış izleme görevleri/XP/davet/ödül claim motoru tamamlanmadı. |
| VIP erişim kontrolü | Server-side aktif subscription kontrolü var; gerçek VIP satışı açılmadı. |
| Google Play Billing | Server verifier kaynak/deploy hazır fakat kapalı. Native Billing, Play ürünleri ve RTDN/refund/chargeback lifecycle bekliyor. |
| Rewarded Ads | Şema/erişim türü var. Native SDK, ECDSA SSV ve ödül claim akışı tamamlanmadı; coin veren sahte reklam yok. |
| Cloudflare | Yetki kontrollü Worker kaynağı var; hesap/secrets olmadığı için Worker, R2 ve Stream deploy edilmedi. |
| Yorum, spoiler, puan, şikayet | Uygulandı; yorumlar moderasyonda başlar, tekrar/sıklık sınırı var. Otomatik gelişmiş küfür sınıflandırıcı yok. |
| Bildirim | Uygulama içi bildirim, tercihler, scheduled yayın bildirimi var. Android push/token/teslim worker yok. |
| Admin | Yetkili kayıt listeleme/düzenleme, content/video/cüzdan/moderasyon; bazı işlemler JSON editörü kullanır. Tam medya ingest ve gelişmiş görsel CMS değil. |
| Analytics | Watch progress ve işlem kayıtları var. Gelir/retention/DAU/WAU/MAU dashboard ve event pipeline henüz tam değil. |
| Scheduled yayın | pg_cron dakikada bir hazır videolu scheduled bölümleri yayınlar. |
| TR/EN | Temel navigasyon/başlıklar ve model alanları var. Tüm alt ekran metinleri henüz eksiksiz çevrilmedi. |
| Deep links | Web query linkleri ve Android intent filter var; signed-release assetlinks doğrulaması bekliyor. |
| Offline | Progress kuyruğu ve katalog cache; offline video yok. |
| Güvenlik | RLS, session revocation, ledger kilidi, ownership, privilege testleri var. Üretim abuse/red-team ve pentest tamamlanmadı. |
| Official Launch | Hazır değil. Gerçek içerikler, üretim hizmet bağlantıları, ödeme/reklam lifecycle ve cihaz testleri zorunlu. |

İleri geliştirmede tüm yeni tablolar aynı `drabornseries` şemasında `dbs_` adıyla oluşturulmalıdır; mevcut DraBornStyle dbs_ tabloları kullanılmamalıdır.
