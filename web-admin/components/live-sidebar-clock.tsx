"use client";

import { useEffect, useState } from "react";

const SIDEBAR_TIME_ZONE = "America/Chicago";

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: SIDEBAR_TIME_ZONE,
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  timeZone: SIDEBAR_TIME_ZONE,
});

type Props = {
  separator?: string;
};

export function LiveSidebarClock({ separator = " - " }: Props) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(new Date());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <p suppressHydrationWarning>
      {dateFormatter.format(now)}
      {separator}
      {timeFormatter.format(now)}
    </p>
  );
}
