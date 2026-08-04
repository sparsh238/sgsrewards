# Known issues / future bugfix backlog

Deferred findings from the 2026-08 code review. None are blocking; each notes what's
wrong, when it would actually bite, and a suggested fix. (The high/medium findings from
that review were already fixed — see the "Code-review fixes" commit.)

---

## 1. Editing a birthday/anniversary can shift it a day (timezone)
- **Where:** `frontend/src/screens/admin/Users.tsx` (`toInput`, EditDealerModal) and `frontend/src/screens/Profile.tsx` (`toInput`).
- **What:** the edit form derives the date value in UTC (`new Date(d).toISOString().slice(0,10)`), while the read-only view shows it in local time. For a date stored at a non-UTC-midnight instant (e.g. imported/legacy data at IST midnight), the edit form shows the **previous day**, and saving persists the shift.
- **When it bites:** only for dates not entered through this app (app-entered dates are UTC-midnight and safe).
- **Fix:** format the date from its `YYYY-MM-DD` slice without a `Date` round-trip (as `Bills.tsx` already does), or normalise to a date-only value on save.

## 2. Editing an old bill can make its tier label and points disagree
- **Where:** `backend/src/controllers/billController.ts` (`editBill`).
- **What:** `editBill` recomputes points at the dealer's **current** tier but leaves the bill's stored `tierAtBill` unchanged. After a tier change, an edited bill can show one tier while its points reflect another.
- **When it bites:** edit an old bill after the dealer's tier has changed. Arguably intended (re-price at today's rate) — flagging the inconsistency.
- **Fix:** either update `tierAtBill` to the current tier on edit, or reprice using the stored `tierAtBill`.

## 3. "Bill X more to unlock" is rounded (~₹5k)
- **Where:** `frontend/src/lib/format.ts` (`formatRupees` / `compact`).
- **What:** the compact display rounds to 0.1 lakh, so a reward's unlock hint can read "₹3.5L more" when the exact figure is ₹3,45,000.
- **When it bites:** cosmetic; the Product goal hint only.
- **Fix:** use a precise formatter for that one hint, or show the exact rupee figure there.

## 4. Small admin-only validation rough edges
- **Where:** `backend/src/controllers/superAdminController.ts`, `backend/src/models/systemModel.ts`.
- **What:**
  - `updateTierBillingRequirements` overwrites all six (required) tier keys — a PUT that omits one returns a 500 instead of keeping the old value.
  - `resetPassword` for a customer with an empty new secret returns "PIN must be exactly 4 digits" instead of "a new PIN/password is required" (validation order).
  - `systemModel` interface uses `Unranked` while the schema/consumers use `NoTier` (TypeScript-only mismatch; runtime is fine).
- **When it bites:** only unusual admin input.
- **Fix:** merge-update the requirements (don't require all keys on PUT); reorder the empty check before the PIN-format check; rename `Unranked` → `NoTier` in the interface.

## 5. A broken tier config would show "Bill ₹0 more or you drop"
- **Where:** `frontend/src/lib/tier.ts` (`computeNudge`).
- **What:** if a non-NoTier tier has no entry in `tierBillingRequirements`, `keepReq` is null → state becomes `risk` with `toKeep = 0`, so the nudge reads "Bill **₹0** more or you drop."
- **When it bites:** only if the tier settings themselves are misconfigured.
- **Fix:** guard for a missing requirement and show a neutral state instead of a risk line.

## 6. Auth token model — random logouts FIXED (full rebuild optional)
- **Where:** `backend/src/middleware/authMiddleware.ts`.
- **Was:** the middleware required the incoming bearer to equal the stored `refreshToken`
  field, which rotates on every login — so any re-login or token refresh silently
  invalidated other sessions (the random logouts).
- **Fixed:** the middleware now authenticates by the token's `_id` alone (any signed,
  unexpired JWT), and rejects blocked users. Sessions survive backend restarts and
  concurrent logins. Non-breaking — existing stored tokens keep working.
- **Optional future cleanup (not fragility-related):** the client still sends the
  *refresh* token as its bearer (login stores `data.refreshToken`), and server-side
  logout (`refreshToken = null`) no longer revokes a live token — it stays valid until
  expiry. A full redesign would use a short access token + a real refresh flow and
  re-add server-side revocation. Low priority now that the logouts are gone.
