import { supabase } from './src/lib/supabase.js';

const DATA_KEYS = ['adledger_clients', 'adledger_cards', 'adledger_transactions'];

export async function recoverLedgerDataBeforeAppStarts() {
  if (typeof window === 'undefined') return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return;

    let workspaceId = null;

    const { data: owned, error: ownedError } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!ownedError && owned?.id) {
      workspaceId = owned.id;
    } else {
      const { data: membership, error: membershipError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!membershipError && membership?.workspace_id) {
        workspaceId = membership.workspace_id;
      }
    }

    if (!workspaceId) return;

    const { data: rows, error } = await supabase
      .from('workspace_app_data')
      .select('data_key, data')
      .eq('workspace_id', workspaceId)
      .in('data_key', DATA_KEYS);

    if (error || !Array.isArray(rows)) return;

    for (const row of rows) {
      if (!DATA_KEYS.includes(row.data_key)) continue;
      if (!Array.isArray(row.data) || row.data.length === 0) continue;
      window.localStorage.setItem(row.data_key, JSON.stringify(row.data));
    }

    window.localStorage.setItem('adledger_version', '2');
  } catch (error) {
    console.error('AdLytic pre-app data recovery failed', error);
  }
}
