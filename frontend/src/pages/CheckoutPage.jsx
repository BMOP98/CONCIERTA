import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function CheckoutPage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'checkout' && reservation && <main className="container narrow inner">
            <div className="eyebrow">CONFIRMACIÓN SEGURA</div>
            <h1>Finaliza tu reserva</h1>
            <div className="panel checkout">
                <div className="timer"><Clock3 />Tiempo disponible <strong>{Math.max(0, Math.floor((new Date(reservation.expires_at).getTime() - now) / 60000)).toString().padStart(2, '0')}:{Math.max(0, Math.floor(((new Date(reservation.expires_at).getTime() - now) % 60000) / 1000)).toString().padStart(2, '0')}</strong></div>
                <h2>
                    {selected?.name}
                </h2>
                <p className="muted">Código {reservation.code} · {reservation.tickets.length} entradas</p>
                <div className="basket-lines">
                    {venue?.Sections?.map(sec => {
                        const tickets = reservation.tickets.filter(t => t.section_id === sec.id); return tickets.length ? <div className="basket-line" key={sec.id}>
                            <strong>{sec.name} · {tickets.length}</strong>
                            <small>
                                {tickets.map(t => t.seat_label).join(', ')}
                            </small>
                        </div> : null;
                    })}
                </div>
                <div className="summary-total">
                    <span>Importe</span>
                    <strong>
                        {money(reservation.total)}
                    </strong>
                </div>
                <div className="info">
                    <ShieldCheck />
                    <div>
                        <strong>Simulación de pago</strong>
                    </div>
                </div>
                <button disabled={busy || new Date(reservation.expires_at).getTime() <= now} className="primary full" onClick={confirm}>Pagar y confirmar <CheckCircle2 /></button>
                <button className="secondary full" onClick={() => withBusy(async () => { await api(BOOK, '/reservations/' + reservation.id + '/cancel', { method: 'POST', token }); go('home'); })}>Cancelar reserva</button>
            </div>
        </main>}
    </>;
}
