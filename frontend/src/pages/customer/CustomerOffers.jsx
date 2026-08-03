import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BadgePercent,
  CalendarDays,
  Check,
  Copy,
  Gift,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";

import { api, formatApiError } from "../../lib/api";

function formatDate(value) {
  if (!value) return "No expiry";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function offerLabel(offer) {
  if (offer.offer_type === "percentage") {
    return `${Number(offer.discount_value || 0)}% OFF`;
  }

  if (offer.offer_type === "flat") {
    return `₹${Number(offer.discount_value || 0).toLocaleString("en-IN")} OFF`;
  }

  return "FREE DELIVERY";
}

function offerIcon(offer) {
  if (offer.offer_type === "free_delivery") return Truck;
  if (offer.offer_type === "percentage") return BadgePercent;
  return Gift;
}

export default function CustomerOffers() {
  const navigate = useNavigate();

  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    api
      .get("/offers/available")
      .then((response) => {
        if (!active) return;

        setOffers(
          Array.isArray(response.data?.offers)
            ? response.data.offers
            : []
        );
      })
      .catch((requestError) => {
        if (!active) return;

        setError(
          formatApiError(
            requestError,
            "Unable to load available offers."
          )
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const copyCode = async (code) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      window.setTimeout(() => setCopiedCode(""), 1800);
    } catch {
      setCopiedCode("");
    }
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      <section className="overflow-hidden rounded-[30px] bg-gradient-to-r from-[#062B5F] to-[#0F4C9C] p-6 text-white shadow-xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-200">
              Save More
            </p>

            <h1 className="mt-2 text-3xl font-black sm:text-4xl">
              Offers & Coupons
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-blue-100">
              Explore active ZANSZI offers and use the best coupon during checkout.
            </p>
          </div>

          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/15 backdrop-blur">
            <Sparkles size={23} />
          </span>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="h-60 animate-pulse rounded-[26px] bg-slate-200"
            />
          ))}
        </section>
      ) : offers.length ? (
        <section className="grid gap-4 sm:grid-cols-2">
          {offers.map((offer) => {
            const Icon = offerIcon(offer);

            return (
              <article
                key={offer.offer_id}
                className={`relative overflow-hidden rounded-[26px] border bg-white p-5 shadow-sm ${
                  offer.featured
                    ? "border-amber-200 ring-2 ring-amber-50"
                    : "border-slate-200"
                }`}
              >
                {offer.featured && (
                  <span className="absolute right-0 top-0 rounded-bl-2xl bg-[#F4B400] px-3 py-1.5 text-[10px] font-black text-[#062B5F]">
                    BEST OFFER
                  </span>
                )}

                <div className="flex items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-[#0F4C9C]">
                    <Icon size={23} />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-[#0F4C9C]">
                      {offerLabel(offer)}
                    </p>

                    <h2 className="mt-1 text-lg font-black text-slate-900">
                      {offer.title}
                    </h2>

                    {offer.description && (
                      <p className="mt-2 text-sm leading-6 text-slate-500">
                        {offer.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Coupon code
                      </p>
                      <p className="mt-1 text-lg font-black tracking-widest text-[#062B5F]">
                        {offer.code}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => copyCode(offer.code)}
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-black text-[#0F4C9C] shadow-sm"
                    >
                      {copiedCode === offer.code ? (
                        <>
                          <Check size={15} />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy size={15} />
                          Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 text-xs text-slate-500">
                  <p className="flex items-center gap-2">
                    <ShoppingBag size={15} className="text-[#0F4C9C]" />
                    Minimum order ₹
                    {Number(
                      offer.minimum_order_value || 0
                    ).toLocaleString("en-IN")}
                  </p>

                  <p className="flex items-center gap-2">
                    <CalendarDays size={15} className="text-[#0F4C9C]" />
                    Expires {formatDate(offer.expires_at)}
                  </p>

                  {offer.first_order_only && (
                    <p className="flex items-center gap-2 font-bold text-emerald-600">
                      <Tag size={15} />
                      First order only
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    navigate("/checkout", {
                      state: { couponCode: offer.code },
                    })
                  }
                  className="mt-5 w-full rounded-2xl bg-[#0F4C9C] px-4 py-3 font-black text-white"
                >
                  Use This Offer
                </button>
              </article>
            );
          })}
        </section>
      ) : (
        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-blue-50 text-[#0F4C9C]">
            <Gift size={30} />
          </span>

          <h2 className="mt-4 text-xl font-black text-slate-900">
            No offers available
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
            New discounts and coupon codes will appear here when they are active.
          </p>
        </section>
      )}
    </div>
  );
}
