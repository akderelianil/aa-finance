-- Drop the data model of the deleted convenience flows (installment, loan, term deposit, investment,
-- plans, card days, attachments). The ledger core and Gider/Gelir/Transfer do not use them.

drop view if exists card_due_status, loan_due_status, investment_holdings, contact_balances;
drop function if exists report_cash_flow;

-- The default trigger no longer looks at instrument_id.
create or replace function accounts_fill_defaults() returns trigger
language plpgsql set search_path to 'public' as $$
begin
    if new.currency is null then
        select base_currency into new.currency from groups where id = new.group_id;
    end if;
    if new.parent_id is null and new.template_key is null then
        new.parent_id := account_default_parent(new.group_id, new.type, new.subtype, new.system_key);
    end if;
    if new.subtype is null and new.parent_id is not null then
        select subtype into new.subtype from accounts where id = new.parent_id;
    end if;
    if new.code is null then
        new.code := account_next_code(new.parent_id);
    end if;
    return new;
end;
$$;

drop table if exists installments, installment_plans, investment_trades, instrument_prices, plans,
  loan_settings, deposit_settings, credit_card_settings, attachments;
alter table accounts drop column if exists instrument_id;
drop table if exists instruments;
drop function if exists month_day;
