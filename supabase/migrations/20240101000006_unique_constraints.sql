-- Add missing unique constraints needed for seed idempotency

-- accounts: legal_name should be unique
alter table accounts add constraint accounts_legal_name_key unique (legal_name);
