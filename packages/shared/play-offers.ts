import { isCoinProduct, playPlans } from "../api/billing-types";
type Offer = { id?: string | null; basePlanIdAndroid?: string | null; offerTokenAndroid?: string | null; displayPrice?: string | null; pricingPhasesAndroid?: { pricingPhaseList: { formattedPrice: string }[] } | null; rentalDetailsAndroid?: unknown; purchaseOptionIdAndroid?: string | null; type?: string | null; };
export type PlayProduct = { id: string; displayPrice: string; type: string; subscriptionOffers?: Offer[] | null; discountOffers?: Offer[] | null; };
/** Pick the configured, regular base plan; never substitute a trial or another period. */
export function regularPlayOffer(product: PlayProduct) {
  const plan = playPlans[product.id as keyof typeof playPlans];
  if (plan) return product.subscriptionOffers?.find(offer => offer.basePlanIdAndroid === plan && !offer.id && offer.offerTokenAndroid);
  if (isCoinProduct(product.id)) return product.discountOffers?.find(offer => offer.purchaseOptionIdAndroid === "buy" && !offer.id && !offer.rentalDetailsAndroid && offer.offerTokenAndroid)
    || product.discountOffers?.find(offer => !offer.purchaseOptionIdAndroid && !offer.id && !offer.rentalDetailsAndroid && offer.offerTokenAndroid);
}
export function playProductPrice(product: PlayProduct) {
  const offer = regularPlayOffer(product);
  if (Object.hasOwn(playPlans, product.id)) return offer?.pricingPhasesAndroid?.pricingPhaseList.at(-1)?.formattedPrice || offer?.displayPrice || "";
  if (isCoinProduct(product.id) && product.type === "in-app") return offer?.displayPrice || (product.discountOffers?.length ? "" : product.displayPrice);
  return "";
}
