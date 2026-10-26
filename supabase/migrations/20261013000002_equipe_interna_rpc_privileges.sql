-- Defense in depth: remove direct anon grants that may survive from default ACLs.
revoke all on function public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date) from public, anon;
revoke all on function public.admin_internal_team_graph() from public, anon;
revoke all on function public.admin_internal_team_catalogs() from public, anon;
revoke all on function public.admin_internal_team_list() from public, anon;
revoke all on function public.admin_internal_team_catalog_upsert(text,uuid,text,text,boolean) from public, anon;

grant execute on function public.admin_internal_team_update(uuid,uuid,uuid,uuid,text,date) to authenticated;
grant execute on function public.admin_internal_team_graph() to authenticated;
grant execute on function public.admin_internal_team_catalogs() to authenticated;
grant execute on function public.admin_internal_team_list() to authenticated;
grant execute on function public.admin_internal_team_catalog_upsert(text,uuid,text,text,boolean) to authenticated;
