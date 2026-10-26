import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function DetailPage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'detail' && selected && <main className="container inner">
            <button className="back" onClick={() => go('home')}>← Volver a conciertos</button>
            <div className="eyebrow">ELIGE TU EXPERIENCIA</div>
            <h1>
                {selected.name}
            </h1>
            <p className="muted"><Calendar size={16} />{displayDate(selected.date)} · {selected.artist}</p>
            <div className="booking">
                <section className="panel">
                    <div className="flex-between">
                        <div>
                            <h2>Selecciona tus entradas</h2>
                            <p className="muted">Máximo 6 localidades por cliente y evento.</p>
                        </div>
                        <button className="iconbtn" title="Actualizar disponibilidad" onClick={() => refreshAvailability().catch(error)}>
                            <RefreshCw />
                        </button>
                    </div>
                    <div className="venue-map-wrapper">
                        <p className="map-intro">Selecciona una zona directamente en el plano. Puedes combinar entradas de varias localidades.</p>
                        <VenueMap section={section} setSection={setSection} sections={venue?.Sections || []} availability={availability} />
                    </div>

                    <div className="section-buttons">
                        {venue?.Sections?.map(s => <button key={s.id} className={section?.id === s.id ? 'active' : ''} onClick={() => setSection(s)}>
                            {s.name}
                            <small>
                                {money(Number(s.price))}
                            </small>
                            <span>{availability?.sections?.find(a => a.section_id === s.id)?.available ?? '–'} libres</span>
                            <span className="selected-zone-count">{chosen.filter(x => x.section_id === s.id).length + (s.type === 'CANCHA' ? qty : 0)} seleccionados</span>
                        </button>)}
                    </div>

                    <div className="zone-note"><strong>
                        {section?.name}
                    </strong> · {section?.type === 'CANCHA' ? 'Localidad sin numeración' : 'Selecciona asientos individuales'} · {money(Number(section?.price || 0))} por entrada</div>

                    {section?.type === 'CANCHA' ? <div className="standing">
                        <Music2 size={42} />
                        <h3>CANCHA · sin numeración</h3>
                        <p>Puedes agregar entradas aquí y luego elegir asientos en otras zonas.</p>
                        <div className="counter">
                            <button aria-label="Quitar una entrada de cancha" onClick={() => setQty(Math.max(0, qty - 1))}>
                                <Minus />
                            </button>
                            <strong>
                                {qty}
                            </strong>
                            <button aria-label="Agregar una entrada de cancha" disabled={selectedCount >= 6 || qty >= (availability?.sections?.find(a => a.section_id === section.id)?.available ?? 6)} onClick={() => setQty(Math.min(6 - chosen.length, qty + 1))}>
                                <Plus />
                            </button>
                        </div>
                    </div> : <div className="seatmap">
                        {Array.from({ length: section?.rows || 0 }, (_, r) => <div className="seatrow" key={r}>
                            <span>
                                {String.fromCharCode(65 + r)}
                            </span>
                            {(section?.Seats || []).filter(a => a.rowLabel === String.fromCharCode(65 + r)).map(a => <button key={a.id} title={'Asiento ' + a.label} disabled={taken.has(a.id)} className={'seat ' + (chosen.some(x => x.seat_id === a.id) ? 'selected' : '')} onClick={() => toggleSeat(a.id)}>
                                {a.number}
                            </button>)}
                            <span>
                                {String.fromCharCode(65 + r)}
                            </span>
                        </div>)}
                    </div>}

                    <div className="legend">
                        <span><i />Disponible</span>
                        <span><i className="selected" />Seleccionado</span>
                        <span><i className="occupied" />Ocupado</span>
                    </div>
                </section>
                <aside className="panel sidebar">
                    <h2>Tu reserva</h2>
                    <h3>
                        {selected.name}
                    </h3>
                    <p className="muted">
                        {displayDate(selected.date)}
                    </p>
                    <div className="summary-row">
                        <span>Entradas</span>
                        <strong>{selectedCount} / 6</strong>
                    </div>
                    <div className="basket-lines">
                        {venue?.Sections?.map(sec => {
                            const seats = chosen.filter(x => x.section_id === sec.id);
                            const count = seats.length + (sec.type === 'CANCHA' ? qty : 0);
                            return count > 0 ? <div className="basket-line" key={sec.id}>
                                <div>
                                    <strong>
                                        {sec.name}
                                    </strong>
                                    <small>
                                        {sec.type === 'CANCHA' ? `${qty} entradas generales` : seats.map(x => sec.Seats?.find(a => a.id === x.seat_id)?.label).join(', ')}
                                    </small>
                                </div>
                                <div>
                                    <strong>
                                        {money(count * Number(sec.price))}
                                    </strong>
                                    <button className="remove-line" onClick={() => {
                                        setChosen(old => old.filter(x => x.section_id !== sec.id));
                                        if (sec.type === 'CANCHA')
                                            setQty(0);
                                    }}>Quitar</button>
                                </div>
                            </div> : null;
                        })}
                    </div>
                    <hr />
                    <div className="summary-total">
                        <span>Total</span>
                        <strong>
                            {money(selectedPrice)}
                        </strong>
                    </div>
                    <button className="primary full" disabled={busy || !selectedCount} onClick={reserve}>Reservar {selectedCount} entradas <ArrowRight /></button>
                    <p className="footnote"><ShieldCheck size={15} /> Todas las localidades se bloquearán juntas durante 5 minutos.</p>
                </aside>
            </div>
        </main>}
    </>;
}
