import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonCards, SkeletonHeader } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <Container>
      <LoadingLabel what="linens" />
      <SkeletonHeader />
      <SkeletonCards count={4} cols="lg:grid-cols-2" />
    </Container>
  );
}
