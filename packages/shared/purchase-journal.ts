import { isPlayProduct } from "../api/billing-types";
export type RecoverablePurchase = { productId: string; purchaseToken: string; purchaseState?: string };
type Storage = { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<unknown> };
/** Unfinished receipts stay in private app storage, isolated by signed-in account. */
export class PurchaseJournal {
  private writes = Promise.resolve();
  constructor(private storage: Storage) {}
  async list(account: string): Promise<RecoverablePurchase[]> {
    await this.writes;
    return this.read(account);
  }
  remember(account: string, purchase: RecoverablePurchase) {
    return this.change(account, rows => [...rows.filter(row => row.purchaseToken !== purchase.purchaseToken), purchase]);
  }
  forget(account: string, token: string) {
    return this.change(account, rows => rows.filter(row => row.purchaseToken !== token));
  }
  private async read(account: string): Promise<RecoverablePurchase[]> {
    try {
      const parsed = JSON.parse(await this.storage.getItem("dbs-play-unfinished:" + account) || "[]");
      return Array.isArray(parsed) ? parsed.filter(row => row && isPlayProduct(row.productId)
        && typeof row.purchaseToken === "string" && row.purchaseToken.length > 0 && row.purchaseToken.length <= 4096) : [];
    } catch { return []; }
  }
  private change(account: string, update: (rows: RecoverablePurchase[]) => RecoverablePurchase[]) {
    const task = this.writes.then(async () => {
      const rows = update(await this.read(account));
      await this.storage.setItem("dbs-play-unfinished:" + account, JSON.stringify(rows));
    });
    this.writes = task.catch(() => {});
    return task;
  }
}
