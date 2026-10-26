import React from 'react';

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

            <path d="M104 18 Q210 -13 316 18 L292 61 L128 61 Z" fill="#35318b" />
            <text x="210" y="39" textAnchor="middle" className="plan-stage">ESCENARIO</text>

            {zones.map((z, i) => <g key={i} className={'plan-zone ' + (section?.type === z.type ? 'plan-active' : '')} role="button" tabIndex="0" aria-label={'Seleccionar ' + z.label + ' (referencia ' + z.original + ')'} onClick={() => choose(z.type)} onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    choose(z.type);
                }
            }}>

                <path d={z.path} />
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

export default VenueMap;
