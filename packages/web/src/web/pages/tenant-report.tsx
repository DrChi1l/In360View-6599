import { useEffect, useState } from "react";
import { CheckCircle2, Camera, MessageSquare, Lock, Save, Send } from "lucide-react";
import { Logo } from "../components/logo";
import { Button } from "../components/ui/button";
import { Card, Input, Textarea } from "../components/ui/field";
import { ErrorNote, Loading } from "../components/empty-state";
import { TenantSignature } from "../components/tenant-signature";
import { useTenantReport } from "../queries/tenant-report";
import { client } from "../lib/api";
import { TENANT_DECLARATION, type TenantResponse } from "../../api/lib/tenant-contract";
import { REPORT_TYPE_LABELS, CONDITION_LABELS, CLEANLINESS_LABELS } from "../../api/lib/domain";

type Review = Awaited<ReturnType<typeof client.tenantReport.get>>;

export default function TenantReport({ token }: { token: string }) {
  const query = useTenantReport(token);
  useEffect(() => {
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex, nofollow";
    const referrer = document.createElement("meta");
    referrer.name = "referrer";
    referrer.content = "no-referrer";
    document.head.append(robots, referrer);
    return () => {
      robots.remove();
      referrer.remove();
    };
  }, []);
  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header className="border-b border-ink-100 bg-white px-5 py-5">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <Logo size={28} withTagline />
          <span className="text-right text-xs text-ink-500">
            Private tenant review
            <br />
            No account needed
          </span>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
        {query.isLoading ? (
          <Loading />
        ) : query.error || !query.data ? (
          <Card className="p-6">
            <h1 className="mb-3 text-xl font-semibold">We couldn’t open this report</h1>
            <ErrorNote error={query.error ?? new Error("Report not found")} />
            <p className="mt-3 text-sm text-ink-500">
              Check the full link or ask your inspector for a new one.
            </p>
            <Button className="mt-4" onClick={() => void query.refetch()}>
              Try again
            </Button>
          </Card>
        ) : (
          <ReviewForm key={token} token={token} initial={query.data} />
        )}
      </main>
      <footer className="border-t border-ink-100 px-5 py-6 text-center text-xs text-ink-500">
        In360View · This link is confidential. Only share it with the intended tenant.
      </footer>
    </div>
  );
}

function ReviewForm({ token, initial }: { token: string; initial: Review }) {
  const [review, setReview] = useState(initial);
  const [draft, setDraft] = useState<TenantResponse>(() => ({
    name: initial.tenant.name,
    comments: initial.tenant.comments,
    photos: initial.tenant.photos.map(({ assetId, itemId, caption }) => ({
      assetId,
      itemId,
      caption,
    })),
    signatureAssetId: initial.tenant.signatureAssetId,
  }));
  const [revision, setRevision] = useState(initial.revision);
  const [signature, setSignature] = useState<Blob | null>(null);
  const [signatureCleared, setSignatureCleared] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState("");
  const [dirty, setDirty] = useState(false);
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.tenant.photos.filter((p) => p.url).map((p) => [p.assetId, p.url!])),
  );
  const [target, setTarget] = useState("");
  const locked = review.status === "submitted";
  const disabled = locked || Boolean(busy);
  const report = review.report;
  const allItems = report.rooms.flatMap((r) => r.items.map((i) => ({ ...i, room: r.name })));

  useEffect(() => {
    if (!dirty || locked) return;
    const guard = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty, locked]);

  function update(next: TenantResponse) {
    setDraft(next);
    setDirty(true);
    setNotice("");
  }
  function comment(itemId: string | null, text: string) {
    update({
      ...draft,
      comments: [
        ...draft.comments.filter((c) => c.itemId !== itemId),
        ...(text.trim() ? [{ itemId, text }] : []),
      ],
    });
  }
  const currentComment = (id: string | null) =>
    draft.comments
      .filter((c) => c.itemId === id)
      .map((c) => c.text)
      .join("\n");

  async function upload(blob: Blob, kind: "photo" | "signature") {
    if (blob.size > 8 * 1024 * 1024) throw new Error("Each image must be smaller than 8 MB.");
    if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type))
      throw new Error("Use a JPEG, PNG or WebP image. Convert HEIC images before uploading.");
    const reservation = await client.tenantReport.upload({
      token,
      kind,
      bytes: blob.size,
      contentType: blob.type as "image/jpeg" | "image/png" | "image/webp",
    });
    const result = await fetch(reservation.url, {
      method: "PUT",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    if (!result.ok) throw new Error("Upload failed. Please try again.");
    return client.tenantReport.verifyUpload({ token, assetId: reservation.assetId });
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    if (files.length + draft.photos.length > 20) {
      setError(new Error("Maximum 20 tenant photographs."));
      return;
    }
    setBusy("Uploading photographs…");
    setError(null);
    let next = draft;
    try {
      for (const file of Array.from(files)) {
        const asset = await upload(file, "photo");
        setPhotoUrls((urls) => ({ ...urls, [asset.assetId]: asset.url }));
        next = {
          ...next,
          photos: [
            ...next.photos,
            { assetId: asset.assetId, itemId: target || null, caption: file.name.slice(0, 500) },
          ],
        };
        update(next);
      }
      setNotice("Photographs uploaded. Save your response to keep them attached.");
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }

  async function persist(submit: boolean) {
    setBusy(submit ? "Submitting your response…" : "Saving your response…");
    setError(null);
    setNotice("");
    try {
      let next = { ...draft };
      if (signatureCleared) next.signatureAssetId = null;
      if (signature) {
        const asset = await upload(signature, "signature");
        next.signatureAssetId = asset.assetId;
        setSignature(null);
        setSignatureCleared(false);
        setDraft(next);
      }
      if (submit && (!accepted || !next.signatureAssetId || !next.name.trim()))
        throw new Error("Enter your name, draw a signature and accept the declaration.");
      const result = submit
        ? await client.tenantReport.submit({ token, revision, response: next, accepted: true })
        : await client.tenantReport.save({ token, revision, response: next });
      setRevision(result.revision);
      setDraft(next);
      setDirty(false);
      // Apply the final lock immediately, even if the follow-up read fails.
      setReview((current) => ({
        ...current,
        revision: result.revision,
        status: result.submittedAt ? "submitted" : "open",
        tenant: {
          ...current.tenant,
          ...next,
          photos: next.photos.map((p) => ({ ...p, url: photoUrls[p.assetId] ?? null })),
          submittedAt: result.submittedAt,
        },
      }));
      setNotice(
        submit
          ? "Your response has been submitted and locked."
          : "Saved. You can return using this same link.",
      );
      try {
        const fresh = await client.tenantReport.get({ token });
        setReview(fresh);
        setPhotoUrls(
          Object.fromEntries(
            fresh.tenant.photos.filter((p) => p.url).map((p) => [p.assetId, p.url!]),
          ),
        );
      } catch {
        setNotice(
          "Your response was saved. Reload this page to refresh photographs and your signature.",
        );
      }
    } catch (e) {
      setError(e);
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <span className="rounded-md bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-800">
            {REPORT_TYPE_LABELS[report.type]}
          </span>
          <span className="text-xs text-ink-500">{report.reference}</span>
          {locked && (
            <span className="flex items-center gap-1 text-xs font-semibold text-ok">
              <Lock className="size-3" />
              Response submitted
            </span>
          )}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          {report.property.address}
        </h1>
        <p className="mt-2 text-ink-500">
          {report.property.postcode} · Inspected{" "}
          {new Date(`${report.inspectionDate}T12:00:00`).toLocaleDateString("en-GB")} by{" "}
          {report.inspectorName}
        </p>
        <div className="mt-6 border-l-4 border-brand-800 bg-white p-5 text-sm leading-relaxed">
          <strong className="block">Your review, alongside the original report.</strong>Check the
          entries below, add any observations and photos, then sign and submit. Your feedback does
          not change the inspector’s original record.
          {!locked && " Save your response before leaving the page."}
        </div>
      </section>

      {locked && (
        <Card className="border border-ok bg-ok-soft p-6">
          <div className="flex gap-3">
            <CheckCircle2 className="size-6 shrink-0 text-ok" />
            <div>
              <h2 className="text-lg font-semibold">Thank you, {draft.name}</h2>
              <p className="mt-1 text-sm">
                Submitted {new Date(review.tenant.submittedAt!).toLocaleString("en-GB")}. Your
                comments, photographs and signature are recorded below.
              </p>
              <p className="mt-2 text-xs">
                For a later correction, contact your inspector. This response cannot be edited.
              </p>
            </div>
          </div>
        </Card>
      )}

      {report.summary && (
        <Card className="p-5">
          <h2 className="mb-2 font-semibold">Inspection summary</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
            {report.summary}
          </p>
        </Card>
      )}

      <Images urls={report.photoUrls ?? []} label="Property" />

      <nav aria-label="Rooms" className="flex flex-wrap gap-2">
        {report.rooms.map((r, n) => (
          <a
            key={r.id}
            href={`#room-${n}`}
            className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm hover:border-brand-500"
          >
            {r.name}
          </a>
        ))}
      </nav>
      {report.rooms.map((room, n) => (
        <section key={room.id} id={`room-${n}`} className="scroll-mt-6">
          <h2 className="mb-4 border-b-2 border-brand-800 pb-3 text-xl font-semibold">
            {room.name}
          </h2>
          {room.notes && (
            <p className="mb-4 whitespace-pre-wrap text-sm text-ink-700">{room.notes}</p>
          )}
          <Images urls={room.photoUrls} label={room.name} />
          <div className="space-y-4">
            {room.items.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-semibold">
                      {item.name}
                      {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                    </h3>
                    <div className="flex gap-2 text-xs text-ink-500">
                      {item.condition && <span>Condition: {CONDITION_LABELS[item.condition]}</span>}
                      {item.cleanliness && (
                        <span>Cleanliness: {CLEANLINESS_LABELS[item.cleanliness]}</span>
                      )}
                    </div>
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-700">
                    {item.description || "No additional description recorded."}
                  </p>
                  {item.notes && (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-brand-700">
                      Inspector’s notes: {item.notes}
                    </p>
                  )}
                  <Images urls={item.photoUrls} label={item.name} />
                </div>
                <div className="border-t border-ink-100 bg-brand-50/60 p-5">
                  <label
                    className="mb-2 flex items-center gap-2 text-xs font-semibold text-brand-800"
                    htmlFor={`comment-${item.id}`}
                  >
                    <MessageSquare className="size-3.5" />
                    Your observation
                  </label>
                  <Textarea
                    id={`comment-${item.id}`}
                    disabled={disabled}
                    maxLength={5000}
                    rows={2}
                    value={currentComment(item.id)}
                    onChange={(e) => comment(item.id, e.target.value)}
                    placeholder="Anything you would like to add about this item?"
                  />
                </div>
              </Card>
            ))}
          </div>
        </section>
      ))}

      {(report.meters.length > 0 || report.keys.length > 0) && (
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Meters & keys</h2>
          <div className="space-y-3 text-sm">
            {report.meters.map((m, i) => (
              <p key={i}>
                <strong className="capitalize">{m.type.replace(/_/g, " ")}</strong> · Reading:{" "}
                {m.reading || "Not recorded"} · Serial: {m.serialNumber || "Not recorded"}
                {m.location && ` · ${m.location}`}
              </p>
            ))}
            {report.keys.map((k, i) => (
              <p key={`k${i}`}>
                {k.quantity} × {k.description}
                {k.notes && ` — ${k.notes}`}
              </p>
            ))}
          </div>
        </Card>
      )}

      <section className="border-t-2 border-brand-800 pt-6">
        <h2 className="text-xl font-semibold">Your response</h2>
        <p className="mt-2 text-sm text-ink-500">
          General comments, supporting photos and your signature.
        </p>
        <div className="mt-5 space-y-6">
          <div>
            <label htmlFor="general-comment" className="mb-2 block text-sm font-medium">
              General comments
            </label>
            <Textarea
              id="general-comment"
              rows={4}
              maxLength={5000}
              disabled={disabled}
              value={currentComment(null)}
              onChange={(e) => comment(null, e.target.value)}
              placeholder="Anything else the inspector should know…"
            />
          </div>
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Camera className="size-4" />
              Your photographs ({draft.photos.length}/20)
            </h3>
            {!locked && (
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <label className="grid gap-1 text-xs text-ink-500">
                  Attach to
                  <select
                    aria-label="Photograph item"
                    disabled={disabled}
                    className="max-w-full rounded-lg border border-ink-200 bg-white p-2 text-sm text-ink-900"
                    value={target}
                    onChange={(e) => setTarget(e.target.value)}
                  >
                    <option value="">General response</option>
                    {allItems.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.room} — {i.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className={`inline-block cursor-pointer rounded-lg bg-brand-800 px-4 py-2 text-sm font-medium text-white ${disabled ? "opacity-50" : ""}`}
                >
                  Add photos
                  <input
                    aria-label="Upload photographs"
                    type="file"
                    multiple
                    accept="image/jpeg,image/png,image/webp"
                    disabled={disabled}
                    className="sr-only"
                    onChange={(e) => {
                      void addPhotos(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>
                <span className="text-xs text-ink-500">JPEG, PNG or WebP · up to 8 MB each</span>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {draft.photos.map((photo) => (
                <div key={photo.assetId} className="rounded-xl border border-ink-200 bg-white p-3">
                  <img
                    src={photoUrls[photo.assetId]}
                    referrerPolicy="no-referrer"
                    alt={photo.caption || "Tenant photograph"}
                    className="h-44 w-full rounded-lg object-contain"
                  />
                  <Input
                    aria-label="Photo caption"
                    className="mt-2"
                    maxLength={500}
                    disabled={disabled}
                    value={photo.caption}
                    onChange={(e) =>
                      update({
                        ...draft,
                        photos: draft.photos.map((p) =>
                          p.assetId === photo.assetId ? { ...p, caption: e.target.value } : p,
                        ),
                      })
                    }
                  />
                  {photo.itemId && (
                    <p className="mt-1 text-xs text-ink-500">
                      {allItems.find((i) => i.id === photo.itemId)?.name}
                    </p>
                  )}
                  {!locked && (
                    <button
                      disabled={disabled}
                      type="button"
                      className="mt-2 text-xs text-danger"
                      onClick={() =>
                        update({
                          ...draft,
                          photos: draft.photos.filter((p) => p.assetId !== photo.assetId),
                        })
                      }
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          <Card className="p-5 sm:p-6">
            <h3 className="mb-4 font-semibold">Declaration & signature</h3>
            <p className="mb-5 text-sm leading-relaxed text-ink-700">{TENANT_DECLARATION}</p>
            <label htmlFor="tenant-name" className="mb-2 block text-sm font-medium">
              Your full name
            </label>
            <Input
              id="tenant-name"
              autoComplete="name"
              value={draft.name}
              maxLength={150}
              disabled={disabled}
              onChange={(e) => update({ ...draft, name: e.target.value })}
            />
            {locked ? (
              review.tenant.signature && (
                <img
                  src={review.tenant.signature.url}
                  referrerPolicy="no-referrer"
                  alt={`Signature of ${draft.name}`}
                  className="mt-4 h-32 max-w-full object-contain"
                />
              )
            ) : (
              <div className="mt-5">
                <p className="mb-2 text-sm font-medium">
                  Draw your signature using your finger or mouse
                </p>
                {review.tenant.signature && !signature && !signatureCleared && (
                  <>
                    <p className="mb-2 text-xs text-ok">
                      Saved signature — draw below only to replace it.
                    </p>
                    <img
                      src={review.tenant.signature.url}
                      alt="Saved signature"
                      referrerPolicy="no-referrer"
                      className="mb-3 h-20 object-contain"
                    />
                  </>
                )}
                <TenantSignature
                  disabled={disabled}
                  onChange={(blob) => {
                    setSignature(blob);
                    setSignatureCleared(!blob);
                    setDirty(true);
                  }}
                />
                <label className="mt-5 flex items-start gap-3 text-sm leading-relaxed">
                  <input
                    aria-label="Accept declaration"
                    type="checkbox"
                    className="mt-1 size-4 accent-brand-800"
                    checked={accepted}
                    disabled={disabled}
                    onChange={(e) => setAccepted(e.target.checked)}
                  />
                  I have reviewed the report and accept the declaration above. I understand my
                  response will be locked after submission.
                </label>
              </div>
            )}
          </Card>
          {error !== null && <ErrorNote error={error} />}
          {(notice || busy) && (
            <output className="block text-sm font-medium text-brand-800">{busy || notice}</output>
          )}
          {!locked && (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl bg-white p-4 ring-1 ring-ink-100">
              <div>
                <p className="text-sm font-medium">
                  {dirty ? "Unsaved changes" : "Response ready to review"}
                </p>
                <p className="mt-1 text-xs text-ink-500">
                  Saving keeps a draft. Submitting locks your response.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="outline" disabled={disabled} onClick={() => void persist(false)}>
                  <Save className="size-4" />
                  Save response
                </Button>
                <Button
                  disabled={
                    disabled ||
                    !accepted ||
                    !draft.name.trim() ||
                    (!signature && (!draft.signatureAssetId || signatureCleared))
                  }
                  onClick={() => void persist(true)}
                >
                  <Send className="size-4" />
                  Sign & submit
                </Button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Images({ urls, label }: { urls: string[]; label: string }) {
  if (!urls.length) return null;
  return (
    <div className="my-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {urls.map((url, i) => (
        <a
          key={`${i}-${url}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-lg border border-ink-100 bg-white"
        >
          <img
            loading="lazy"
            src={url}
            alt={`${label} photograph ${i + 1}`}
            referrerPolicy="no-referrer"
            className="h-40 w-full rounded-lg object-contain"
          />
        </a>
      ))}
    </div>
  );
}
