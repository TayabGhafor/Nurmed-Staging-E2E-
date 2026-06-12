# Iframe Embed — What We Changed and Why (Plain-English Version)

This doc explains, in everyday language, the frontend changes that let a
hospital's software (their "EHR") show a **logged-in Nurmed screen inside a
window-within-a-window** (an "iframe"), without the doctor having to log in
again.

No code knowledge needed. If you want the technical version, see
`IFRAME_EMBED_HANDOFF.md` and `IFRAME_EMBED_FRONTEND_GUIDE.md`.

---

## The goal in one sentence

A doctor is already working inside the hospital's system. We want Nurmed to
appear **right there inside that system**, already logged in, so the doctor
never leaves their screen or types a password.

Think of it like embedding a YouTube video inside a blog post — except instead
of a video, it's the whole Nurmed app, and it needs to be securely signed in.

---

## Why this is hard (the short story)

Browsers are **very suspicious** of one website showing another website inside
it. They worry about scams (a fake site secretly framing a real bank login).
So browsers add several locked doors by default. To make the embed work, we had
to politely open the *specific* doors we need — and only those — without
weakening security.

Below are the doors, and what we did for each.

---

## Door #1 — "Are you even allowed to show me inside a frame?"

**The problem:** By default, many websites tell the browser "never display me
inside another site's window." If Nurmed did that, the hospital screen would
show a blank box or an error.

**What we did:** We added a setting (a "frame-ancestors" rule) that says
*"Nurmed is allowed to be framed, but ONLY by these specific approved hospital
addresses."* It's an explicit guest list, not an open door.

**Why it's safe:** Random websites still can't frame Nurmed — only the hospitals
we name on the list can. Today the list contains the test page; before go-live
the real hospital's web address gets added.

---

## Door #2 — "You don't have a pass, go back to the login page"

**The problem:** Nurmed checks for a "pass" (a login cookie) on every page. When
the embedded page first loads, that pass doesn't exist yet — so the system would
immediately kick the user out to the login screen before the magic could happen.

**What we did:** We marked the special embed entry page as a **"no pass needed
to enter"** page, so it's allowed to load and do its sign-in work instead of
being bounced.

---

## Door #3 — The actual sign-in (the clever part)

**The problem:** The normal "click the email magic link to log in" method does
**not** work inside a frame. The browser blocks it for security reasons, and the
doctor just sees a spinner forever.

**What we did:** We built a **new dedicated entry page** (`/embed`). Here's what
it does, in plain steps:

1. The hospital's system hands us a **one-time ticket** (a short code that's
   valid for only ~2 minutes and can be used only once).
2. Our entry page quietly trades that ticket — **behind the scenes,
   computer-to-computer** — for a real login.
3. The doctor lands on their Nurmed dashboard, already signed in.

**Why it's safe:** The doctor's browser never has to talk to the sensitive login
servers directly (which is what the browser was blocking). And the one-time
ticket is useless after a couple of minutes or after one use, so it can't be
stolen and reused.

---

## Door #4 — The "vanishing pass" problem (the bug you hit)

**The problem:** This is the one that caused the "after recording I can't access
the session" issue.

Inside a frame, the login pass (cookie) must be a special "shareable" type, or
the browser refuses to carry it. Our system was correctly setting it to the
shareable type at sign-in — **but** every so often the app automatically renews
the login in the background (this is normal and happens during a long recording).
When it renewed, it **accidentally re-stamped the pass as the non-shareable
type**. The browser then stopped honoring it inside the frame, and the doctor
got bounced to the login screen.

**What we did:** We taught the app to **recognize when it's running inside a
frame** and, in that case, *always* stamp the pass as the shareable type —
including during those automatic background renewals. So the pass no longer
"vanishes" mid-session.

**Important:** When Nurmed is used normally (in its own browser tab, not framed),
nothing changes — it keeps using the stricter, safer pass type. The shareable
type is only used inside a frame, where it's required.

---

## Door #5 — "This frame can't use the microphone"

**The problem:** Nurmed needs the microphone to record. But browsers **block
the microphone inside a frame by default**, even if the doctor already gave
Nurmed mic permission. So recording silently failed.

**What we did:** The microphone permission has to be **handed down** from the
outer hospital page to the inner Nurmed frame. On our test page we added that
"hand-down" instruction (`allow="microphone; camera"`).

**Action needed from the hospital:** The hospital's developers must add the
**same hand-down instruction** to their frame on their side. We cannot do this
for them — it lives in their code. Without it, the mic will not work in their
system no matter what we do.

---

## Summary table

| What we opened | Plain meaning | Who controls it |
|---|---|---|
| Frame-ancestors rule | "Only approved hospitals may frame Nurmed" | Nurmed (add hospital's address) |
| Embed page is public | "Let the sign-in page load instead of bouncing it" | Nurmed |
| New `/embed` sign-in | "Trade a one-time ticket for a real login, safely" | Nurmed |
| Shareable login pass | "Keep the login working inside the frame, even after auto-renewal" | Nurmed |
| Microphone hand-down | "Allow the frame to use the mic" | **Both** — Nurmed test page + **hospital must add it too** |

---

## What still needs checking before real hospitals use it

1. **Add each real hospital's web address** to the approved frame list.
2. **The hospital must add the microphone hand-down** to their frame.
3. **The big unknown — Safari and strict privacy browsers.** Some browsers
   (notably Safari, and Chrome's stricter future settings) **block shared
   passes across sites entirely**, as an anti-tracking measure. If that happens,
   the doctor would still get bounced to login inside the frame — and the fix
   above can't help, because the browser is dropping the pass before our code
   ever sees it. The backup plan if that occurs is a newer cookie technology
   called **"Partitioned cookies" (CHIPS)**. We only build that if testing in
   those browsers shows we need it.
4. **One ticket per open.** The hospital's system must request a **fresh
   one-time ticket every time** it opens the Nurmed frame (the ticket can't be
   reused).

---

*Last updated: 2026-06-10 · Applies to: `staging`*
