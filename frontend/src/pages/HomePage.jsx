import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function HomePage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'home' && <>
            <section className="hero">
                <div className="container hero-inner">
                    <div className="hero-copy">
                        <div className="eyebrow">✦ EL ESCENARIO ES TUYO</div>
                        <h1>La música se vive.<br /><em>Los momentos</em><br />se recuerdan.</h1>
                        <p>Donde cada concierto se convierte en una historia. Descubre, elige tu lugar y vive lo extraordinario.</p>
                        <button className="primary large" onClick={() => document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' })}>Descubre los eventos <ArrowRight size={19} /></button>
                        <div className="stats">
                            <div>
                                <strong>2026</strong>
                                <span>Temporada en vivo</span>
                            </div>
                            <div>
                                <strong>100%</strong>
                                <span>Tickets digitales</span>
                            </div>
                            <div>
                                <strong>QR</strong>
                                <span>Acceso más ágil</span>
                            </div>
                        </div>
                    </div>
                    <div className="hero-art">
                        <div className="halo"></div>
                        <span className="hero-art-word">LIVE<br /><i>LOUD.</i></span>
                        <div className="hero-art-footer">SOUND ON · WORLD OFF</div>
                    </div>
                </div>
            </section>
            <main id="catalog" className="container catalog">
                <div className="section-head">
                    <div>
                        <div className="eyebrow">LA AGENDA</div>
                        <h2>Próximos <em>eventos</em></h2>
                        <p>La mejor noche de tu vida comienza aquí.</p>
                    </div>
                    <span className="pill">{events.length} conciertos</span>
                </div>
                <div className="search">
                    <Search size={19} />
                    <input placeholder="Buscar evento o artista" value={query} onChange={e => setQuery(e.target.value)} />
                </div>
                <div className="event-grid">
                    {events.filter(e => (e.name + ' ' + e.artist + ' ' + e.genre).toLowerCase().includes(query.toLowerCase())).map((e, i) => <article className="event-card" key={e.id}>
                        <button className="poster" style={{ background: `linear-gradient(135deg,${colors[i % 4][0]},${colors[i % 4][1]})` }} onClick={() => openEvent(e)}>
                            <span className="poster-top">CONCIERTA PRESENTA</span>
                            <span className="poster-symbol">
                                {['✺', '⚡', '♫', '✧'][i % 4]}
                            </span>
                            <span className="poster-name">
                                {e.name}
                            </span>
                            <span className="poster-bottom">LIVE EXPERIENCE · 2026</span>
                        </button>
                        <div className="card-body">
                            <span className="tag">
                                {e.genre}
                            </span>
                            <h3>
                                {e.name}
                            </h3>
                            <p>
                                {e.artist}
                            </p>
                            <p className="meta">
                                <Calendar size={15} />
                                {displayDate(e.date)}
                            </p>
                            <p className="meta">
                                <MapPin size={15} />
                                {venue?.name || 'Escenario CONCIERTA'}
                            </p>
                            <div className="card-footer">
                                <div>
                                    <small>Desde</small>
                                    <strong>
                                        {money(Math.min(...(venue?.Sections || [{ price: 25 }]).map(s => Number(s.price))))}
                                    </strong>
                                </div>
                                <button aria-label="Comprar entradas" className="circle-btn" onClick={() => openEvent(e)}>
                                    <ArrowRight />
                                </button>
                            </div>
                        </div>
                    </article>)}
                </div>
                {!events.length && <div className="empty">No hay conciertos disponibles. Verifica el servicio de eventos.</div>}
            </main>
            <section className="benefits">
                <div className="container benefits-grid">
                    {[[Ticket, 'Ticket digital', 'Un QR único por cada entrada confirmada.'], [ShieldCheck, 'Reserva protegida', 'Bloqueos temporales seguros en el servidor.'], [Clock3, 'Sin complicaciones', 'Todo tu proceso desde un solo lugar.']].map(([Icon, t, d]) => <div key={t}>
                        <Icon />
                        <h3>
                            {t}
                        </h3>
                        <p>
                            {d}
                        </p>
                    </div>)}
                </div>
            </section>
        </>}
    </>;
}
