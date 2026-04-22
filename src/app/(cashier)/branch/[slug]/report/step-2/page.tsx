import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default function Step2Page({ params }: { params: { slug: string } }) {
  return (
    <DynamicStepClient 
      slug={params.slug} 
      step={2} 
      stepLabel="المبيعات" 
      nextStep={3}
    />
  );
}
