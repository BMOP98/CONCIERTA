import React, { useEffect, useRef } from 'react';

function QRScanner({ onRead, onError }) {
    const videoRef = useRef(null);

    useEffect(() => {
        let active = true;
        let stream = null;
        let animationId = null;

        async function start() {
            try {
                if (!('BarcodeDetector' in window)) {
                    throw new Error('Este navegador no permite leer QR con la cámara. Usa un lector externo y pega el contenido del código.');
                }
                if (!navigator.mediaDevices?.getUserMedia) {
                    throw new Error('La cámara no está disponible. Puedes pegar el contenido del QR manualmente.');
                }

                const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: 'environment' } },
                    audio: false
                });
                if (!active) return;

                const video = videoRef.current;
                if (!video) return;
                video.srcObject = stream;
                await video.play();

                async function scan() {
                    if (!active) return;
                    try {
                        const codes = await detector.detect(video);
                        if (!active) return;
                        if (codes.length && codes[0].rawValue) {
                            active = false;
                            onRead(codes[0].rawValue);
                            return;
                        }
                    } catch {
                        // Un fotograma sin lectura no invalida el escaneo.
                    }
                    if (active) animationId = requestAnimationFrame(scan);
                }
                animationId = requestAnimationFrame(scan);
            } catch (err) {
                if (active) onError(err.message || 'No se pudo iniciar la cámara.');
            }
        }

        start();
        return () => {
            active = false;
            if (animationId !== null) cancelAnimationFrame(animationId);
            if (stream) stream.getTracks().forEach(track => track.stop());
            if (videoRef.current) videoRef.current.srcObject = null;
        };
    }, [onRead, onError]);

    return (
        <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            aria-label="Cámara para escanear el código QR del boleto"
            style={{ width: '100%', maxWidth: 420, borderRadius: 12, background: '#17121f' }}
        />
    );
}


export default QRScanner;
