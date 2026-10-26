import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function MinePage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'mine' && <main className="container inner">
            <div className="eyebrow">MI CUENTA</div>
            <h1>Mis reservas</h1>
            <p className="muted">Tu historial, localidades y tickets QR.</p>
            {mine.length === 0 ? <div className="panel empty">Aún no tienes reservas. <button className="primary" onClick={() => go('home')}>Explorar conciertos</button></div> : mine.map(r => <article className="panel reservation" key={r.id}>
                <div className="flex-between">
                    <div>
                        <span className="tag">
                            {r.status}
                        </span>
                        <h2>
                            {events.find(e => e.id === r.event_id)?.name || 'Concierto'}
                        </h2>
                        <p className="muted">{r.code} · {r.tickets.length} entradas</p>
                    </div>
                    <strong className="price">
                        {money(r.total)}
                    </strong>
                </div>
                {r.status === 'PENDING' && <button className="primary" onClick={() => { setReservation(r); setSelected(events.find(e => e.id === r.event_id)); go('checkout'); }}>Continuar confirmación</button>}
                {r.status === 'CONFIRMED' && <>
                    <div className="document-actions">
                        <button className="secondary" onClick={() => downloadDocument('/reservations/' + r.id + '/summary.pdf', r.code + '-resumen.pdf')}>Descargar comprobante PDF</button>
                        {r.email_status === 'FAILED' && <button className="secondary" onClick={() => withBusy(async () => { await api(BOOK, '/reservations/' + r.id + '/resend-email', { method: 'POST', token }); setNotice('Se volverá a intentar el envío del correo.'); setMine(await api(BOOK, '/reservations/mine', { token })); })}>Reenviar documentos por correo</button>}
                    </div>
                    <div className="ticket-grid">
                        {r.tickets.map(t => <div className="ticket" key={t.id}>
                            <QRCode token={token} id={t.id} />
                            <strong>
                                {venue?.Sections?.find(sec => sec.id === t.section_id)?.name || "Localidad"}
                            </strong>
                            <span>
                                {t.seat_label}
                            </span>
                            <small>
                                {t.id.slice(0, 8).toUpperCase()}
                            </small>
                            <button className="download-ticket" onClick={() => downloadDocument('/tickets/' + t.id + '/ticket.pdf', 'entrada-' + t.id.slice(0, 8) + '.pdf')}>Descargar PDF</button>
                        </div>)}
                    </div>
                </>}
                {['PENDING', 'CONFIRMED'].includes(r.status) && <button className="secondary" onClick={() => cancel(r.id)}>Cancelar reserva</button>}
            </article>)}
        </main>}
    </>;
}
