import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default async function Step4Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <DynamicStepClient slug={slug} step={4} stepLabel="الصادر" nextStep={5} />;
}
