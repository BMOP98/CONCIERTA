import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function ChangePasswordPage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'change-password' && <main className="container auth-page">
            <section className="panel auth-box">
                <div className="eyebrow">SEGURIDAD DE TU CUENTA</div>
                <h1>Define tu nueva contraseña</h1>
                <p className="muted">Por seguridad, debes cambiar la contraseña temporal antes de utilizar CONCIERTA. Al guardarla, la contraseña inicial dejará de funcionar.</p>
                <form onSubmit={e => {
                    e.preventDefault();
                    const d = Object.fromEntries(new FormData(e.currentTarget));
                    if (d.new_password !== d.repeat_password) {
                        setNotice('Las contraseñas nuevas no coinciden.');
                        return;
                    }
                    withBusy(async () => { const r = await api(AUTH, '/auth/password', { method: 'PUT', token, body: { current_password: d.current_password, new_password: d.new_password } }); sessionStorage.setItem('concierta_token', r.access_token); setToken(r.access_token); setUser(r.user); setMustChange(false); setPage('home'); setNotice('Contraseña actualizada. ¡Bienvenido a CONCIERTA!'); });
                }}>
                    <label>Contraseña temporal<input name="current_password" type="password" autoComplete="current-password" required /></label>
                    <label>Nueva contraseña<input name="new_password" type="password" minLength="10" autoComplete="new-password" required /><small>Mínimo 10 caracteres; incluye mayúsculas, minúsculas y números.</small></label>
                    <label>Confirmar nueva contraseña<input name="repeat_password" type="password" minLength="10" autoComplete="new-password" required /></label>
                    <button disabled={busy} className="primary full">Guardar y continuar <ShieldCheck /></button>
                </form>
                <button className="secondary full" onClick={logout}>Cerrar sesión</button>
            </section>
        </main>}
    </>;
}
