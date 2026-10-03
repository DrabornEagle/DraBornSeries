export function verificationMessage(code: string) {
  const messages: Record<string, string> = {
    PLAY_VERIFICATION_PERMISSION: "Google Play doğrulama bağlantısı henüz hazır değil. Satın alımın kayıtlı; yeniden ödeme yapmadan tekrar doğrulayabilirsin.",
    BILLING_NOT_CONFIGURED: "Google Play hesap bağlantısı hazır olduğunda satın alımın doğrulanabilecek. Yeniden ödeme yapmana gerek yok.",
    PURCHASE_ACCOUNT_MISMATCH: "Bu satın alımın yapıldığı DraBornSeries hesabıyla giriş yap.",
    UNSUPPORTED_QUANTITY: "Bu paket tek adet olarak yüklenebilir. Google Play siparişindeki adedi kontrol et.",
    PURCHASE_CANCELLED: "Google Play bu ödemenin iptal edildiğini veya iade edildiğini bildirdi.",
    PURCHASE_ALREADY_CONSUMED: "Bu ödeme daha önce tamamlanmış. Cüzdanını ve işlem geçmişini kontrol et.",
    AUTH_REQUIRED: "Satın alımını doğrulamak için hesabına yeniden giriş yap.",
  };
  return messages[code] || "Satın alımın henüz doğrulanamadı. Yeniden ödeme yapmadan tekrar doğrulayabilirsin.";
}
