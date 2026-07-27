/**
 * Simple file-based blog ("Journal"). Posts are structured blocks (no markdown
 * dependency). Add a post by appending to `posts` — newest first. Each post
 * feeds the /blog list, its own page, the sitemap, and Article structured data.
 */
export type BlogBlock =
  | { type: "p"; text: string }
  | { type: "h2"; text: string }
  | { type: "ul"; items: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  excerpt: string;
  date: string; // ISO (YYYY-MM-DD)
  keywords: string[];
  body: BlogBlock[];
};

export const posts: BlogPost[] = [
  {
    slug: "handmade-faith-based-gift-guide",
    title: "A Handmade Gift Guide for Faith-Inspired, Meaningful Presents",
    excerpt:
      "Looking for a thoughtful, faith-based gift? Here's how to choose a handmade bag, pouch, or keychain that feels personal — and lasts.",
    date: "2026-07-01",
    keywords: [
      "handmade gifts",
      "faith-based gifts",
      "Christian handmade gifts",
      "handmade gift guide",
      "thoughtful gifts for her",
    ],
    body: [
      {
        type: "p",
        text: "The best gifts feel personal — like someone slowed down and made something just for you. That's the heart of every handmade piece at Threaded Hope: small-batch bags, zipper pouches, tote bags, and keychains sewn with care, and often a little Scripture stitched into the story.",
      },
      { type: "h2", text: "Match the gift to the person" },
      {
        type: "p",
        text: "A slouchy shoulder bag suits someone who carries their whole life with them. A zipper pouch is perfect for the organizer who loves a spot for everything. A keychain is a small, everyday reminder that they're thought of. When you're shopping handmade, you're not just buying an object — you're giving something one-of-a-kind.",
      },
      { type: "h2", text: "Why handmade makes a better gift" },
      {
        type: "ul",
        items: [
          "Each piece is made in small batches, so it's genuinely unique.",
          "Quality materials and hand-finished seams mean it lasts.",
          "Faith-inspired details make it meaningful, not just pretty.",
          "You're supporting a small maker, not a factory line.",
        ],
      },
      {
        type: "p",
        text: "Whether it's a birthday, a season of waiting, or a just-because moment, a handmade gift says what a store-bought one can't. Browse the shop and find the piece that tells their story.",
      },
    ],
  },
  {
    slug: "how-our-handmade-bags-and-pouches-are-made",
    title: "How Our Handmade Bags & Pouches Are Made",
    excerpt:
      "A peek behind the sewing table — how each small-batch handmade bag and zipper pouch comes together, from fabric to finished seam.",
    date: "2026-06-15",
    keywords: [
      "handmade bags",
      "handmade zipper pouches",
      "small batch handmade",
      "how handmade bags are made",
      "handmade fabric accessories",
    ],
    body: [
      {
        type: "p",
        text: "Every Threaded Hope piece starts at a sewing table, not a production line. Here's what \"handmade in small batches\" actually means for the bag or pouch you bring home.",
      },
      { type: "h2", text: "Choosing the fabric" },
      {
        type: "p",
        text: "It begins with fabric chosen for both feel and durability — corduroy, canvas, cottons, and prints that can stand up to everyday use. Because we work in small batches, some fabrics are limited, which is part of what makes each piece one-of-a-kind.",
      },
      { type: "h2", text: "Cutting, sewing, and finishing" },
      {
        type: "ul",
        items: [
          "Panels are measured and cut by hand for each item.",
          "Seams are sewn and reinforced at stress points like straps and zippers.",
          "Interior pockets and linings are added for everyday function.",
          "Every finished piece is checked before it's listed or shipped.",
        ],
      },
      {
        type: "p",
        text: "That care is why a handmade bag feels different in your hands — and why it holds up. When you shop handmade, you're getting the maker's time and attention stitched into every seam.",
      },
    ],
  },
  {
    slug: "caring-for-handmade-fabric-accessories",
    title: "Caring for Your Handmade Fabric Accessories",
    excerpt:
      "Keep your handmade bag, tote, or pouch looking its best for years with these simple fabric-care tips.",
    date: "2026-06-01",
    keywords: [
      "handmade bag care",
      "how to clean a fabric bag",
      "handmade tote care",
      "fabric accessories care",
    ],
    body: [
      {
        type: "p",
        text: "A well-made handmade bag can last for years with a little care. Here's how to keep your Threaded Hope pieces looking their best.",
      },
      { type: "h2", text: "Everyday care" },
      {
        type: "ul",
        items: [
          "Spot-clean spills quickly with a damp cloth and mild soap.",
          "Avoid overloading — it stresses seams and straps over time.",
          "Let a damp bag air-dry fully before storing to prevent mildew.",
          "Store stuffed with tissue to help it keep its shape.",
        ],
      },
      { type: "h2", text: "Deeper cleaning" },
      {
        type: "p",
        text: "For most fabric bags and pouches, hand-washing in cool water with a gentle detergent is safest, then reshape and air-dry. Skip the dryer, which can shrink fabric and weaken seams. If your piece has a stiff interior or hardware, wipe rather than soak.",
      },
      {
        type: "p",
        text: "Treat it kindly and your handmade accessory will keep telling its story for a long time. Questions about a specific piece? Reach out any time — we're happy to help.",
      },
    ],
  },
];

export function getAllPosts(): BlogPost[] {
  return [...posts].sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug);
}
