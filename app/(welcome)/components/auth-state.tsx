import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getCliAuthDiagnostics, type AuthDiagnostics } from "@/lib/cli-detection";

interface AuthStateProps {
  onRecheck: () => void | Promise<void>;
}

interface GuideStep {
  title: string;
  body: React.ReactNode;
}

function stepsForKind(kind: AuthDiagnostics["kind"] | undefined): GuideStep[] {
  if (kind === "rate_limit") {
    return [
      {
        title: "Wait for the rate-limit window to reset.",
        body: "The Claude account governs throttling — Pro and Max tiers typically reset every five minutes.",
      },
      {
        title: "Click Re-check below.",
        body: "If the issue persists, consider upgrading your Anthropic plan.",
      },
    ];
  }
  if (kind === "network") {
    return [
      {
        title: "Verify your internet connection.",
        body: "Confirm Wi-Fi or Ethernet is connected and other websites load.",
      },
      {
        title: "Disable any VPN or corporate proxy.",
        body: "Some networks block the Anthropic endpoints used by Claude Code.",
      },
      {
        title: "Run a direct probe.",
        body: (
          <>
            In a terminal, run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude -p ping</code>{" "}
            to surface the underlying error.
          </>
        ),
      },
      { title: "Click Re-check below.", body: null },
    ];
  }
  return [
    {
      title: "Open a terminal.",
      body: (
        <>
          macOS: <kbd className="rounded border bg-muted px-1 text-xs">Cmd</kbd>+
          <kbd className="rounded border bg-muted px-1 text-xs">Space</kbd>, type{" "}
          <span className="font-mono">terminal</span>. Windows: PowerShell from the Start menu.
        </>
      ),
    },
    {
      title: "Run the Claude Code CLI.",
      body: (
        <>
          Run <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude</code>. The
          first invocation initiates the sign-in flow.
        </>
      ),
    },
    {
      title: "Authenticate in your browser.",
      body: "A browser window will open. Sign in to your Anthropic account and grant access.",
    },
    { title: "Click Re-check below.", body: null },
  ];
}

// Body of the connection-issues dialog when the CLI is installed but
// the auth probe failed. Outer container (header, padding, close
// button) is supplied by the dialog. Steps adapt to the failure kind
// classified by the Rust `cli_auth_diagnostics` command.
export function AuthState({ onRecheck }: AuthStateProps) {
  const [diag, setDiag] = useState<AuthDiagnostics | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await getCliAuthDiagnostics();
      r.match(
        (d) => setDiag(d),
        () => {
          /* non-fatal — diagnostics are advisory; default copy still renders */
        },
      );
    })();
  }, []);

  const steps = stepsForKind(diag?.kind);

  return (
    <div className="space-y-3">
      {diag?.message && <p className="text-sm text-muted-foreground">{diag.message}</p>}
      <ol className="list-decimal space-y-2 pl-5 text-sm">
        {steps.map((step, i) => (
          <li key={i}>
            <span className="font-medium">{step.title}</span>
            {step.body !== null && step.body !== undefined && (
              <> <span className="text-muted-foreground">{step.body}</span></>
            )}
          </li>
        ))}
      </ol>

      <div className="pt-1">
        <Button
          onClick={() => {
            void onRecheck();
          }}
          size="sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Re-check
        </Button>
      </div>

      {diag?.stderrTail && (
        <details className="rounded border bg-muted/40 text-xs">
          <summary className="cursor-pointer px-3 py-2 text-muted-foreground">
            Advanced diagnostics
          </summary>
          <div className="space-y-2 border-t px-3 py-2 text-muted-foreground">
            <pre className="max-h-48 overflow-auto rounded bg-muted px-2 py-1 font-mono text-[11px]">
              {diag.stderrTail}
            </pre>
            {diag.resolvedPath && (
              <p className="break-all">
                Probed CLI at <span className="font-mono">{diag.resolvedPath}</span>
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
