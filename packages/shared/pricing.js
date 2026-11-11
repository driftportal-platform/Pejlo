export const subscriptionRates = {
  monthly: {first: 4900, extra: 2900, months: 1},
  annual: {first: 44900, extra: 26900, months: 12},
  biennial: {first: 79900, extra: 47900, months: 24}
};

export function standardSubscriptionPrice(cycle, quantity) {
  const rate = Object.hasOwn(subscriptionRates, cycle) ? subscriptionRates[cycle] : null;
  return rate && Number.isInteger(quantity) && quantity >= 1 && quantity <= 1000
    ? rate.first + (quantity - 1) * rate.extra : null;
}

export function subscriptionSavings(cycle, quantity) {
  const total = standardSubscriptionPrice(cycle, quantity);
  return total === null ? null
    : standardSubscriptionPrice('monthly', quantity) * subscriptionRates[cycle].months - total;
}
