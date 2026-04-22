import ReviewWithShortage from "@/components/cashier/ReviewWithShortage";

export default function ReviewPage({ params }: { params: { slug: string } }) {
  return <ReviewWithShortage slug={params.slug} />;
}
