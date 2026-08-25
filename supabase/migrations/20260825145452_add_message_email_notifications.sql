-- Per-project notification email: notified when a CLIENT sends a message on this project.
alter table public.projects
  add column if not exists notification_email text;

comment on column public.projects.notification_email is
  'Email address notified when a client sends a message on this project.';

-- Per-message, opt-in list of client profile IDs the admin chose to email
-- when sending a message (populated by the admin UI compose selector).
alter table public.client_messages
  add column if not exists notify_recipient_ids uuid[];

comment on column public.client_messages.notify_recipient_ids is
  'Client profile IDs the admin chose to email for this specific message (opt-in, per-message). Null/empty = no email sent.';

-- Required for the DB -> Edge Function webhook call below.
create extension if not exists pg_net;

-- Generate (once) a random shared secret used to authenticate the webhook call
-- from Postgres to the send-message-notification Edge Function. The value is
-- generated here so it is never stored in plaintext in a migration file; it is
-- retrieved separately (out of band) to configure the matching Edge Function secret.
do $$
begin
  if not exists (
    select 1 from vault.secrets where name = 'message_notification_webhook_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'message_notification_webhook_secret'
    );
  end if;
end $$;

create or replace function public.notify_new_client_message()
returns trigger
language plpgsql
security definer
set search_path = public, vault, extensions, net
as $$
declare
  v_secret text;
begin
  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'message_notification_webhook_secret';

  if v_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := 'https://lvnoveggrifsqjwzixzl.supabase.co/functions/v1/send-message-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    body := jsonb_build_object(
      'id', NEW.id,
      'project_id', NEW.project_id,
      'sender_id', NEW.sender_id,
      'message', NEW.message,
      'created_at', NEW.created_at,
      'notify_recipient_ids', NEW.notify_recipient_ids
    ),
    timeout_milliseconds := 5000
  );

  return NEW;
end;
$$;

revoke all on function public.notify_new_client_message() from public;

drop trigger if exists on_client_message_insert_notify on public.client_messages;

create trigger on_client_message_insert_notify
  after insert on public.client_messages
  for each row
  execute function public.notify_new_client_message();
