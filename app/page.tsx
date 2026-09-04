import Link from "next/link";
import PurchasePanel from "./components/purchase-panel";

const features = [
  {
    title: "Immersive sound",
    body: "Tuned drivers deliver rich bass and clear vocals for long listening sessions.",
  },
  {
    title: "All-day comfort",
    body: "Cushioned ear cups and a light frame stay comfortable from commute to late night.",
  },
  {
    title: "Premium wireless",
    body: "Stable Bluetooth pairing with lasting battery for travel, work, and downtime.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold tracking-[0.18em] uppercase">
              Auralis
            </p>
            <p className="hidden text-xs text-muted sm:block">
              Protected by Checkout Guardian
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-xs tracking-wide text-muted uppercase hover:text-foreground"
          >
            Merchant dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-2 lg:gap-16 lg:py-16">
        <section
          aria-label="Premium Headphones product visual"
          className="flex min-h-[22rem] items-center justify-center rounded-[2rem] border border-line bg-surface px-6 py-10"
        >
          <div className="headphones" aria-hidden="true">
            <div className="headphones-glow" />
            <div className="headphones-band" />
            <div className="headphones-cup headphones-cup-left">
              <div className="headphones-pad" />
            </div>
            <div className="headphones-cup headphones-cup-right">
              <div className="headphones-pad" />
            </div>
          </div>
        </section>

        <section>
          <p className="text-xs font-medium tracking-[0.2em] text-muted uppercase">
            Wireless Headphones
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
            Premium Headphones
          </h1>
          <p className="mt-4 text-3xl font-semibold tracking-tight">₹3,499</p>
          <p className="mt-5 max-w-md text-base leading-7 text-muted">
            Immersive sound, all-day comfort, and premium wireless listening —
            built for everyday music, calls, and travel.
          </p>

          <ul className="mt-8 space-y-4">
            {features.map((feature) => (
              <li key={feature.title} className="border-t border-line pt-4">
                <p className="font-medium">{feature.title}</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  {feature.body}
                </p>
              </li>
            ))}
          </ul>

          <PurchasePanel />
          <p className="mt-4 max-w-md text-sm leading-6 text-muted">
            Payment failed. Checkout didn’t. If a payment fails, Checkout
            Guardian verifies Razorpay truth before any retry and will not
            reopen checkout while a previous payment is still unresolved.
          </p>
        </section>
      </main>
    </div>
  );
}
