import React from 'react';
import { Music2, Ticket, Calendar, MapPin, Search, ArrowRight, UserRound, LogOut, ShieldCheck, Clock3, CheckCircle2, X, Plus, Minus, LayoutDashboard, Trash2, Edit3, RefreshCw } from 'lucide-react';
import { api, AUTH, EVENTS, BOOK, money, displayDate, colors } from '../lib/api.js';
import VenueMap from '../components/VenueMap.jsx';
import QRScanner from '../components/QRScanner.jsx';
import QRCode from '../components/QRCode.jsx';

export default function AdminPage({ ctx }) {
    const { token, setToken, user, setUser, page, setPage, events, setEvents, adminEvents, setAdminEvents, eventStatusFilter, setEventStatusFilter, venue, setVenue, selected, setSelected, section, setSection, chosen, setChosen, qty, setQty, availability, setAvailability, reservation, setReservation, mine, setMine, query, setQuery, authMode, setAuthMode, mustChange, setMustChange, notice, setNotice, busy, setBusy, now, setNow, report, setReport, users, setUsers, userQuery, setUserQuery, selectedUserId, setSelectedUserId, roles, setRoles, roleEditing, setRoleEditing, allReservations, setAllReservations, bookingQuery, setBookingQuery, bookingStatus, setBookingStatus, selectedBookingId, setSelectedBookingId, qrValue, setQrValue, qrResult, setQrResult, qrCameraOpen, setQrCameraOpen, tab, setTab, editing, setEditing, filters, setFilters, error, go, load, access, logout, openEvent, refreshAvailability, taken, selectedCount, selectedPrice, toggleSeat, reserve, downloadDocument, confirm, cancel, loadMine, loadAdmin, withBusy, onQRRead, onQRError, validateQR, EventForm } = ctx;
    return <>
        {page === 'admin' && user?.role === 'ADMIN' && <main className="container inner">
            <div className="eyebrow">CENTRO DE CONTROL</div>
            <h1>Administración</h1>
            <div className="tabs">
                {[['overview', 'Resumen'], ['events', 'Eventos'], ['bookings', 'Reservas'], ['users', 'Usuarios'], ['roles', 'Roles'], ['validate', 'Validar entradas'], ['venue', 'Escenario']].map(([k, n]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>
                    {n}
                </button>)}
            </div>
            {tab === 'overview' && <>
                <div className="metric-grid">
                    {[['Reservas', report?.reservation_count], ['Confirmadas', report?.confirmed_count], ['Ingresos', money(report?.total_revenue)], ['Eventos', events.length]].map(([name, v]) => <div className="panel metric" key={name}>
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
                        <label>Desde<input type="date" value={filters.from} onChange={e => setFilters({ ...filters, from: e.target.value })} /></label>
                        <label>Hasta<input type="date" value={filters.to} onChange={e => setFilters({ ...filters, to: e.target.value })} /></label>
                        <label>
                            Concierto
                            <select
                                value={filters.event_id}
                                onChange={e => setFilters({ ...filters, event_id: e.target.value })}
                            >
                                <option value="">Todos los conciertos</option>
                                {adminEvents.map(event => (
                                    <option key={event.id} value={event.id}>
                                        {event.name}{event.active ? '' : ' (Despublicado)'}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>Estado<select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}>
                            {['', 'PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(k => <option key={k} value={k}>
                                {k || 'Todos'}
                            </option>)}
                        </select></label>
                        <button className="primary" onClick={() => loadAdmin('overview')}>Aplicar filtros</button>
                        <button
                            className="secondary"
                            onClick={() => {
                                setFilters({ from: '', to: '', event_id: '', status: '' });
                                setNotice('Filtros restablecidos. Pulsa «Aplicar filtros» para actualizar el reporte.');
                            }}
                        >
                            Limpiar filtros
                        </button>
                    </div>
                    <p>
                        Los filtros de fecha se aplican a la fecha de creación de la reserva.
                        La ocupación e ingresos corresponden a reservas confirmadas.
                    </p>
                    <div className="metric-grid">
                        {['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(status => (
                            <div className="panel metric" key={status}>
                                <small>{status}</small>
                                <strong>{report?.by_status?.[status] ?? 0}</strong>
                            </div>
                        ))}
                    </div>
                    <h3>Disponibilidad, ocupación y recaudación por concierto</h3>
                    <p className="muted">
                        La ocupación y disponibilidad de este reporte se calculan a partir de entradas
                        confirmadas que coinciden con los filtros. No representan necesariamente los
                        cupos disponibles en tiempo real si hay reservas pendientes o filtros activos.
                    </p>
                    <div className="tablewrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Concierto</th>
                                    <th>Reservas</th>
                                    <th>Capacidad</th>
                                    <th>Ocupadas</th>
                                    <th>Disponibles según reporte</th>
                                    <th>Ocupación</th>
                                    <th>Recaudación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(report?.by_event || []).map(r => {
                                    const capacity = Number(r.capacity || 0);
                                    const occupied = Number(r.occupied || 0);
                                    const percent = capacity > 0 ? 100 * occupied / capacity : 0;
                                    return (
                                        <tr key={r.event_id}>
                                            <td>{adminEvents.find(e => e.id === r.event_id)?.name || r.event_id}</td>
                                            <td>{r.reservations}</td>
                                            <td>{capacity}</td>
                                            <td>{occupied}</td>
                                            <td>{r.available ?? Math.max(0, capacity - occupied)}</td>
                                            <td>{percent.toFixed(1)}%</td>
                                            <td>{money(r.revenue)}</td>
                                        </tr>
                                    );
                                })}
                                {!report?.by_event?.length && (
                                    <tr><td colSpan={7}>No hay reservas que coincidan con los filtros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    <h3>Detalle por sección</h3>
                    <div className="tablewrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Concierto</th>
                                    <th>Sección</th>
                                    <th>Capacidad</th>
                                    <th>Ocupadas</th>
                                    <th>Disponibles según reporte</th>
                                    <th>Ocupación</th>
                                    <th>Recaudación</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(report?.by_event || []).flatMap(r =>
                                    (r.sections || []).map(s => {
                                        const capacity = Number(s.capacity || 0);
                                        const occupied = Number(s.occupied || 0);
                                        const percent = capacity > 0 ? 100 * occupied / capacity : 0;
                                        return (
                                            <tr key={`${r.event_id}-${s.section_id}`}>
                                                <td>{adminEvents.find(e => e.id === r.event_id)?.name || r.event_id}</td>
                                                <td>{s.name}</td>
                                                <td>{capacity}</td>
                                                <td>{occupied}</td>
                                                <td>{s.available ?? Math.max(0, capacity - occupied)}</td>
                                                <td>{percent.toFixed(1)}%</td>
                                                <td>{money(s.revenue ?? 0)}</td>
                                            </tr>
                                        );
                                    })
                                )}
                                {!report?.by_event?.length && (
                                    <tr><td colSpan={7}>No hay datos por sección para estos filtros.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </>}
            {tab === 'events' && <>
                <div className="flex-between" style={{ marginBottom: 16 }}>
                    <button className="primary" onClick={() => setEditing({})}>
                        <Plus size={16} /> Crear concierto
                    </button>
                    <label>
                        Estado del concierto
                        <select
                            aria-label="Filtrar conciertos por estado"
                            value={eventStatusFilter}
                            onChange={e => setEventStatusFilter(e.target.value)}
                        >
                            <option value="all">Todos</option>
                            <option value="active">Publicados</option>
                            <option value="inactive">Despublicados</option>
                        </select>
                    </label>
                </div>
                {editing !== null && <EventForm key={editing.id || 'new'} />}
                <div className="panel tablewrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Concierto</th>
                                <th>Artista</th>
                                <th>Fecha</th>
                                <th>Estado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {adminEvents
                                .filter(e =>
                                    eventStatusFilter === 'all' ||
                                    (eventStatusFilter === 'active' ? e.active : !e.active)
                                )
                                .map(e => (
                                    <tr key={e.id}>
                                        <td>{e.name}</td>
                                        <td>{e.artist}</td>
                                        <td>{displayDate(e.date)}</td>
                                        <td>{e.active ? 'PUBLICADO' : 'DESPUBLICADO'}</td>
                                        <td>
                                            <button
                                                className="ghost"
                                                onClick={() => setEditing({
                                                    ...e,
                                                    date: new Date(
                                                        new Date(e.date).getTime() -
                                                        new Date(e.date).getTimezoneOffset() * 60000
                                                    ).toISOString().slice(0, 16)
                                                })}
                                            >
                                                <Edit3 size={16} /> Editar
                                            </button>
                                            {e.active ? (
                                                <button
                                                    className="ghost danger"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (!window.confirm('¿Despublicar este concierto?')) return;
                                                        withBusy(async () => {
                                                            await api(EVENTS, '/events/' + e.id, {
                                                                method: 'DELETE', token
                                                            });
                                                            await load();
                                                            await loadAdmin('events');
                                                        });
                                                    }}
                                                >
                                                    <Trash2 size={16} /> Despublicar
                                                </button>
                                            ) : (
                                                <button
                                                    className="ghost"
                                                    disabled={busy}
                                                    onClick={() => {
                                                        if (!window.confirm('¿Volver a publicar este concierto?')) return;
                                                        withBusy(async () => {
                                                            await api(EVENTS, '/events/' + e.id, {
                                                                method: 'PUT',
                                                                token,
                                                                body: {
                                                                    name: e.name,
                                                                    description: e.description,
                                                                    artist: e.artist,
                                                                    genre: e.genre,
                                                                    date: e.date,
                                                                    imageUrl: e.imageUrl ?? null,
                                                                    active: true
                                                                }
                                                            });
                                                            await load();
                                                            await loadAdmin('events');
                                                        });
                                                    }}
                                                >
                                                    <RefreshCw size={16} /> Republicar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                    </table>
                </div>
            </>}
            {tab === 'validate' && <section className="panel" style={{ maxWidth: 720 }}>
                <h2><ShieldCheck size={24} /> Validar entrada QR</h2>
                <p className="muted">
                    Escanea el QR de un boleto confirmado. Solo personal administrador puede autorizar el acceso.
                    Cada boleto puede validarse una sola vez.
                </p>
                <div className="actions" style={{ marginBottom: 16 }}>
                    <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                            setQrCameraOpen(value => !value);
                            setQrResult(null);
                        }}
                    >
                        {qrCameraOpen ? 'Cerrar cámara' : 'Escanear con cámara'}
                    </button>
                </div>
                {qrCameraOpen && <QRScanner onRead={onQRRead} onError={onQRError} />}
                <form onSubmit={validateQR} className="editform">
                    <label>
                        Contenido del código QR
                        <input
                            autoComplete="off"
                            spellCheck={false}
                            value={qrValue}
                            placeholder="CONCIERTA:identificador:secreto"
                            onChange={e => {
                                setQrValue(e.target.value);
                                setQrResult(null);
                            }}
                            required
                        />
                    </label>
                    <p className="footnote">
                        Si el navegador no admite lectura por cámara, utiliza un lector QR externo
                        y pega su contenido completo aquí. El ID visible del boleto no es suficiente.
                    </p>
                    <button type="submit" className="primary" disabled={busy || !qrValue.trim()}>
                        <ShieldCheck size={18} /> {busy ? 'Validando…' : 'Validar entrada'}
                    </button>
                </form>
                {qrResult && <div role="status" className={qrResult.ok ? 'info' : 'alert'} style={{ marginTop: 16 }}>
                    <strong>{qrResult.ok ? 'ACCESO AUTORIZADO' : 'ACCESO RECHAZADO'}</strong>
                    <p>{qrResult.message}</p>
                    {qrResult.ticketId && <small>Boleto: {qrResult.ticketId}</small>}
                </div>}
            </section>}
            {tab === 'bookings' && <>
                <h2>Historial de reservas y entradas</h2>
                <p className="muted">
                    Consulta el historial de cada cliente, los estados y los boletos asociados.
                </p>
                <div className="filters">
                    <label>
                        Buscar reserva, cliente o concierto
                        <input
                            value={bookingQuery}
                            placeholder="Código, usuario, correo o concierto"
                            onChange={e => setBookingQuery(e.target.value)}
                        />
                    </label>
                    <label>
                        Estado
                        <select value={bookingStatus} onChange={e => setBookingStatus(e.target.value)}>
                            {['', 'PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'].map(status => (
                                <option key={status} value={status}>{status || 'Todos'}</option>
                            ))}
                        </select>
                    </label>
                    <button className="secondary" disabled={busy} onClick={() => loadAdmin('bookings')}>
                        <RefreshCw size={16} /> Actualizar historial
                    </button>
                </div>
                {selectedBookingId && (() => {
                    const r = allReservations.find(item => item.id === selectedBookingId);
                    if (!r) return null;
                    const customer = users.find(u => u.id === r.client_id);
                    const event = adminEvents.find(e => e.id === r.event_id);
                    return <section className="panel" style={{ marginBottom: 16 }}>
                        <div className="flex-between">
                            <h2>Detalle de reserva {r.code}</h2>
                            <button className="ghost" onClick={() => setSelectedBookingId(null)}>
                                <X size={16} /> Cerrar
                            </button>
                        </div>
                        <p><strong>Cliente:</strong> {customer ? `${customer.first_name} ${customer.last_name} (${customer.username})` : r.client_id}</p>
                        <p><strong>Concierto:</strong> {event?.name || r.event_id}</p>
                        <p><strong>Estado:</strong> {r.status} · <strong>Creada:</strong> {displayDate(r.created_at)}</p>
                        <p><strong>Total:</strong> {money(r.total)} · <strong>Envío de correo:</strong> {r.email_status || 'Sin información'}</p>
                        <div className="tablewrap">
                            <table>
                                <thead><tr>
                                    <th>Boleto (ID)</th><th>Sección</th><th>Asiento</th>
                                    <th>Precio</th><th>Validación de acceso</th>
                                </tr></thead>
                                <tbody>
                                    {(r.tickets || []).map(t => (
                                        <tr key={t.id}>
                                            <td title={t.id}>{t.id.slice(0, 12)}…</td>
                                            <td>{venue?.Sections?.find(sec => sec.id === t.section_id)?.name || t.section_id}</td>
                                            <td>{t.seat_label || 'Sin numerar'}</td>
                                            <td>{money(t.unit_price)}</td>
                                            <td>{t.validated_at ? displayDate(t.validated_at) : 'Sin validar'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {r.status === 'CONFIRMED' && (
                            <button
                                className="secondary"
                                onClick={() => downloadDocument(
                                    '/reservations/' + r.id + '/summary.pdf',
                                    r.code + '-resumen.pdf'
                                )}
                            >Descargar comprobante PDF</button>
                        )}
                    </section>;
                })()}
                <div className="panel tablewrap">
                    <table>
                        <thead><tr>
                            <th>Código</th><th>Cliente</th><th>Concierto</th>
                            <th>Fecha</th><th>Estado</th><th>Boletos</th>
                            <th>Total</th><th>Detalle</th>
                        </tr></thead>
                        <tbody>
                            {allReservations.filter(r => {
                                if (bookingStatus && r.status !== bookingStatus) return false;
                                const customer = users.find(u => u.id === r.client_id);
                                const event = adminEvents.find(e => e.id === r.event_id);
                                const text = [
                                    r.code, r.client_id, r.event_id, event?.name,
                                    customer?.first_name, customer?.last_name,
                                    customer?.username, customer?.email
                                ].filter(Boolean).join(' ').toLocaleLowerCase('es');
                                return text.includes(bookingQuery.trim().toLocaleLowerCase('es'));
                            }).map(r => {
                                const customer = users.find(u => u.id === r.client_id);
                                const event = adminEvents.find(e => e.id === r.event_id);
                                return <tr key={r.id}>
                                    <td>{r.code}</td>
                                    <td>{customer ? `${customer.first_name} ${customer.last_name}` : r.client_id.slice(0, 10)}</td>
                                    <td>{event?.name || r.event_id.slice(0, 8)}</td>
                                    <td>{displayDate(r.created_at)}</td>
                                    <td>{r.status}</td>
                                    <td>{r.tickets?.length || 0}</td>
                                    <td>{money(r.total)}</td>
                                    <td><button className="ghost" onClick={() => setSelectedBookingId(r.id)}>
                                        Ver boletos
                                    </button></td>
                                </tr>;
                            })}
                        </tbody>
                    </table>
                </div>
            </>}
            {tab === 'users' && <button className="primary" onClick={() => setEditing({ type: 'user' })}>+ Registrar usuario</button>}
            {tab === 'users' && editing?.type === 'user' && <form className="editform" onSubmit={e => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); withBusy(async () => { const result = await api(AUTH, '/auth/users', { method: 'POST', body: data, token }); setEditing(null); setUsers(await api(AUTH, '/auth/users', { token })); setNotice('Usuario creado correctamente. Se enviaron sus credenciales por correo electrónico.'); }); }}>
                <h3>Crear usuario administrativo</h3>
                {[['first_name', 'Primer nombre'], ['second_name', 'Segundo nombre'], ['last_name', 'Apellido'], ['dni', 'DNI'], ['address', 'Dirección'], ['phone', 'Teléfono'], ['email', 'Correo']].map(([k, l]) => <label key={k}>
                    {l}
                    <input name={k} required={k !== 'second_name'} type={k === 'email' ? 'email' : 'text'} />
                </label>)}
                <label>Nacionalidad<input name="nationality" value="Ecuatoriana" readOnly /></label>
                <label>Rol<select name="role_id">
                    <option>CLIENTE</option>
                    <option>ADMIN</option>
                </select></label>
                <button className="primary">Crear</button>
            </form>}
            {tab === 'users' && <>
                <div className="search" style={{ marginTop: 16, marginBottom: 16 }}>
                    <Search size={19} />
                    <input
                        aria-label="Buscar usuarios"
                        placeholder="Buscar por nombre, usuario, correo o DNI"
                        value={userQuery}
                        onChange={e => setUserQuery(e.target.value)}
                    />
                </div>
                {selectedUserId && (() => {
                    const selectedUser = users.find(u => u.id === selectedUserId);
                    if (!selectedUser) return null;
                    const data = [
                        ['Nombre completo', [selectedUser.first_name, selectedUser.second_name, selectedUser.last_name].filter(Boolean).join(' ')],
                        ['Usuario', selectedUser.username],
                        ['Correo electrónico', selectedUser.email],
                        ['Documento de identidad', selectedUser.dni],
                        ['Nacionalidad', selectedUser.nationality],
                        ['Teléfono', selectedUser.phone],
                        ['Dirección', selectedUser.address],
                        ['Rol', selectedUser.role],
                        ['Estado', selectedUser.active ? 'Activo' : 'Inactivo'],
                        ['Cambio de contraseña pendiente', selectedUser.must_change_password ? 'Sí' : 'No'],
                        ['Último acceso', selectedUser.last_login ? displayDate(selectedUser.last_login) : 'Sin registros']
                    ];
                    return (
                        <section className="panel" aria-label="Detalle del usuario" style={{ marginBottom: 16 }}>
                            <div className="flex-between">
                                <h2>Detalle del usuario</h2>
                                <button className="ghost" onClick={() => setSelectedUserId(null)}>
                                    <X size={16} /> Cerrar
                                </button>
                            </div>
                            <div className="tablewrap">
                                <table>
                                    <tbody>
                                        {data.map(([label, value]) => (
                                            <tr key={label}>
                                                <th scope="row">{label}</th>
                                                <td>{value || 'No registrado'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <h3>Historial individual de reservas</h3>
                            {(() => {
                                const history = allReservations.filter(r => r.client_id === selectedUser.id);
                                if (!history.length) return <p className="muted">Este usuario todavía no tiene reservas.</p>;
                                return <div className="tablewrap">
                                    <table>
                                        <thead><tr>
                                            <th>Código</th><th>Concierto</th><th>Fecha</th>
                                            <th>Estado</th><th>Boletos</th><th>Total</th><th>Detalle</th>
                                        </tr></thead>
                                        <tbody>{history.map(r => (
                                            <tr key={r.id}>
                                                <td>{r.code}</td>
                                                <td>{adminEvents.find(e => e.id === r.event_id)?.name || r.event_id.slice(0, 8)}</td>
                                                <td>{displayDate(r.created_at)}</td>
                                                <td>{r.status}</td>
                                                <td>{r.tickets?.length || 0}</td>
                                                <td>{money(r.total)}</td>
                                                <td><button className="ghost" onClick={() => {
                                                    setSelectedBookingId(r.id);
                                                    setBookingQuery('');
                                                    setBookingStatus('');
                                                    setTab('bookings');
                                                }}>Ver boletos</button></td>
                                            </tr>
                                        ))}</tbody>
                                    </table>
                                </div>;
                            })()}
                        </section>
                    );
                })()}
                <div className="panel tablewrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Usuario</th>
                                <th>Correo</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.filter(u => {
                                const term = userQuery.trim().toLocaleLowerCase('es');
                                if (!term) return true;
                                return [u.first_name, u.second_name, u.last_name, u.username, u.email, u.dni]
                                    .some(value => String(value || '').toLocaleLowerCase('es').includes(term));
                            }).map(u => (
                                <tr key={u.id}>
                                    <td>{u.first_name} {u.last_name}</td>
                                    <td>{u.username}</td>
                                    <td>{u.email}</td>
                                    <td>
                                        <select
                                            value={u.role}
                                            disabled={busy || u.id === user?.id}
                                            aria-label={'Rol de ' + u.username}
                                            onChange={e => withBusy(async () => {
                                                await api(AUTH, '/auth/users/' + u.id, {
                                                    method: 'PATCH', body: { role_id: e.target.value }, token
                                                });
                                                setUsers(await api(AUTH, '/auth/users', { token }));
                                            })}
                                        >
                                            {[...new Set(['CLIENTE', 'ADMIN', u.role])].map(role => (
                                                <option key={role} value={role}>{role}</option>
                                            ))}
                                        </select>
                                    </td>
                                    <td>
                                        <button
                                            className="secondary"
                                            disabled={busy || u.id === user?.id}
                                            title={u.id === user?.id ? 'No puedes desactivar tu propia cuenta' : 'Cambiar estado de la cuenta'}
                                            onClick={() => withBusy(async () => {
                                                await api(AUTH, '/auth/users/' + u.id, {
                                                    method: 'PATCH', body: { active: !u.active }, token
                                                });
                                                setUsers(await api(AUTH, '/auth/users', { token }));
                                            })}
                                        >
                                            {u.active ? 'ACTIVO' : 'INACTIVO'}
                                        </button>
                                    </td>
                                    <td>
                                        <button className="ghost" onClick={() => setSelectedUserId(u.id)}>
                                            Ver detalle
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </>}
            {tab === 'roles' && <>
                <button
                    className="primary"
                    disabled={busy}
                    onClick={() => setRoleEditing({ id: '', description: '' })}
                >
                    + Crear rol
                </button>

                {roleEditing !== null && (
                    <form
                        className="editform"
                        onSubmit={e => {
                            e.preventDefault();
                            const data = Object.fromEntries(new FormData(e.currentTarget));
                            withBusy(async () => {
                                if (roleEditing.id) {
                                    await api(AUTH, '/auth/roles/' + roleEditing.id, {
                                        method: 'PUT',
                                        body: { description: data.description },
                                        token
                                    });
                                } else {
                                    await api(AUTH, '/auth/roles', {
                                        method: 'POST',
                                        body: {
                                            id: data.id.trim().toUpperCase(),
                                            description: data.description.trim()
                                        },
                                        token
                                    });
                                }
                                setRoles(await api(AUTH, '/auth/roles', { token }));
                                setRoleEditing(null);
                                setNotice('Rol guardado correctamente.');
                            });
                        }}
                    >
                        <h3>{roleEditing.id ? 'Editar rol' : 'Nuevo rol'}</h3>
                        <label>
                            Identificador del rol
                            <input
                                name="id"
                                required
                                minLength={3}
                                maxLength={30}
                                pattern="[A-Z_]{3,30}"
                                defaultValue={roleEditing.id}
                                disabled={!!roleEditing.id}
                                onInput={e => {
                                    e.currentTarget.value = e.currentTarget.value.toUpperCase();
                                }}
                            />
                        </label>
                        <label>
                            Descripción
                            <input
                                name="description"
                                required
                                minLength={2}
                                maxLength={100}
                                defaultValue={roleEditing.description}
                            />
                        </label>
                        <div className="actions">
                            <button className="primary" disabled={busy}>Guardar rol</button>
                            <button
                                className="ghost"
                                type="button"
                                onClick={() => setRoleEditing(null)}
                            >
                                Cancelar
                            </button>
                        </div>
                    </form>
                )}

                <div className="panel tablewrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Rol</th>
                                <th>Descripción</th>
                                <th>Usuarios asignados</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roles.map(role => {
                                const assigned = users.filter(u => u.role === role.id).length;
                                const isBase = ['ADMIN', 'CLIENTE'].includes(role.id);
                                return (
                                    <tr key={role.id}>
                                        <td>{role.id}</td>
                                        <td>{role.description}</td>
                                        <td>{assigned}</td>
                                        <td>
                                            <button
                                                className="ghost"
                                                disabled={busy}
                                                onClick={() => setRoleEditing(role)}
                                            >
                                                <Edit3 size={16} /> Editar
                                            </button>
                                            {!isBase && (
                                                <button
                                                    className="ghost danger"
                                                    disabled={busy || assigned > 0}
                                                    title={assigned ? 'El rol está asignado a usuarios' : 'Eliminar rol'}
                                                    onClick={() => {
                                                        if (!window.confirm('¿Eliminar el rol ' + role.id + '?')) return;
                                                        withBusy(async () => {
                                                            await api(AUTH, '/auth/roles/' + role.id, {
                                                                method: 'DELETE',
                                                                token
                                                            });
                                                            setRoles(await api(AUTH, '/auth/roles', { token }));
                                                            setRoleEditing(null);
                                                            setNotice('Rol eliminado correctamente.');
                                                        });
                                                    }}
                                                >
                                                    <Trash2 size={16} /> Eliminar
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
                <p className="footnote">
                    Los roles ADMIN y CLIENTE son obligatorios y no pueden eliminarse.
                    El alta administrativa de usuarios continúa restringida a esos dos roles
                    por las reglas actuales del microservicio de Autenticación.
                </p>
            </>}
            {tab === 'venue' && <div className="panel">
                <h2>
                    {venue?.name}
                </h2>
                <p>{venue?.location} · Capacidad: {venue?.capacity}</p>
                {venue?.Sections?.map(s => <p key={s.id}><strong>
                    {s.name}
                </strong> — {s.capacity} localidades · {s.rows || 'Sin filas'} filas · {money(Number(s.price))}</p>)}
                <p className="footnote">Datos de solo lecturas.</p>
            </div>}
        </main>}
    </>;
}
