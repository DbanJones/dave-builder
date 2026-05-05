import { invoke } from "@tauri-apps/api/core";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { getNodeNpmDiagnostics, type NodeNpmDiagnostics } from "@/lib/cli-detection";

interface InstallStateProps {
  onRecheck: () => void | Promise<void>;
  errorMessage?: string;
}

interface ResolutionDiagnostics {
  resolved: string | null;
  probed: string[];
  bundledPresent: boolean;
}

// Body of the connection-issues dialog when the CLI is missing. Outer
// container (header, padding, close button) is supplied by the dialog —
// this component renders the disambiguation note, the numbered steps,
// the Re-check button, and an Advanced diagnostics disclosure.
export function InstallState({ onRecheck, errorMessage }: InstallStateProps) {
  const [diag, setDiag] = useState<ResolutionDiagnostics | null>(null);
  const [nodeNpm, setNodeNpm] = useState<NodeNpmDiagnostics | null>(null);
  useEffect(() => {
    void (async () => {
      try {
        const r = await invoke<ResolutionDiagnostics>("cli_resolution_diagnostics");
        setDiag(r);
      } catch {
        /* non-fatal — diagnostics are advisory */
      }
    })();
    void (async () => {
      const r = await getNodeNpmDiagnostics();
      r.match(
        (d) => setNodeNpm(d),
        () => setNodeNpm({ nodeVersion: null, npmVersion: null }),
      );
    })();
  }, []);

  const nodeMissing = nodeNpm !== null && nodeNpm.nodeVersion === null;
  const npmMissing = nodeNpm !== null && nodeNpm.npmVersion === null;
  const prerequisitesMet = nodeNpm !== null && !nodeMissing && !npmMissing;

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
        Dave-Builder requires the <strong>Claude Code CLI</strong> — a separate product from the{" "}
        <strong>Claude desktop app</strong>. Both share the same Anthropic account, but only the
        CLI provides the integration Dave-Builder uses.
      </p>

      <ol className="list-decimal space-y-2 pl-5 text-sm">
        <li>
          <span className="font-medium">Install Node.js 20+.</span>{" "}
          {nodeMissing || npmMissing ? (
            <span className="text-destructive">
              Required —{" "}
              {nodeMissing && npmMissing
                ? "Node.js and npm were not detected"
                : nodeMissing
                  ? "Node.js was not detected"
                  : "npm was not detected"}
              . Install the LTS build from{" "}
              <a
                href="https://nodejs.org/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium underline underline-offset-2"
              >
                nodejs.org
              </a>
              , then re-open Dave-Builder.
            </span>
          ) : (
            <span className="text-muted-foreground">
              Detected: Node {nodeNpm?.nodeVersion ?? "—"}, npm {nodeNpm?.npmVersion ?? "—"}.
            </span>
          )}
        </li>
        <li>
          <span className="font-medium">Open a terminal.</span>{" "}
          <span className="text-muted-foreground">
            macOS: <kbd className="rounded border bg-muted px-1 text-xs">Cmd</kbd>+
            <kbd className="rounded border bg-muted px-1 text-xs">Space</kbd>, type{" "}
            <span className="font-mono">terminal</span>. Windows: PowerShell from the Start menu.
          </span>
        </li>
        <li>
          <span className="font-medium">Install the CLI.</span>{" "}
          <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">
            npm install -g @anthropic-ai/claude-code
          </code>
        </li>
        <li>
          <span className="font-medium">Sign in.</span>{" "}
          <span className="text-muted-foreground">
            Run <code className="rounded bg-muted px-1 font-mono text-xs">claude</code> and
            authenticate against your Anthropic account in the browser.
          </span>
        </li>
        <li>
          <span className="font-medium">Click Re-check below.</span>
        </li>
      </ol>

      <div className="flex items-center gap-3 pt-1">
        <Button
          onClick={() => {
            void onRecheck();
          }}
          size="sm"
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Re-check
        </Button>
        <a
          href="https://docs.claude.com/claude-code"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground underline underline-offset-2"
        >
          docs.claude.com/claude-code
        </a>
      </div>

      {(errorMessage !== undefined || diag !== null) && (
        <details className="rounded border bg-muted/40 text-xs">
          <summary className="cursor-pointer px-3 py-2 text-muted-foreground">
            Advanced diagnostics
          </summary>
          <div className="space-y-2 border-t px-3 py-2 text-muted-foreground">
            {errorMessage !== undefined && (
              <p>
                <span className="font-medium">Detection error:</span> {errorMessage}
              </p>
            )}
            {diag !== null && diag.bundledPresent && diag.resolved === null && (
              <p>
                A bundled CLI is shipped with Dave-Builder but could not be resolved. This is a
                packaging issue — please report it.
              </p>
            )}
            {diag !== null && diag.resolved === null && (
              <>
                <p>
                  If <span className="font-mono">claude</span> already works in your terminal,
                  Dave-Builder is checking different paths than where it&apos;s installed. Run{" "}
                  <code className="rounded bg-muted px-1 font-mono">command -v claude</code> in
                  your terminal to find the install path.
                </p>
                <p className="font-medium">Paths checked ({diag.probed.length}):</p>
                <ul className="ml-4 list-disc space-y-0.5 font-mono text-[10px]">
                  {diag.probed.map((p, i) => (
                    <li key={i} className="break-all">
                      {p}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {prerequisitesMet && (
              <p>
                Node.js <span className="font-mono">{nodeNpm?.nodeVersion}</span> and npm{" "}
                <span className="font-mono">{nodeNpm?.npmVersion}</span> are present.
              </p>
            )}
          </div>
        </details>
      )}
    </div>
  );
}
