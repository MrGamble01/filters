import { getJob, jobCsvs } from "@/lib/store/jobStore";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const job = getJob(id);
  if (!job) return new Response("Not found", { status: 404 });

  const type = new URL(request.url).searchParams.get("type") === "flags"
    ? "flags"
    : "send";
  const { sendCsv, flagsCsv } = jobCsvs(job);
  const csv = type === "flags" ? flagsCsv : sendCsv;
  const filename = `${job.company.gr_code}_${job.outputType}_${type}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
