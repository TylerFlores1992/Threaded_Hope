"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type CartItem = {
  id: string; // slug + variant signature, uniquely identifies a line
  slug: string;
  name: string;
  price: number;
  hue: number;
  options: Record<string, string>; // e.g. { Color: "Sage" }
  quantity: number;
};

type State = { items: CartItem[] };

type Action =
  | { type: "add"; item: Omit<CartItem, "quantity">; quantity: number }
  | { type: "remove"; id: string }
  | { type: "setQty"; id: string; quantity: number }
  | { type: "clear" }
  | { type: "hydrate"; items: CartItem[] };

const STORAGE_KEY = "threaded-hope-cart";

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { items: action.items };
    case "add": {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          items: state.items.map((i) =>
            i.id === action.item.id
              ? { ...i, quantity: i.quantity + action.quantity }
              : i,
          ),
        };
      }
      return {
        items: [...state.items, { ...action.item, quantity: action.quantity }],
      };
    }
    case "setQty":
      return {
        items: state.items
          .map((i) =>
            i.id === action.id
              ? { ...i, quantity: Math.max(0, action.quantity) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      };
    case "remove":
      return { items: state.items.filter((i) => i.id !== action.id) };
    case "clear":
      return { items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
  add: (item: Omit<CartItem, "quantity">, quantity?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, quantity: number) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function makeLineId(slug: string, options: Record<string, string>) {
  const sig = Object.entries(options)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${v}`)
    .join("|");
  return sig ? `${slug}__${sig}` : slug;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: [] });
  const [isOpen, setIsOpen] = useState(false);
  const loaded = useRef(false);

  // Load persisted cart on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) dispatch({ type: "hydrate", items: JSON.parse(raw) });
    } catch {
      /* ignore malformed storage */
    }
  }, []);

  // Persist on every change *after* the first committed render, so the empty
  // initial state can't clobber a stored cart before hydration lands.
  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    } catch {
      /* storage full or unavailable — non-fatal */
    }
  }, [state.items]);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = state.items.reduce((n, i) => n + i.quantity * i.price, 0);
    return {
      items: state.items,
      count,
      subtotal,
      isOpen,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      add: (item, quantity = 1) => {
        dispatch({ type: "add", item, quantity });
        setIsOpen(true);
      },
      remove: (id) => dispatch({ type: "remove", id }),
      setQty: (id, quantity) => dispatch({ type: "setQty", id, quantity }),
      clear: () => dispatch({ type: "clear" }),
    };
  }, [state.items, isOpen]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
