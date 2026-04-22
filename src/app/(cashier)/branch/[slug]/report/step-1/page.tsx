import DynamicStepClient from "@/components/cashier/DynamicStepClient";

export default function Step1Page({ params }: { params: { slug: string } }) {
  return (
    <DynamicStepClient 
      slug={params.slug} 
      step={1} 
      stepLabel="الوارد" 
      nextStep={2}
    />
  );
}
