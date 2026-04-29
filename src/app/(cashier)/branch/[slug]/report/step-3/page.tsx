import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default async function Step3Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DynamicStepClient slug={slug} step={3} stepLabel="تفاصيل المبيعات" nextStep={4} />;
}
