import Link from "next/link";
import { Container, PageHeader } from "@/app/components/ui";

// Must be dynamic: the shared layout reads the login cookie to pick the nav
// (admin vs cleaner) and theme. Prerendering this route statically would bake
// in "no session" and demote a manager to the cleaner view.
export const dynamic = "force-dynamic";

// A standalone, no-login-needed walkthrough for cleaners. Mirrors the real
// in-app labels so the steps match what they see.

function Step({
  n,
  children,
  manager = false,
}: {
  n: number;
  children: React.ReactNode;
  manager?: boolean;
}) {
  return (
    <li className="flex gap-3">
      <span
        className={`tnum mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          manager
            ? "border border-line-strong bg-surface-3 text-ink-tertiary"
            : "bg-red text-bone"
        }`}
      >
        {n}
      </span>
      <span className="text-sm leading-relaxed text-ink-secondary">
        {children}
        {manager && (
          <span className="ml-2 whitespace-nowrap rounded-full border border-line-strong bg-surface-3 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            Manager
          </span>
        )}
      </span>
    </li>
  );
}

function Card({
  id,
  title,
  kicker,
  children,
}: {
  id: string;
  title: string;
  kicker?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 rounded-card border border-line bg-surface-2 p-5 shadow-e1">
      {kicker && (
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {kicker}
        </p>
      )}
      <h2 className="mt-0.5 font-display text-lg font-bold text-ink-primary">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Inline reference to a button/label in the app. */
function B({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[4px] border border-line-strong bg-surface-3 px-1.5 py-0.5 text-xs font-semibold text-ink-primary">
      {children}
    </span>
  );
}

export default function GuidePage() {
  return (
    <Container>
      <PageHeader eyebrow="How to use Par" title="How Par works">
        <Link
          href="/"
          className="rounded-control border border-line-strong bg-surface-3 px-3 py-2 text-sm font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary"
        >
          ← Back to units
        </Link>
      </PageHeader>

      {/* Jump straight to the part you need — the page is a long one. */}
      <nav aria-label="Sections" className="mb-5 flex flex-wrap gap-2">
            <a href="#two-kinds-of-inventory-two-rules" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">Two kinds of inventory, two rules</a>
            <a href="#the-30-second-clean-routine" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">The 30-second clean routine</a>
            <a href="#some-bedding-is-bagged-in-the-closet" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">Some bedding is bagged in the closet</a>
            <a href="#the-restock-run-refill-every-closet-in-o" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">The restock run — refill every closet in one trip</a>
            <a href="#replace-a-damaged-or-missing-linen" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">Replace a damaged or missing linen</a>
            <a href="#refill-a-unit-from-the-stockroom-right-n" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">Refill a unit from the Stockroom right now</a>
            <a href="#what-the-colors-mean" className="rounded-control border border-line-strong bg-surface-3 px-3 py-1.5 text-xs font-semibold text-ink-secondary transition hover:border-red hover:text-ink-primary">What the colors mean</a>
      </nav>

      <div className="space-y-4">
        {/* The big idea */}
        <Card id="two-kinds-of-inventory-two-rules" kicker="Start here" title="Two kinds of inventory, two rules">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-control bg-surface-1 p-4">
              <p className="font-display text-sm font-bold text-state-warn">Consumables</p>
              <p className="mt-1 text-xs text-ink-muted">
                Toilet paper, paper towels, trash bags, pods, coffee, creamer,
                sponges, and the closet soaps (Dawn, conditioner, 3-in-1).
              </p>
              <p className="mt-2 text-sm text-ink-secondary">
                Live in the unit&apos;s owner closet. They run <b>down</b> every
                turnover. You <b>flag</b> the low ones — they get refilled from
                the Stockroom on the <b>weekly restock run</b>, not every clean.
              </p>
            </div>
            <div className="rounded-control bg-surface-1 p-4">
              <p className="font-display text-sm font-bold text-state-ok">Linens</p>
              <p className="mt-1 text-xs text-ink-muted">
                Bath towels, washcloths, hand / makeup / kitchen towels, plus the
                sheets, quilts, and pillowcases for the beds that unit has.
              </p>
              <p className="mt-2 text-sm text-ink-secondary">
                Stay <b>at the unit</b>, washed on site. They should never run
                low. Only pull from the Stockroom when one is <b>damaged, stained, or
                missing</b>.
              </p>
            </div>
          </div>
          <p className="mt-3 rounded-control border border-[rgba(245,184,0,.3)] bg-gold-subtle px-3 py-2 text-sm text-state-warn">
            Golden rule: anything you take out of the Stockroom, log it in the app.
            That keeps every count honest.
          </p>
        </Card>

        {/* Every clean */}
        <Card id="the-30-second-clean-routine" kicker="Do this at every unit" title="The 30-second clean routine">
          <ol className="space-y-3">
            <Step n={1}>
              On <B>Home</B>, tap the <b>unit</b> you&apos;re cleaning.
            </Step>
            <Step n={2}>
              <b>Parking pass</b> — tap <B>Present</B> (or <B>Missing</B> if
              it&apos;s gone).
            </Step>
            <Step n={3}>
              <b>Consumables</b> — after you set out the leave-behind items, tap
              anything at or below its reorder line so it turns gold:{" "}
              <B>Needs restock</B>. Leave the rest on <B>OK</B>.
            </Step>
            <Step n={4}>
              <b>Linens</b> — if every towel and bedding set is there and clean,
              tap <B>All match par</B>. If one&apos;s damaged/stained/missing, tap{" "}
              <B>Flag an issue</B> and set the real count with −/+.
            </Step>
            <Step n={5}>
              Pick your <b>name</b> from the list (it&apos;s remembered) → tap{" "}
              <B>Mark clean complete</B>.
            </Step>
          </ol>
          <p className="mt-3 text-xs text-ink-muted">
            You do <b>not</b> drive to the Stockroom for one low item — flagging is
            enough.
          </p>
        </Card>

        {/* Pullout bedding */}
        <Card id="some-bedding-is-bagged-in-the-closet" kicker="Easy to miss" title="Some bedding is bagged in the closet">
          <p className="text-sm text-ink-secondary">
            A <b>pullout couch</b> and a <b>twin rollaway</b> keep their bedding
            in a linen bag in the closet — not made up on the bed. The unit page
            tells you when a unit has one and how many. The kits never vary:
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-control bg-surface-1 p-4">
              <p className="font-display text-sm font-bold text-ink-primary">
                Queen pullout couch
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-secondary">
                <li>1 set of queen sheets — fitted + flat</li>
                <li>1 queen quilt</li>
                <li>2 queen pillowcases</li>
              </ul>
            </div>
            <div className="rounded-control bg-surface-1 p-4">
              <p className="font-display text-sm font-bold text-ink-primary">
                Twin rollaway — one bag each
              </p>
              <ul className="mt-2 space-y-1.5 text-sm text-ink-secondary">
                <li>1 set of twin sheets — fitted + flat</li>
                <li>1 twin quilt</li>
                <li>1 queen pillowcase</li>
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Open every bag and check inside. A bag that&apos;s there but missing a
            pillowcase is still short — flag it like any other linen.
          </p>
        </Card>

        {/* Weekly restock */}
        <Card id="the-restock-run-refill-every-closet-in-o" kicker="Once a week · Managers only" title="The restock run — refill every closet in one trip">
          <p className="mb-3 rounded-control border border-line-strong bg-surface-1 px-3 py-2 text-xs text-ink-muted">
            Cleaners don&apos;t run this one — flag what&apos;s low during the
            clean and a manager refills it on the weekly run.
          </p>
          <ol className="space-y-3">
            <Step n={1}>
              Tap <B>Restock</B> in the top menu.
            </Step>
            <Step n={2}>
              The <B>Pull from Stockroom</B> list totals everything every unit
              needs — one shopping list. A red <B>Stockroom short</B> flag means
              buy more of that item first.
            </Step>
            <Step n={3}>
              Go to the Stockroom <b>once</b>, grab everything on the list, load up.
            </Step>
            <Step n={4}>
              Drive to each unit and refill its closet up to par.
            </Step>
            <Step n={5}>
              In the app, pick your name and tap <B>Refill to par</B> on each
              unit — or <B>Refill all to par</B> to clear the whole list.
            </Step>
          </ol>
          <p className="mt-3 text-sm text-ink-secondary">
            That one tap refills the unit, subtracts what you took from the Stockroom,
            and logs the pull — automatically. You never type numbers.
          </p>
        </Card>

        {/* Damaged linen */}
        <Card id="replace-a-damaged-or-missing-linen" kicker="When a towel is bad" title="Replace a damaged or missing linen">
          <p className="mb-3 rounded-control border border-line-strong bg-surface-1 px-3 py-2 text-xs text-ink-muted">
            Cleaners: step 1 is yours. Flag it, finish the clean, and you&apos;re
            done — a manager handles the Stockroom half.
          </p>
          <ol className="space-y-3">
            <Step n={1}>
              During the clean, under <b>Linens</b>, tap <B>Flag an issue</B> and
              lower the count for the bad towel. Complete the clean.
            </Step>
            <Step n={2} manager>Go to the Stockroom and grab a replacement.</Step>
            <Step n={3} manager>
              Open the unit → tap <B>Pull from Stockroom</B> (top of the page).
              It&apos;s pre-filled to that unit. Pick the towel, quantity, reason{" "}
              <B>Damage replacement</B> or <B>Stain out</B> → <B>Log pull</B>.
            </Step>
            <Step n={4} manager>
              Take it back to the unit. The app sets that unit back to par and
              subtracts 1 from the Stockroom.
            </Step>
          </ol>
          <p className="mt-3 text-xs text-ink-muted">
            Shortcut: on the <B>Linens</B> screen, a short unit has a{" "}
            <B>Replace</B> button that opens this pre-filled.
          </p>
        </Card>

        {/* Urgent consumable */}
        <Card
          id="refill-a-unit-from-the-stockroom-right-n"
          kicker="When it can't wait · Managers only"
          title="Refill a unit from the Stockroom right now"
        >
          <p className="mb-3 rounded-control border border-line-strong bg-surface-1 px-3 py-2 text-xs text-ink-muted">
            Cleaners: flag it during the clean and tell a manager — they&apos;ll
            bring it over. The steps below are theirs.
          </p>
          <ol className="space-y-3">
            <Step n={1}>Go to the Stockroom and grab the item(s).</Step>
            <Step n={2}>
              Open the unit → <B>Pull from Stockroom</B> (or <B>Log pull</B> in the
              top bar). Pick the item, quantity, reason <B>Weekly restock</B> →{" "}
              <B>Log pull</B>.
            </Step>
            <Step n={3}>
              Take it back. The app refills the unit to par and draws down
              the Stockroom.
            </Step>
          </ol>
          <p className="mt-3 rounded-control border border-[rgba(226,6,2,.3)] bg-red-subtle px-3 py-2 text-xs text-state-bad">
            Don&apos;t double up: on the weekly run use <B>Refill to par</B> (it
            logs the pull for you). Use <B>Log pull</B> only for one-off and
            linen pulls — not both for the same item.
          </p>
        </Card>

        {/* Colors */}
        <Card id="what-the-colors-mean" kicker="Reading the app" title="What the colors mean">
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full bg-gold" />
              <span className="text-ink-secondary">
                <b className="text-state-warn">Gold</b> — needs attention / restock
                soon.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full bg-red" />
              <span className="text-ink-secondary">
                <b className="text-state-bad">Red</b> — a problem: missing towel,
                missing parking pass, or the Stockroom can&apos;t cover the run.
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="inline-block h-3 w-3 rounded-full bg-green" />
              <span className="text-ink-secondary">
                <b className="text-state-ok">Green</b> — good / at par.
              </span>
            </li>
          </ul>
        </Card>
      </div>
    </Container>
  );
}
