# R2 için otomatik Türkçe altyazı

Stüdyo'da bir R2 bölümü kaydedildiğinde veritabanı iş kuyruğu oluşur. `R2 Turkish subtitles` iş akışı GitHub Actions üzerinde yaklaşık beş dakikada bir kontrol eder; GitHub yoğunluğu nedeniyle başlangıç gecikebilir. İlk model indirmesi sonraki işlemlerden uzun sürer. İş akışı boş kuyrukta model kurmaz. Konuşma olmayan klipte altyazı oluşturmaz. Hazır manuel Türkçe altyazıya dokunmaz.

Konuşma: SYSTRAN faster-whisper 1.2.1 ve Whisper small, CPU int8/VAD. Türkçe ses doğrudan çözümlenir. Diğer diller gerektiğinde Whisper ile İngilizceye, Helsinki-NLP/opus-mt-tc-big-en-tr ile Türkçeye çevrilir. Model lisansı CC BY 4.0: https://huggingface.co/Helsinki-NLP/opus-mt-tc-big-en-tr ; üretilen VTT içinde atıf bulunur. Whisper/faster-whisper MIT lisanslıdır. Modelle üretilmiş metnin doğruluğu yayıncı tarafından gözden geçirilebilir.

Ek ücretli ASR/çeviri API'si veya yeni API anahtarı gerekmez. Çalıştırma mevcut GitHub Actions kullanım kotalarına tabidir. Bir klip en fazla 2 saat / 3 GB olabilir; daha büyük kliplerde iş başarısız olarak görünür. Stüdyo bölüm kartında kuyruk/işleniyor/hazır/konuşma yok/başarısız durumu gösterilir. Başarısız işler otomatik en fazla üç kez denenir; Stüdyo'dan yeniden sıraya alınabilir.

Güvenlik: Sadece main dalındaki `.github/workflows/subtitles.yml` iş akışına ait GitHub RS256 OIDC tokenı (özel audience ve sayısal repo kimliği) iş alabilir. Service role anahtarı runner'a gönderilmez. Mevcut Worker, Edge'in servis kimliğini doğruladıktan sonra geçici video bağlantısı üretir. VTT `dbs-auto-subtitles` özel bucket'ında tutulur. Kullanıcı, bölümün oynatma hakkı kontrol edilmeden imzalı altyazı bağlantısı alamaz. Kaynak değişmişse eski iş altyazıyı bağlayamaz; bitmiş/eskimiş iş lease'i yeniden kullanılamaz. Video ve ses geçici runner klasöründedir; cache yalnız model dosyaları içerir.

Doğrulama: `tests/caption-automation.test.ts`, `tests/v071-promotions-security.sql`. Manuel tetikleme: repo Actions → R2 Turkish subtitles → Run workflow. GitHub zamanlanmış işleri pasif depolarda durdurursa aynı ekran üzerinden yeniden etkinleştirilmelidir.
