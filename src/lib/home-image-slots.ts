/**
 * Home page image slot metadata. Plain module (no server-only) so both the admin
 * client form and the server code can import it. The actual values live in the
 * `Setting` table; see `home-images.ts` for the cached reader.
 */
/**
 * Every slot here must be rendered somewhere. Four "hero collage" slots
 * outlived the collage they filled and sat on this page for months doing
 * nothing — if a slot's photo stops being shown, delete the slot in the same
 * change.
 */
export const HOME_IMAGE_SLOTS = [
  {
    key: "home_logo",
    label: "Logo",
    group: "Brand",
    help: "Header, footer, packing slips and the admin. A wide transparent PNG works best — the border is auto-trimmed on upload.",
  },
  {
    key: "home_story_image",
    label: "“Stitched with hope” photo",
    group: "Home page",
    help: "Sits beside the story blurb partway down the home page. Defaults to the logo.",
  },
  {
    key: "our_story_image",
    label: "Header photo",
    group: "Our Story page",
    help: "The large photo at the top of the Our Story page. Defaults to a generated pattern.",
  },
] as const;

export const HOME_IMAGES_TAG = "home-images";

/** Shape shared by static slots and the per-collection banner slots. */
export type ImageSlot = {
  key: string;
  label: string;
  help: string;
  group?: string;
};

/** Setting key holding a collection's hero/banner image. */
export const collectionHeroKey = (slug: string) => `collection_hero_${slug}`;
