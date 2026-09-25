"use client";

import { useState } from "react";
import styles from "./setup-report.module.css";

type Setting = { id: string; group: string | null; name: string | null; value: string | null; desc: string | null };
const PAGE_SIZE = 20;

export function SettingsReportTable({ settings }: { settings: Setting[] }) {
  const [page, setPage] = useState(1);
  const sorted = [...settings].sort((a, b) =>
    (a.group || "Ungrouped").localeCompare(b.group || "Ungrouped") ||
    (a.name || "").localeCompare(b.name || ""));
  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = sorted.slice(start, start + PAGE_SIZE);
  const controls = <nav className={styles.pager} aria-label="Settings report pages">
    <button className="button-secondary" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
    <span aria-live="polite">Page {currentPage} of {pages} · Settings {sorted.length ? start + 1 : 0}–{Math.min(start + PAGE_SIZE, sorted.length)} of {sorted.length}</span>
    <button className="button-secondary" disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next</button>
  </nav>;
  function table(rows: Setting[]) {
    const groups = [...new Set(rows.map(setting => setting.group || "Ungrouped"))];
    return <table className={`${styles.table} ${styles.settingsTable}`}>
      <thead><tr><th className={styles.groupColumn}>Group</th><th className={styles.optionColumn}>Option</th><th>Current Value</th><th>Description</th></tr></thead>
      {groups.map(group => <tbody key={group}>
        <tr className={styles.groupHeading}><th className={styles.groupColumn} scope="rowgroup">{group}</th><td colSpan={3} /></tr>
        {rows.filter(setting => (setting.group || "Ungrouped") === group).map(setting => <tr key={setting.id}>
          <td /><td className={`${styles.optionColumn} ${styles.optionName}`}>{setting.name}</td>
          <td>{setting.value === null || setting.value === "" ? "(Not set)" : setting.value}</td><td>{setting.desc || "—"}</td>
        </tr>)}
      </tbody>)}
      {!rows.length ? <tbody><tr><td colSpan={4}>No application settings configured.</td></tr></tbody> : null}
    </table>;
  }
  return <>
    {controls}
    <div className={styles.screenSettings}>{table(visible)}</div>
    {controls}
    <div className={styles.printSettings}>{table(sorted)}</div>
  </>;
}
