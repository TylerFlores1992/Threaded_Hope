import "server-only";
import { unstable_cache } from "next/cache";
import { getSetting } from "@/lib/settings";
import { HOME_IMAGE_SLOTS, HOME_IMAGES_TAG } from "@/lib/home-image-slots";

/**
 * Cached reader for admin-managed home page imagery, stored in the `Setting`
 * table (Blob URLs) and editable at /admin/home. Slot metadata lives in
 * `home-image-slots.ts` so the client form can share it.
 */
export { HOME_IMAGE_SLOTS, HOME_IMAGES_TAG };

export type HomeImages = Record<string, string | undefined>;

/**
 * Cached read of every home-image override. `unstable_cache` keeps pages static
 * (no per-request DB hit); the admin action busts it with `revalidateTag`.
 * Empty strings (a cleared slot) collapse to `undefined`.
 */
export const getHomeImages = unstable_cache(
  async (): Promise<HomeImages> => {
    const entries = await Promise.all(
      HOME_IMAGE_SLOTS.map(
        async (s) => [s.key, (await getSetting(s.key)) || undefined] as const,
      ),
    );
    return Object.fromEntries(entries);
  },
  ["home-images"],
  { tags: [HOME_IMAGES_TAG], revalidate: 3600 },
);
