import { useEffect, useRef } from "react";

// The backend emits a "nodes" event on /ui/api/nodes/stream whenever the node
// set or any node's online state changes. EventSource is same-origin here, so
// the HttpOnly session cookie is sent automatically — no token handling needed.
const STREAM_URL = "/ui/api/nodes/stream";

/**
 * Subscribes to server-sent node-change events and invokes `onChange` each time
 * they arrive. The EventSource reconnects on its own, but we also rebuild it
 * after an error (e.g. the session expired then was refreshed) with a short
 * backoff. `onChange` is kept in a ref so callers don't need to memoize it.
 */
export function useNodeStream(onChange: () => void, enabled = true): void {
  const cbRef = useRef(onChange);
  useEffect(() => {
    cbRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource(STREAM_URL);
      es.addEventListener("nodes", () => cbRef.current());
      es.onerror = () => {
        // Browser will retry a dropped connection by itself; on a hard error
        // close and rebuild after a short delay to be safe.
        es?.close();
        es = null;
        if (!closed) retry = window.setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      closed = true;
      if (retry) window.clearTimeout(retry);
      es?.close();
    };
  }, [enabled]);
}
