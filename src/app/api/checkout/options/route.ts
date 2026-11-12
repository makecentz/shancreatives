import { getPickupLocations, getShippingRates, getTaxSettings } from "@/lib/data/settings";
import { isDemoMode, isSquareConfigured, isStripeConfigured } from "@/lib/env";

export async function GET() {
  const [rates, pickup, tax] = await Promise.all([getShippingRates(), getPickupLocations(), getTaxSettings()]);
  return Response.json({
    demo: isDemoMode(),
    rates,
    pickup,
    tax,
    providers: { stripe: isStripeConfigured(), square: isSquareConfigured() },
  });
}
