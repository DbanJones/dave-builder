"use client";

import { useEffect, useState } from "react";

import { UpdatePrompt } from "@/app/components/update-prompt";
import { logAuditEvent } from "@/lib/audit";
import { checkForUpdateQuiet, type AvailableUpdate } from "@/lib/updater";

import { ReadyState } from "./components/ready-state";

// Landing page. The new-project flow is always visible — connection
// state lives in the tab-bar's ConnectionStatusButton, which opens a
// dialog with the install/auth setup guide when needed.
export default function WelcomePage() {
  const [pendingUpdate, setPendingUpdate] = useState<AvailableUpdate | null>(null);

  useEffect(() => {
    void logAuditEvent("app_first_run", {}, { once: true });
    void (async () => {
      const r = await checkForUpdateQuiet();
      r.match(
        (update) => setPendingUpdate(update),
        () => {
          /* Network errors etc. — silent on launch; user can retry via menu later. */
        },
      );
    })();
  }, []);

  return (
    <main className="flex min-h-full justify-center overflow-y-auto bg-background p-8">
      <div className="w-full max-w-2xl">
        {pendingUpdate ? (
          <UpdatePrompt update={pendingUpdate} onDismiss={() => setPendingUpdate(null)} />
        ) : null}
        <ReadyState />
      </div>
    </main>
  );
}
