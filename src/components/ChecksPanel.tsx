import React, { useState } from 'react';
import { ShieldCheck, AlertTriangle, ChevronDown } from 'lucide-react';
import { DataIssue, IssueKind } from '../utils/checks';
import { formatDateBE } from '../utils/calculations';

const KIND_LABEL: Record<IssueKind, string> = {
  overlap: 'Overlap',
  'zero-duration': '0 minuten',
  'zero-km': '0 km',
  'vacation-reversed': 'Vakantie'
};

/**
 * Blok "Controle": toont bestaande problemen in de data. Er wordt niets automatisch
 * aangepast of verwijderd; je kuist zelf op via de lijst hieronder of het tabblad Ritten.
 */
export const ChecksPanel: React.FC<{ issues: DataIssue[] }> = ({ issues }) => {
  const [open, setOpen] = useState(false);

  if (issues.length === 0) {
    return (
      <div className="card-panel px-4 py-3 flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
        <ShieldCheck className="w-4 h-4" />
        <span className="font-semibold">Controle: geen problemen gevonden.</span>
      </div>
    );
  }

  return (
    <section aria-label="Controle" className="card-panel border-amber-300 dark:border-amber-800/70 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls="checks-list"
        className="w-full px-4 py-3 flex items-center justify-between gap-3 text-left bg-amber-50/70 dark:bg-amber-950/30"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-amber-800 dark:text-amber-200">
          <AlertTriangle className="w-4 h-4" />
          Controle: {issues.length} {issues.length === 1 ? 'probleem' : 'problemen'} in je gegevens
        </span>
        <ChevronDown className={`w-4 h-4 text-amber-700 dark:text-amber-300 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <ul id="checks-list" className="divide-y divide-[var(--panel-border)]">
          {issues.map(issue => (
            <li key={issue.key} className="px-4 py-2.5 flex items-start gap-3 text-xs">
              <span className="shrink-0 mt-0.5 px-2 py-0.5 rounded-full font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200">
                {KIND_LABEL[issue.kind]}
              </span>
              <span className="min-w-0">
                <span className="font-semibold text-[var(--text-main)] capitalize">{formatDateBE(issue.date)}</span>
                <span className="text-[var(--text-muted)]"> — {issue.message}</span>
              </span>
            </li>
          ))}
          <li className="px-4 py-2 text-[11px] text-[var(--text-muted)]">
            Er wordt niets automatisch aangepast. Pas of verwijder de registratie zelf in de lijst (of bij Ritten).
          </li>
        </ul>
      )}
    </section>
  );
};
