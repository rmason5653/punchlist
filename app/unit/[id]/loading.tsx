import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonCard, SkeletonLine } from "@/app/components/Skeleton";

// The clean flow's shape: back link, unit title, three step cards.
export default function Loading() {
  return (
    <Container>
      <LoadingLabel what="the unit" />
      <SkeletonLine w="w-20" h="h-4" />
      <div className="mt-3 space-y-2">
        <SkeletonLine w="w-16" h="h-3" />
        <SkeletonLine w="w-48" h="h-8" />
      </div>
      <div className="mt-6 space-y-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={6} />
        <SkeletonCard lines={2} />
      </div>
    </Container>
  );
}
