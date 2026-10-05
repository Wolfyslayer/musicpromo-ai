export const BILLING_REFRESH_EVENT = "musicpromo:billing-refresh";
export const BILLING_OPEN_PLANS_EVENT = "musicpromo:open-billing-plans";

export function dispatchBillingRefresh() {
  window.dispatchEvent(new CustomEvent(BILLING_REFRESH_EVENT));
}

export function dispatchOpenBillingPlans() {
  window.dispatchEvent(new CustomEvent(BILLING_OPEN_PLANS_EVENT));
}
