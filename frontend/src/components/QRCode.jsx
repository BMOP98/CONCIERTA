import React, { useEffect, useState } from 'react';
import { BOOK } from '../lib/api.js';

function QRCode({ id, token }) {
    const [data, setData] = useState('');
    useEffect(() => {
        let url = URL.createObjectURL(new Blob());
        fetch(BOOK + '/tickets/' + id + '/qr', { headers: { Authorization: 'Bearer ' + token } }).then(r => {
            if (!r.ok)
                throw Error('No disponible');
            return r.blob();
        }).then(b => { URL.revokeObjectURL(url); url = URL.createObjectURL(b); setData(url); }).catch(() => { });
        return () => URL.revokeObjectURL(url);
    }, [id, token]);
    return data ? <img src={data} alt="Ticket QR" /> : <small>Cargando QR…</small>;
}

export default QRCode;
