// Public values only. Fill these for official builds, or override in mobile/.env.
// Never include a Supabase secret/service-role key or a Muse integration token.
const TASK_INBOX_PUBLIC_CONFIG = Object.freeze({ supabaseUrl: '', supabasePublishableKey: '' });
module.exports = { TASK_INBOX_PUBLIC_CONFIG };
