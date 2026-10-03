import { ErrorPanel } from "@/components/errors/error-panel";

export default function NotFound() {
  return (
    <ErrorPanel
      title="We couldn't find that page"
      body="The link may be out of date, or the round or report it pointed to may have been deleted."
    />
  );
}
