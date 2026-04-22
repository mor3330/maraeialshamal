import ReportDetailsClient from "@/components/cashier/ReportDetailsClient";

export default function ReportDetailsPage({ 
  params 
}: { 
  params: { slug: string; reportId: string } 
}) {
  return <ReportDetailsClient slug={params.slug} reportId={params.reportId} />;
}
