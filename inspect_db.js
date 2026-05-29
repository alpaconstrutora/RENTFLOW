const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'http://127.0.0.1:54321';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function inspect() {
  try {
    console.log("=== INSPECTING DB ===");
    
    const { data: templates, error: tErr } = await supabase.from('contract_templates').select('id, name');
    if (tErr) console.error("Error contract_templates:", tErr.message);
    else console.log("Templates no banco:", templates);

    const { data: instances, error: iErr } = await supabase.from('contract_instances').select('id, template_id, status, generated_docx_path');
    if (iErr) console.error("Error contract_instances:", iErr.message);
    else console.log("Instâncias no banco:", instances);

    const { data: variables, error: vErr } = await supabase.from('contract_variables').select('id, code, origin');
    if (vErr) console.error("Error contract_variables:", vErr.message);
    else console.log("Variáveis no banco:", variables.length);

  } catch (err) {
    console.error("Crash:", err);
  }
}

inspect();
