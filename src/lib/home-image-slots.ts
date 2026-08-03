/**
 * Home page image slot metadata. Plain module (no server-only) so both the admin
 * client form and the server code can import it. The actual values live in the
 * `Setting` table; see `home-images.ts` for the cached reader.
 */
export const HOME_IMAGE_SLOTS = [
  {
    key: "home_logo",
    label: "Logo",
    help: "Shown in the header, footer, and story section. A wide transparent PNG works best — the border is auto-trimmed on upload.",
  },
  { key: "home_hero_1", label: "Hero image 1", help: "Top-left of the hero collage." },
  { key: "home_hero_2", label: "Hero image 2", help: "Top-right of the hero collage." },
  { key: "home_hero_3", label: "Hero image 3", help: "Bottom-left of the hero collage." },
  { key: "home_hero_4", label: "Hero image 4", help: "Bottom-right of the hero collage." },
  {
    key: "home_story_image",
    label: "Home “Stitched with hope” image",
    help: "The image beside the story blurb on the home page. Defaults to the logo.",
  },
  {
    key: "our_story_image",
    label: "Our Story page image",
    help: "The large photo at the top of the Our Story page. Defaults to a placeholder.",
  },
] as const;

export const HOME_IMAGES_TAG = "home-images";

/** Shape shared by static slots and the per-collection hero slots. */
export type ImageSlot = { key: string; label: string; help: string };

/** Setting key holding a collection's hero/banner image. */
export const collectionHeroKey = (slug: string) => `collection_hero_${slug}`;
