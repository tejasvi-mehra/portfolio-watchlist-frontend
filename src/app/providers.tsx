import type { PropsWithChildren } from "react";
import { RealtimeProvider } from "../realtime/provider";

export function AppProviders({ children }: PropsWithChildren) {
  return <RealtimeProvider>{children}</RealtimeProvider>;
}
