-- Fix handle_new_user trigger: set search_path explicitly for SECURITY DEFINER functions
-- This is required in Supabase Cloud where the auth schema runs with a different search_path

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'role', '')::public.user_role,
      'assistant'::public.user_role
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Re-create the trigger to ensure it points to the updated function
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
