// الخطوة السادسة: المصروفات والملاحظات
import Step6ExpensesClient from "@/components/cashier/Step6ExpensesClient";

export default async function Step6Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Step6ExpensesClient slug={slug} />;
}
