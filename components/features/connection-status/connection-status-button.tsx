"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, Plug, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { AuthState } from "@/app/(welcome)/components/auth-state";
import { InstallState } from "@/app/(welcome)/components/install-state";
import { detectCli, type CliState, type DetectionError } from "@/lib/cli-detection";

type Status =
  | { kind: "loading" }
  | { kind: "result"; state: CliState }
  | { kind: "error"; error: DetectionError };

// Icon button for the tab bar reflecting current Claude Code connection
// state. Click opens a dialog with the same step-by-step guide that the
// welcome page used to inline, so the user can resolve connection
// issues without leaving the project picker.
export function ConnectionStatusButton() {
  const [status, setStatus] = useState<Status>({ kind: "loading" });
  const [open, setOpen] = useState(false);

  const runDetection = useCallback(async (): Promise<void> => {
    setStatus({ kind: "loading" });
    const result = await detectCli();
    result.match(
      (state) => setStatus({ kind: "result", state }),
      (error) => setStatus({ kind: "error", error }),
    );
  }, []);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

  // Re-probe each time the dialog opens so a "Re-check" inside it
  // settles on the freshest result without an extra mount.
  useEffect(() => {
    if (open) void runDetection();
  }, [open, runDetection]);

  const ready = status.kind === "result" && status.state === "ready";
  const dotColor = ready
    ? "bg-green-500"
    : status.kind === "loading"
      ? "bg-muted-foreground/40"
      : "bg-destructive";
  const label = ready
    ? "Claude Code: connected"
    : status.kind === "loading"
      ? "Claude Code: checking…"
      : "Claude Code: connection issues";

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label={label}
        title={label}
        className={
          "relative flex h-9 w-9 items-center justify-center border-l text-muted-foreground hover:bg-background/60 hover:text-foreground " +
          (ready ? "" : "text-destructive hover:text-destructive")
        }
      >
        {ready ? (
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <Plug className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span
          aria-hidden="true"
          className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${dotColor}`}
        />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 flex max-h-[85vh] w-full max-w-xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-lg border bg-background shadow-lg">
          <div className="flex items-start justify-between gap-3 border-b p-5">
            <div>
              <Dialog.Title className="flex items-center gap-2 text-base font-semibold">
                <Plug className="h-4 w-4" aria-hidden="true" />
                {ready ? "Claude Code is connected" : "Connection issues"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                {ready
                  ? "Dave-Builder is reaching the Claude Code service successfully."
                  : "Dave-Builder is unable to establish a connection. Complete the steps below, then re-check."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              aria-label="Close"
              className="-mr-1 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </Dialog.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-auto p-5">
            {status.kind === "result" && status.state === "missing" && (
              <InstallState onRecheck={runDetection} />
            )}
            {status.kind === "result" && status.state === "unauthenticated" && (
              <AuthState onRecheck={runDetection} />
            )}
            {status.kind === "result" && status.state === "ready" && (
              <p className="text-sm text-muted-foreground">
                You&apos;re all set — close this dialog and start a new project.
              </p>
            )}
            {status.kind === "error" && (
              <InstallState
                onRecheck={runDetection}
                errorMessage={`Detection failed: ${status.error.message}`}
              />
            )}
            {status.kind === "loading" && (
              <p className="text-sm text-muted-foreground" aria-live="polite">
                Checking connection…
              </p>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
