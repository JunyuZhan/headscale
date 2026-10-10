import { useEffect, useRef } from "react";
import type { Event } from "../api/client";

// The backend emits a "message" event on /ui/api/events/stream for every new
// audit event (admins get all, users only their own). EventSource is
// same-origin, so the HttpOnly session cookie is sent automatically.
const STREAM_URL = "/ui/api/events/stream";

/**
 * Subscribes to server-sent audit events and invokes `onEvent` for each one.
 * Rebuilds the connection after an error with a short backoff; keeps the
 * callback in a ref so callers don't need to memoize it.
 */
export function useEventStream(onEvent: (ev: Event) => void, enabled = true): void {
  const cbRef = useRef(onEvent);
  useEffect(() => {
    cbRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof EventSource === "undefined") return;

    let es: EventSource | null = null;
    let retry: number | undefined;
    let closed = false;

    const connect = () => {
      if (closed) return;
      es = new EventSource(STREAM_URL);
      es.addEventListener("message", (m) => {
        try {
          cbRef.current(JSON.parse((m as MessageEvent).data) as Event);
        } catch {
          /* ignore malformed frame */
        }
      });
      es.onerror = () => {
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
