import { Container } from "@/app/components/ui";
import { LoadingLabel, SkeletonHeader, SkeletonLine, SkeletonRows } from "@/app/components/Skeleton";

export default function Loading() {
  return (
    <Container>
      <LoadingLabel what="the pull log" />
      <SkeletonHeader />
      <div className="mb-4"><SkeletonLine w="w-64" h="h-8" /></div>
      <SkeletonRows rows={10} />
    </Container>
  );
}
