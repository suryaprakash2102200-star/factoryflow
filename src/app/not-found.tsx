import { ErrorScreen } from "@/components/ErrorScreen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      message="This page doesn't exist, the record was deleted, or the module is switched off for your workspace."
    />
  );
}
