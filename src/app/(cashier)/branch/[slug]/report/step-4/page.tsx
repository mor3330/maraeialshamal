import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default function Step4Page({ params }: { params: { slug: string } }) {
  return (
    <DynamicStepClient 
      slug={params.slug} 
      step={4} 
      stepLabel="الصادر" 
      nextStep={5}
    />
  );
}
