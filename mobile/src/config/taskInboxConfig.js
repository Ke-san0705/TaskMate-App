// Public values for the existing TaskMate project; mobile/.env may override them.
// Never include a Supabase secret/service-role key or a Muse integration token.
const TASK_INBOX_PUBLIC_CONFIG = Object.freeze({
  supabaseUrl: 'https://nppqtkehgeusoghkecsw.supabase.co',
  supabasePublishableKey: 'sb_publishable_eHSVCLI_q72clKHym9TuAA_EGcNqzX2'
});
module.exports = { TASK_INBOX_PUBLIC_CONFIG };
