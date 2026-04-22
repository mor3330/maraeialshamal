import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default function Step3Page({ params }: { params: { slug: string } }) {
  return (
    <DynamicStepClient 
      slug={params.slug} 
      step={3} 
      stepLabel="تفاصيل المبيعات" 
      nextStep={4}
    />
  );
}
