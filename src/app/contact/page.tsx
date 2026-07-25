import type { Metadata } from "next";
import { store } from "@/data/store";
import { PageIntro } from "@/components/PageIntro";
import { ContactForm } from "@/components/ContactForm";

export const metadata: Metadata = {
  title: "Contact",
  description: "Get in touch with the Threaded Hope team.",
};

export default function ContactPage() {
  return (
    <div>
      <PageIntro
        title="Contact Us"
        subtitle="We'd love to hear from you — questions, custom requests, or just to say hi."
      />
      <div className="mx-auto grid max-w-5xl gap-10 px-4 py-12 md:grid-cols-2">
        <div>
          <h2 className="font-serif text-2xl text-ink">Say hello</h2>
          <p className="mt-3 text-ink-soft">
            Fill out the form and we&apos;ll get back to you within 1–2 business days.
          </p>
          <dl className="mt-6 space-y-3 text-sm">
            <div>
              <dt className="font-semibold text-ink">Email</dt>
              <dd>
                <a
                  href={`mailto:${store.contact.email}`}
                  className="text-sage-deep hover:underline"
                >
                  {store.contact.email}
                </a>
              </dd>
            </div>
            {store.contact.phone ? (
              <div>
                <dt className="font-semibold text-ink">Phone</dt>
                <dd className="text-ink-soft">{store.contact.phone}</dd>
              </div>
            ) : null}
            <div>
              <dt className="font-semibold text-ink">Studio</dt>
              <dd className="text-ink-soft">{store.contact.location}</dd>
            </div>
          </dl>
        </div>
        <ContactForm />
      </div>
    </div>
  );
}
