-- AdLytic cloud-sync RLS policies
-- Run this once in Supabase SQL Editor.

-- Keep the existing function argument name (target_workspace) so CREATE OR REPLACE
-- works even if the helper function was created earlier.
create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = auth.uid()
      and wm.status = 'Active'
  );
$$;

revoke all on function public.is_workspace_member(uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_settings enable row level security;
alter table public.clients enable row level security;
alter table public.cards enable row level security;
alter table public.transactions enable row level security;
alter table public.campaigns enable row level security;

drop policy if exists "workspace members can view workspace" on public.workspaces;
drop policy if exists "workspace owner can manage workspace" on public.workspaces;
drop policy if exists "members can view workspace" on public.workspaces;
create policy "workspace members can view workspace"
on public.workspaces for select to authenticated
using (owner_id = auth.uid() or public.is_workspace_member(id));
create policy "workspace owner can insert workspace"
on public.workspaces for insert to authenticated
with check (owner_id = auth.uid());
create policy "workspace owner can update workspace"
on public.workspaces for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Membership rows: users can see their own memberships and workspace members.
drop policy if exists "members can view workspace members" on public.workspace_members;
drop policy if exists "users can insert own membership" on public.workspace_members;
drop policy if exists "owners can manage workspace members" on public.workspace_members;
drop policy if exists "owners can delete workspace members" on public.workspace_members;
create policy "members can view workspace members"
on public.workspace_members for select to authenticated
using (user_id = auth.uid() or public.is_workspace_member(workspace_id));
create policy "users can insert own membership"
on public.workspace_members for insert to authenticated
with check (
  user_id = auth.uid()
  and (
    public.is_workspace_member(workspace_id)
    or exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  )
);
create policy "owners can manage workspace members"
on public.workspace_members for update to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()))
with check (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()));
create policy "owners can delete workspace members"
on public.workspace_members for delete to authenticated
using (exists (select 1 from public.workspaces w where w.id = workspace_id and w.owner_id = auth.uid()) and user_id <> auth.uid());

-- Shared workspace data.
drop policy if exists "workspace members can read clients" on public.clients;
drop policy if exists "workspace members can insert clients" on public.clients;
drop policy if exists "workspace members can update clients" on public.clients;
drop policy if exists "workspace members can delete clients" on public.clients;
create policy "workspace members can read clients" on public.clients for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workspace members can insert clients" on public.clients for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "workspace members can update clients" on public.clients for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace members can delete clients" on public.clients for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can read cards" on public.cards;
drop policy if exists "workspace members can insert cards" on public.cards;
drop policy if exists "workspace members can update cards" on public.cards;
drop policy if exists "workspace members can delete cards" on public.cards;
create policy "workspace members can read cards" on public.cards for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workspace members can insert cards" on public.cards for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "workspace members can update cards" on public.cards for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace members can delete cards" on public.cards for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can read transactions" on public.transactions;
drop policy if exists "workspace members can insert transactions" on public.transactions;
drop policy if exists "workspace members can update transactions" on public.transactions;
drop policy if exists "workspace members can delete transactions" on public.transactions;
create policy "workspace members can read transactions" on public.transactions for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workspace members can insert transactions" on public.transactions for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "workspace members can update transactions" on public.transactions for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace members can delete transactions" on public.transactions for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can read campaigns" on public.campaigns;
drop policy if exists "workspace members can insert campaigns" on public.campaigns;
drop policy if exists "workspace members can update campaigns" on public.campaigns;
drop policy if exists "workspace members can delete campaigns" on public.campaigns;
create policy "workspace members can read campaigns" on public.campaigns for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workspace members can insert campaigns" on public.campaigns for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "workspace members can update campaigns" on public.campaigns for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace members can delete campaigns" on public.campaigns for delete to authenticated using (public.is_workspace_member(workspace_id));

drop policy if exists "workspace members can read settings" on public.workspace_settings;
drop policy if exists "workspace members can insert settings" on public.workspace_settings;
drop policy if exists "workspace members can update settings" on public.workspace_settings;
drop policy if exists "workspace members can delete settings" on public.workspace_settings;
create policy "workspace members can read settings" on public.workspace_settings for select to authenticated using (public.is_workspace_member(workspace_id));
create policy "workspace members can insert settings" on public.workspace_settings for insert to authenticated with check (public.is_workspace_member(workspace_id));
create policy "workspace members can update settings" on public.workspace_settings for update to authenticated using (public.is_workspace_member(workspace_id)) with check (public.is_workspace_member(workspace_id));
create policy "workspace members can delete settings" on public.workspace_settings for delete to authenticated using (public.is_workspace_member(workspace_id));
