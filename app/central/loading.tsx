import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonHeader, SkeletonLine, SkeletonRows } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <Container>
      <LoadingLabel what="the Stockroom" />
      <SkeletonHeader />
      <div className="mb-3"><SkeletonLine w="w-28" h="h-4" /></div>
      <SkeletonRows rows={9} />
    </Container>
  );
}
