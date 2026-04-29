import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default async function Step1Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DynamicStepClient slug={slug} step={1} stepLabel="الوارد" nextStep={2} />;
}
