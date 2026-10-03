export function validateCoinReceipt(receipt: any, product: string, accountHash: string) {
  if (receipt.productId && receipt.productId !== product) throw Error("PURCHASE_PRODUCT_MISMATCH");
  if (receipt.obfuscatedExternalAccountId !== accountHash) throw Error("PURCHASE_ACCOUNT_MISMATCH");
  if (receipt.purchaseState === 2) return "pending";
  if (receipt.purchaseState !== 0) throw Error("PURCHASE_CANCELLED");
  if ((receipt.quantity ?? 1) !== 1) throw Error("UNSUPPORTED_QUANTITY");
  return "purchased";
}
