"use client";

import * as React from "react";
import { interpolate } from "@/lib/i18n/dictionary";

const subscribe = () => () => {};

/**
 * "Good morning" by the supplier's clock, not the server's.
 *
 * The server runs in UTC and a manufacturer may be in Shenzhen or Munich, so a
 * greeting picked on the server was wrong for most of them for part of every
 * day. The server renders a neutral "Hello"; the browser, which knows the local
 * hour, swaps in the time of day as it hydrates.
 */
export function Greeting({
  name,
  labels,
  className,
}: {
  name: string;
  labels: { neutral: string; morning: string; afternoon: string; evening: string };
  className?: string;
}) {
  const hour = React.useSyncExternalStore(
    subscribe,
    () => new Date().getHours(),
    () => null,
  );

  const template =
    hour === null
      ? labels.neutral
      : hour < 12
        ? labels.morning
        : hour < 18
          ? labels.afternoon
          : labels.evening;

  return <h1 className={className}>{interpolate(template, { name })}</h1>;
}
