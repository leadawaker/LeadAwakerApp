import { createContext, useContext } from "react";

/** Whether tags should be visible on task cards. Defaults to true. */
export const TagVisibilityContext = createContext<boolean>(true);

export function useTagVisibility() {
  return useContext(TagVisibilityContext);
}
