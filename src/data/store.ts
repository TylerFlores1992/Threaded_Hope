/**
 * Store-wide branding & content.
 * ── EDIT HERE ── to change store name, tagline, Scripture line, contact info,
 * and social links. Nothing else needs to change to re-brand the site.
 */
export const store = {
  name: "Threaded Hope",
  shortName: "Threaded Hope",
  tagline: "Stitching a little hope into every thread.",
  heroSubtitle:
    "Handmade pieces made with care, love, and a whole lot of hope — from bags and pouches to keychains and gifts, each one has its own story.",
  newsletterPitch:
    "Join our Threaded Hope community — be the first to hear about our newest products & offers.",

  // The verse the brand is named for.
  scripture: {
    text: "“Be joyful in hope, patient in affliction, persistent in prayer.”",
    reference: "Romans 12:12",
  },

  contact: {
    email: "hello@threadedhope.shop",
    phone: "",
    location: "Handmade in the USA",
  },

  socials: {
    instagram: "https://instagram.com/threaded_hope_",
    instagramHandle: "threaded_hope_",
    facebook: "",
    pinterest: "",
  },

  shipping: {
    freeThreshold: 50, // free shipping over this US$ amount
    flatRate: 5.5,
  },
};

export type Store = typeof store;
