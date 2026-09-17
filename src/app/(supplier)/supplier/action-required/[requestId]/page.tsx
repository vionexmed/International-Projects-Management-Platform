import Link from "next/link";
import { AlertCircle, ArrowLeft, CircleCheck, Clock, Download, FileText } from "lucide-react";
import { requireSupplierUser } from "@/server/auth/current-user";
import { requireDocumentRequestAccess } from "@/server/authz/access";
import { listRequestReviews } from "@/server/services/documents";
import { orNotFound } from "@/server/authz/rsc";
import { Panel, PanelHeader } from "@/components/ui/card";
import { SolidBadge } from "@/components/ui/badge";
import { SubmitRequestForm } from "@/features/supplier-portal/submit-request-form";
import { ReviewHistory } from "@/features/documents/review-history";
import { getDictionary, interpolate, plural } from "@/lib/i18n/dictionary";
import { localeFromLanguage } from "@/lib/i18n/config";
import { label, meta } from "@/lib/labels";
import { daysUntil, formatDate, formatDateTime, formatFileSize } from "@/lib/format";
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
  const status = meta.request(request.status, dict);
  const remaining = daysUntil(request.dueDate);
  const overdue = remaining !== null && remaining < 0 && request.status === "PENDING";
  /**
   * Mirrors the rule the service enforces. Submitting while Vionex is reading
   * used to be allowed, which let a supplier replace the file underneath a
   * reviewer mid-decision; what the rejection *is for* is coming back, so that
   * state stays open.
   */
  const canSubmit = request.status === "PENDING" || request.status === "REJECTED";
  const needsCorrection = request.status === "REJECTED";
  const underReview = request.status === "SUBMITTED" || request.status === "IN_REVIEW";


  return (
    <div className="mx-auto max-w-[820px]">
      <Link
        href="/supplier/action-required"
        className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-3.5" />
        {dict.portal.requests.title}
      </Link>

      <div className="mb-7">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[26px] leading-tight font-semibold tracking-[-0.02em] text-ink">
            {request.title}
          </h1>
          <SolidBadge tone={status.tone}>{status.label}</SolidBadge>
        </div>
        <p className="mt-1.5 text-[14px] text-muted">
          {request.project.name} · {label.documentType(request.type, dict)}
        </p>
      </div>

      <Panel className="mb-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-5 p-5 sm:grid-cols-3">
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              {dict.portal.requests.requestedBy}
            </dt>
            <dd className="mt-1.5 text-sm text-ink">
              {request.requestedBy.name}
              {request.requestedBy.jobTitle ? (
                <span className="block text-[13px] text-muted">{request.requestedBy.jobTitle}</span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              {dict.portal.requests.due}
            </dt>
            <dd className={cn("mt-1.5 text-sm", overdue ? "font-medium text-risk" : "text-ink")}>
              {formatDate(request.dueDate, locale)}
              {remaining !== null && request.status === "PENDING" ? (
                <span className="block text-[13px] font-normal">
                  {overdue
                    ? dict.portal.requests.overdue
                    : remaining === 0
                      ? dict.portal.requests.dueToday
                      : plural(dict.portal.requests.dueInDays, remaining)}
                </span>
              ) : null}
            </dd>
          </div>
          <div>
            <dt className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              {dict.common.status}
            </dt>
            <dd className="mt-1.5 text-sm text-ink">
              {status.label}
              {request.submittedAt ? (
                <span className="block text-[13px] text-muted">
                  {interpolate(dict.portal.requests.submittedOn, {
                    date: formatDate(request.submittedAt, locale),
                  })}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>

        {request.description ? (
          <div className="border-t border-line px-5 py-4">
            <p className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase">
              {dict.common.description}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{request.description}</p>
          </div>
        ) : null}

        {request.reviewNote ? (
          <div
            className={
              needsCorrection
                ? "border-t border-warn/25 bg-warn-soft px-5 py-4"
                : "border-t border-line bg-subtle px-5 py-4"
            }
          >
            <p
              className={
                needsCorrection
                  ? "text-[11px] font-semibold tracking-[0.06em] text-warn uppercase"
                  : "text-[11px] font-semibold tracking-[0.06em] text-muted uppercase"
              }
            >
              {needsCorrection ? dict.portal.requests.changesRequested : "Vionex"}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-wrap text-ink">
              {request.reviewNote}
            </p>
          </div>
        ) : null}
      </Panel>

      {/*
        The state, said plainly. A supplier arriving at this page should know in
        one line whether the ball is theirs — "REJECTED" on a badge does not
        answer that, and it also sounds final when the process is not.
      */}
      {needsCorrection || underReview || request.status === "APPROVED" ? (
        <Panel className="mb-6">
          <div className="flex items-start gap-3 px-5 py-4">
            {needsCorrection ? (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-warn" />
            ) : underReview ? (
              <Clock className="mt-0.5 size-4 shrink-0 text-info" />
            ) : (
              <CircleCheck className="mt-0.5 size-4 shrink-0 text-ok" />
            )}
            <p className="text-[13px] leading-relaxed text-ink-soft">
              {needsCorrection
                ? dict.portal.requests.changesRequestedHint
                : underReview
                  ? dict.portal.requests.underReviewHint
                  : dict.portal.requests.approvedHint}
            </p>
          </div>
        </Panel>
      ) : null}

      {/* Files already submitted for this request */}
      {request.document && request.document.versions.length > 0 ? (
        <Panel className="mb-6">
          <PanelHeader title={dict.portal.documents.title} />
          <ul className="divide-y divide-line-soft">
            {request.document.versions.map((version) => (
              <li key={version.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <FileText className="size-4 shrink-0 text-faint" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{version.fileName}</p>
                    <p className="mt-0.5 text-[13px] text-muted">
                      v{version.version} · {formatFileSize(version.fileSize)} ·{" "}
                      {formatDateTime(version.createdAt, locale)}
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/files/${version.id}`}
                  className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-medium text-brand-strong hover:underline"
                >
                  <Download className="size-3.5" />
                  {dict.common.download}
                </a>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {reviews.length > 0 ? (
        <Panel className="mb-6">
          <div className="p-5">
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
          </div>
        </Panel>
      ) : null}

      {/* Conversation on this request */}
      {request.replies.length > 0 ? (
        <Panel className="mb-6">
          <PanelHeader title={dict.portal.requests.history} />
          <ul className="divide-y divide-line-soft">
            {request.replies.map((reply) => (
              <li key={reply.id} className="px-5 py-3.5">
                <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink">{reply.body}</p>
                <p className="mt-1 text-[12px] text-muted">
                  {reply.author.supplierId
                    ? dict.portal.requests.fromYou
                    : dict.portal.requests.fromVionex}
                  {" · "}
                  {formatDateTime(reply.createdAt, locale)}
                </p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}

      {canSubmit ? (
        <Panel>
          <PanelHeader
            title={
              needsCorrection
                ? dict.portal.requests.resubmit
                : dict.portal.requests.uploadTitle
            }
          />
          <div className="p-5">
            <SubmitRequestForm
              requestId={request.id}
              projectId={request.project.id}
              dict={dict}
              accept={ACCEPT_ATTRIBUTE}
              maxSizeMb={maxUploadMb()}
            />
          </div>
        </Panel>
      ) : null}
    </div>
  );
}
