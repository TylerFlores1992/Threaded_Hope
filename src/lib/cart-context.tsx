"use client";

import {
  createContext,
  useCallback,
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

type State = {
  items: CartItem[];
  /** True once the persisted cart has been read back on mount. */
  hydrated: boolean;
};

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
      // Reusing the existing items array when there's nothing to restore keeps
      // the context value's identity stable for a no-op.
      return {
        items: action.items.length === 0 ? state.items : action.items,
        hydrated: true,
      };
    case "add": {
      const existing = state.items.find((i) => i.id === action.item.id);
      if (existing) {
        return {
          ...state,
          items: state.items.map((i) =>
            i.id === action.item.id
              ? { ...i, quantity: i.quantity + action.quantity }
              : i,
          ),
        };
      }
      return {
        ...state,
        items: [...state.items, { ...action.item, quantity: action.quantity }],
      };
    }
    case "setQty":
      return {
        ...state,
        items: state.items
          .map((i) =>
            i.id === action.id
              ? { ...i, quantity: Math.max(0, action.quantity) }
              : i,
          )
          .filter((i) => i.quantity > 0),
      };
    case "remove":
      return {
        ...state,
        items: state.items.filter((i) => i.id !== action.id),
      };
    case "clear":
      // Returning a fresh object for an already-empty cart changes
      // `state.items`' identity, which rebuilds the context value, which gives
      // consumers a new `clear` — and an effect that depends on `clear` then
      // clears again, forever. Bail out instead.
      if (state.items.length === 0) return state;
      return { ...state, items: [] };
    default:
      return state;
  }
}

type CartContextValue = {
  items: CartItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  /**
   * False until the persisted cart has been read back on mount. Anything that
   * mutates the cart from a page effect must wait for this: child effects run
   * before the provider's, so acting earlier is undone by hydration.
   */
  hydrated: boolean;
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
  const [state, dispatch] = useReducer(reducer, { items: [], hydrated: false });
  const [isOpen, setIsOpen] = useState(false);
  const loaded = useRef(false);

  // Load persisted cart on mount.
  useEffect(() => {
    let items: CartItem[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) items = JSON.parse(raw);
    } catch {
      /* ignore malformed storage */
    }
    // One dispatch carries both the restored items and the hydrated flag, so
    // there's no synchronous setState sitting in this effect.
    dispatch({ type: "hydrate", items });
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

  // Actions are stable for the life of the provider — `dispatch` and
  // `setIsOpen` never change — so a component can safely depend on one in an
  // effect without re-running on every cart change.
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);
  const add = useCallback(
    (item: Omit<CartItem, "quantity">, quantity = 1) => {
      dispatch({ type: "add", item, quantity });
      setIsOpen(true);
    },
    [],
  );
  const remove = useCallback((id: string) => dispatch({ type: "remove", id }), []);
  const setQty = useCallback(
    (id: string, quantity: number) => dispatch({ type: "setQty", id, quantity }),
    [],
  );
  const clear = useCallback(() => dispatch({ type: "clear" }), []);

  const value = useMemo<CartContextValue>(() => {
    const count = state.items.reduce((n, i) => n + i.quantity, 0);
    const subtotal = state.items.reduce((n, i) => n + i.quantity * i.price, 0);
    return {
      items: state.items,
      count,
      subtotal,
      isOpen,
      hydrated: state.hydrated,
      openCart,
      closeCart,
      add,
      remove,
      setQty,
      clear,
    };
  }, [
    state.items,
    state.hydrated,
    isOpen,
    openCart,
    closeCart,
    add,
    remove,
    setQty,
    clear,
  ]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
