import BranchHomeClient from "@/components/cashier/BranchHomeClient";

export default async function BranchHomePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <BranchHomeClient slug={slug} />;
}
