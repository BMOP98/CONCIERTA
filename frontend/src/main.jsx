import React, { useState, useEffect, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import './styles.css';
const AUTH = 'http://localhost:8001', EVENTS = 'http://localhost:8002', BOOK = 'http://localhost:8003';
const money = n => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n || 0);
const displayDate = d => new Date(d).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' });
const colors = [['#802ee5', '#ef4276'], ['#ec6839', '#711b58'], ['#14a6a3', '#233f9b'], ['#c59b44', '#40225e']];
async function api(base, path, { method = 'GET', body, token } = {}) {
    let r;
    try {
        r = await fetch(base + path, { method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
    }
    catch {
        throw Error('No se pudo conectar con el servidor. Comprueba que los microservicios estén iniciados.');
    }
    const d = await r.json().catch(() => ({}));
    if (!r.ok)
        throw Error(typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail || 'Solicitud rechazada'));
    return d;
}
function VenueMap({ section, setSection, sections, availability }) {
    const choose = type => {
        const found = sections.find(x => x.type === type);
        if (found)
            setSection(found);
    };
    const zones = [
        { type: 'GENERAL', label: 'GENERAL', original: 'VIP exterior', path: 'M46 155 Q25 45 210 20 Q395 45 374 155 L359 155 Q368 65 210 39 Q52 65 61 155 Z', tx: 210, ty: 30 },
        { type: 'BUTACAS', label: 'BUTACAS', original: 'Butaca', path: 'M55 161 Q42 100 87 60 L110 82 Q72 120 83 161 Z', tx: 72, ty: 117 },
        { type: 'BUTACAS', label: 'BUTACAS', original: 'Butaca', path: 'M365 161 Q378 100 333 60 L310 82 Q348 120 337 161 Z', tx: 347, ty: 117 },
        { type: 'VIP', label: 'VIP', original: 'Humbe Box', path: 'M127 91 Q210 72 293 91 L293 128 L127 128 Z', tx: 210, ty: 112 },
        { type: 'CANCHA', label: 'CANCHA', original: 'Output Box', path: 'M127 133 L293 133 Q283 170 210 180 Q137 170 127 133 Z', tx: 210, ty: 157 },
        { type: 'PREFERENCIA', label: 'PREFERENCIA', original: 'Fan', path: 'M80 172 Q210 285 340 172 L314 172 Q210 248 106 172 Z', tx: 210, ty: 225 },
        { type: 'GENERAL', label: 'GENERAL', original: 'VIP', path: 'M37 165 Q60 287 210 292 Q360 287 383 165 L357 165 Q336 262 210 267 Q84 262 63 165 Z', tx: 210, ty: 277 }
    ];
    return <div className="venue-plan">
        <svg viewBox="0 0 420 312" role="group" aria-label="Mapa interactivo de localidades del escenario CONCIERTA">
        
            <path d="M104 18 Q210 -13 316 18 L292 61 L128 61 Z" fill="#35318b"/>
            <text x="210" y="39" textAnchor="middle" className="plan-stage">ESCENARIO</text>
        
            {zones.map((z, i) => <g key={i} className={'plan-zone ' + (section?.type === z.type ? 'plan-active' : '')} role="button" tabIndex="0" aria-label={'Seleccionar ' + z.label + ' (referencia ' + z.original + ')'} onClick={() => choose(z.type)} onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(z.type);
                }
            }}>
            
                <path d={z.path}/>
                <text x={z.tx} y={z.ty} textAnchor="middle" dominantBaseline="middle" className={'plan-label ' + (z.type === 'BUTACAS' ? 'plan-side-label' : '')} transform={z.type === 'BUTACAS' ? `rotate(${i === 1 ? -70 : 70} ${z.tx} ${z.ty})` : undefined}>
                    {z.label}
                </text>
        
            </g>)}
        
            <text x="210" y="304" textAnchor="middle" className="plan-caption">PLANO REFERENCIAL · ELIGE TU ZONA</text>
    
        </svg>
        <div className="plan-meta">
            <strong>
                {section?.name || 'Selecciona una localidad'}
            </strong>
            <span>{availability?.sections?.find(x => x.section_id === section?.id)?.available ?? '–'} cupos disponibles</span>
        </div>
    </div>;
}
function App() {
    const [token, setToken] = useState(sessionStorage.getItem('concierta_token') || '');
    const [user, setUser] = useState(null);
    const [page, setPage] = useState('home');
    const [events, setEvents] = useState([]);
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
    const [allReservations, setAllReservations] = useState([]);
    const [tab, setTab] = useState('overview');
    const [editing, setEditing] = useState(null);
    const [filters, setFilters] = useState({ from: '', to: '', status: '' });
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
            const qs = new URLSearchParams(Object.entries(filters).filter(([k, v]) => v && k !== 'status'));
            if (filters.status)
                qs.set('status', filters.status);
            const [r, us, rs] = await Promise.all([api(EVENTS, '/reports/general?' + qs, { token }), api(AUTH, '/auth/users', { token }), api(BOOK, '/reservations/all', { token })]);
            setReport(r);
            setUsers(us);
            setAllReservations(rs);
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
    function EventForm() {
        const initial = editing || {};

        return (
            <form
                className="editform"
                onSubmit={e => {
                    e.preventDefault();
                    let f = Object.fromEntries(new FormData(e.currentTarget));
                    withBusy(async () => {
                        let body = { ...f, date: new Date(f.date).toISOString() };
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
                            <UserRound size={17}/>
                            {user.first_name}
                        </button>
                        <button className="iconbtn" title="Cerrar sesión" onClick={logout}>
                            <LogOut size={19}/>
                        </button>
                    </> : <>
                        <button className="ghost" onClick={() => { setAuthMode('login'); go('auth'); }}>Ingresar</button>
                        <button className="primary small" onClick={() => { setAuthMode('register'); go('auth'); }}>Regístrate <ArrowRight size={16}/></button>
                    </>}
                </div>
            </div>
        </header>
        
        {notice && <div role="alert" className="alert container">
            <span>
                {notice}
            </span>
            <button onClick={() => setNotice('')}>
                <X size={18}/>
            </button>
        </div>}
        
        {page === 'home' && <>
            <section className="hero">
                <div className="container hero-inner">
                    <div className="hero-copy">
                        <div className="eyebrow">✦ EL ESCENARIO ES TUYO</div>
                        <h1>La música se vive.<br /><em>Los momentos</em><br />se recuerdan.</h1>
                        <p>Donde cada concierto se convierte en una historia. Descubre, elige tu lugar y vive lo extraordinario.</p>
                        <button className="primary large" onClick={() => document.querySelector('#catalog')?.scrollIntoView({ behavior: 'smooth' })}>Descubre los eventos <ArrowRight size={19}/></button>
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
                    <Search size={19}/>
                    <input placeholder="Buscar evento o artista" value={query} onChange={e => setQuery(e.target.value)}/>
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
                                <Calendar size={15}/>
                                {displayDate(e.date)}
                            </p>
                            <p className="meta">
                                <MapPin size={15}/>
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
        
        {page === 'detail' && selected && <main className="container inner">
            <button className="back" onClick={() => go('home')}>← Volver a conciertos</button>
            <div className="eyebrow">ELIGE TU EXPERIENCIA</div>
            <h1>
                {selected.name}
            </h1>
            <p className="muted"><Calendar size={16}/>{displayDate(selected.date)} · {selected.artist}</p>
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
                        <VenueMap section={section} setSection={setSection} sections={venue?.Sections || []} availability={availability}/>
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
                        <Music2 size={42}/>
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
                        <span><i className="selected"/>Seleccionado</span>
                        <span><i className="occupied"/>Ocupado</span>
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
                    <p className="footnote"><ShieldCheck size={15}/> Todas las localidades se bloquearán juntas durante 5 minutos.</p>
                </aside>
            </div>
        </main>}
        
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
                    {venue?.Sections?.map(sec => { const tickets = reservation.tickets.filter(t => t.section_id === sec.id); return tickets.length ? <div className="basket-line" key={sec.id}>
                        <strong>{sec.name} · {tickets.length}</strong>
                        <small>
                            {tickets.map(t => t.seat_label).join(', ')}
                        </small>
                    </div> : null; })}
                </div>
                <div className="summary-total">
                    <span>Importe simulado</span>
                    <strong>
                        {money(reservation.total)}
                    </strong>
                </div>
                <div className="info">
                    <ShieldCheck />
                    <div>
                        <strong>Simulación de pago</strong>
                        <p>No se recogen datos bancarios ni se cobra dinero real. La confirmación registra la reserva en PostgreSQL y habilita tus QR.</p>
                    </div>
                </div>
                <button disabled={busy || new Date(reservation.expires_at).getTime() <= now} className="primary full" onClick={confirm}>Simular pago aprobado y confirmar <CheckCircle2 /></button>
                <button className="secondary full" onClick={() => withBusy(async () => { await api(BOOK, '/reservations/' + reservation.id + '/cancel', { method: 'POST', token }); go('home'); })}>Cancelar reserva</button>
            </div>
        </main>}
        
        {page === 'success' && <main className="container narrow inner centered">
            <CheckCircle2 size={70} className="success-icon"/>
            <div className="eyebrow">RESERVA CONFIRMADA</div>
            <h1>¡Que empiece la música!</h1>
            <p>Tus entradas y códigos QR están disponibles. Te enviaremos el comprobante y cada boleto PDF por correo electrónico.</p>
            <button className="primary" onClick={loadMine}>Ver mis entradas <Ticket /></button>
        </main>}
        
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
                            <QRCode token={token} id={t.id}/>
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
                    <label>Contraseña temporal<input name="current_password" type="password" autoComplete="current-password" required/></label>
                    <label>Nueva contraseña<input name="new_password" type="password" minLength="10" autoComplete="new-password" required/><small>Mínimo 10 caracteres; incluye mayúsculas, minúsculas y números.</small></label>
                    <label>Confirmar nueva contraseña<input name="repeat_password" type="password" minLength="10" autoComplete="new-password" required/></label>
                    <button disabled={busy} className="primary full">Guardar y continuar <ShieldCheck /></button>
                </form>
                <button className="secondary full" onClick={logout}>Cerrar sesión</button>
            </section>
        </main>}
        
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
                            <input name={id} required={id !== 'second_name'} minLength={id === 'address' ? 4 : undefined}/>
                        </label>)}
                        <label>Nacionalidad<input name="nationality" value="Ecuatoriana" readOnly aria-label="Nacionalidad preestablecida: ecuatoriana"/></label>
                    </>}
                    <label>
                        {authMode === 'login' ? 'Usuario o correo' : 'Correo electrónico'}
                        <input name={authMode === 'login' ? 'username' : 'email'} type={authMode === 'login' ? 'text' : 'email'} required/>
                    </label>
                    {authMode === 'login' && <label>Contraseña<input name="password" type="password" required/></label>}
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
        
        {page === 'admin' && user?.role === 'ADMIN' && <main className="container inner">
            <div className="eyebrow">CENTRO DE CONTROL</div>
            <h1>Administración</h1>
            <div className="tabs">
                {[['overview', 'Resumen'], ['events', 'Eventos'], ['bookings', 'Reservas'], ['users', 'Usuarios'], ['venue', 'Escenario']].map(([k, n]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                    {n}
                </button>)}
            </div>
            {tab === 'overview' && <>
                <div className="metric-grid">
                    {[['Reservas', report?.reservation_count], ['Confirmadas', report?.confirmed_count], ['Ingresos simulados', money(report?.total_revenue)], ['Eventos', events.length]].map(([name, v]) => <div className="panel metric" key={name}>
                        <small>
                            {name}
                        </small>
                        <strong>
                            {v ?? '–'}
                        </strong>
                    </div>)}
                </div>
                <div className="panel">
                    <h2>Reporte consolidado</h2>
                    <div className="filters">
                        <label>Desde<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })}/></label>
                        <label>Hasta<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })}/></label>
                        <label>Estado<select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                                {['', 'PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(k => <option key={k} value={k}>
                                    {k || 'Todos'}
                                </option>)}
                            </select></label>
                        <button className="primary" onClick={() => loadAdmin('overview')}>Aplicar</button>
                    </div>
                    <p>Por estado: {JSON.stringify(report?.by_status || {})}</p>
                    <div className="tablewrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Evento</th>
                                    <th>Reservas</th>
                                    <th>Ocupación</th>
                                    <th>Ingresos simulados</th>
                                    <th>Por sección (ID: entradas)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report?.by_event?.map(r => <tr key={r.event_id}>
                                    <td>
                                        {events.find(e => e.id === r.event_id)?.name || r.event_id}
                                    </td>
                                    <td>
                                        {r.reservations}
                                    </td>
                                    <td>
                                        {r.occupied}
                                    </td>
                                    <td>
                                        {money(r.revenue)}
                                    </td>
                                    <td>
                                        {r.sections?.map(s => `${s.name}: ${s.occupied}/${s.capacity} (${s.available} libres)`).join(' · ')}
                                    </td>
                                </tr>)}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>}
            {tab === 'events' && <>
                <button className="primary" onClick={() => setEditing({})}>+ Crear evento</button>
                {editing !== null && <EventForm key={editing.id || 'new'}/>}
                <div className="panel tablewrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Concierto</th>
                                <th>Artista</th>
                                <th>Fecha</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {events.map(e => <tr key={e.id}>
                                <td>
                                    {e.name}
                                </td>
                                <td>
                                    {e.artist}
                                </td>
                                <td>
                                    {displayDate(e.date)}
                                </td>
                                <td>
                                    <button className="ghost" onClick={() => setEditing({
                        ...e, date: new Date(new Date(e.date).getTime() -
                            new Date(e.date).getTimezoneOffset() * 60000).toISOString().slice(0, 16)
                    })}><Edit3 size={16}/> Editar</button>
                                    <button className="ghost danger" onClick={() => {
                        if (window.confirm('¿Despublicar evento?'))
                            withBusy(async () => { await api(EVENTS, '/events/' + e.id, { method: 'DELETE', token }); await load(); });
                    }}><Trash2 size={16}/> Retirar</button>
                                </td>
                            </tr>)}
                        </tbody>
                    </table>
                </div>
            </>}
            {tab === 'bookings' && <div className="panel tablewrap">
                <table>
                    <thead>
                        <tr>
                            <th>Código</th>
                            <th>Cliente (ID)</th>
                            <th>Evento</th>
                            <th>Estado</th>
                            <th>Entradas</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {allReservations.map(r => <tr key={r.id}>
                            <td>
                                {r.code}
                            </td>
                            <td>
                                {r.client_id.slice(0, 10)}
                            </td>
                            <td>
                                {events.find(e => e.id === r.event_id)?.name || r.event_id.slice(0, 8)}
                            </td>
                            <td>
                                {r.status}
                            </td>
                            <td>
                                {r.tickets.length}
                            </td>
                            <td>
                                {money(r.total)}
                            </td>
                        </tr>)}
                    </tbody>
                </table>
            </div>}
            {tab === 'users' && <button className="primary" onClick={() => setEditing({ type: 'user' })}>+ Registrar usuario</button>}
            {tab === 'users' && editing?.type === 'user' && <form className="editform" onSubmit={e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); withBusy(async () => { const result = await api(AUTH, '/auth/users', { method: 'POST', body: data, token }); setEditing(null); setUsers(await api(AUTH, '/auth/users', { token })); setNotice('Usuario creado correctamente. Se enviaron sus credenciales por correo electrónico.'); }); }}>
                <h3>Crear usuario administrativo</h3>
                {[['first_name', 'Primer nombre'], ['second_name', 'Segundo nombre'], ['last_name', 'Apellido'], ['dni', 'DNI'], ['address', 'Dirección'], ['phone', 'Teléfono'], ['email', 'Correo']].map(([k, l]) => <label key={k}>
                    {l}
                    <input name={k} required={k !== 'second_name'} type={k === 'email' ? 'email' : 'text'}/>
                </label>)}
                <label>Nacionalidad<input name="nationality" value="Ecuatoriana" readOnly/></label>
                <label>Rol<select name="role_id">
                        <option>CLIENTE</option>
                        <option>ADMIN</option>
                    </select></label>
                <button className="primary">Crear</button>
            </form>}
            {tab === 'users' && <div className="panel tablewrap">
                <table>
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Usuario</th>
                            <th>Correo</th>
                            <th>Rol</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        {users.map(u => <tr key={u.id}>
                            <td>
                                {u.first_name} 
                                {u.last_name}
                            </td>
                            <td>
                                {u.username}
                            </td>
                            <td>
                                {u.email}
                            </td>
                            <td>
                                <select value={u.role} onChange={e => withBusy(async () => { await api(AUTH, '/auth/users/' + u.id, { method: 'PATCH', body: { role_id: e.target.value }, token }); setUsers(await api(AUTH, '/auth/users', { token })); })}>
                                    <option>CLIENTE</option>
                                    <option>ADMIN</option>
                                </select>
                            </td>
                            <td>
                                <button className="secondary" onClick={() => withBusy(async () => { await api(AUTH, '/auth/users/' + u.id, { method: 'PATCH', body: { active: !u.active }, token }); setUsers(await api(AUTH, '/auth/users', { token })); })}>
                                    {u.active ? 'ACTIVO' : 'INACTIVO'}
                                </button>
                            </td>
                        </tr>)}
                    </tbody>
                </table>
            </div>}
            {tab === 'venue' && <div className="panel">
                <h2>
                    {venue?.name}
                </h2>
                <p>{venue?.location} · Capacidad: {venue?.capacity}</p>
                {venue?.Sections?.map(s => <p key={s.id}><strong>
                        {s.name}
                    </strong> — {s.capacity} localidades · {s.rows || 'Sin filas'} filas · {money(Number(s.price))}</p>)}
                <p className="footnote">Datos de solo lectura, cargados desde la semilla.</p>
            </div>}
        </main>}
        
        {page === 'about' && <main className="container inner narrow">
            <div className="eyebrow">SOBRE CONCIERTA</div>
            <h1>Vívelo en primera fila.</h1>
            <p>CONCIERTA es una plataforma de gestión de conciertos para un escenario único. Integra selección de localidades, reservas temporales, tickets electrónicos y un sistema administrativo para la promotora.</p>
            <p>Proyecto académico: los pagos se simulan y ningún cobro se procesa.</p>
        </main>}
        
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
function QRCode({ id, token }) {
    const [data, setData] = useState('');
    useEffect(() => {
        let url = URL.createObjectURL(new Blob());
        fetch('http://localhost:8003/tickets/' + id + '/qr', { headers: { Authorization: 'Bearer ' + token } }).then(r => {
            if (!r.ok)
                throw Error('No disponible');
            return r.blob();
        }).then(b => { URL.revokeObjectURL(url); url = URL.createObjectURL(b); setData(url); }).catch(() => { });
        return () => URL.revokeObjectURL(url);
    }, [id, token]);
    return data ? <img src={data} alt="Ticket QR"/> : <small>Cargando QR…</small>;
}
createRoot(document.getElementById('root')).render(<App />);
