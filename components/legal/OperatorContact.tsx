import type { Operator } from "@/lib/legal";

// How /privacy and /terms name the instance operator and how to reach them,
// with the fallbacks from the Edge Cases of 010-legal-pages.

export function OperatorName({ operator }: { operator: Operator }) {
  return <>{operator.name ?? "the operator of this instance"}</>;
}

export function OperatorContact({ operator }: { operator: Operator }) {
  if (!operator.contactEmail) {
    return <>contact the administrator of this instance</>;
  }
  return (
    <>
      email <a href={`mailto:${operator.contactEmail}`}>{operator.contactEmail}</a>
    </>
  );
}
