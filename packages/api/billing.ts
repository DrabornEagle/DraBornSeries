import type { Billing, PurchaseNotice } from "./billing-types";
import { useEffect, useRef, useState } from "react";
import { usePlayCatalog } from "./play-catalog";
export function useBilling(_user: string | undefined, _onVerified: () => Promise<void>): Billing {
  const { catalog, refresh } = usePlayCatalog();
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState<PurchaseNotice | null>(null);
  const flight = useRef<Promise<void> | null>(null), account = useRef(_user); account.current = _user;
  useEffect(() => { setNotice(null); setBusy(false); }, [_user]);
  const restore = () => {
    if (flight.current) return flight.current;
    const user = account.current;
    if (!user) return Promise.resolve();
    setBusy(true); setNotice({ id: "web:restore:start:" + Date.now(), kind: "restore", status: "pending", productId: "", message: "VIP üyeliğin ve BornCoins cüzdanın yenileniyor…" });
    const task = Promise.resolve().then(_onVerified)
      .then(() => { if (account.current === user) setNotice({ id: "web:restore:" + Date.now(), kind: "restore", status: "info", productId: "", message: "Cüzdanın ve VIP üyeliğin güncellendi. Google Play makbuzlarını geri yüklemek için Android uygulamasını kullanabilirsin." }); })
      .catch(() => { if (account.current === user) setNotice({ id: "web:restore:error:" + Date.now(), kind: "restore", status: "error", productId: "", message: "Hesap bilgilerin yenilenemedi. Bağlantını kontrol edip tekrar dene." }); })
      .finally(() => { if (account.current === user) setBusy(false); if (flight.current === task) flight.current = null; });
    flight.current = task; return task;
  };
  return { ready: false, busy, restoring: busy, message: "Satın alımını Google Play Android uygulamasında tamamlayabilirsin. VIP üyeliğin ve BornCoins bakiyen aynı hesapla webde de geçerlidir.", prices: catalog?.prices || {}, available: catalog?.available || [], notice, clearNotice: () => setNotice(null), buy: async () => {}, restore, refresh };
}
