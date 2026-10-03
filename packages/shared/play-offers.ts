import { isCoinProduct, playPlans } from "../api/billing-types";
type Offer = { id?: string | null; basePlanIdAndroid?: string | null; offerTokenAndroid?: string | null; displayPrice?: string | null; pricingPhasesAndroid?: { pricingPhaseList: { formattedPrice: string; priceAmountMicros?: string; billingPeriod?: string }[] } | null; rentalDetailsAndroid?: unknown; preorderDetailsAndroid?: unknown; purchaseOptionIdAndroid?: string | null; type?: string | null; percentageDiscountAndroid?: number | null; discountAmountMicrosAndroid?: string | null; };
export type PlayProduct = { id: string; displayPrice: string; type: string; productStatusAndroid?: string | null; subscriptionOffers?: Offer[] | null; discountOffers?: Offer[] | null; };
/** Pick the configured, regular base plan; never substitute a trial or another period. */
export function regularPlayOffer(product: PlayProduct) {
  const plan = playPlans[product.id as keyof typeof playPlans];
  // OpenIAP 3.6 uses the base-plan ID as `id` when Google has no offerId.
  // An absent ID and that normalized ID both represent the regular plan.
  if (plan) return product.subscriptionOffers?.find(offer => offer.basePlanIdAndroid === plan
    && (!offer.id || offer.id === plan) && offer.offerTokenAndroid
    && (!offer.pricingPhasesAndroid || offer.pricingPhasesAndroid.pricingPhaseList.length === 1));
  if (isCoinProduct(product.id)) {
    const eligible = product.discountOffers?.filter(offer => !offer.rentalDetailsAndroid && !offer.preorderDetailsAndroid && offer.offerTokenAndroid);
    const regular = eligible?.filter(offer => (!offer.id || offer.id === offer.purchaseOptionIdAndroid)
      && !offer.rentalDetailsAndroid && !offer.preorderDetailsAndroid && offer.offerTokenAndroid
      && !offer.percentageDiscountAndroid && !Number(offer.discountAmountMicrosAndroid || 0));
    return regular?.find(offer => offer.purchaseOptionIdAndroid === "buy") || regular?.[0]
      || eligible?.find(offer => offer.purchaseOptionIdAndroid === "buy") || eligible?.[0];
  }
}
export function playProductPrice(product: PlayProduct) {
  if (product.productStatusAndroid && product.productStatusAndroid !== "ok") return "";
  const offer = regularPlayOffer(product);
  if (Object.hasOwn(playPlans, product.id)) return offer?.pricingPhasesAndroid?.pricingPhaseList.at(-1)?.formattedPrice || offer?.displayPrice || "";
  if (isCoinProduct(product.id) && product.type === "in-app") return offer?.displayPrice || (product.discountOffers?.length ? "" : product.displayPrice);
  return "";
}
