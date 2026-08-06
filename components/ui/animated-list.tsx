"use client";

import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function AnimatedList({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {Children.map(children, (child, index) => (
        <div
          className="animated-list-item"
          style={{ "--animated-list-index": index } as CSSProperties}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
