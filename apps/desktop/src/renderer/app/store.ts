import { create } from "zustand";
import { persist } from "zustand/middleware";

import { initialState } from "@/renderer/app/types";

import { persistenceOptions } from "./store/persistence";
import { createCatalogSlice } from "./store/slices/catalog-slice";
import { createCommandSlice } from "./store/slices/command-slice";
import { createHistorySlice } from "./store/slices/history-slice";
import { createPreferencesSlice } from "./store/slices/preferences-slice";
import { createViewSlice } from "./store/slices/view-slice";
import type { DesktopStore } from "./store/types";

export const useDesktopStore = create<DesktopStore>()(
  persist(
    (...args) => ({
      ...initialState,
      view: "main",
      ...createViewSlice(...args),
      ...createCatalogSlice(...args),
      ...createCommandSlice(...args),
      ...createHistorySlice(...args),
      ...createPreferencesSlice(...args),
    }),
    persistenceOptions,
  ),
);
