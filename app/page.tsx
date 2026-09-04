import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import PurchasePanel from "./components/purchase-panel";

function IconWell({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${className}`}
    >
      {children}
    </span>
  );
}

function WaveIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="M3 12h2l1.5-5 2 10L11 8l2 8 1.5-6H21"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ComfortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M5.5 19c.8-3.2 3.3-5 6.5-5s5.7 1.8 6.5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SignalIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="M5 16a9 9 0 0 1 14 0M8 18.2a5.5 5.5 0 0 1 8 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <circle cx="12" cy="20" r="1.2" fill="currentColor" />
    </svg>
  );
}

function MusicIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="M9 18V6l11-2v12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="18" r="2.4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="18" cy="16" r="2.4" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function HeadsetIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="M5 13a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="3.5" y="12.5" width="3.6" height="6.2" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <rect x="16.9" y="12.5" width="3.6" height="6.2" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M13.2 2 4 13.2h6.2L8.8 22 20 9.6h-6.4L13.2 2Z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="none">
      <path
        d="M12 19.5s-7-4.3-7-9.1A3.9 3.9 0 0 1 12 7.2 3.9 3.9 0 0 1 19 10.4c0 4.8-7 9.1-7 9.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M7 5h3.2v14H7V5Zm6.8 0H17v14h-3.2V5Z" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M8.2 10V7.8a3.8 3.8 0 1 1 7.6 0V10H18a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 18 20H6a1.5 1.5 0 0 1-1.5-1.5v-7A1.5 1.5 0 0 1 6 10h2.2Zm1.7 0h4.2V7.8a2.1 2.1 0 0 0-4.2 0V10Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true" fill="currentColor">
      <path d="M12 2.5a9.5 9.5 0 1 0 0 19 9.5 9.5 0 0 0 0-19Zm4.3 6.7-5.3 6.5-2.7-2.7 1.4-1.4 1.2 1.2 3.9-4.8 1.5 1.2Z" />
    </svg>
  );
}

function HeadphoneMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <path
        d="M5 13a7 7 0 0 1 14 0"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <rect x="3.4" y="12.2" width="4" height="7.4" rx="2" fill="currentColor" />
      <rect x="16.6" y="12.2" width="4" height="7.4" rx="2" fill="currentColor" />
    </svg>
  );
}

function ProductRender() {
  return (
    <div className="relative mx-auto flex h-[min(56vh,520px)] w-[min(100%,36rem)] items-center justify-center lg:-mx-10 xl:-mx-16">
      <div
        className="absolute left-[4%] top-[6%] h-[82%] w-[82%] rounded-full bg-[#cfd8f6]"
        aria-hidden="true"
      />
      <div
        className="absolute right-[-2%] top-[14%] h-[76%] w-[76%] rounded-full bg-[#d9e0f8]"
        aria-hidden="true"
      />
      <div
        className="absolute left-[18%] top-[22%] h-[68%] w-[68%] rounded-full bg-[#e8edfb]"
        aria-hidden="true"
      />
      <div
        className="absolute bottom-[6%] left-[10%] h-[54%] w-[54%] rounded-full bg-[#b7c4f0]/70"
        aria-hidden="true"
      />
      <div
        className="absolute right-[12%] top-[8%] h-[42%] w-[42%] rounded-full bg-[#eef2ff]/90"
        aria-hidden="true"
      />
      <Image
        src="/auralis-headphones.png"
        alt="Auralis Premium Headphones"
        width={980}
        height={980}
        priority
        className="relative z-10 h-[96%] w-auto max-w-none object-contain drop-shadow-[0_18px_28px_rgba(79,99,180,0.22)] [mask-image:radial-gradient(ellipse_72%_76%_at_50%_48%,#000_56%,transparent_78%)]"
      />
    </div>
  );
}

const heroBenefits = [
  {
    title: "Immersive sound",
    body: "Feel every detail",
    well: "bg-[#e8edff] text-[#3d5bd6]",
    icon: <WaveIcon />,
  },
  {
    title: "Everyday comfort",
    body: "Designed around your day",
    well: "bg-[#e8f7ee] text-[#1f8a4c]",
    icon: <ComfortIcon />,
  },
  {
    title: "Wireless freedom",
    body: "Simple. Clean. Untethered.",
    well: "bg-[#eee8ff] text-[#6d4fd6]",
    icon: <SignalIcon />,
  },
];

const experienceCards = [
  {
    title: "Rich listening experience",
    body: "Made for music, work and everyday listening.",
    well: "bg-[#e8edff] text-[#3d5bd6]",
    icon: <MusicIcon />,
  },
  {
    title: "Designed for comfort",
    body: "An experience built around everyday use.",
    well: "bg-[#e8f7ee] text-[#1f8a4c]",
    icon: <HeadsetIcon />,
  },
  {
    title: "Simple & wireless",
    body: "Less friction. More listening.",
    well: "bg-[#fff3e0] text-[#d97706]",
    icon: <BoltIcon />,
  },
  {
    title: "Made for everyday",
    body: "A premium companion for daily moments.",
    well: "bg-[#ffe8ef] text-[#e11d48]",
    icon: <HeartIcon />,
  },
];

export default function Home() {
  return (
    <div className="min-h-full bg-[#f4f6fb] text-slate-900">
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/95">
        <div className="mx-auto flex h-14 w-full max-w-[1220px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href="#product" className="flex items-center gap-2 text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0f172a] text-white">
              <HeadphoneMark className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Auralis</span>
          </a>
          <nav
            aria-label="Auralis"
            className="hidden items-center gap-6 text-sm text-slate-600 md:flex"
          >
            <a
              href="#product"
              className="outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Product
            </a>
            <a
              href="#experience"
              className="outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Experience
            </a>
            <a
              href="#protection"
              className="outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Protection
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="text-sm text-slate-500 outline-none hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Merchant Dashboard
            </Link>
            <a
              href="#checkout"
              className="rounded-full bg-[#0f172a] px-3.5 py-1.5 text-sm font-medium text-white outline-none hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Checkout
            </a>
          </div>
        </div>
      </header>

      <main>
        <section
          id="product"
          className="mx-auto grid w-full max-w-[1220px] items-center gap-3 px-4 py-3 sm:px-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(320px,1.28fr)_minmax(320px,0.86fr)] lg:gap-2 lg:py-3 xl:grid-cols-[minmax(0,0.8fr)_minmax(360px,1.32fr)_minmax(340px,0.84fr)]"
        >
          <div className="relative z-10 min-w-0 lg:pr-2">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#4f6ef7]">
              PREMIUM WIRELESS AUDIO
            </p>
            <h1 className="mt-2 text-[2rem] font-semibold tracking-tight text-slate-900 sm:text-[2.35rem] lg:text-[2.55rem] lg:leading-[1.05]">
              Sound that
              <br />
              moves <span className="text-[#4f6ef7]">you.</span>
            </h1>
            <p className="mt-3 max-w-[20rem] text-[13px] leading-6 text-slate-500">
              Immerse yourself in rich, detailed sound with Auralis. Designed
              for everyday listening, these wireless headphones keep the
              experience simple.
            </p>
            <ul className="mt-4 space-y-3">
              {heroBenefits.map((benefit) => (
                <li key={benefit.title} className="flex items-center gap-3">
                  <IconWell className={benefit.well}>{benefit.icon}</IconWell>
                  <span>
                    <span className="block text-[13px] font-semibold text-slate-900">
                      {benefit.title}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {benefit.body}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative z-0 flex items-center justify-center lg:scale-[1.08]">
            <ProductRender />
          </div>

          <div className="relative z-10">
            <PurchasePanel />
          </div>
        </section>

        <section
          id="experience"
          className="mx-auto w-full max-w-[1220px] px-4 pb-6 sm:px-6"
        >
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {experienceCards.map((card) => (
              <article
                key={card.title}
                className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_4px_14px_rgba(15,23,42,0.04)]"
              >
                <IconWell className={card.well}>{card.icon}</IconWell>
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">
                    {card.title}
                  </h2>
                  <p className="mt-0.5 text-xs leading-5 text-slate-500">
                    {card.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden bg-[#0b1220] text-slate-200">
          <div
            className="pointer-events-none absolute -right-16 top-1/2 h-48 w-48 -translate-y-1/2 rounded-full bg-[#3b4ea0]/35"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-2 top-[18%] h-28 w-28 rounded-full bg-[#5b4db8]/30"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid w-full max-w-[1220px] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-center">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#8ea2ff]">
                A SAFER CHECKOUT
              </p>
              <h2 className="mt-2 text-[1.65rem] font-semibold tracking-tight text-white lg:leading-[1.15]">
                A safer path
                <br />
                through payment uncertainty.
              </h2>
            </div>
            <ul className="grid gap-4 sm:grid-cols-3">
              <li className="flex gap-3">
                <IconWell className="bg-[#2a3a78] text-[#9db0ff]">
                  <CheckIcon />
                </IconWell>
                <span>
                  <span className="block text-sm font-medium text-white">
                    Verified payment state
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                    Razorpay establishes payment truth.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <IconWell className="bg-[#3a2f72] text-[#c4b5fd]">
                  <PauseIcon />
                </IconWell>
                <span>
                  <span className="block text-sm font-medium text-white">
                    Uncertainty is held
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                    Unresolved payments are not treated as failures.
                  </span>
                </span>
              </li>
              <li className="flex gap-3">
                <IconWell className="bg-[#2a3a78] text-[#9db0ff]">
                  <LockIcon />
                </IconWell>
                <span>
                  <span className="block text-sm font-medium text-white">
                    Merchant-controlled recovery
                  </span>
                  <span className="mt-0.5 block text-xs leading-5 text-slate-400">
                    Policy authorizes before recovery begins.
                  </span>
                </span>
              </li>
            </ul>
          </div>
        </section>
      </main>
    </div>
  );
}
