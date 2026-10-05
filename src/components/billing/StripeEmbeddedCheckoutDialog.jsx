import { useMemo } from "react";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/**
 * In-app Stripe Checkout (embedded iframe). Remount when `sessionKey` changes.
 */
export default function StripeEmbeddedCheckoutDialog({
  open,
  onOpenChange,
  publishableKey,
  clientSecret,
  sessionKey,
  title = "Complete checkout",
  description = "Secure payment powered by Stripe.",
  onComplete,
}) {
  const stripePromise = useMemo(() => {
    if (!publishableKey) return null;
    return loadStripe(publishableKey);
  }, [publishableKey]);

  const canRender = open && clientSecret && stripePromise;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-2xl flex-col gap-3 overflow-hidden p-4 sm:p-6">
        <DialogHeader className="shrink-0 text-left">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="min-h-[480px] flex-1 overflow-y-auto rounded-xl border border-border/50 bg-muted/20 p-1">
          {canRender ? (
            <EmbeddedCheckoutProvider
              key={sessionKey}
              stripe={stripePromise}
              options={{
                clientSecret,
                onComplete: () => {
                  onComplete?.();
                },
              }}
            >
              <EmbeddedCheckout className="w-full" />
            </EmbeddedCheckoutProvider>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">Loading checkout…</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
