import type { Billing } from "./billing-types";
export function useBilling(_user: string | undefined, _onVerified: () => Promise<void>): Billing {
  return { ready: false, busy: false, message: "VIP satın alımını Google Play Android uygulamasında tamamlayabilirsin. Üyeliğin aynı hesapla webde de geçerli olur.", prices: {}, buy: async () => {}, restore: _onVerified };
}
