import type { Metadata } from "next";
import Link from "next/link";
import { faqs } from "@/data/faqs";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = {
  title: "FAQs",
  description: "Answers to common questions about Threaded Hope.",
};

export default function FaqsPage() {
  return (
    <div>
      <PageIntro
        title="Frequently Asked Questions"
        subtitle="Everything you need to know about our handmade goods, shipping, and care."
      />
      <div className="mx-auto max-w-3xl px-4 py-12">
        <div className="space-y-3">
          {faqs.map((item) => (
            <details
              key={item.q}
              className="group rounded-2xl bg-white/70 p-5 ring-1 ring-border"
            >
              <summary className="flex cursor-pointer items-center justify-between font-medium text-ink marker:content-none">
                {item.q}
                <span className="ml-4 text-sage-deep transition group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="mt-3 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>

        <p className="mt-10 text-center text-ink-soft">
          Still have a question?{" "}
          <Link href="/contact" className="font-medium text-sage-deep hover:underline">
            Get in touch
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
