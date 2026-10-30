import { useState } from "react";
import { Link } from "wouter";
import { Copy, Send } from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/field";
import { ErrorNote } from "./empty-state";
import { usePublishTenantReport } from "../queries/tenant-report";

export function TenantShare({ reportId, completed }: { reportId: string; completed: boolean }) {
  const publish = usePublishTenantReport();
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  return (
    <Card className="p-4">
      <h2 className="font-semibold">Tenant review</h2>
      <p className="my-3 text-xs leading-relaxed text-ink-500">
        Create a private link for the tenant to add comments, photographs and a signature. No
        account required. This shares a snapshot, not an editable inspection.
      </p>
      {publish.data ? (
        <div className="space-y-3">
          <input
            aria-label="Tenant report link"
            readOnly
            value={publish.data.url}
            className="w-full rounded-lg border border-ink-200 px-2 py-2 text-xs"
            onFocus={(e) => e.target.select()}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(publish.data!.url);
                  setCopied(true);
                } catch {
                  setCopyError(true);
                }
              }}
            >
              <Copy className="size-3" />
              {copied ? "Copied" : "Copy link"}
            </Button>
            <Link
              href={`/t/${publish.data.token}`}
              className="self-center text-xs font-medium text-brand-800"
            >
              Open review
            </Link>
          </div>
          {copyError && <p className="text-xs">Select the link above and copy it manually.</p>}
          <p className="text-xs text-ink-500">
            Keep this link: it also lets you check the tenant’s response. Custom-domain links
            require the website to be published at in360view.co.uk.
          </p>
        </div>
      ) : (
        <Button
          className="w-full"
          disabled={!completed || publish.isPending}
          onClick={() => publish.mutate({ reportId })}
        >
          <Send className="size-4" />
          {publish.isPending ? "Creating link…" : "Send to tenant"}
        </Button>
      )}
      {!completed && <p className="mt-2 text-xs text-ink-500">Complete the inspection first.</p>}
      {publish.error && (
        <div className="mt-3">
          <ErrorNote error={publish.error} />
        </div>
      )}
    </Card>
  );
}
