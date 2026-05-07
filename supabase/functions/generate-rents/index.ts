import { createClient } from "npm:@supabase/supabase-js@2.42.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

async function acquireJobLock(jobName: string): Promise<string | null> {
  const { data: acquired } = await supabase
    .rpc("try_acquire_job_lock", { p_job_name: jobName });

  if (!acquired) {
    await supabase.from("job_runs").insert({
      job_name: jobName,
      status: "aborted",
      error_message: "Advisory lock ativo — outro worker em execução",
    });
    return null;
  }

  const { data: run } = await supabase
    .from("job_runs")
    .insert({ job_name: jobName, status: "running" })
    .select()
    .single();

  return run?.id ?? null;
}

async function releaseJobLock(
  jobName: string,
  runId: string,
  status: "success" | "failed",
  startTime: number,
  opts?: { rows?: number; error?: string }
) {
  await supabase.rpc("release_job_lock", { p_job_name: jobName });
  await supabase
    .from("job_runs")
    .update({
      status,
      rows_affected: opts?.rows,
      error_message: opts?.error,
      duration_ms: Date.now() - startTime,
    })
    .eq("id", runId);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const startTime = Date.now();
  const jobName = "generate-rents";

  const runId = await acquireJobLock(jobName);
  if (!runId) return new Response("aborted", { status: 409 });

  try {
    const { data: count1, error: error1 } = await supabase.rpc("generate_monthly_rents");
    if (error1) throw error1;

    const { data: count2, error: error2 } = await supabase.rpc("generate_recurring_expenses");
    if (error2) throw error2;

    await supabase.from("domain_events").insert({
      event_type: "rent_generated",
      event_version: 1,
      source: "job",
      payload: {
        entity_id: null,
        entity_type: "transaction",
        timestamp: new Date().toISOString(),
        context: { month: new Date().toISOString().slice(0, 7), count: count1 },
      },
    });

    const totalRows = (count1 ?? 0) + (count2 ?? 0);
    await releaseJobLock(jobName, runId, "success", startTime, { rows: totalRows });

    return new Response(JSON.stringify({ success: true, totalRows }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    await releaseJobLock(jobName, runId, "failed", startTime, { error: error.message });
    await supabase.from("domain_events").insert({
      event_type: "job_failed",
      event_version: 1,
      source: "job",
      payload: {
        entity_id: runId,
        entity_type: "job",
        timestamp: new Date().toISOString(),
        context: { job_name: jobName, error_message: error.message },
      },
    });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
