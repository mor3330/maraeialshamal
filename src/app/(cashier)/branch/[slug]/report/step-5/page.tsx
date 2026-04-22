import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default function Step5Page({ params }: { params: { slug: string } }) {
  return (
    <DynamicStepClient 
      slug={params.slug} 
      step={5} 
      stepLabel="المتبقي في الثلاجة" 
      nextStep={6}
    />
  );
}
