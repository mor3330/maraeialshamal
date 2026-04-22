// الخطوة السادسة: المصروفات والملاحظات (نُقلت من step-7)
import Step6ExpensesClient from "@/components/cashier/Step6ExpensesClient";

export default function Step6Page({ params }: { params: { slug: string } }) {
  return <Step6ExpensesClient slug={params.slug} />;
}
