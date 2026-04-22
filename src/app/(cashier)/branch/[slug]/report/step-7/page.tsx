// الخطوة 7 أصبحت الخطوة 6 - تحويل تلقائي
import { redirect } from "next/navigation";

export default function Step7Page({ params }: { params: { slug: string } }) {
  redirect(`/branch/${params.slug}/report/step-6`);
}
