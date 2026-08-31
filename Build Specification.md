# Bebum Snack Bar — Stock Control System
## Build specification

**Version** 1.0 · **Date** 27 August 2026
**Prototype supplied** `Bar Control App.html`, `Bar Control System.xlsx`

This describes what to build. The prototype shows the workflow and the screens; it is
not production code. Everything below that says **MUST** is a requirement, not a
preference.

---

## 1. What the business does

Bebum Snack Bar runs two stock locations managed by two different teams:

- **The magazine (store/warehouse)** — receives crates from suppliers, issues crates
  to the bar. Managed by the store keeper.
- **The snack (bar)** — receives crates, sells individual bottles. Managed by the bar
  tender.

Each morning around 10:00 both locations are counted and the previous trading day is
closed out. A paper Control Report is filled in and signed by the store keeper, the
bar tender and the manager.

The system replaces that paper form. Its purpose is **not** convenience. It is to make
stock losses visible by requiring two independent records of every movement.

### 1.1 Why this matters for the build

The single most important property of this system is that **no one person can move
stock without a second person's record disagreeing with them.** Every design decision
below serves that. If a shortcut makes one person able to record both sides of a
movement, the shortcut is wrong even if it is more convenient.

---

## 2. Glossary

| Term | Meaning |
|---|---|
| **Magazine** | The warehouse. Holds full crates only. |
| **Snack** | The bar. Holds loose bottles. |
| **Crate** | A case of bottles. Size varies by drink: 6, 12, 15 or 24. |
| **Magazine rate** | Buying price, per crate. |
| **Snacks rate** | Selling price, per bottle. |
| **Issue** | Crates leaving the magazine for the snack. |
| **Receipt** | The bar's confirmation of what actually arrived. |
| **Trading day** | The business date a record belongs to. Set explicitly, never derived from a timestamp. |
| **Balance sales** | Cash the bar tender must physically hand over. |
| **Debt** | Drinks taken on credit. Reduces cash handed over, not profit. |

---

## 3. Roles and permissions

Three roles. A user has exactly one.

| Capability | Store Keeper | Bar Tendant | Manager |
|---|:--:|:--:|:--:|
| View everything | ✓ | ✓ | ✓ |
| Magazine ledger (opening, purchases, count) | ✓ | — | ✓ |
| Issue crates to the bar | ✓ | — | ✓ |
| Confirm receipt at the bar | — | ✓ | ✓ |
| Bar closing count | — | ✓ | ✓ |
| Cash lines (expenses, damage, shortage, debt) | — | ✓ | ✓ |
| Edit prices | ✓ | — | ✓ |
| Add a drink | ✓ | — | ✓ |
| Archive a drink | — | — | ✓ |
| Delete a drink | — | — | ✓ |
| Sign own role | ✓ | ✓ | ✓ |
| Sign any role | — | — | ✓ |
| Reopen a signed day | — | — | ✓ |
| Correct a figure owned by another role | — | — | ✓ |

**MUST:** permissions are enforced on the server. The client hides controls as a
courtesy; it is not the control. Every write request is authorised independently of
what the UI allowed.

**MUST:** a manager override is written to the audit log with an `override: true`
flag, because a manager acting as both sides defeats the two-record principle and
should be visible when it happens.

---

## 4. Data model

PostgreSQL assumed. Money is **integer XAF** — the currency has no minor unit. Never
use floating point for money.

### 4.1 Reference data

```sql
CREATE TABLE users (
  id            uuid PRIMARY KEY,
  display_name  text NOT NULL,
  role          text NOT NULL CHECK (role IN ('keeper','tender','manager')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE drinks (
  id                uuid PRIMARY KEY,
  name              text NOT NULL,
  bottles_per_crate int  NOT NULL CHECK (bottles_per_crate > 0),
  archived          boolean NOT NULL DEFAULT false,
  sort_order        int  NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX drinks_name_key ON drinks (lower(name));
```

### 4.2 Prices are effective-dated

This is the one place the prototype is wrong and **MUST NOT** be copied. The prototype
applies today's prices to every past day, so correcting a supplier price silently
changes last month's profit.

```sql
CREATE TABLE drink_prices (
  id             uuid PRIMARY KEY,
  drink_id       uuid NOT NULL REFERENCES drinks(id),
  effective_from date NOT NULL,
  buy_per_crate  int,                    -- NULL = not yet known
  sell_per_bottle int NOT NULL CHECK (sell_per_bottle > 0),
  created_by     uuid NOT NULL REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (drink_id, effective_from)
);
```

**MUST:** any calculation for trading day *D* uses the price row with the greatest
`effective_from <= D`. Changing a price today never alters a past day's figures.

**MUST:** `bottles_per_crate` changes are also effective-dated. Move it into
`drink_prices` if you prefer a single table; the requirement is that history is
immutable. Small Smooth changed from 12 to 15 during this project, which is exactly
the case that breaks a non-versioned design.

### 4.3 Trading days

```sql
CREATE TABLE trading_days (
  business_date date PRIMARY KEY,
  status        text NOT NULL DEFAULT 'open'
                CHECK (status IN ('open','locked')),
  opened_at     timestamptz NOT NULL DEFAULT now(),
  locked_at     timestamptz,
  version       int NOT NULL DEFAULT 0
);

CREATE TABLE day_signatures (
  business_date date NOT NULL REFERENCES trading_days(business_date),
  role          text NOT NULL CHECK (role IN ('keeper','tender','manager')),
  signed_by     uuid NOT NULL REFERENCES users(id),
  signed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_date, role)
);
```

### 4.4 The two ledgers

```sql
-- magazine, in crates
CREATE TABLE magazine_lines (
  business_date   date NOT NULL,
  drink_id        uuid NOT NULL REFERENCES drinks(id),
  opening_crates  int NOT NULL DEFAULT 0,
  purchased_crates int NOT NULL DEFAULT 0,
  counted_crates  int,                    -- NULL until counted
  counted_by      uuid REFERENCES users(id),
  counted_at      timestamptz,
  opening_overridden boolean NOT NULL DEFAULT false,
  version         int NOT NULL DEFAULT 0,
  PRIMARY KEY (business_date, drink_id)
);

-- snack, in bottles
CREATE TABLE bar_lines (
  business_date   date NOT NULL,
  drink_id        uuid NOT NULL REFERENCES drinks(id),
  opening_bottles int NOT NULL DEFAULT 0,
  counted_bottles int,                    -- NULL until counted
  counted_by      uuid REFERENCES users(id),
  counted_at      timestamptz,
  opening_overridden boolean NOT NULL DEFAULT false,
  version         int NOT NULL DEFAULT 0,
  PRIMARY KEY (business_date, drink_id)
);
```

`counted_* IS NULL` means *not yet counted*, and is **not** the same as zero. A drink
that has not been counted contributes nothing to sales. The prototype originally got
this wrong and reported a full day's revenue before anyone had counted a bottle.

### 4.5 Transfers — the audit spine

```sql
CREATE TABLE transfers (
  id                uuid PRIMARY KEY,
  business_date     date NOT NULL,
  drink_id          uuid NOT NULL REFERENCES drinks(id),
  issued_crates     int  NOT NULL CHECK (issued_crates > 0),
  issued_by         uuid NOT NULL REFERENCES users(id),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  received_crates   int  CHECK (received_crates >= 0),
  received_by       uuid REFERENCES users(id),
  received_at       timestamptz,
  status            text NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','confirmed','cancelled')),
  cancel_reason     text
);
```

**MUST:** `issued_by` and `received_by` are different users, unless the acting user is
a manager, in which case the audit entry is flagged as an override. This constraint is
the system.

**MUST:** a transfer is never edited after confirmation. To correct one, cancel it
(reason required) and raise a new one. Both remain visible.

**MUST:** `bar_lines` has no writable "received" column. Bottles received are derived:

```
received_bottles(date, drink) =
  SUM(received_crates) * bottles_per_crate
  FROM transfers
  WHERE status='confirmed' AND business_date=date AND drink_id=drink
```

### 4.6 Cash

```sql
CREATE TABLE day_cash (
  business_date date PRIMARY KEY REFERENCES trading_days(business_date),
  recovered     int NOT NULL DEFAULT 0,
  damaged       int NOT NULL DEFAULT 0,
  expenses      int NOT NULL DEFAULT 0,
  expense_note  text,
  shortage      int NOT NULL DEFAULT 0,
  debt          int NOT NULL DEFAULT 0,
  debt_note     text,
  version       int NOT NULL DEFAULT 0
);
```

Consider a separate `expense_lines` table if they want expenses itemised. The paper
form has one line, so one line is enough for version 1.

### 4.7 Audit log

```sql
CREATE TABLE audit_log (
  id            bigserial PRIMARY KEY,
  at            timestamptz NOT NULL DEFAULT now(),
  actor_id      uuid NOT NULL REFERENCES users(id),
  actor_role    text NOT NULL,
  business_date date,
  entity        text NOT NULL,        -- 'magazine_line','transfer','price', ...
  entity_key    text NOT NULL,
  field         text,
  old_value     text,
  new_value     text,
  override      boolean NOT NULL DEFAULT false,
  request_id    uuid
);
```

**MUST:** append-only. `REVOKE UPDATE, DELETE ON audit_log FROM app_user`. No API
path writes to it directly; it is written by the same transaction as the change,
ideally by a database trigger so it cannot be bypassed.

**MUST:** every write to `magazine_lines`, `bar_lines`, `transfers`, `day_cash`,
`drink_prices`, `drinks` and `day_signatures` produces an audit row.

---

## 5. The arithmetic

**MUST** be computed on the server. The client may compute the same values for instant
feedback, but the server's answer is authoritative and the client must reconcile to it.

### 5.1 Per drink, per day

```
supply_bottles   = received_bottles                       (see 4.5)
total_bottles    = opening_bottles + supply_bottles
sold_bottles     = total_bottles - counted_bottles        (NULL if not counted)

sales            = sold_bottles * sell_per_bottle
cost_of_sales    = sold_bottles * buy_per_crate / bottles_per_crate
gross_profit     = sales - cost_of_sales
```

**Rounding:** `buy_per_crate / bottles_per_crate` is frequently not an integer
(8,500 ÷ 12 = 708.333…). Compute `cost_of_sales` as
`ROUND(sold_bottles * buy_per_crate / bottles_per_crate)` — multiply first, divide and
round once, at the end. Do not round the per-bottle cost and then multiply; across a
month that drifts by thousands.

Use `numeric`, not `float`.

### 5.2 Magazine variance

```
expected_crates = opening_crates + purchased_crates - SUM(issued_crates)
variance        = expected_crates - counted_crates      (NULL if not counted)
```

Note this uses **issued**, not received. The magazine is accountable for what left it.

### 5.3 Transfer variance

```
transfer_gap = issued_crates - received_crates           (per confirmed transfer)
```

### 5.4 Carry-forward

When trading day *D* is first opened, for each non-archived drink:

```
bar_lines.opening_bottles(D)     = counted_bottles(D-1)  if counted
                                 = opening_bottles(D-1)  if not counted
magazine_lines.opening_crates(D) = counted_crates(D-1)   if counted
                                 = expected_crates(D-1)  if not counted
```

"D-1" means the most recent trading day before D that has records, not literally the
previous calendar date.

**MUST:** if a user edits an opening figure, set `opening_overridden = true` and never
re-apply carry-forward to that line. **MUST:** an overridden opening that differs from
the carried value raises a *shelf variance* warning — this is how overnight loss is
detected, so it must not be silently swallowed.

### 5.5 Day totals

```
sales          = SUM(sales) over counted drinks
cost_of_sales  = SUM(cost_of_sales) over counted drinks
gross_profit   = sales - cost_of_sales
deductions     = damaged + expenses + shortage
net_profit     = gross_profit - deductions
balance_sales  = sales + recovered - deductions - debt
```

Debt is excluded from profit deliberately. It is owed, not lost. Repayment is recorded
as `recovered`.

### 5.6 Stock valuation

```
magazine_value = SUM(crates_held * buy_per_crate)
```

Report magazine value and bar value separately. Do not add them into a single
"capital" figure — they are different teams' accountability and the business asked for
them kept apart.

---

## 6. Day lifecycle

```
        ┌─────────┐  three signatures   ┌────────┐
        │  open   │ ──────────────────► │ locked │
        └─────────┘                     └────────┘
             ▲                               │
             └──── manager reopen ───────────┘
                   (audited, clears signatures)
```

- A day is created on first write to it.
- Signatures are per role. A role signs once.
- When all three roles have signed, `status` becomes `locked`.
- **MUST:** while `locked`, every write to that day's lines, transfers, cash and
  signatures is rejected with `409 DAY_LOCKED`. Manager included — the manager reopens
  first, which is itself audited.
- Reopening clears all three signatures and writes an audit row.
- **MUST:** signing is rejected if any transfer for that day is still `pending`.
  An unconfirmed transfer means the two teams have not reconciled.

---

## 7. The three checks

These are the product. Surface them prominently, do not bury them in a report.

| Check | Compares | Owner | Meaning when it fires |
|---|---|---|---|
| **Magazine** | counted crates vs expected | Store keeper | Crates missing from the store |
| **Transfer** | issued vs received | Both | Crates lost between store and bar |
| **Shelf** | today's opening vs yesterday's close | Bar tender | Bottles gone overnight |

**MUST:** each check names the two people whose records disagree. A variance with no
name attached is a number nobody owns.

A fourth signal worth adding: `sold_bottles < 0` means the count exceeds what was
available. Always a data-entry error or an unrecorded delivery. Flag immediately at
entry, not at month end.

---

## 8. What must be server-side

Everything below is currently client-side in the prototype and **MUST** move:

| Rule | Why |
|---|---|
| Role permissions | Otherwise anyone edits anything from the console |
| All money arithmetic | Otherwise a phone can report whatever profit it likes |
| Price lookup by date | Client has no business choosing which price applied |
| Locked-day rejection | A signed day must be immovable |
| Transfer state machine | The two-record guarantee lives here |
| Audit writes | Must be unbypassable |
| Delete-guard on drinks | Deleting a drink with history corrupts past months |

The client keeps: input handling, offline queueing, optimistic display, and the
variance highlighting shown in the prototype.

---

## 9. API sketch

REST, JSON, bearer token. All mutations take `If-Match: <version>` and return
`409 VERSION_CONFLICT` on mismatch — the three users work simultaneously and
last-write-wins is not acceptable for stock figures.

```
POST   /auth/login
GET    /days/{date}                    full day: lines, transfers, cash, totals, checks
POST   /days/{date}/magazine/{drinkId} { opening_crates?, purchased_crates?, counted_crates? }
POST   /days/{date}/bar/{drinkId}      { opening_bottles?, counted_bottles? }
POST   /days/{date}/transfers          { drinkId, issued_crates }
POST   /transfers/{id}/receive         { received_crates }
POST   /transfers/{id}/cancel          { reason }
PUT    /days/{date}/cash               { recovered, damaged, expenses, ... }
POST   /days/{date}/sign               { role }
POST   /days/{date}/reopen             { reason }          manager only
GET    /months/{yyyy-mm}               daily series + per-drink totals
GET    /drinks                         GET/POST/PATCH; DELETE guarded
POST   /drinks/{id}/prices             { effective_from, buy_per_crate, sell_per_bottle }
GET    /audit?date=&drink=&actor=
```

`GET /days/{date}` should return everything one screen needs in one call. The bar has
poor connectivity; chatty APIs will make it unusable.

---

## 10. Offline

Not optional. The count happens in a store room, and the network drops.

- **MUST:** the app works fully offline for a whole count and syncs when connectivity
  returns.
- **MUST:** queued mutations carry a client-generated `request_id`; the server
  deduplicates on it so a retry cannot double-issue a transfer.
- **MUST:** on conflict, show both values and let the person choose. Never silently
  discard a count someone spent twenty minutes taking.
- Transfers are the risky case: an issue raised offline and confirmed offline on
  another phone cannot reconcile until both sync. Show pending-sync state clearly.

---

## 11. Non-functional

| Item | Requirement |
|---|---|
| **Currency** | XAF, integer, no minor unit. Display grouped: `272,500`. |
| **Timezone** | Africa/Douala (UTC+1). Store timestamps as `timestamptz`. |
| **Trading day** | A `date`, chosen explicitly by the user. Never derived from `now()`. The count at 10:00 belongs to the previous day. |
| **Language** | English now. Keep strings externalised — French is likely. |
| **Devices** | Android phones, mid-range, small screens, one hand, poor light. |
| **Scale** | ~35 drinks, ~3 users, ~400 records a day. Tiny. Optimise for reliability, not throughput. |
| **Backups** | Nightly automated, restore tested. Also a monthly CSV/Excel export the owner keeps himself. |
| **Retention** | Never hard-delete a trading day. |

---

## 12. Acceptance tests

Ship when these pass.

1. Store keeper issues 5 crates of Export. Bar tender's phone shows a pending
   delivery. Bar confirms 4. Both records persist; the gap shows on both phones and
   names both people.
2. Bar tender attempts to record a receipt with no matching issue → rejected.
3. Store keeper attempts to confirm his own issue → rejected. Manager may, and the
   audit row is flagged `override`.
4. Magazine: opening 40, purchased 10, issued 5, counted 43 → "2 crates short".
   Counted 45 → "balances".
5. Drink uncounted at the bar → contributes 0 to sales, not a full shelf.
6. Day D closing 27, day D+1 opening pre-filled 27 with no warning. Change it to 19 →
   shelf variance of 8 raised against the bar tender.
7. Three signatures → day locks. Every write rejected, manager included.
8. Manager reopens → signatures cleared, audit row written, writes accepted.
9. Signing rejected while any transfer is pending.
10. Buying price changed today → last month's gross profit is byte-identical to
    before the change.
11. Drink with history: delete rejected, archive offered. Archived drink leaves the
    working lists; last month's totals unchanged.
12. Two phones edit the same line concurrently → second gets `409`, is shown both
    values, chooses.
13. Full count taken offline in flight mode, then reconnect → all lines sync, nothing
    lost, nothing duplicated.
14. Load the 22 August 2026 data: sales **272,500**, cost of drinks **196,217**,
    gross profit **76,283**, expenses 500, debt 11,000, balance sales **261,000**.
    Sales and balance must match the paper report exactly.
15. Audit query for one drink on one day returns every change with actor, role,
    timestamp, old and new value.

---

## 13. Out of scope for version 1

Worth knowing about, worth resisting for now.

- Point of sale / per-transaction sales. This system counts stock, it does not ring up
  drinks. Adding POS changes the whole shape.
- Supplier accounts, invoices, payables.
- Multiple bars. The schema tolerates a `location_id` later; do not build it yet.
- Payroll, shift rotas.
- Automatic reorder suggestions. Get a clean count history first.

---

## 14. Open questions for the owner

Answer these before writing code.

1. **Booster Gin and Booster Mango** selling prices — assumed 1,000, unconfirmed.
2. **Late-day transfers.** Crates issued at 09:00, confirmed at 10:00 during the
   count. Which trading day? Recommendation: the day the *issue* was raised, with the
   bar's confirmation allowed to arrive after — but the business must decide.
3. **Count before or after restocking?** If crates go to the bar at 09:00 and the
   count is at 10:00, the shelf variance fires every morning. The count must precede
   restocking, or the model needs a cut-off time.
4. **Damage and staff drinks.** Currently only a cash deduction, so the bottles never
   leave the stock count and the shelf silently drifts. Recommendation: record them as
   bottles, not just money.
5. **Who resolves a variance, and what happens then?** The system will surface
   shortages. It has no opinion about consequences. It needs one, or it will be
   ignored within a month.

---

## Appendix A — reference data

31 drinks, both rates confirmed 27 August 2026. Full table in `Price List.csv`.
Margins run 13.3% to 58.3%, clustering near 29.2% on beer. Seed `drinks` and
`drink_prices` from that file with `effective_from = '2026-08-01'`.

## Appendix B — the prototype

`Bar Control App.html` runs standalone in a browser. Use it to see the intended
screens and the count interaction, particularly:

- the −/+ stepper on the closing count, which lets the bar tender work without the
  keyboard
- the pending-delivery block at the top of the Bar tab
- the variance wording on the magazine ledger
- progress indicators during a count

Do not port its storage layer, its permission checks or its price handling. All three
are prototype-grade and are described correctly above.
