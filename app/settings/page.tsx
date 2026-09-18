import { getSettings, listConsumableItems, listUnits } from "@/lib/inventory";
import { Container, PageHeader, SetupNotice } from "@/app/components/ui";
import type { ConsumableItem, Settings, Unit } from "@/lib/types";
import SettingsClient from "./SettingsClient";
import UnitPropsClient from "./UnitPropsClient";
import DigestButton from "@/app/components/DigestButton";
import { slackConfigured } from "@/lib/slack";
import { emailConfigured } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  let settings: Settings = {
    default_turnover_frequency: 3,
    buffer_turnovers: 1,
    central_buffer: 2,
  };
  let items: ConsumableItem[] = [];
  let units: Unit[] = [];
  let loadError: string | null = null;

  try {
    [settings, items, units] = await Promise.all([
      getSettings(),
      listConsumableItems(),
      listUnits(),
    ]);
    // Bulk supplies (fixed par, e.g. a gallon of soap) aren't driven by the
    // leave-behind math — they're edited on the Stockroom, not here.
    items = items.filter((i) => !i.fixed_par);
  } catch (err) {
    loadError = (err as Error).message;
  }

  return (
    <Container>
      <PageHeader eyebrow="Admin" title="Par settings" />
      {loadError ? (
        <SetupNotice message={loadError} />
      ) : (
        <div className="space-y-10">
          <SettingsClient settings={settings} items={items} />

          <section>
            <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-ink-primary">
              Bagged bedding
            </h2>
            <div className="mt-3">
              <UnitPropsClient units={units} />
            </div>
          </section>

          {/* The things that reach outside the app live together here, not on
              the pages they happen to post from. */}
          <section>
            <h2 className="font-display text-lg font-bold tracking-[-0.01em] text-ink-primary">
              Integrations
            </h2>
            <div className="mt-3 space-y-3 rounded-card border border-line bg-surface-2 p-4 shadow-e1">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink-primary">Slack summary</div>
                  <div className="text-xs text-ink-muted">
                    {slackConfigured()
                      ? "Connected. Posts each morning when there's something to act on; post one now to check."
                      : "Not connected yet — add a Slack webhook to the app's settings on Vercel (SLACK_WEBHOOK_URL)."}
                  </div>
                </div>
                {slackConfigured() && <DigestButton />}
              </div>
              <div className="border-t border-line pt-3">
                <div className="text-sm font-medium text-ink-primary">Invite emails</div>
                <div className="text-xs text-ink-muted">
                  {emailConfigured()
                    ? "Connected. New team members get their setup link by email."
                    : "Not connected — send setup links by text, or copy them from the Team page."}
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Container>
  );
}
