"use client";

import { useEffect } from "react";
import { ErrorScreen } from "@/components/ErrorScreen";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <ErrorScreen
      code="500"
      title="Internal server error"
      message="Something went wrong on our side while loading this page. Try again, and if it keeps happening share the error ID below."
      digest={error.digest}
      onRetry={reset}
    />
  );
}
