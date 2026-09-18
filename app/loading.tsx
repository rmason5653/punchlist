import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonHeader, SkeletonRows } from "@/app/components/Skeleton";

// Default placeholder for any route without its own: header + a list.
export default function Loading() {
  return (
    <Container>
      <LoadingLabel />
      <SkeletonHeader />
      <SkeletonRows rows={8} />
    </Container>
  );
}
