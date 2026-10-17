"use client";

import type { KeyboardEvent } from "react";

export type TabItem = { id: string; label: string };

export function Tabs({
  tabs,
  active,
  onChange,
  label,
  idPrefix,
}: {
  tabs: readonly TabItem[];
  active: string;
  onChange: (id: string) => void;
  label: string;
  idPrefix: string;
}) {
  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    const nextTab = tabs[next];
    if (!nextTab) return;
    onChange(nextTab.id);
    document.getElementById(`${idPrefix}-tab-${nextTab.id}`)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="nav-scroll flex gap-7 overflow-x-auto border-b border-line">
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`${idPrefix}-tab-${tab.id}`}
          type="button"
          role="tab"
          aria-selected={active === tab.id}
          aria-controls={`${idPrefix}-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => onKeyDown(event, index)}
          className={`min-h-11 shrink-0 border-b-2 px-1 py-3 text-caption font-semibold transition-colors ${active === tab.id ? "border-accent text-accent-strong" : "border-transparent text-ink-muted hover:text-ink"}`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
