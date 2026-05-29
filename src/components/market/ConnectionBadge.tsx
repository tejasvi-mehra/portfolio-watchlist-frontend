import type { ConnectionState } from "../../realtime/protocol";

export function ConnectionBadge({ state }: { state: ConnectionState }) {
  return <span className={`badge badge-${state}`}>{state}</span>;
}

