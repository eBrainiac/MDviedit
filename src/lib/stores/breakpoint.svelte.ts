/**
 * UI-LAYOUT-RULES §5: breakpoints por el ancho de `Content`, medidos
 * exclusivamente con ResizeObserver (nunca `window.innerWidth`/`screen.*`,
 * ADR-012 COORD-005). ContentArea reporta su ancho aquí; FormatToolbar lo
 * consume para decidir el colapso `compact` (IN-014).
 */
import { appConfig } from "../../config/app.config";

export type Breakpoint = "compact" | "regular" | "wide";

class BreakpointStore {
  contentWidth = $state(0);

  get current(): Breakpoint {
    if (this.contentWidth <= appConfig.behavior.breakpoints.compactMaxPx) return "compact";
    if (this.contentWidth >= appConfig.behavior.breakpoints.wideMinPx) return "wide";
    return "regular";
  }
}

export const breakpointStore = new BreakpointStore();
