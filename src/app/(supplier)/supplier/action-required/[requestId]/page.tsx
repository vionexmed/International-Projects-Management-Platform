import Link from "next/link";
import { AlertCircle, CircleCheck, Clock, Download, FileText } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { requireDocumentRequestAccess } from "@/server/authz/access";
import { listRequestReviews, type RequestStatus } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { PageHeader } from "@/components/app/page-header";
import { trailLabels } from "@/components/app/trail-labels";
import { Panel, PanelHeader, PropertyList } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { SolidBadge } from "@/components/ui/badge";
import { SubmitRequestForm } from "@/features/supplier-portal/submit-request-form";
import { ReviewHistory } from "@/features/documents/review-history";
import { getDictionary, interpolate } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/format";
import { DUE_TONE_CLASS, dueLabel } from "@/features/supplier-portal/due-label";
import { ACCEPT_ATTRIBUTE, maxUploadMb } from "@/lib/upload";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ requestId: string }> }) {
  const { requestId } = await params;
  try {
    const user = await requireSupplierUser();
    const request = await requireDocumentRequestAccess(user, requestId);
    return { title: request.title };
  } catch {
    return { title: "Request" };
  }
}

/**
 * "What exactly was asked, and is it on me?"
 *
 * The form is the focal element: when the supplier can act, it sits above the
 * fold, right under the one state callout that tells them why. Everything
 * else — files already sent, the review history, the reply thread — is
 * context, and reads as canvas sections rather than a stack of identical
 * cards. When the supplier cannot act (under review, approved), the callout
 * leads instead, because there is nothing here for them to do.
 */
export default async function SupplierRequestPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const user = await requireSupplierUser();

  const request = await orNotFound(requireDocumentRequestAccess(user, requestId));
  // Withheld from this list: who at Vionex decided. The service never selects
  // the reviewer for a portal session.
  const reviews = await listRequestReviews(user, request.id);

  const locale = localeFromLanguage(user.language);
  const dict = getDictionary(locale);
  // "Rejected" reads as final; the request is in fact open again, waiting on a new version.
  const status =
    request.status === "REJECTED"
      ? { label: dict.portal.requests.changesRequested, tone: "warn" as const }
      : meta.request(request.status as RequestStatus, dict);
  /**
   * Mirrors the rule the service enforces. Submitting while Vionex is reading
   * used to be allowed, which let a supplier replace the file underneath a
   * reviewer mid-decision; what the rejection *is for* is coming back, so that
   * state stays open.
   */
  const canSubmit = request.status === "PENDING" || request.status === "REJECTED";
  const needsCorrection = request.status === "REJECTED";
  const underReview = request.status === "SUBMITTED" || request.status === "IN_REVIEW";
  const due = dueLabel(request.dueDate, dict, locale, { open: canSubmit });

  return (
    <div className="mx-auto max-w-[1080px]">
      <PageHeader
        breadcrumb={[{ label: dict.portal.requests.title, href: "/supplier/action-required" }]}
        trailLabels={trailLabels(locale, dict.common.back)}
        title={request.title}
        status={<SolidBadge tone={status.tone}>{status.label}</SolidBadge>}
        description={`${request.project.name} · ${label.documentType(request.type, dict)}`}
        meta={
          due ? (
            <span className={DUE_TONE_CLASS[due.tone]}>
              {due.tone === "later"
                ? due.text
                : `${interpolate(dict.portal.requests.dueOn, {
                    date: formatDate(request.dueDate, locale),
                  })} · ${due.text}`}
            </span>
          ) : null
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        {/* Left: what the supplier came here to do, then the record of the conversation. */}
        <div className="min-w-0 space-y-8">
          {/*
            The state, said once and first. A supplier arriving here should know in
            one line whether the ball is theirs — "REJECTED" on a badge does not
            answer that, and it also sounds final when the process is not. Vionex's
            note travels with it, instead of repeating in a second and third block.
          */}
          {needsCorrection || underReview || request.status === "APPROVED" ? (
            <div
              className={cn(
                "flex items-start gap-3 rounded-lg border px-5 py-4",
                needsCorrection
                  ? "border-warn/30 bg-warn-soft"
                  : underReview
                    ? "border-info/20 bg-info-soft"
                    : "border-ok/20 bg-ok-soft",
              )}
            >
              {needsCorrection ? (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" />
              ) : underReview ? (
                <Clock className="mt-0.5 size-4 shrink-0 text-info" />
              ) : (
                <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
              )}
              <div className="min-w-0">
                <p className="text-body leading-relaxed text-ink">
                  {needsCorrection
                    ? dict.portal.requests.changesRequestedHint
                    : underReview
                      ? dict.portal.requests.underReviewDetail
                      : dict.portal.requests.approvedHint}
                </p>
                {request.reviewNote ? (
                  <blockquote className="mt-3 border-l-2 border-current/20 pl-3 text-body leading-relaxed whitespace-pre-wrap text-ink-soft">
                    <span className="mb-1 block text-meta font-medium text-muted not-italic">
                      {needsCorrection ? dict.portal.requests.changesRequested : "Vionex"}
                    </span>
                    {request.reviewNote}
                  </blockquote>
                ) : null}
                {request.submittedAt ? (
                  <p className="mt-2 text-meta text-muted">
                    {interpolate(dict.portal.requests.submittedOn, {
                      date: formatDate(request.submittedAt, locale),
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {/*
            What was asked, right under the state. It used to sit in the side column, which
            on a phone stacks *below* the form — so a supplier on mobile had to
            upload before they could read what to upload.
          */}
          {request.description ? (
            <section aria-labelledby="request-needs">
              <h2 id="request-needs" className="text-meta font-medium text-muted">
                {dict.portal.requests.whatIsNeeded}
              </h2>
              <p className="mt-1.5 max-w-prose text-body leading-relaxed whitespace-pre-wrap text-ink">
                {request.description}
              </p>
            </section>
          ) : null}

          {/* The focal element: the one form this page exists for. */}
          {canSubmit ? (
            <Panel>
              <PanelHeader
                title={needsCorrection ? dict.portal.requests.resubmit : dict.portal.requests.uploadTitle}
                description={
                  needsCorrection ? dict.portal.requests.resubmitIntro : dict.portal.requests.uploadIntro
                }
              />
              <div className="p-5">
                <SubmitRequestForm
                  requestId={request.id}
                  projectId={request.project.id}
                  dict={dict}
                  accept={ACCEPT_ATTRIBUTE}
                  maxSizeMb={maxUploadMb()}
                  resubmission={needsCorrection}
                />
              </div>
            </Panel>
          ) : null}

          {/* Files already submitted for this request */}
          {request.document && request.document.versions.length > 0 ? (
            <Section title={dict.portal.requests.filesSent}>
              <ul className="divide-y divide-line-soft">
                {request.document.versions.map((version) => (
                  <li key={version.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="size-4 shrink-0 text-faint" aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-body font-medium text-ink">{version.fileName}</p>
                        <p className="mt-0.5 text-meta text-muted">
                          v{version.version} · {formatFileSize(version.fileSize)} ·{" "}
                          {formatDateTime(version.createdAt, locale)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/files/${version.id}`}
                      aria-label={interpolate(dict.portal.documents.downloadFile, {
                        name: version.fileName,
                      })}
                      className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-sm px-2 text-meta font-medium text-brand-strong hover:bg-brand-soft/60 hover:underline"
                    >
                      <Download className="size-3.5" aria-hidden />
                      {dict.common.download}
                    </a>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}

          {reviews.length > 0 ? (
            <ReviewHistory
              rounds={reviews.map((review) => ({
                ...review,
                when: formatDateTime(review.createdAt, locale),
              }))}
              title={dict.portal.requests.reviewHistory}
              labels={{
                approved: dict.portal.requests.approvedLabel,
                changesRequested: dict.portal.requests.changesRequested,
                version: "v",
              }}
            />
          ) : null}

          {/* Conversation on this request */}
          {request.replies.length > 0 ? (
            <Section title={dict.portal.requests.history}>
              <ul className="divide-y divide-line-soft">
                {request.replies.map((reply) => (
                  <li key={reply.id} className="py-3">
                    <p className="text-body leading-relaxed whitespace-pre-wrap text-ink">{reply.body}</p>
                    <p className="mt-1 text-meta text-muted">
                      {reply.author.supplierId
                        ? dict.portal.requests.fromYou
                        : dict.portal.requests.fromVionex}
                      {" · "}
                      {formatDateTime(reply.createdAt, locale)}
                    </p>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
        </div>

        {/* Right: the fixed facts about this request. */}
        <div className="space-y-6">
          <PropertyList
            layout="stacked"
            items={[
              {
                label: dict.portal.requests.requestedBy,
                value: (
                  <>
                    {request.requestedBy.name}
                    {request.requestedBy.jobTitle ? (
                      <span className="block text-meta font-normal text-muted">
                        {request.requestedBy.jobTitle}
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                label: dict.portal.requests.due,
                value: (
                  <>
                    {formatDate(request.dueDate, locale)}
                    {due && due.tone !== "later" ? (
                      <span className={cn("block text-meta", DUE_TONE_CLASS[due.tone])}>
                        {due.text}
                      </span>
                    ) : null}
                  </>
                ),
              },
              {
                label: dict.common.project,
                value: (
                  <Link
                    href={`/supplier/projects/${request.project.id}`}
                    className="text-brand-strong underline-offset-4 hover:underline"
                  >
                    {request.project.name}
                  </Link>
                ),
              },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
