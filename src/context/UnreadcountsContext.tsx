import { createContext, useContext } from "react";

interface UnreadCountsContextType {
  refreshCounts: () => void;
}

export const UnreadCountsContext = createContext<UnreadCountsContextType>({
  refreshCounts: () => {},
});

export const useRefreshCounts = () => useContext(UnreadCountsContext);