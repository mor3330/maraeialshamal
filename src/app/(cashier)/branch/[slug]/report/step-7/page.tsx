// الخطوة 7 أصبحت الخطوة 6 - تحويل تلقائي
import { redirect } from "next/navigation";

export default async function Step7Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/branch/${slug}/report/step-6`);
}
