// Autor: Nina Kaljević ([student ID omitted]) - SSU6-10
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { cancelMobileReservation, createMobileReservation, getMobileReservationDefaults, getMobileReservations } from '../api/mobileReservations';
import type { MobileReservation, MobileReservationZone } from '../api/mobileReservations';
import { getMobileMenuCatalog } from '../api/mobileMenu';
import CalendarIcon from '../components/icons/CalendarIcon';
import ClockIcon from '../components/icons/ClockIcon';
import FilterIcon from '../components/icons/FilterIcon';
import LocationIcon from '../components/icons/LocationIcon';
import PeopleIcon from '../components/icons/PeopleIcon';
import PlusIcon from '../components/icons/PlusIcon';
import TrashIcon from '../components/icons/TrashIcon';
import SearchIcon from '../components/icons/SearchIcon';
import CategoryPills from '../components/menu/CategoryPills';
import MenuItemCard from '../components/menu/MenuItemCard';
import PrimaryActionButton from '../components/ui/PrimaryActionButton';
import QuantityStepper from '../components/ui/QuantityStepper';
import SectionTitle from '../components/ui/SectionTitle';
import StandardBottomSheet from '../components/ui/StandardBottomSheet';
import { useMobileAuth } from '../context/MobileAuthContext';
import { useModal } from '../context/ModalContext';
import { useReservation } from '../context/ReservationContext';
import { useToast } from '../context/ToastContext';
import type { Category, MenuItem, ReservationDraft } from '../types';

const fallbackZones: MobileReservationZone[] = [
  { key: 'none', label: 'Bez preferencije' },
  { key: 'inside', label: 'Unutra' },
  { key: 'garden', label: 'Bašta' },
  { key: 'window', label: 'Pored prozora' },
];
const allCategory: Category = { key: 'sve', label: 'Sve', emoji: '✦' };
const fallbackDeposit = 500;
const MIN_RESERVATION_LEAD_MINUTES = 15;

type PickerSheet = 'date' | 'time' | 'zone' | null;

function formatPrice(value: number) {
  return `${Math.round(value).toLocaleString('sr-RS')} RSD`;
}

function isUpcomingReservation(item: MobileReservation) {
  const startsAt = new Date(item.startsAt).getTime();
  return Number.isNaN(startsAt) || startsAt > Date.now();
}

const reservationMonths = [
  'Januar',
  'Februar',
  'Mart',
  'April',
  'Maj',
  'Jun',
  'Jul',
  'Avgust',
  'Septembar',
  'Oktobar',
  'Novembar',
  'Decembar',
];

const reservationWeekDays = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned'];

function padNumber(value: number) {
  return String(value).padStart(2, '0');
}

function parseReservationDate(value?: string) {
  if (!value) return null;

  const [year, month, day] = value.split('-').map(Number);

  if (!year || !month || !day) return null;

  const date = new Date(year, month - 1, day, 12, 0, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toReservationDateValue(date: Date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function getTodayReservationValue() {
  return toReservationDateValue(new Date());
}

function isReservationDateInPast(date: Date) {
  return toReservationDateValue(date) < getTodayReservationValue();
}

function getSafeCalendarDate(value?: string) {
  const parsedDate = parseReservationDate(value);
  return parsedDate && !isReservationDateInPast(parsedDate) ? parsedDate : new Date();
}

function formatDateLabel(value?: string) {
  const date = parseReservationDate(value);

  if (!date) return value || 'Izaberite datum';

  return new Intl.DateTimeFormat('sr-RS', { weekday: 'short', day: '2-digit', month: 'short' })
    .format(date)
    .replace(',', '');
}

function formatFullDateLabel(value?: string) {
  const date = parseReservationDate(value);

  if (!date) return value || 'Izaberite datum';

  return `${padNumber(date.getDate())}.${padNumber(date.getMonth() + 1)}.${date.getFullYear()}.`;
}

function formatTimeLabel(value?: string) {
  if (!value) return 'Izaberite vreme';
  const [hour = '00', minute = '00'] = value.split(':');
  return `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

function splitReservationTime(value: string) {
  const [rawHour = '20', rawMinute = '00'] = value.split(':');
  const hour = /^\d{1,2}$/.test(rawHour) ? padNumber(Math.min(23, Math.max(0, Number(rawHour)))) : '20';
  const minute = /^\d{1,2}$/.test(rawMinute) ? padNumber(Math.min(59, Math.max(0, Number(rawMinute)))) : '00';
  return { hour, minute };
}

function getReservationDateTime(dateValue: string, timeValue: string) {
  const date = parseReservationDate(dateValue);
  const { hour, minute } = splitReservationTime(timeValue);

  if (!date) return null;

  const result = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    Number(hour),
    Number(minute),
    0,
    0,
  );

  return Number.isNaN(result.getTime()) ? null : result;
}

function isReservationTooSoon(dateValue: string, timeValue: string) {
  const startsAt = getReservationDateTime(dateValue, timeValue);
  return !startsAt || startsAt.getTime() < Date.now() + MIN_RESERVATION_LEAD_MINUTES * 60_000;
}

function getZoneLabel(zones: MobileReservationZone[], key: string) {
  return zones.find((zone) => zone.key === key)?.label ?? 'Bez preferencije';
}

function SelectButton({ icon, label, value, onClick }: { icon: ReactNode; label: string; value: string; onClick: () => void }) {
  return (
    <button className="reservation-select-row" type="button" onClick={onClick}>
      <span className="reservation-field-icon">{icon}</span>
      <span className="reservation-select-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </span>
      <span className="reservation-select-chevron" aria-hidden="true">▾</span>
    </button>
  );
}

function DateFieldButton({ value, onClick }: { value: string; onClick: () => void }) {
  return (
    <button className="reservation-select-row reservation-picker-trigger" type="button" onClick={onClick}>
      <span className="reservation-field-icon"><CalendarIcon /></span>
      <span className="reservation-select-copy">
        <span>Datum</span>
        <strong>{value ? formatFullDateLabel(value) : 'Izaberite datum'}</strong>
      </span>
      <span className="reservation-select-chevron" aria-hidden="true">▾</span>
    </button>
  );
}

function TimeFieldButton({ value, onClick }: { value: string; onClick: () => void }) {
  return (
    <button className="reservation-select-row reservation-picker-trigger" type="button" onClick={onClick}>
      <span className="reservation-field-icon"><ClockIcon /></span>
      <span className="reservation-select-copy">
        <span>Vreme</span>
        <strong>{value ? formatTimeLabel(value) : 'Izaberite vreme'}</strong>
      </span>
      <span className="reservation-select-chevron" aria-hidden="true">▾</span>
    </button>
  );
}

export default function ReservationScreen() {
  const navigate = useNavigate();
  const { session, user, isAuthenticated, isAnonymous, isCheckingSession } = useMobileAuth();
  const { showToast } = useToast();
  const { reservation, setReservation, removePreorder } = useReservation();
  const { openItem } = useModal();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([allCategory]);
  const [zoneOptions, setZoneOptions] = useState<MobileReservationZone[]>(fallbackZones);
  const [menuLoading, setMenuLoading] = useState(true);
  const [menuError, setMenuError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSheet, setPickerSheet] = useState<PickerSheet>(null);
  const [calendarViewDate, setCalendarViewDate] = useState(() => getSafeCalendarDate(reservation.date));
  const [timeDraft, setTimeDraft] = useState(() => splitReservationTime(reservation.time || '20:00'));
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerCategory, setPickerCategory] = useState('sve');
  const [submitting, setSubmitting] = useState(false);
  const [knownReservations, setKnownReservations] = useState<MobileReservation[]>([]);
  const [cancelTarget, setCancelTarget] = useState<MobileReservation | null>(null);
  const [cancellingReservationId, setCancellingReservationId] = useState<string | null>(null);
  const pickerRefs = useRef<Record<string, HTMLElement | null>>({});
  const reservationListRef = useRef<HTMLDivElement | null>(null);
  const reservationCardRefs = useRef<Record<string, HTMLElement | null>>({});
  const preorderTotal = useMemo(() => reservation.preorder.reduce((sum, item) => sum + item.totalPrice, 0), [reservation.preorder]);
  const payableTotal = preorderTotal > 0 ? preorderTotal : reservation.ownerDeposit ?? fallbackDeposit;
  const upcomingReservations = useMemo(() => {
    return knownReservations
      .filter((item) => item.status === 'confirmed')
      .filter(isUpcomingReservation)
      .sort((first, second) => new Date(first.startsAt).getTime() - new Date(second.startsAt).getTime());
  }, [knownReservations]);
  const canGoPreviousMonth = useMemo(() => {
    const today = new Date();
    const currentMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const visibleMonth = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), 1);
    return visibleMonth > currentMonth;
  }, [calendarViewDate]);
  const calendarDays = useMemo(() => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const totalDays = new Date(year, month + 1, 0).getDate();
    const emptySlots = (firstDay.getDay() + 6) % 7;

    return {
      emptySlots: Array.from({ length: emptySlots }),
      days: Array.from({ length: totalDays }, (_, index) => index + 1),
    };
  }, [calendarViewDate]);
  const timeHours = useMemo(() => Array.from({ length: 24 }, (_, index) => padNumber(index)), []);
  const timeMinutes = useMemo(() => Array.from({ length: 60 }, (_, index) => padNumber(index)), []);

  useEffect(() => {
    if (!session?.token || isAnonymous) {
      setMenuLoading(false);
      setMenuError('');
      setItems([]);
      setCategories([allCategory]);
      return undefined;
    }

    let mounted = true;

    setMenuLoading(true);
    setMenuError('');

    getMobileMenuCatalog()
      .then((catalog) => {
        if (!mounted) return;
        setItems(catalog.items);
        setCategories([allCategory, ...catalog.categories]);
      })
      .catch((err: unknown) => {
        if (!mounted) return;
        setMenuError(err instanceof Error ? err.message : 'Meni za preorder nije učitan.');
        setItems([]);
        setCategories([allCategory]);
      })
      .finally(() => {
        if (mounted) setMenuLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [isAnonymous, session?.token]);

  useEffect(() => {
    if (!session?.token || isAnonymous) return;

    let mounted = true;

    getMobileReservationDefaults(session.token)
      .then((defaults) => {
        if (!mounted) return;
        const nextZones = defaults.zones?.length ? defaults.zones : fallbackZones;
        setZoneOptions(nextZones);
        setReservation({
          ...reservation,
          ownerDeposit: defaults.depositAmount || reservation.ownerDeposit || fallbackDeposit,
          name: reservation.name || defaults.user?.name || user?.fullName || '',
          phone: reservation.phone || defaults.user?.phone || user?.phone || '',
          zone: nextZones.some((zone) => zone.key === reservation.zone) ? reservation.zone : 'none',
        });
      })
      .catch(() => null);

    return () => {
      mounted = false;
    };
  }, [isAnonymous, session?.token]);

  useEffect(() => {
    if (!session?.token || isAnonymous) {
      setKnownReservations([]);
      return undefined;
    }

    let cancelled = false;
    const token = session.token;

    const refreshReservations = async () => {
      try {
        const response = await getMobileReservations(token);
        if (!cancelled) setKnownReservations(response.reservations ?? []);
      } catch {
        // Zadržavamo poslednje uspešno stanje umesto da lista treperi pri kratkom prekidu mreže.
      }
    };

    void refreshReservations();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshReservations();
    }, 10_000);

    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [isAnonymous, session?.token]);

  const pickerQuery = pickerSearch.trim().toLowerCase();
  const filteredPickerItems = useMemo(() => {
    return items.filter((item) => {
      if (!pickerQuery) return true;
      return `${item.name} ${item.desc} ${item.composition ?? ''}`.toLowerCase().includes(pickerQuery);
    });
  }, [items, pickerQuery]);

  const pickerGroups = useMemo(() => {
    return categories
      .filter((category) => category.key !== 'sve')
      .map((category) => ({ category, items: filteredPickerItems.filter((item) => item.cat === category.key) }))
      .filter((group) => group.items.length > 0);
  }, [categories, filteredPickerItems]);

  const update = <K extends keyof ReservationDraft>(key: K, value: ReservationDraft[K]) => {
    setReservation({ ...reservation, [key]: value });
  };

  const handleDateChange = (value: string) => {
    setReservation({ ...reservation, date: value, dateLabel: formatDateLabel(value) });
  };

  const handleTimeChange = (value: string) => {
    update('time', value);
  };

  const openDatePicker = () => {
    setCalendarViewDate(getSafeCalendarDate(reservation.date));
    setPickerSheet('date');
  };

  const openTimePicker = () => {
    setTimeDraft(splitReservationTime(reservation.time || '20:00'));
    setPickerSheet('time');
  };

  const selectCalendarDay = (day: number) => {
    const nextDate = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day, 12, 0, 0);

    if (isReservationDateInPast(nextDate)) return;

    handleDateChange(toReservationDateValue(nextDate));
    setPickerSheet(null);
  };

  const applyTimePicker = () => {
    const nextTime = `${timeDraft.hour}:${timeDraft.minute}`;

    if (reservation.date && isReservationTooSoon(reservation.date, nextTime)) {
      showToast('error', `Termin mora biti najmanje ${MIN_RESERVATION_LEAD_MINUTES} minuta unapred.`, 'reservation');
      return;
    }

    handleTimeChange(nextTime);
    setPickerSheet(null);
  };

  const handleZoneChange = (value: string) => {
    update('zone', value);
    setPickerSheet(null);
  };

  const handlePickerCategory = (key: string) => {
    setPickerCategory(key);
    if (key === 'sve') {
      document.querySelector('.reservation-picker-sheet')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.setTimeout(() => pickerRefs.current[key]?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
  };

  const confirmCancellation = async () => {
    if (!session?.token || !cancelTarget || cancellingReservationId) return;

    setCancellingReservationId(cancelTarget.id);

    try {
      const response = await cancelMobileReservation(session.token, cancelTarget.id);
      setKnownReservations((current) => current.filter((item) => item.id !== cancelTarget.id));
      setCancelTarget(null);
      showToast('success', response.message || 'Rezervacija je otkazana.', 'reservation');
    } catch (error) {
      showToast('error', error instanceof Error ? error.message : 'Otkazivanje rezervacije nije uspelo.', 'reservation');
    } finally {
      setCancellingReservationId(null);
    }
  };

  const confirm = async () => {
    if (submitting) return;

    if (!session?.token || isAnonymous) {
      showToast('error', 'Rezervacije su dostupne samo registrovanim korisnicima.', 'reservation');
      return;
    }

    if (!reservation.date && !reservation.dateLabel) {
      showToast('error', 'Izaberi datum rezervacije.', 'reservation');
      return;
    }

    if (!reservation.time.trim()) {
      showToast('error', 'Izaberi vreme rezervacije.', 'reservation');
      return;
    }

    if (isReservationTooSoon(reservation.date, reservation.time)) {
      showToast('error', `Termin mora biti najmanje ${MIN_RESERVATION_LEAD_MINUTES} minuta unapred.`, 'reservation');
      return;
    }

    if (!reservation.name.trim()) {
      showToast('error', 'Unesi ime za rezervaciju.', 'reservation');
      return;
    }

    setSubmitting(true);

    try {
      const response = await createMobileReservation(session.token, reservation);

      try {
        const refreshed = await getMobileReservations(session.token);
        setKnownReservations(refreshed.reservations ?? [response.reservation]);
      } catch {
        setKnownReservations((current) => [
          response.reservation,
          ...current.filter((item) => item.id !== response.reservation.id),
        ]);
      }

      showToast(
        'success',
        response.message || `${response.reservation.table.label} je rezervisan za ${response.reservation.dateLabel} u ${response.reservation.time}.`,
        'reservation',
      );

      window.setTimeout(() => {
        const createdCard = reservationCardRefs.current[response.reservation.id];
        (createdCard ?? reservationListRef.current)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 140);
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Rezervacija nije uspela.', 'reservation');
    } finally {
      setSubmitting(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="screen ssu-group-screen ssu-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">…</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Rezervacija</p>
            <h1>Proveravamo nalog</h1>
            <p>Sačekajte trenutak dok aplikacija proveri da li možete da napravite rezervaciju.</p>
          </div>
        </section>
      </div>
    );
  }

  if (!isAuthenticated || isAnonymous) {
    return (
      <div className="screen ssu-group-screen ssu-screen ssu-reservation-locked-screen ssu-centered-access-screen">
        <section className="glass-card ssu-centered-access-card">
          <div className="ssu-centered-icon">📅</div>

          <div className="ssu-centered-copy">
            <p className="eyebrow">Rezervacija</p>
            <h1>Prijavite se za rezervaciju</h1>
            <p>
              Rezervacije i preorder su dostupni registrovanim gostima. Kao gost možete
              pregledati meni, skenirati sto i naručivati, ali rezervaciju pravite preko naloga.
            </p>
          </div>

          <div className="ssu-centered-actions">
            <button className="primary-action-button ssu-main-action" onClick={() => navigate('/login')}>
              <span>Prijavi se</span>
              <span>→</span>
            </button>

            <button className="ssu-entry-action-button" onClick={() => navigate('/register')}>
              <span>Registruj se</span>
              <span>→</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <div className="screen reservation-screen">
        {upcomingReservations.length > 0 && (
          <section className="reservation-list-section" ref={reservationListRef}>
            <SectionTitle title="Potvrđene rezervacije" />
            <div className="reservation-status-list">
              {upcomingReservations.map((item) => (
                <article
                  className="reservation-status-card glass-card is-confirmed"
                  key={item.id}
                  ref={(node) => { reservationCardRefs.current[item.id] = node; }}
                >
                  <div className="reservation-status-details">
                    <div><span>Sto</span><strong>{item.table.label} · {item.table.sector.name}</strong></div>
                    <div><span>Termin</span><strong>{item.dateLabel} u {item.time}</strong></div>
                    <div><span>Avans/preorder</span><strong>{formatPrice(item.depositAmount)}</strong></div>
                  </div>
                  <button
                    className="reservation-cancel-trigger"
                    type="button"
                    aria-label={`Otkaži rezervaciju za ${item.dateLabel} u ${item.time}`}
                    onClick={() => setCancelTarget(item)}
                  >
                    <TrashIcon />
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        <SectionTitle title="Upis rezervacije" />
        <section className="reservation-card glass-card reservation-select-card">
          <DateFieldButton value={reservation.date ?? ''} onClick={openDatePicker} />

          <TimeFieldButton value={reservation.time} onClick={openTimePicker} />

          <div className="reservation-field-row"><span className="reservation-field-icon"><PeopleIcon /></span><div className="reservation-field-main"><span>Broj gostiju</span><QuantityStepper value={reservation.guests} min={1} onMinus={() => update('guests', Math.max(1, reservation.guests - 1))} onPlus={() => update('guests', reservation.guests + 1)} /></div></div>

          <SelectButton
            icon={<LocationIcon />}
            label="Zona stola"
            value={getZoneLabel(zoneOptions, reservation.zone)}
            onClick={() => setPickerSheet('zone')}
          />
        </section>
        <SectionTitle title="Podaci za rezervaciju" />
        <section className="contact-section glass-card">
          <label className="contact-input-row"><span>Ime</span><input value={reservation.name} onChange={(event) => update('name', event.target.value)} placeholder="Vaše ime" /></label>
          <label className="contact-input-row"><span>Telefon</span><input value={reservation.phone} onChange={(event) => update('phone', event.target.value)} placeholder="Broj telefona" /></label>
        </section>
        <SectionTitle title="Napomena" />
        <section className="note-field glass-card"><textarea value={reservation.note} onChange={(event) => update('note', event.target.value)} placeholder="Dolazimo na rođendan, ako je moguće mirniji sto." rows={3} /></section>
        <section className="preorder-section glass-card">
          <div className="preorder-head"><span className="preorder-title">Preorder</span><span className="preorder-sub">Dodajte stavke koje želite da budu spremne kada stignete.</span></div>
          {reservation.preorder.length > 0 ? reservation.preorder.map((item) => (
            <div className="preorder-item-row" key={item.id}>
              <div className="preorder-item-main">
                <div className="preorder-item-title-line"><span className="preorder-item-name">{item.menuItem.name}</span><span className="preorder-item-qty">×{item.qty}</span></div>
                {item.selectedOptions.length > 0 && <small>{item.selectedOptions.map((option) => option.label).join(' · ')}</small>}
                {item.note && <small>Napomena: {item.note}</small>}
              </div>
              <div className="preorder-item-side">
                <span className="preorder-item-price">{formatPrice(item.totalPrice)}</span>
                <button className="preorder-remove-button" type="button" aria-label={`Ukloni ${item.menuItem.name}`} onClick={() => removePreorder(item.id)}>
                  <TrashIcon />
                </button>
              </div>
            </div>
          )) : <div className="preorder-empty-line">Još nema preorder stavki.</div>}
          <button className="preorder-add-button" type="button" onClick={() => setPickerOpen(true)}><span className="preorder-plus"><PlusIcon /></span><span>Dodaj stavke iz menija</span></button>
          <div className="preorder-note">Preorder nije obavezan. Ako ga nema, evidentira se osnovni avans.</div>
        </section>
        <section className="reservation-summary-card glass-card">
          <div className="summary-row"><span>Datum</span><span>{formatDateLabel(reservation.date ?? reservation.dateLabel)}</span></div>
          <div className="summary-row"><span>Vreme</span><span>{reservation.time}</span></div>
          <div className="summary-row"><span>Gosti</span><span>{reservation.guests}</span></div>
          <div className="summary-row"><span>Zona</span><span>{getZoneLabel(zoneOptions, reservation.zone)}</span></div>
          <div className="summary-row"><span>Preorder</span><span>{formatPrice(preorderTotal)}</span></div>
          <div className="summary-button-row">
            <PrimaryActionButton
              label={submitting ? 'Rezervišem sto…' : 'Rezerviši sto'}
              price={formatPrice(payableTotal)}
              onClick={confirm}
              disabled={submitting}
            />
          </div>
        </section>
      </div>

      <StandardBottomSheet
        open={cancelTarget !== null}
        onClose={() => {
          if (!cancellingReservationId) setCancelTarget(null);
        }}
        ariaLabel="Potvrda otkazivanja rezervacije"
        sheetClassName="reservation-cancel-sheet"
      >
        {cancelTarget && (
          <div className="reservation-cancel-dialog">
            <div className="reservation-cancel-dialog-copy">
              <h2>Da li sigurno želite da otkažete rezervaciju?</h2>
              <p>
                {cancelTarget.table.label} · {cancelTarget.table.sector.name}<br />
                {cancelTarget.dateLabel} u {cancelTarget.time}
              </p>
            </div>

            <div className="reservation-cancel-dialog-actions">
              <button
                className="reservation-cancel-keep-button"
                type="button"
                onClick={() => setCancelTarget(null)}
                disabled={cancellingReservationId === cancelTarget.id}
              >
                Zadrži rezervaciju
              </button>
              <button
                className="reservation-cancel-confirm-button"
                type="button"
                onClick={() => void confirmCancellation()}
                disabled={cancellingReservationId === cancelTarget.id}
              >
                {cancellingReservationId === cancelTarget.id ? 'Otkazujem…' : 'Da, otkaži'}
              </button>
            </div>
          </div>
        )}
      </StandardBottomSheet>

      <StandardBottomSheet
        open={pickerSheet !== null}
        onClose={() => setPickerSheet(null)}
        ariaLabel="Izbor parametra rezervacije"
        sheetClassName={`reservation-option-sheet ${pickerSheet ? `reservation-${pickerSheet}-sheet` : ''}`}
      >
        {pickerSheet === 'date' && (
          <div className="reservation-calendar-panel">
            <div className="reservation-picker-title-block compact">
              <h2>Izaberite datum</h2>
              <p>Odaberite dan dolaska. Datum možete promeniti pre slanja rezervacije.</p>
            </div>

            <div className="reservation-calendar-card">
              <div className="reservation-calendar-header">
                <button
                  type="button"
                  disabled={!canGoPreviousMonth}
                  aria-label="Prethodni mesec"
                  onClick={() => setCalendarViewDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}
                >
                  ‹
                </button>
                <strong>{reservationMonths[calendarViewDate.getMonth()]} {calendarViewDate.getFullYear()}</strong>
                <button
                  type="button"
                  aria-label="Sledeći mesec"
                  onClick={() => setCalendarViewDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}
                >
                  ›
                </button>
              </div>

              <div className="reservation-calendar-grid">
                {reservationWeekDays.map((day) => <span key={day} className="reservation-calendar-day-name">{day}</span>)}
                {calendarDays.emptySlots.map((_, index) => <span key={`empty-${index}`} className="reservation-calendar-empty" />)}
                {calendarDays.days.map((day) => {
                  const date = new Date(calendarViewDate.getFullYear(), calendarViewDate.getMonth(), day, 12, 0, 0);
                  const currentValue = toReservationDateValue(date);
                  const todayValue = getTodayReservationValue();
                  const isSelected = reservation.date === currentValue;
                  const isToday = todayValue === currentValue;
                  const isPast = currentValue < todayValue;

                  return (
                    <button
                      key={day}
                      type="button"
                      disabled={isPast}
                      className={`reservation-calendar-day${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}${isPast ? ' disabled' : ''}`}
                      onClick={() => selectCalendarDay(day)}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {pickerSheet === 'time' && (
          <div className="reservation-time-panel">
            <div className="reservation-picker-title-block compact">
              <h2>Izaberite vreme</h2>
              <p>Podesite vreme dolaska, najmanje 15 minuta unapred.</p>
            </div>

            <div className="reservation-time-display">{timeDraft.hour}:{timeDraft.minute}</div>

            <div className="reservation-time-wheel-grid">
              <div className="reservation-time-wheel-column">
                <span>Sati</span>
                <div className="reservation-time-wheel-scroll custom-scrollbar">
                  {timeHours.map((hour) => (
                    <button
                      key={hour}
                      type="button"
                      className={`reservation-time-option${timeDraft.hour === hour ? ' active' : ''}`}
                      onClick={() => setTimeDraft((current) => ({ ...current, hour }))}
                    >
                      {hour}
                    </button>
                  ))}
                </div>
              </div>

              <div className="reservation-time-wheel-column">
                <span>Minuti</span>
                <div className="reservation-time-wheel-scroll custom-scrollbar">
                  {timeMinutes.map((minute) => (
                    <button
                      key={minute}
                      type="button"
                      className={`reservation-time-option${timeDraft.minute === minute ? ' active' : ''}`}
                      onClick={() => setTimeDraft((current) => ({ ...current, minute }))}
                    >
                      {minute}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button type="button" className="reservation-time-done-button" onClick={applyTimePicker}>Gotovo</button>
          </div>
        )}

        {pickerSheet === 'zone' && (
          <div className="reservation-zone-panel">
            <div className="reservation-picker-title-block compact reservation-zone-title-block">
              <h2>Izaberite zonu stola</h2>
              <p>Ako nemate preferenciju, lokal će dodeliti najbolji slobodan sto.</p>
            </div>

            <div className="reservation-option-list">
              {zoneOptions.map((option) => (
                <button className={`reservation-option-row${reservation.zone === option.key ? ' selected' : ''}`} type="button" key={option.key} onClick={() => handleZoneChange(option.key)}>
                  <span>{option.label}</span>
                  {option.description ? <small>{option.description}</small> : null}
                </button>
              ))}
            </div>
          </div>
        )}
      </StandardBottomSheet>

      <StandardBottomSheet
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        ariaLabel="Dodavanje preorder stavki"
        sheetClassName="reservation-picker-sheet"
      >
        <div className="picker-head-row">
          <div>
            <h2>Meni za preorder</h2>
            <p>Dodajte stavku bez napuštanja rezervacije.</p>
          </div>
        </div>

        <div className="search-wrap picker-search">
          <span className="search-icon"><SearchIcon /></span>
          <input className="search-input" value={pickerSearch} onChange={(event) => setPickerSearch(event.target.value)} placeholder="Pretraži meni" />
          <span className="search-filter"><FilterIcon /></span>
        </div>

        <CategoryPills categories={categories} active={pickerCategory} onSelect={handlePickerCategory} />
        <div className="reservation-picker-list">
          {menuLoading && <div className="empty-state compact"><div className="empty-title">Učitavam meni</div><p>Preorder sada čita bazu, jer mock kuhinja ipak nema konobara.</p></div>}
          {!menuLoading && menuError && <div className="empty-state compact"><div className="empty-title">Meni nije učitan</div><p>{menuError}</p></div>}
          {!menuLoading && !menuError && pickerGroups.map(({ category, items: groupItems }) => (
            <section className="menu-category-section picker-category-section" key={category.key} ref={(node) => { pickerRefs.current[category.key] = node; }}>
              <div className="menu-category-title-row"><h2>{category.label}</h2><span>{groupItems.length} stavki</span></div>
              <div className="product-list">{groupItems.map((item) => <MenuItemCard key={item.id} item={item} onOpen={(menuItem) => openItem(menuItem, 'preorder')} />)}</div>
            </section>
          ))}
          {!menuLoading && !menuError && pickerGroups.length === 0 && <div className="empty-state compact"><div className="empty-title">Nema stavki</div><p>Promeni pretragu ili kategoriju.</p></div>}
        </div>
      </StandardBottomSheet>
    </>
  );
}
