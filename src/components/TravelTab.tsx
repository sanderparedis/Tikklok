import React, { useState } from 'react';
import { Car, Bike, Plus, Trash2, MapPin } from 'lucide-react';
import { TravelEntry, TransportType } from '../types';
import { TRANSPORT_RATES, LOCATIONS, ROUTE_DISTANCES } from '../utils/calculations';

interface TravelTabProps {
  travelEntries: TravelEntry[];
  onAddTravelEntry: (e: React.FormEvent<HTMLFormElement>) => void;
  onDeleteTravelEntry: (id: string) => void;
  defaultDate: string;
}

export const TravelTab: React.FC<TravelTabProps> = ({
  travelEntries,
  onAddTravelEntry,
  onDeleteTravelEntry,
  defaultDate
}) => {
  const [routeType, setRouteType] = useState<'preset' | 'custom'>('preset');
  const [startLoc, setStartLoc] = useState<string>(LOCATIONS[0]);
  const [endLoc, setEndLoc] = useState<string>(LOCATIONS[1]);
  const [transportType, setTransportType] = useState<TransportType>('auto');

  const calculatedDistance = ROUTE_DISTANCES[startLoc]?.[endLoc] || 0;

  const totalKm = travelEntries.reduce((acc, t) => acc + t.distance, 0);
  const totalComp = travelEntries.reduce((acc, t) => acc + (t.distance * TRANSPORT_RATES[t.type]), 0);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="card-panel p-5">
          <div className="flex items-center justify-between text-brand-primary mb-2">
            <span className="label-tiny !mb-0 text-brand-primary font-semibold">Totaal Afstand</span>
            <Car className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-[var(--text-main)]">
            {totalKm.toFixed(1)} km
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Over alle geregistreerde ritten
          </p>
        </div>

        <div className="card-panel p-5">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400 mb-2">
            <span className="label-tiny !mb-0 text-emerald-700 dark:text-emerald-300 font-semibold">Totaal Vergoeding</span>
            <Bike className="w-4 h-4" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400">
            € {totalComp.toFixed(2)}
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Auto (€{TRANSPORT_RATES.auto}/km) • Fiets (€{TRANSPORT_RATES.fiets}/km)
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="card-panel p-6">
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-4 h-4 text-brand-primary" />
          <h2 className="text-sm font-bold text-[var(--text-main)]">Verplaatsing Registreren</h2>
        </div>

        <form onSubmit={onAddTravelEntry} className="space-y-4">
          {/* Transport Type Toggle */}
          <div>
            <label className="label-tiny">Vervoermiddel</label>
            <input type="hidden" name="type" value={transportType} />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTransportType('auto')}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  transportType === 'auto'
                    ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                    : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-[var(--text-muted)]'
                }`}
              >
                <Car className="w-4 h-4" />
                <span>Auto (€{TRANSPORT_RATES.auto} / km)</span>
              </button>

              <button
                type="button"
                onClick={() => setTransportType('fiets')}
                className={`py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${
                  transportType === 'fiets'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-[var(--text-muted)]'
                }`}
              >
                <Bike className="w-4 h-4" />
                <span>Fiets (€{TRANSPORT_RATES.fiets} / km)</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label-tiny">Datum</label>
              <input
                type="date"
                name="date"
                required
                defaultValue={defaultDate}
                className="input-field"
              />
            </div>

            <div>
              <label className="label-tiny">Type Traject</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setRouteType('preset')}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    routeType === 'preset'
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-[var(--text-muted)]'
                  }`}
                >
                  Standaard Route
                </button>
                <button
                  type="button"
                  onClick={() => setRouteType('custom')}
                  className={`flex-1 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                    routeType === 'custom'
                      ? 'border-brand-primary bg-brand-primary/10 text-brand-primary'
                      : 'border-[var(--panel-border)] bg-[var(--input-bg)] text-[var(--text-muted)]'
                  }`}
                >
                  Vrije Invoer
                </button>
              </div>
            </div>
          </div>

          {routeType === 'preset' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-[var(--panel-border)]">
              <div>
                <label className="label-tiny">Vertreklocatie</label>
                <select
                  value={startLoc}
                  onChange={(e) => setStartLoc(e.target.value)}
                  className="input-field"
                >
                  {LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label-tiny">Aankomstlocatie</label>
                <select
                  value={endLoc}
                  onChange={(e) => setEndLoc(e.target.value)}
                  className="input-field"
                >
                  {LOCATIONS.filter(loc => loc !== startLoc).map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <input type="hidden" name="distance" value={calculatedDistance} />
              <input type="hidden" name="description" value={`${startLoc} - ${endLoc}`} />

              <div className="sm:col-span-2 flex justify-between items-center text-xs text-[var(--text-muted)] pt-2 border-t border-[var(--panel-border)]">
                <span>Berekende afstand: <strong className="font-mono text-sm text-[var(--text-main)]">{calculatedDistance} km</strong></span>
                <span>Vergoeding: <strong className="font-mono text-sm text-emerald-600 dark:text-emerald-400">€ {(calculatedDistance * TRANSPORT_RATES[transportType]).toFixed(2)}</strong></span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-tiny">Omschrijving Traject</label>
                <input
                  type="text"
                  name="description"
                  required
                  placeholder="bijv. Huisbezoek / Cursus Hasselt"
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-tiny">Afstand (in kilometers)</label>
                <input
                  type="number"
                  name="distance"
                  step="0.1"
                  min="0.1"
                  required
                  placeholder="bijv. 14.5"
                  className="input-field"
                />
              </div>
            </div>
          )}

          <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
            <Plus className="w-4 h-4" />
            <span>Verplaatsing Toevoegen</span>
          </button>
        </form>
      </div>

      {/* Travel Entries List */}
      <div className="card-panel overflow-hidden">
        <div className="p-4 border-b border-[var(--panel-border)]">
          <h2 className="text-base font-bold text-[var(--text-main)]">
            Geregistreerde Verplaatsingen ({travelEntries.length})
          </h2>
        </div>

        {travelEntries.length === 0 ? (
          <div className="p-8 text-center text-sm text-[var(--text-muted)]">
            Geen verplaatsingen geregistreerd.
          </div>
        ) : (
          <div className="divide-y divide-[var(--panel-border)]">
            {travelEntries.map(entry => {
              const comp = entry.distance * TRANSPORT_RATES[entry.type];
              return (
                <div
                  key={entry.id}
                  className="p-4 flex items-center justify-between hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[var(--text-muted)]">
                      {entry.type === 'auto' ? <Car className="w-4 h-4" /> : <Bike className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-[var(--text-main)]">
                        {entry.description}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {entry.date} • {entry.type === 'auto' ? 'Auto' : 'Fiets'} • {entry.distance} km
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">
                        € {comp.toFixed(2)}
                      </div>
                    </div>
                    <button
                      onClick={() => onDeleteTravelEntry(entry.id)}
                      title="Verwijderen"
                      className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
