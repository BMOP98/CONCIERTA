import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function AuthPage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'auth' && <main className="container auth-page">
            <section className="panel auth-box">
                <div className="logo"><span className="mark">◉</span> CONCIERTA<span className="pink">.</span></div>
                <h1>
                    {authMode === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta'}
                </h1>
                <p className="muted">
                    {authMode === 'login' ? 'Tu próxima experiencia te espera.' : 'Regístrate para reservar tus entradas.'}
                </p>
                <form onSubmit={e => {
                    e.preventDefault();
                    const f = Object.fromEntries(new FormData(e.currentTarget));
                    withBusy(async () => {
                        if (authMode === 'login') {
                            access(await api(AUTH, '/auth/login', { method: 'POST', body: f }));
                        }
                        else {
                            await api(AUTH, '/auth/register', { method: 'POST', body: f });
                            setAuthMode('login');
                            setNotice('¡Cuenta creada correctamente! Revisa tu correo electrónico para obtener tu usuario y contraseña e iniciar sesión.');
                        }
                    });
                }}>
                    {authMode === 'register' && <>
                        {[['first_name', 'Primer nombre'], ['second_name', 'Segundo nombre (opcional)'], ['last_name', 'Apellido'], ['dni', 'Documento / DNI'], ['address', 'Dirección'], ['phone', 'Teléfono']].map(([id, label]) => <label key={id}>
                            {label}
                            <input name={id} required={id !== 'second_name'} minLength={id === 'address' ? 4 : undefined} />
                        </label>)}
                        <label>Nacionalidad<input name="nationality" value="Ecuatoriana" readOnly aria-label="Nacionalidad preestablecida: ecuatoriana" /></label>
                    </>}
                    <label>
                        {authMode === 'login' ? 'Usuario o correo' : 'Correo electrónico'}
                        <input name={authMode === 'login' ? 'username' : 'email'} type={authMode === 'login' ? 'text' : 'email'} required />
                    </label>
                    {authMode === 'login' && <label>Contraseña<input name="password" type="password" required /></label>}
                    <button disabled={busy} className="primary full">
                        {authMode === 'login' ? 'Entrar a mi cuenta' : 'Crear cuenta'}
                        <ArrowRight />
                    </button>
                </form>
                <p className="switch">
                    {authMode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                    <button onClick={() => { setNotice(''); setAuthMode(authMode === 'login' ? 'register' : 'login'); }}>
                        {authMode === 'login' ? 'Regístrate' : 'Inicia sesión'}
                    </button>
                </p>
            </section>
        </main>}
    </>;
}
