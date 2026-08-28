import { supabase } from './src/lib/supabase.js';

const DATA_KEYS = ['adledger_clients', 'adledger_cards', 'adledger_transactions'];

export async function recoverLedgerDataBeforeAppStarts() {
  if (typeof window === 'undefined') return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    // Find every workspace this signed-in user can access instead of blindly
    // choosing the oldest owned workspace. This prevents an empty workspace
    // from hiding an existing ledger stored in another accessible workspace.
    const { data: workspaces, error: workspaceError } = await supabase
      .from('workspaces')
      .select('id, created_at')
      .order('created_at', { ascending: true });

    if (workspaceError || !Array.isArray(workspaces) || workspaces.length === 0) return;

    let bestWorkspace = null;
    let bestRows = [];
    let bestScore = -1;

    for (const workspace of workspaces) {
      const { data: rows, error } = await supabase
        .from('workspace_app_data')
        .select('data_key, data')
        .eq('workspace_id', workspace.id)
        .in('data_key', DATA_KEYS);

      if (error || !Array.isArray(rows)) continue;

      const score = rows.reduce((total, row) => {
        if (!DATA_KEYS.includes(row.data_key) || !Array.isArray(row.data)) return total;
        return total + row.data.length;
      }, 0);

      if (score > bestScore) {
        bestScore = score;
        bestWorkspace = workspace;
        bestRows = rows;
      }
    }

    if (!bestWorkspace || bestScore <= 0) return;

    // Only hydrate non-empty cloud datasets. Never replace existing local
    // data with an empty cloud response.
    for (const row of bestRows) {
      if (!DATA_KEYS.includes(row.data_key)) continue;
      if (!Array.isArray(row.data) || row.data.length === 0) continue;
      window.localStorage.setItem(row.data_key, JSON.stringify(row.data));
    }

    window.localStorage.setItem('adledger_version', '2');
    window.localStorage.setItem('adledger_recovery_workspace', bestWorkspace.id);
  } catch (error) {
    console.error('AdLytic pre-app data recovery failed', error);
  }
}
