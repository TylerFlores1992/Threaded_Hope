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
    label: "“Stitched with hope” image",
    help: "The image beside the story blurb. Defaults to the logo.",
  },
] as const;

export const HOME_IMAGES_TAG = "home-images";
