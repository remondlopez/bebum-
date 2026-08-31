# Bebum Snack Bar — Control System

A spreadsheet and a phone app that do the job of your paper Control Report:
warehouse stock, bar stock, sales, expenses, and the three signatures.

---

## What is in this folder

| File | What it is |
|---|---|
| **Bar Control System.xlsx** | The full system. Seven sheets. Works offline, on any laptop. |
| **Bar Control App.html** | The phone version. Open it in a browser. |
| **Bar Control App.css** | The phone app's stylesheet, loaded by the HTML file. |
| **Bar Control App.js** | The phone app's JavaScript, loaded by the HTML file. |
| **Price List.csv** | All 31 drinks with crate size, buying price, selling price and margin. |
| **Build Specification.md** | For a developer. Everything needed to build the real version. |
| **README.md** | This file. |

Start with the spreadsheet. It is the one that keeps your records safely.

## Authenticated app access

The phone app uses Supabase email/password authentication. Create each user in
Supabase Authentication, then set their User Metadata to include a role:

```json
{"name":"John","role":"tender"}
```

Valid roles are `keeper`, `tender`, and `manager`. Run `Supabase RLS Setup.sql`
in the Supabase SQL Editor after creating the `daily_records` and `app_catalog`
tables. This blocks anonymous shared-data access and limits catalog changes to
the keeper and manager roles.

The prototype stores a whole day in one JSON document, so the browser still
enforces the Store, Bar, Cash, and Report field permissions. True server-side
field-level permissions require moving those JSON sections into separate
database tables.

---

## The spreadsheet

Open **Bar Control System.xlsx** and read the **Start Here** sheet first.

**Blue text means you type there. Black text is a formula — leave it alone.**

| Sheet | Used for |
|---|---|
| Start Here | Instructions and the colour legend |
| Drinks | The 31 drinks: crate size, buying price, selling price |
| Daily Entry | One row per drink per day. The engine. |
| Daily Cash | Your Control Sheet of Business Trend, one row per day |
| Control Report | Printable, same layout as your paper form, signature lines included |
| Dashboard | Any date range: sales, profit, and which drinks actually earn |

### Every closing

1. **Daily Entry** — add a row per drink. Type the date, drink, warehouse opening
   and purchase, crates sent to the bar, the bar's opening quantity, and the bar's
   closing count. Sold quantity, sales, cost and profit calculate themselves.
2. **Daily Cash** — add that date and enter expenses, damages, shortage and debt.
   *Balance Sales* is the cash the bar tender should hand over.
3. **Control Report** — change the yellow date at the top and print it.

### The formulas

```
Warehouse closing  = opening crates + purchases − crates sent to the bar
Bar supply         = crates sent to the bar × bottles per crate
Sold               = bar opening + supply − bar closing count
Sales              = sold × selling price
Balance sales      = sales + recovered − damaged − expenses − shortage − debt
Net profit         = gross profit − damaged − expenses − shortage
```

Debt is money still owed to you, so it reduces the cash handed over but not the profit.

### Carry-over check

Column S of Daily Entry compares each day's opening against the previous day's
closing and turns red when they disagree. That is your shortage detector, and it is
the main thing paper cannot do for you.

---

## The phone app

Open **Bar Control App.html** in any browser. Five tabs.

| Tab | Who uses it |
|---|---|
| **Store** | Warehouse team — crates in from suppliers, issuing stock to the bar, counting the store |
| **Bar** | Bar team — confirming deliveries, counting the shelf |
| **Cash** | Bar team — expenses, damages, shortage, debt |
| **Report** | Everyone — totals, warnings, prices, signatures, audit log |
| **Month** | Manager — revenue and profit by month, best days, best drinks |

### The three jobs

On first open, each person enters their name and picks a job.

- **Store Keeper** — warehouse ledger, issuing stock to the bar, buying prices, adding brands
- **Bar Attendant** — confirming what arrives, counting the shelf, the cash lines
- **Manager** — everything, plus archiving brands and reopening a signed day

Fields outside your job are visible but greyed out. Everyone sees the whole picture;
only one person can change each number.

### The audit chain

This is the part that matters.

1. The store keeper issues crates. It shows as **"not yet confirmed by the bar"**.
2. The bar tender counts what actually arrived and confirms it.
3. If the numbers differ, both are kept: *"5 crates issued by Ndifor, only 4 received by Ayuk."*

The bar cannot type "crates in" by hand. Received stock comes only from a confirmed
transfer. Three checks then run independently, each owned by a different person:

- **Warehouse** — crates counted against crates expected
- **Transfer** — issued against received
- **Bar shelf** — last night's closing against this morning's opening

Every edit is stamped with a name and a time and shown on the Report tab.

### Signing off

Each role signs on the Report tab. When all three have signed the day locks and no
figure can change. Only the manager can reopen it, and the reopening is recorded too.

### Adding and removing brands

**Report tab → Prices → Add a brand.** Store keeper or manager.

Removing has two options:

- **Archive** (manager) — the brand leaves the working lists but all its past
  figures still count. Use this for a drink you have stopped stocking.
- **Delete** (manager) — only allowed for a brand with no records anywhere. If it has
  history, the app refuses and tells you to archive instead. Deleting a brand that
  had sales would quietly change past months' totals.

---

## Your prices

Both rates are loaded and confirmed.

- **Magazine rate** — what you pay per crate
- **Snacks rate** — what the customer pays per bottle

All 31 margins are positive, running from 13% to 58% and clustering near 29% on beer.
See **Price List.csv** for the full table.

**Two still to confirm:** Booster Gin and Booster Mango were not on the snacks rate
list. Both are set at 1,000, the same as Booster Cola.

### Four figures your earlier sheets had wrong

| Drink | Was | Should be |
|---|---|---|
| Small Smooth | 12 a crate — a loss of 83 a bottle | **15 a crate**, 133 profit |
| Malta Guinness | 12 a crate at 17,000 — a loss of 417 a bottle | **24 a crate at 15,000**, 375 profit |
| Heineken | 1,500 a crate — a 92% margin | **24 a crate at 21,000**, 625 profit |
| Supper Mount | 12 a crate — a 76% margin | **6 a crate**, 258 profit |

---

## What I found in your 22 August report

- **Castel Beer** — the row reads 14 sold, but 16 + 60 − 57 = 19. Your own column
  total of 272,500 only works with 19, so it is a slip of the pen.
- **Mutzig, Castel Beer, Isenbeck** — crates counted as warehouse closing stock *and*
  issued to the bar as supply. The same crates cannot be in both places.
- **Castel Milk** — 4 crates × 5,500 is 22,000, but the sheet shows 34,000.

With both rates confirmed, 22 August works out at:

```
Sales            272,500
Cost of drinks   196,217
Gross profit      76,283
Expenses             500   (photocopy)
Net profit        75,783
Debt              11,000   (staff)
Cash to hand over 261,000
```

Your handwritten sales and balance figures match exactly. Your handwritten profit was
70,462, about 5,800 below this. That gap is no longer explained by prices.

---

## Limits you should know about

**The app does not keep records on its own.** Opened from this folder, it works for
the session but forgets everything when closed, and the three phones do not share
data. It is here to show the workflow, not to run the bar.

**The spreadsheet is your record of truth.** Keep it on one machine and save a dated
copy every week. A spreadsheet is only as safe as its last backup.

**The job is a name badge, not a password.** Anyone with the link can pick any role.
For three people who work together, the audit trail is the deterrent. If you need it
enforced, you need real logins.

---

## When you are ready for the real thing

The workflow is now settled, which is the hard part. To get shared, permanent records:

1. **Google Sheets + AppSheet or Glide** — your spreadsheet becomes the database and
   the phone app sits on top. Staff logins, syncs when the network returns, roughly
   5–10 US dollars per user per month. For one bar this is usually the right answer.
2. **A hosted database** (Supabase or Firebase) behind a custom app — full audit
   trail and enforced roles, but you need a developer and ongoing maintenance.
3. **Off-the-shelf bar POS** — handles storage, but most cannot model your
   warehouse-to-snack crate transfer, which is the part you actually care about.

Hand them **Build Specification.md**. It has the database schema, the role permissions,
the arithmetic with its rounding rules, the transfer state machine, what must run on the
server rather than the phone, and fifteen acceptance tests to sign the work off against.

---

## Still open

- Confirm the selling price of **Booster Gin** and **Booster Mango**.
- Agree a rule for stock issued late in the day: if the store issues crates at 9am
  and the bar confirms at 10am during the count, whose trading day does it belong to?
- Check that the bar's shelf count is taken **before** any restocking for the new day.
  If crates go out at 9am and the count happens at 10am, the carry-over warning will
  fire every morning.
