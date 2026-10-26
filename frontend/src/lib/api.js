export const AUTH = 'http://localhost:8001', EVENTS = 'http://localhost:8002', BOOK = 'http://localhost:8003';
export const money = n => new Intl.NumberFormat('es-EC', { style: 'currency', currency: 'USD' }).format(n || 0);
export const displayDate = d => new Date(d).toLocaleString('es-EC', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Guayaquil' });
export const colors = [['#802ee5', '#ef4276'], ['#ec6839', '#711b58'], ['#14a6a3', '#233f9b'], ['#c59b44', '#40225e']];
export async function api(base, path, { method = 'GET', body, token } = {}) {
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
