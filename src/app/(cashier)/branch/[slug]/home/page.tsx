import BranchHomeClient from "@/components/cashier/BranchHomeClient";

export default function BranchHomePage({ params }: { params: { slug: string } }) {
  return <BranchHomeClient slug={params.slug} />;
}
