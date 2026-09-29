// Autor: Ivana Mušikić 2023/0204
//
// SSU5 — Skeniranje QR koda stola.
// Komponenta omogućava realno skeniranje QR koda kamerom kada browser to podržava,
// kao i ručni unos koda stola za prezentaciju i testiranje.

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTableSession } from '../context/TableSessionContext';
import { useToast } from '../context/ToastContext';

type CameraStatus = 'idle' | 'starting' | 'active' | 'unsupported' | 'error';
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = {
  detect: (source: HTMLVideoElement) => Promise<DetectedBarcode[]>;
};
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

type WindowWithBarcodeDetector = Window & {
  BarcodeDetector?: BarcodeDetectorConstructor;
};

/**
 * Vraća native BarcodeDetector ako ga browser podržava.
 * @returns Konstruktor za očitavanje QR kodova ili null.
 */
function getBarcodeDetectorConstructor() {
  const barcodeWindow = window as WindowWithBarcodeDetector;
  return barcodeWindow.BarcodeDetector ?? null;
}

/**
 * ScanQrScreen prikazuje ekran za povezivanje gosta sa stolom u restoranu.
 * @returns JSX ekran za skeniranje QR koda.
 */
export default function ScanQrScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { connectTable } = useTableSession();

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorInstance | null>(null);
  const scanFrameRef = useRef<number | null>(null);
  const isActivatingRef = useRef(false);

  const [tableCode, setTableCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraMessage, setCameraMessage] = useState('Kamera će se otvoriti samo ako je uređaj podržava.');

  /**
   * Gasi kameru i zaustavlja aktivno očitavanje QR koda.
   * @returns void
   */
  const stopCamera = useCallback(() => {
    if (scanFrameRef.current !== null) {
      cancelAnimationFrame(scanFrameRef.current);
      scanFrameRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  /**
   * Šalje kod stola backend-u, čuva aktivnu sesiju i vodi korisnika na meni.
   * @param code Kod stola koji je korisnik uneo ili skenirao.
   * @returns void
   */
  const activateTableSession = useCallback(
    async (code: string) => {
      const normalizedCode = code.trim();

      if (!normalizedCode) {
        showToast('error', 'Unesite kod stola');
        return;
      }

      if (isActivatingRef.current) {
        return;
      }

      isActivatingRef.current = true;
      setIsSubmitting(true);

      try {
        const connectedSession = await connectTable(normalizedCode);
        stopCamera();
        setCameraStatus('idle');
        showToast('success', `Povezan je ${connectedSession.table.label}`);
        setTimeout(() => navigate('/menu'), 500);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'QR kod nije validan';
        showToast('error', message);
      } finally {
        isActivatingRef.current = false;
        setIsSubmitting(false);
      }
    },
    [connectTable, navigate, showToast, stopCamera],
  );

  /**
   * Pokreće petlju za očitavanje QR koda iz video stream-a.
   * @returns void
   */
  const runScannerLoop = useCallback(() => {
    const scan = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (!video || !detector || isActivatingRef.current) {
        scanFrameRef.current = requestAnimationFrame(scan);
        return;
      }

      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        try {
          const detectedCodes = await detector.detect(video);
          const scannedCode = detectedCodes.find((code) => code.rawValue.trim().length > 0)?.rawValue;

          if (scannedCode) {
            await activateTableSession(scannedCode);
            return;
          }
        } catch {
          setCameraStatus('error');
          setCameraMessage('Kamera radi, ali browser trenutno ne može da očita QR kod. Unesite kod ručno.');
        }
      }

      scanFrameRef.current = requestAnimationFrame(scan);
    };

    scanFrameRef.current = requestAnimationFrame(scan);
  }, [activateTableSession]);

  /**
   * Otvara kameru i, ako browser podržava BarcodeDetector, stvarno očitava QR kod.
   * @returns void
   */
  async function handleStartCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('unsupported');
      setCameraMessage('Ovaj browser ne dozvoljava pristup kameri. Unesite kod stola ručno.');
      showToast('error', 'Kamera nije dostupna u ovom browseru');
      return;
    }

    const BarcodeDetector = getBarcodeDetectorConstructor();

    setCameraStatus('starting');
    setCameraMessage('Traži se pristup kameri...');

    try {
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraStatus('active');

      if (!BarcodeDetector) {
        detectorRef.current = null;
        setCameraMessage('Kamera je otvorena, ali browser ne podržava automatsko očitavanje QR koda. Za prezentaciju koristite ručni unos.');
        return;
      }

      detectorRef.current = new BarcodeDetector({ formats: ['qr_code'] });
      setCameraMessage('Usmerite kameru ka QR kodu na stolu. Kod će biti očitan automatski.');
      runScannerLoop();
    } catch {
      stopCamera();
      detectorRef.current = null;
      setCameraStatus('error');
      setCameraMessage('Kamera nije dostupna ili pristup nije dozvoljen. Unesite kod stola ručno.');
      showToast('error', 'Nije moguće otvoriti kameru');
    }
  }

  /**
   * Pokreće ručnu proveru unetog koda stola.
   * @returns void
   */
  function handleManualSubmit() {
    activateTableSession(tableCode);
  }

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const isCameraBusy = cameraStatus === 'starting' || isSubmitting;
  const isCameraActive = cameraStatus === 'active';

  return (
    <div className="screen ssu-scan-screen ssu-screen ssu-centered-access-screen">
      <section className="glass-card ssu-card ssu-centered-access-card ssu-scan-access-card">
        <div className="ssu-centered-icon ssu-scan-main-icon">▦</div>

        <div className="ssu-centered-copy">
          <p className="eyebrow">QR pristup stolu</p>
          <h1>Skenirajte kod sa stola</h1>
          <p>
            Otvorite kameru i usmerite je ka QR kodu. Za testiranje pred prezentaciju možete
            ručno uneti kod ili broj stola.
          </p>
        </div>

        <div className={`ssu-scan-preview ${isCameraActive ? 'is-active' : ''}`}>
          <video ref={videoRef} className="ssu-scan-video" muted playsInline aria-label="Pregled kamere za skeniranje QR koda" />

          {!isCameraActive && (
            <div className="ssu-scan-placeholder">
              <div className="ssu-qr-frame ssu-scan-frame-compact" aria-hidden="true">
                <div className="ssu-qr-corners">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
                <div className="ssu-qr-symbol">
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            </div>
          )}

          {isCameraActive && <div className="ssu-scan-line" aria-hidden="true" />}
        </div>

        <p className={`ssu-camera-status is-${cameraStatus}`}>{cameraMessage}</p>

        <div className="ssu-centered-actions ssu-scan-actions">
          <button className="primary-action-button ssu-main-action" type="button" onClick={handleStartCamera} disabled={isCameraBusy}>
            <span>{isCameraBusy ? 'Otvaranje kamere...' : isCameraActive ? 'Kamera aktivna' : 'Otvori kameru'}</span>
            <span>📷</span>
          </button>

          {isCameraActive && (
            <button
              className="ssu-entry-action-button ssu-secondary-action"
              type="button"
              onClick={() => {
                stopCamera();
                setCameraStatus('idle');
                setCameraMessage('Kamera će se otvoriti samo ako je uređaj podržava.');
              }}
              disabled={isSubmitting}
            >
              <span>Zatvori kameru</span>
              <span>×</span>
            </button>
          )}
        </div>

        <div className="ssu-scan-divider">
          <span />
          <p>ili unesite kod ručno</p>
          <span />
        </div>

        <div className="ssu-centered-form ssu-scan-manual-form">
          <div className="ssu-form-group">
            <label className="ssu-label" htmlFor="table-code">
              Kod ili broj stola
            </label>
            <input
              id="table-code"
              className="ssu-input"
              type="text"
              placeholder="Na primer: qr_demo_10 ili 10"
              value={tableCode}
              onChange={(event) => setTableCode(event.target.value)}
              disabled={isSubmitting}
            />
          </div>

          <button className="primary-action-button ssu-main-action" type="button" onClick={handleManualSubmit} disabled={isSubmitting}>
            <span>{isSubmitting ? 'Povezivanje...' : 'Poveži sto'}</span>
            <span>→</span>
          </button>
        </div>
      </section>
    </div>
  );
}
