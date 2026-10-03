import type { Billing } from "./billing-types";
import { usePlayCatalog } from "./play-catalog";
export function useBilling(_user: string | undefined, _onVerified: () => Promise<void>): Billing {
  const { catalog, refresh } = usePlayCatalog();
  return { ready: false, busy: false, message: "Satın alımını Google Play Android uygulamasında tamamlayabilirsin. VIP üyeliğin ve BornCoins bakiyen aynı hesapla webde de geçerlidir.", prices: catalog?.prices || {}, available: catalog?.available || [], notice: null, clearNotice: () => {}, buy: async () => {}, restore: _onVerified, refresh };
}
