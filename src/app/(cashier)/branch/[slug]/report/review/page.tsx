import ReviewWithShortage from "@/components/cashier/ReviewWithShortage";

export default async function ReviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <ReviewWithShortage slug={slug} />;
}
