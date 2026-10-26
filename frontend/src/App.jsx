import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from './lib/api.js';
import VenueMap from './components/VenueMap.jsx';
import QRScanner from './components/QRScanner.jsx';
import QRCode from './components/QRCode.jsx';
import HomePage from './pages/HomePage.jsx';
import DetailPage from './pages/DetailPage.jsx';
import CheckoutPage from './pages/CheckoutPage.jsx';
import SuccessPage from './pages/SuccessPage.jsx';
import MinePage from './pages/MinePage.jsx';
import ChangePasswordPage from './pages/ChangePasswordPage.jsx';
import AuthPage from './pages/AuthPage.jsx';
import AdminPage from './pages/AdminPage.jsx';
import AboutPage from './pages/AboutPage.jsx';

function App() {
    const [token, setToken] = useState(sessionStorage.getItem('concierta_token') || '');
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('home');
    const [events, setEvents] = useState([]);
    const [adminEvents, setAdminEvents] = useState([]);
    const [eventStatusFilter, setEventStatusFilter] = useState('all');
    const [venue, setVenue] = useState(null);
    const [selected, setSelected] = useState(null);
    const [section, setSection] = useState(null);
    const [chosen, setChosen] = useState([]);
    const [qty, setQty] = useState(1);
    const [availability, setAvailability] = useState(null);
    const [reservation, setReservation] = useState(null);
    const [mine, setMine] = useState([]);
    const [query, setQuery] = useState('');
    const [authMode, setAuthMode] = useState('login');
    const [mustChange, setMustChange] = useState(false);
    const [notice, setNotice] = useState('');
    const [busy, setBusy] = useState(false);
    const [now, setNow] = useState(Date.now());
    const [report, setReport] = useState(null);
    const [users, setUsers] = useState([]);
    const [userQuery, setUserQuery] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [roles, setRoles] = useState([]);
    const [roleEditing, setRoleEditing] = useState(null);
    const [allReservations, setAllReservations] = useState([]);
    const [bookingQuery, setBookingQuery] = useState('');
    const [bookingStatus, setBookingStatus] = useState('');
    const [selectedBookingId, setSelectedBookingId] = useState(null);
    const [qrValue, setQrValue] = useState('');
    const [qrResult, setQrResult] = useState(null);
    const [qrCameraOpen, setQrCameraOpen] = useState(false);
    const [tab, setTab] = useState('overview');
    const [editing, setEditing] = useState(null);
    const [filters, setFilters] = useState({ from: '', to: '', event_id: '', status: '' });
    const error = e => setNotice(e.message || String(e));
    const go = p => {
        if (mustChange && p !== 'change-password' && p !== 'auth')
            p = 'change-password';
        setPage(p);
        setNotice('');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    const load = useCallback(async () => {
        try {
            const [a, b] = await Promise.all([api(EVENTS, '/events'), api(EVENTS, '/scenario')]);
            setEvents(a);
            setVenue(b[0]);
        }
        catch (e) {
            error(e);
        }
    }, []);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
        if (token)
            api(AUTH, '/auth/me', { token }).then(data => {
                setUser(data);
                setMustChange(!!data.must_change_password);
                if (data.must_change_password)
                    setPage('change-password');
            }).catch(() => {
                sessionStorage.removeItem('concierta_token');
                setToken('');
                setUser(null);
                setMustChange(false);
                setPage('auth');
                setAuthMode('login');
                setNotice('Tu sesión ha expirado o fue invalidada. Inicia sesión nuevamente.');
            });
    }, [token]);
    useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
    const access = (data) => { sessionStorage.setItem('concierta_token', data.access_token); setToken(data.access_token); setUser(data.user); setMustChange(!!data.user?.must_change_password); go(data.user?.must_change_password ? 'change-password' : 'home'); };
    const logout = () => { sessionStorage.removeItem('concierta_token'); setToken(''); setUser(null); setMustChange(false); go('home'); };
    async function openEvent(e) {
        setSelected(e);
        setChosen([]);
        setQty(0);
        setSection(venue?.Sections?.[0] || null);
        go('detail');
        try {
            setAvailability(await api(BOOK, '/availability/' + e.id));
        }
        catch (err) {
            error(err);
        }
    }
    async function refreshAvailability() {
        if (selected)
            setAvailability(await api(BOOK, '/availability/' + selected.id));
    }
    const taken = new Set((availability?.taken || []).map(a => a.seat_id));
    const selectedCount = chosen.length + qty;
    const selectedPrice = chosen.reduce((sum, item) => sum + Number(venue?.Sections?.find(sec => sec.id === item.section_id)?.price || 0), 0) + qty * Number(venue?.Sections?.find(sec => sec.type === 'CANCHA')?.price || 0);
    function toggleSeat(seat_id) {
        const exists = chosen.some(item => item.seat_id === seat_id);
        if (exists) {
            setChosen(old => old.filter(item => item.seat_id !== seat_id));
            return;
        }
        if (selectedCount >= 6) {
            setNotice('Puedes elegir un máximo de seis localidades entre todas las secciones.');
            return;
        }
        if (taken.has(seat_id))
            return;
        setChosen(old => [...old, { section_id: section.id, seat_id }]);
    }
    async function reserve() {
        if (!token) {
            go('auth');
            return;
        }
        if (!selectedCount)
            return;
        setBusy(true);
        try {
            const items = [...chosen.map(({ section_id, seat_id }) => ({ section_id, seat_id, quantity: 1 }))];
            const cancha = venue?.Sections?.find(sec => sec.type === 'CANCHA');
            if (qty > 0 && cancha)
                items.push({ section_id: cancha.id, quantity: qty });
            const r = await api(BOOK, '/reservations', { method: 'POST', body: { event_id: selected.id, items }, token });
            setReservation(r);
            go('checkout');
        }
        catch (e) {
            error(e);
            refreshAvailability().catch(() => { });
        }
        finally {
            setBusy(false);
        }
    }
    async function downloadDocument(path, filename) {
        try {
            const response = await fetch(BOOK + path, { headers: { Authorization: 'Bearer ' + token } });
            if (!response.ok)
                throw Error('No se pudo descargar el documento');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1200);
        }
        catch (e) {
            error(e);
        }
    }
    async function confirm() {
        setBusy(true);
        try {
            let r = await api(BOOK, '/reservations/' + reservation.id + '/confirm', { method: 'POST', token });
            setReservation(r);
            go('success');
        }
        catch (e) {
            error(e);
        }
        finally {
            setBusy(false);
        }
    }
    async function cancel(id) {
        if (!window.confirm('¿Cancelar esta reserva y liberar sus localidades?'))
            return;
        try {
            await api(BOOK, '/reservations/' + id + '/cancel', { method: 'POST', token });
            await loadMine();
        }
        catch (e) {
            error(e);
        }
    }
    async function loadMine() {
        try {
            setMine(await api(BOOK, '/reservations/mine', { token }));
            go('mine');
        }
        catch (e) {
            error(e);
        }
    }
    async function loadAdmin(which = 'overview') {
        setTab(which);
        go('admin');
        try {
            if (filters.from && filters.to && filters.from > filters.to) {
                setNotice('La fecha inicial no puede ser posterior a la fecha final.');
                return;
            }
            const qs = new URLSearchParams(
                Object.entries(filters).filter(([, value]) => value !== '')
            );
            const [r, us, rs, roleList, eventsList] = await Promise.all([
                api(EVENTS, '/reports/general?' + qs, { token }),
                api(AUTH, '/auth/users', { token }),
                api(BOOK, '/reservations/all', { token }),
                api(AUTH, '/auth/roles', { token }),
                api(EVENTS, '/events?include_inactive=true', { token })
            ]);
            setReport(r);
            setUsers(us);
            setAllReservations(rs);
            setRoles(roleList);
            setAdminEvents(eventsList);
        }
        catch (e) {
            error(e);
        }
    }
    async function withBusy(fn) {
        setBusy(true);
        try {
            await fn();
        }
        catch (e) {
            error(e);
        }
        finally {
            setBusy(false);
        }
    }
    const onQRRead = useCallback(value => {
        setQrValue(value);
        setQrResult(null);
        setQrCameraOpen(false);
    }, []);

    const onQRError = useCallback(message => {
        setQrCameraOpen(false);
        setQrResult({ ok: false, message });
    }, []);

    async function validateQR(e) {
        e.preventDefault();
        if (busy) return;
        setQrResult(null);

        // El contenido del QR se genera en Reservas: CONCIERTA:<UUID>:<secreto>.
        const match = qrValue.trim().match(
            /^CONCIERTA:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):([A-Za-z0-9_-]+)$/i
        );
        if (!match) {
            setQrResult({
                ok: false,
                message: 'Código QR incorrecto. Escanea el boleto o pega el texto completo que comienza con CONCIERTA:.'
            });
            return;
        }

        setBusy(true);
        try {
            const result = await api(BOOK, '/tickets/' + match[1] + '/validate', {
                method: 'POST',
                token,
                body: { qr_secret: match[2] }
            });
            setQrResult({
                ok: true,
                message: 'Entrada validada. Acceso autorizado.',
                ticketId: result.ticket_id
            });
            setQrValue('');
            // Refrescar el historial para mostrar la fecha de validación.
            try {
                setAllReservations(await api(BOOK, '/reservations/all', { token }));
            } catch {
                // La validación ya se guardó; no reemplazar el resultado exitoso.
            }
        } catch (err) {
            setQrResult({ ok: false, message: err.message || 'No se pudo validar el boleto.' });
        } finally {
            setBusy(false);
        }
    }

    function EventForm() {
        const initial = editing || {};

        return (
            <form
                className="editform"
                onSubmit={e => {
                    e.preventDefault();
                    let f = Object.fromEntries(new FormData(e.currentTarget));
                    withBusy(async () => {
                        const body = {
                            ...f,
                            date: new Date(f.date).toISOString(),
                            ...(editing?.id ? {
                                active: Boolean(initial.active),
                                imageUrl: initial.imageUrl ?? null
                            } : {})
                        };
                        await api(
                            EVENTS,
                            editing?.id ? '/events/' + editing.id : '/events',
                            { method: editing?.id ? 'PUT' : 'POST', body, token }
                        );
                        setEditing(null);
                        await load();
                        await loadAdmin('events');
                    });
                }}
            >
                <h3>{editing?.id ? 'Editar concierto' : 'Nuevo concierto'}</h3>
                {[
                    ['name', 'Nombre del concierto'],
                    ['artist', 'Artista'],
                    ['genre', 'Género'],
                    ['description', 'Descripción']
                ].map(([key, label]) => (
                    <label key={key}>
                        {label}
                        <input
                            name={key}
                            required
                            defaultValue={initial[key] || ''}
                        />
                    </label>
                ))}
                <label>
                    Fecha y hora del evento
                    <input
                        name="date"
                        required
                        type="datetime-local"
                        defaultValue={initial.date?.slice(0, 16) || ''}
                    />
                </label>
                <div className="actions">
                    <button disabled={busy} className="primary">Guardar evento</button>
                    <button type="button" className="ghost" onClick={() => setEditing(null)}>
                        Cerrar
                    </button>
                </div>
            </form>
        );
    }
    const viewContext = {
        token, setToken, user, setUser, page, setPage, events, setEvents,
        adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected,
        section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability,
        reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode,
        mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow,
        report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId,
        roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery,
        bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult,
        qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters,
        error, go, load, access, logout, openEvent, refreshAvailability, taken,
        selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine,
        loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm,
    };
    return <>
        <header className="header">
            <div className="container nav">
                <button className="logo" onClick={() => go('home')}><span className="mark">◉</span> CONCIERTA<span className="pink">.</span></button>
                <nav>
                    <button onClick={() => go('home')}>Conciertos</button>
                    <button onClick={() => go('about')}>Nosotros</button>
                </nav>
                <div className="navright">
                    {user ? <>
                        <button className="ghost" onClick={() => user.role === 'ADMIN' ? loadAdmin() : loadMine()}>
                            <UserRound size={17} />
                            {user.first_name}
                        </button>
                        <button className="iconbtn" title="Cerrar sesión" onClick={logout}>
                            <LogOut size={19} />
                        </button>
                    </> : <>
                        <button className="ghost" onClick={() => { setAuthMode('login'); go('auth'); }}>Ingresar</button>
                        <button className="primary small" onClick={() => { setAuthMode('register'); go('auth'); }}>Regístrate <ArrowRight size={16} /></button>
                    </>}
                </div>
            </div>
        </header>

        {notice && <div role="alert" className="alert container">
            <span>
                {notice}
            </span>
            <button onClick={() => setNotice('')}>
                <X size={18} />
            </button>
        </div>}

        <HomePage ctx={viewContext} />

        <DetailPage ctx={viewContext} />

        <CheckoutPage ctx={viewContext} />

        <SuccessPage ctx={viewContext} />

        <MinePage ctx={viewContext} />

        <ChangePasswordPage ctx={viewContext} />

        <AuthPage ctx={viewContext} />

        <AdminPage ctx={viewContext} />

        <AboutPage ctx={viewContext} />

        <footer className="footer">
            <div className="container footer-flex">
                <div>
                    <div className="logo"><span className="mark">◉</span> CONCIERTA<span className="pink">.</span></div>
                    <p>Donde comienza la experiencia.</p>
                </div>
                <small>© 2026 CONCIERTA · Proyecto académico · Pagos simulados</small>
            </div>
        </footer>
    </>;
}

export default App;
