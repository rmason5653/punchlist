import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonCard, SkeletonCards, SkeletonHeader, SkeletonLine } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <Container>
      <LoadingLabel what="the restock run" />
      <SkeletonHeader />
      <div className="mb-5 flex items-center justify-between rounded-card border border-line bg-surface-2 p-3" aria-hidden="true">
        <SkeletonLine w="w-40" h="h-9" />
        <SkeletonLine w="w-36" h="h-9" />
      </div>
      <div className="mb-5">
        <SkeletonCard lines={4} />
      </div>
      <SkeletonCards count={4} cols="lg:grid-cols-2" />
    </Container>
  );
}
