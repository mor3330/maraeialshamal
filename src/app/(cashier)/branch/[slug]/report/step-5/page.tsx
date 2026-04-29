import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default async function Step5Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DynamicStepClient slug={slug} step={5} stepLabel="المتبقي في الثلاجة" nextStep={6} />;
}
