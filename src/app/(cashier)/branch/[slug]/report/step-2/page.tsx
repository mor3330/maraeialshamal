import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default async function Step2Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DynamicStepClient slug={slug} step={2} stepLabel="المبيعات" nextStep={3} />;
}
