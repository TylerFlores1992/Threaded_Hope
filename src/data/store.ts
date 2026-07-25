/**
 * Store-wide branding & content.
 * ── EDIT HERE ── to change store name, tagline, Scripture line, contact info,
 * and social links. Nothing else needs to change to re-brand the site.
 */
export const store = {
  name: "Threaded Hope",
  shortName: "Threaded Hope",
  tagline: "Handcrafted with love, stitched with hope.",
  heroSubtitle:
    "Small-batch fabric accessories made by hand — everyday goods with a little extra warmth woven in.",
  newsletterPitch:
    "Join our Threaded Hope community — be the first to hear about new products & offers.",

  // A tasteful Scripture line for the footer. Swap for any verse you love.
  scripture: {
    text: "“She is clothed with strength and dignity, and she laughs without fear of the future.”",
    reference: "Proverbs 31:25",
  },

  contact: {
    email: "hello@threadedhope.shop",
    phone: "(555) 019-2834",
    location: "Handmade in the USA",
  },

  socials: {
    instagram: "https://instagram.com/threadedhope",
    facebook: "https://facebook.com/threadedhope",
    pinterest: "https://pinterest.com/threadedhope",
  },

  shipping: {
    freeThreshold: 50, // free shipping over this US$ amount
    flatRate: 5.5,
  },
};

export type Store = typeof store;
