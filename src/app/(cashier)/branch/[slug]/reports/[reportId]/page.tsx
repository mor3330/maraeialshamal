import ReportDetailsClient from "@/components/cashier/ReportDetailsClient";

export default async function ReportDetailsPage({ 
  params 
}: { 
  params: Promise<{ slug: string; reportId: string }>
}) {
  const { slug, reportId } = await params;
  return <ReportDetailsClient slug={slug} reportId={reportId} />;
}
