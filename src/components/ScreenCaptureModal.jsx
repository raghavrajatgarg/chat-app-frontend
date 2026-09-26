import { useEffect, useRef, useState } from 'react';
import styles from '../styles/App.module.scss';

const MAX_EDITOR_EDGE = 2560;
const MAX_HISTORY_STEPS = 12;

function drawImageToCanvas(canvas, image) {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  const scale = Math.min(1, MAX_EDITOR_EDGE / Math.max(sourceWidth, sourceHeight));
  canvas.width = Math.round(sourceWidth * scale);
  canvas.height = Math.round(sourceHeight * scale);
  canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
  return { data: canvas.toDataURL(), width: canvas.width, height: canvas.height };
}

export default function ScreenCaptureModal({ isOpen, onClose, onSaveScreenshot, captureType = 'screen', selectedImage = null }) {
  const canvasRef = useRef(null);
  const cameraVideoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cropOverlayRef = useRef(null);
  const drawingRef = useRef(false);
  const selectingCropRef = useRef(false);
  const cropStartRef = useRef(null);
  const cropEndRef = useRef(null);
  const historyRef = useRef([]);
  const historyIndexRef = useRef(-1);
  const isRestoringHistoryRef = useRef(false);
  const [hasCaptured, setHasCaptured] = useState(false);
  const [editMode, setEditMode] = useState('draw');
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(5);
  const [hasCropSelection, setHasCropSelection] = useState(false);
  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isRestoringHistory, setIsRestoringHistory] = useState(false);
  const [captureError, setCaptureError] = useState('');
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!isOpen || captureType !== 'camera' || !selectedImage || hasCaptured) return undefined;
    let cancelled = false;
    const image = new Image();
    image.onload = () => {
      if (cancelled || !canvasRef.current) return;
      try {
        const canvas = canvasRef.current;
        const originalDataUrl = drawImageToCanvas(canvas, image);
        setOriginalImage(originalDataUrl);
        const initialHistory = [originalDataUrl];
        historyRef.current = initialHistory;
        historyIndexRef.current = 0;
        setHistory(initialHistory);
        setHistoryIndex(0);
        setCaptureError('');
        setHasCaptured(true);
      } catch (error) {
        console.error('Could not prepare this image for editing:', error);
        setCaptureError('This image host blocks canvas editing. Download the image and upload it again to edit.');
      }
    };
    image.onerror = () => setCaptureError('This image could not be loaded. Check your connection or choose another photo.');
    image.crossOrigin = 'anonymous';
    setCaptureError('');
    image.src = selectedImage;
    return () => {
      cancelled = true;
      image.onload = null;
    };
  }, [isOpen, captureType, selectedImage, hasCaptured]);

  useEffect(() => {
    if (!isOpen || captureType !== 'camera' || selectedImage || hasCaptured) return undefined;
    let cancelled = false;

    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCaptureError('Camera access is not available in this browser. Use Upload Photo instead.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: 'user' },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play();
          setCameraReady(true);
          setCaptureError('');
        }
      } catch (error) {
        if (!cancelled) {
          setCaptureError(error?.name === 'NotAllowedError'
            ? 'Allow camera access in your browser to take a photo.'
            : 'Could not open a camera. Check that one is connected and available.');
        }
      }
    };

    startCamera();
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
    };
  }, [isOpen, captureType, selectedImage, hasCaptured]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const commitHistory = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const nextHistory = [...historyRef.current.slice(0, historyIndexRef.current + 1), {
      data: canvas.toDataURL(),
      width: canvas.width,
      height: canvas.height,
    }].slice(-MAX_HISTORY_STEPS);
    historyRef.current = nextHistory;
    historyIndexRef.current = nextHistory.length - 1;
    setHistory(nextHistory);
    setHistoryIndex(nextHistory.length - 1);
  };

  const commitNewImage = (image) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const originalDataUrl = drawImageToCanvas(canvas, image);
    setOriginalImage(originalDataUrl);
    const initialHistory = [originalDataUrl];
    historyRef.current = initialHistory;
    historyIndexRef.current = 0;
    setHistory(initialHistory);
    setHistoryIndex(0);
    setCaptureError('');
    setHasCaptured(true);
  };

  const handleCapture = async () => {
    if (!navigator.mediaDevices?.getDisplayMedia) {
      setCaptureError('Screen capture is not available in this browser.');
      return;
    }
    let stream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: { displaySurface: 'monitor' }, audio: false });
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        video.onerror = reject;
      });
      await video.play();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const image = new Image();
      image.onload = () => commitNewImage(image);
      image.src = canvas.toDataURL('image/png');
    } catch (error) {
      setCaptureError(error?.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : 'Could not capture this screen. Please try again.');
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
    }
  };

  const captureCameraFrame = () => {
    const video = cameraVideoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;
    const frame = document.createElement('canvas');
    frame.width = video.videoWidth;
    frame.height = video.videoHeight;
    frame.getContext('2d').drawImage(video, 0, 0, frame.width, frame.height);
    const image = new Image();
    image.onload = () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
      setCameraReady(false);
      commitNewImage(image);
    };
    image.onerror = () => setCaptureError('Could not capture this frame. Please try again.');
    image.src = frame.toDataURL('image/jpeg', 0.92);
  };

  const getCanvasCoords = (event) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(canvas.width, ((event.clientX - rect.left) / rect.width) * canvas.width)),
      y: Math.max(0, Math.min(canvas.height, ((event.clientY - rect.top) / rect.height) * canvas.height))
    };
  };

  const updateCropOverlay = (start, end) => {
    const canvas = canvasRef.current;
    const overlay = cropOverlayRef.current;
    const stage = canvas?.parentElement;
    if (!canvas || !overlay || !stage || !start || !end) return;
    const canvasRect = canvas.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const left = canvasRect.left - stageRect.left + (Math.min(start.x, end.x) / canvas.width) * canvasRect.width;
    const top = canvasRect.top - stageRect.top + (Math.min(start.y, end.y) / canvas.height) * canvasRect.height;
    const width = (Math.abs(start.x - end.x) / canvas.width) * canvasRect.width;
    const height = (Math.abs(start.y - end.y) / canvas.height) * canvasRect.height;
    Object.assign(overlay.style, { left: `${left}px`, top: `${top}px`, width: `${width}px`, height: `${height}px`, display: 'block' });
  };

  const handlePointerDown = (event) => {
    if (!hasCaptured || isRestoringHistoryRef.current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const point = getCanvasCoords(event);
    if (editMode === 'draw') {
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      context.beginPath();
      context.moveTo(point.x, point.y);
      context.strokeStyle = brushColor;
      context.lineWidth = brushSize * (canvas.width / canvas.getBoundingClientRect().width);
      context.lineCap = 'round';
      context.lineJoin = 'round';
      drawingRef.current = true;
    } else {
      cropStartRef.current = point;
      cropEndRef.current = point;
      selectingCropRef.current = true;
      setHasCropSelection(false);
    }
  };

  const handlePointerMove = (event) => {
    if (!hasCaptured || (!drawingRef.current && !selectingCropRef.current)) return;
    const pointerEvents = event.nativeEvent.getCoalescedEvents?.() || [event.nativeEvent];
    for (const pointerEvent of pointerEvents) {
      const point = getCanvasCoords(pointerEvent);
      if (drawingRef.current) {
        const context = canvasRef.current.getContext('2d');
        context.lineTo(point.x, point.y);
        context.stroke();
      } else if (selectingCropRef.current) {
        cropEndRef.current = point;
        updateCropOverlay(cropStartRef.current, point);
      }
    }
  };

  const handlePointerEnd = () => {
    if (drawingRef.current) {
      drawingRef.current = false;
      commitHistory();
    }
    if (selectingCropRef.current) {
      selectingCropRef.current = false;
      const start = cropStartRef.current;
      const end = cropEndRef.current;
      const hasArea = start && end && Math.abs(end.x - start.x) >= 10 && Math.abs(end.y - start.y) >= 10;
      setHasCropSelection(Boolean(hasArea));
      if (!hasArea && cropOverlayRef.current) cropOverlayRef.current.style.display = 'none';
    }
  };

  const clearCropSelection = () => {
    cropStartRef.current = null;
    cropEndRef.current = null;
    setHasCropSelection(false);
    if (cropOverlayRef.current) cropOverlayRef.current.style.display = 'none';
  };

  const applyCrop = () => {
    const canvas = canvasRef.current;
    const start = cropStartRef.current;
    const end = cropEndRef.current;
    if (!canvas || !start || !end) return;
    const x = Math.round(Math.min(start.x, end.x));
    const y = Math.round(Math.min(start.y, end.y));
    const width = Math.round(Math.abs(start.x - end.x));
    const height = Math.round(Math.abs(start.y - end.y));
    if (width < 10 || height < 10) return;
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    buffer.getContext('2d').drawImage(canvas, x, y, width, height, 0, 0, width, height);
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d').drawImage(buffer, 0, 0);
    commitHistory();
    clearCropSelection();
    setEditMode('draw');
  };

  const rotateCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rotated = document.createElement('canvas');
    rotated.width = canvas.height;
    rotated.height = canvas.width;
    const context = rotated.getContext('2d');
    context.translate(rotated.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(canvas, 0, 0);
    canvas.width = rotated.width;
    canvas.height = rotated.height;
    canvas.getContext('2d').drawImage(rotated, 0, 0);
    commitHistory();
    clearCropSelection();
    setEditMode('draw');
  };

  const restoreHistory = async (nextIndex) => {
    const canvas = canvasRef.current;
    if (!canvas || isRestoringHistoryRef.current || !historyRef.current[nextIndex]) return;
    isRestoringHistoryRef.current = true;
    setIsRestoringHistory(true);
    const image = new Image();
    const snapshot = historyRef.current[nextIndex];
    try {
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = snapshot.data;
      });
      canvas.width = snapshot.width;
      canvas.height = snapshot.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      historyIndexRef.current = nextIndex;
      setHistoryIndex(nextIndex);
      clearCropSelection();
    } catch (error) {
      console.error('Could not restore image history:', error);
    } finally {
      isRestoringHistoryRef.current = false;
      setIsRestoringHistory(false);
    };
  };

  const resetCanvasEdits = () => {
    if (!originalImage || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const image = new Image();
    image.onload = () => {
      canvas.width = originalImage.width;
      canvas.height = originalImage.height;
      canvas.getContext('2d').drawImage(image, 0, 0);
      const initialHistory = [originalImage];
      historyRef.current = initialHistory;
      historyIndexRef.current = 0;
      setHistory(initialHistory);
      setHistoryIndex(0);
    };
    image.src = originalImage.data;
    clearCropSelection();
    setEditMode('draw');
  };

  const downloadEditedImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/jpeg', 0.9);
    link.download = `edited-photo-${Date.now()}.jpg`;
    link.click();
  };

  const handleSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSaveScreenshot(canvas.toDataURL('image/jpeg', 0.88));
    onClose(false);
  };

  const handleDiscard = () => onClose(true);

  if (!isOpen) return null;

  return (
    <div className={`${styles.modalOverlay} ${styles.editorOverlay}`}>
      <div className={`${styles.modalCard} ${styles.imageEditorCard}`} role="dialog" aria-modal="true" aria-label="Photo editor">
        <header className={styles.editorHeader}>
          <button type="button" onClick={handleDiscard} className={styles.editorCloseButton} aria-label="Discard and close editor">×</button>
          <h2>{captureType === 'screen' ? 'Screenshot editor' : 'Edit photo'}</h2>
          <button type="button" onClick={resetCanvasEdits} className={styles.editorResetButton} disabled={!hasCaptured}>Reset</button>
        </header>

        <div className={styles.editorStage}>
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            className={styles.editorCanvas}
            style={{ display: hasCaptured ? 'block' : 'none' }}
            aria-label="Image editing surface"
          />
          {!hasCaptured && captureType === 'camera' && !selectedImage && (
            <div className={styles.cameraCaptureStage}>
              <video
                ref={cameraVideoRef}
                className={styles.cameraCaptureVideo}
                playsInline
                muted
                autoPlay
                aria-label="Live camera preview"
              />
              {!cameraReady && <p className={styles.cameraCaptureStatus}>{captureError || 'Starting camera…'}</p>}
              {cameraReady && (
                <button type="button" className={styles.editorSendButton} onClick={captureCameraFrame}>
                  Take photo
                </button>
              )}
            </div>
          )}
          <div ref={cropOverlayRef} className={styles.editorCropOverlay} />
          {!hasCaptured && !(captureType === 'camera' && !selectedImage) && (
            <div className={styles.editorEmptyState}>
              <p role={captureError ? 'alert' : 'status'}>
                {captureError || (captureType === 'camera' ? 'Loading photo…' : 'Choose a screen or window to capture.')}
              </p>
              {captureType === 'screen' && <button type="button" className={styles.editorSendButton} onClick={handleCapture}>Choose screen</button>}
            </div>
          )}
        </div>

        {hasCaptured && (
          <section className={styles.editorToolbar} aria-label="Image editing controls">
            <div className={styles.editorTools} role="toolbar" aria-label="Editing tools">
              <button type="button" className={`${styles.editorToolButton} ${editMode === 'draw' ? styles.editorToolActive : ''}`} onClick={() => setEditMode('draw')} disabled={isRestoringHistory} aria-pressed={editMode === 'draw'} title="Draw">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-pen" viewBox="0 0 16 16">
  <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
</svg>
                <span>Draw</span>
              </button>
              <button type="button" className={`${styles.editorToolButton} ${editMode === 'crop' ? styles.editorToolActive : ''}`} onClick={() => { setEditMode('crop'); clearCropSelection(); }} disabled={isRestoringHistory} aria-pressed={editMode === 'crop'} title="Crop">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-aspect-ratio" viewBox="0 0 16 16">
  <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5z"/>
  <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H3v2.5a.5.5 0 0 1-1 0zm12 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H13V8.5a.5.5 0 0 1 1 0z"/>
</svg>                <span>Crop</span>
              </button>
              <button type="button" className={styles.editorToolButton} onClick={rotateCanvas} disabled={isRestoringHistory} title="Rotate 90 degrees" aria-label="Rotate 90 degrees">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640"><path d="M544.1 256L552 256C565.3 256 576 245.3 576 232L576 88C576 78.3 570.2 69.5 561.2 65.8C552.2 62.1 541.9 64.2 535 71L483.3 122.8C439 86.1 382 64 320 64C191 64 84.3 159.4 66.6 283.5C64.1 301 76.2 317.2 93.7 319.7C111.2 322.2 127.4 310 129.9 292.6C143.2 199.5 223.3 128 320 128C364.4 128 405.2 143 437.7 168.3L391 215C384.1 221.9 382.1 232.2 385.8 241.2C389.5 250.2 398.3 256 408 256L544.1 256zM573.5 356.5C576 339 563.8 322.8 546.4 320.3C529 317.8 512.7 330 510.2 347.4C496.9 440.4 416.8 511.9 320.1 511.9C275.7 511.9 234.9 496.9 202.4 471.6L249 425C255.9 418.1 257.9 407.8 254.2 398.8C250.5 389.8 241.7 384 232 384L88 384C74.7 384 64 394.7 64 408L64 552C64 561.7 69.8 570.5 78.8 574.2C87.8 577.9 98.1 575.8 105 569L156.8 517.2C201 553.9 258 576 320 576C449 576 555.7 480.6 573.4 356.5z"/></svg>
              </button>
              <button type="button" className={styles.editorToolButton} onClick={downloadEditedImage} disabled={isRestoringHistory} title="Download edited image" aria-label="Download edited image">
<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-download" viewBox="0 0 16 16">
  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5"/>
  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708z"/>
</svg>              </button>
              {editMode === 'crop' && hasCropSelection && <button type="button" onClick={applyCrop} className={styles.editorApplyCrop}>Apply crop</button>}
              <div className={styles.editorHistoryControls}>
                <button type="button" className={styles.editorToolButton} onClick={() => restoreHistory(historyIndexRef.current - 1)} disabled={historyIndex <= 0 || isRestoringHistory} title="Undo" aria-label="Undo">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 152"><path d="M212.333 224.333H12c-6.627 0-12-5.373-12-12V12C0 5.373 5.373 0 12 0h48c6.627 0 12 5.373 12 12v78.112C117.773 39.279 184.26 7.47 258.175 8.007c136.906.994 246.448 111.623 246.157 248.532C504.041 393.258 393.12 504 256.333 504c-64.089 0-122.496-24.313-166.51-64.215-5.099-4.622-5.334-12.554-.467-17.42l33.967-33.967c4.474-4.474 11.662-4.717 16.401-.525C170.76 415.336 211.58 432 256.333 432c97.268 0 176-78.716 176-176 0-97.267-78.716-176-176-176-58.496 0-110.28 28.476-142.274 72.333h98.274c6.627 0 12 5.373 12 12v48c0 6.627-5.373 12-12 12z"/></svg>
                </button>
                <button type="button" className={styles.editorToolButton} onClick={() => restoreHistory(historyIndexRef.current + 1)} disabled={historyIndex >= history.length - 1 || isRestoringHistory} title="Redo" aria-label="Redo">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 152"><path d="M500.33 0h-47.41a12 12 0 0 0-12 12.57l4 82.76A247.42 247.42 0 0 0 256 8C119.34 8 7.9 119.53 8 256.19 8.1 393.07 119.1 504 256 504a247.1 247.1 0 0 0 166.18-63.91 12 12 0 0 0 .48-17.43l-34-34a12 12 0 0 0-16.38-.55A176 176 0 1 1 402.1 157.8l-101.53-4.87a12 12 0 0 0-12.57 12v47.41a12 12 0 0 0 12 12h200.33a12 12 0 0 0 12-12V12a12 12 0 0 0-12-12z"/></svg>                </button>
              </div>
            </div>

            {editMode === 'draw' && (
              <div className={styles.editorBrushControls}>
                <div className={styles.editorColors} role="group" aria-label="Brush color">
                  {['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#ffffff', '#111827'].map((color) => (
                    <button key={color} type="button" onClick={() => setBrushColor(color)} className={`${styles.editorColorSwatch} ${brushColor === color ? styles.editorColorSelected : ''}`} style={{ '--swatch-color': color }} aria-label={`Brush color ${color}`} aria-pressed={brushColor === color} />
                  ))}
                </div>
                <label className={styles.editorBrushSize}>
                  <span>Brush size</span>
                  <input type="range" min="2" max="16" value={brushSize} onChange={(event) => setBrushSize(Number(event.target.value))} />
                </label>
              </div>
            )}
          </section>
        )}

        <footer className={styles.editorFooter}>
          <button type="button" className={styles.editorDiscardButton} onClick={handleDiscard}>Discard</button>
          {hasCaptured && <button type="button" className={styles.editorSendButton} onClick={handleSend}>Use photo</button>}
        </footer>
      </div>
    </div>
  );
}