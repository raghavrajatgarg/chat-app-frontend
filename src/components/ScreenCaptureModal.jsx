import React, { useRef, useState } from 'react';
import styles from '../App.module.css';
export default function ScreenCaptureModal({ isOpen, onClose, onSaveScreenshot, captureType = 'screen' }) {
  const canvasRef = useRef(null);
  const [hasCaptured, setHasCaptured] = useState(false);
  const [editMode, setEditMode] = useState('draw'); // Modes: 'draw' or 'crop'
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(5);

  // Core Drawing States
  const [isDrawing, setIsDrawing] = useState(false);

  // Core Cropping Coordinates
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);

  // Undo / Redo & Asset Memory Management Stacks
  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  if (!isOpen) return null;

  // Commits canvas states into the historical image pointer array
  const saveToHistory = (canvasElement) => {
    const dataUrl = canvasElement.toDataURL();
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const cleanHistory = history.slice(0, historyIndex + 1);
      const updatedHistory = [...cleanHistory, img];
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
    };
  };
  // Add this new useEffect inside your ScreenCaptureModal component right above your handleCapture function:
// Replace the mobile auto-mount useEffect block in ScreenCaptureModal.jsx completely with this:
useEffect(() => {
  if (isOpen && captureType === 'camera' && !hasCaptured) {
    console.log("📸 Pre-loaded native mobile camera asset detected. Initializing editor studio canvas...");
    
    // Small timeout ensures the DOM renders the canvas reference node context safely
    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        console.error("❌ Canvas element not ready yet for camera preview.");
        return;
      }
      
      const ctx = canvas.getContext('2d');
      const imgInstance = new Image();
      
      // Use the open string token value passed down dynamically from the parent wrapper
      imgInstance.src = typeof isOpen === 'string' ? isOpen : canvas.toDataURL(); 
      
      imgInstance.onload = () => {
        // Sync resolution size constraints precisely matching your snapped picture metrics
        canvas.width = imgInstance.naturalWidth || imgInstance.width;
        canvas.height = imgInstance.naturalHeight || imgInstance.height;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(imgInstance, 0, 0);
        
        // Initialize history stack array tracks with this master raw snapshot context
        setOriginalImage(imgInstance);
        setHistory([imgInstance]);
        setHistoryIndex(0);
        
        // Transition layouts immediately straight to drawing tool state options
        setHasCaptured(true); 
      };
    }, 60);

    return () => clearTimeout(timer);
  }
}, [isOpen, captureType, hasCaptured]);


   const handleCapture = async () => {
    try {
      let stream;

      if (captureType === 'camera') {
        console.log("📸 Initializing native hardware video camera feed...");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, // Prioritizes rear camera for snapping external bugs
          audio: false
        });
      } else {
        console.log("💻 Initializing display screen media capture window picker...");
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: "monitor" },
          audio: false
        });
      }
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        setTimeout(() => {
          const canvas = canvasRef.current;
          if (canvas) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            
            const imgInstance = new Image();
            imgInstance.src = canvas.toDataURL('image/png');
            imgInstance.onload = () => {
              setOriginalImage(imgInstance);
              setHistory([imgInstance]);
              setHistoryIndex(0);
              setHasCaptured(true);
            };
          }
          // Safely shut down background video streaming channels to release the hardware indicator
          stream.getTracks().forEach(track => track.stop());
        }, 150);
      };

      await video.play();
    } catch (err) {
      console.error("Native cross-platform capture picker interface initialization failed:", err);
      alert("Could not access media. Please verify hardware permissions are granted.");
      onClose();
    }
  };


  // Normalizes mouse or pointer coordinates matching screen scale bounds
  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handleMouseDown = (e) => {
    if (!hasCaptured) return;
    const { x, y } = getCanvasCoords(e);

    if (editMode === 'draw') {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = brushColor;
      ctx.lineWidth = brushSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      setIsDrawing(true);
    } else if (editMode === 'crop') {
      setCropStart({ x, y });
      setCropEnd({ x, y });
      setIsSelectingCrop(true);
    }
  };

  const handleMouseMove = (e) => {
    if (!hasCaptured) return;
    const { x, y } = getCanvasCoords(e);

    if (editMode === 'draw' && isDrawing) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.lineTo(x, y);
      ctx.stroke();
    } else if (editMode === 'crop' && isSelectingCrop) {
      setCropEnd({ x, y });
      drawCropOverlay(x, y);
    }
  };

  const handleMouseUp = () => {
    if (editMode === 'draw' && isDrawing) {
      setIsDrawing(false);
      saveToHistory(canvasRef.current);
    } else if (editMode === 'crop') {
      setIsSelectingCrop(false);
    }
  };

  const drawCropOverlay = (currentX, currentY) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!canvas || !originalImage || !cropStart) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(originalImage, 0, 0);

    const x = Math.min(cropStart.x, currentX);
    const y = Math.min(cropStart.y, currentY);
    const w = Math.abs(cropStart.x - currentX);
    const h = Math.abs(cropStart.y - currentY);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(x, y, w, h);
    ctx.drawImage(originalImage, x, y, w, h, x, y, w, h);

    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
  };

  const applyCrop = () => {
    if (!cropStart || !cropEnd) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropStart.x - cropEnd.x);
    const h = Math.abs(cropStart.y - cropEnd.y);

    if (w < 10 || h < 10) return;

    const bufferCanvas = document.createElement('canvas');
    bufferCanvas.width = w;
    bufferCanvas.height = h;
    const bufferCtx = bufferCanvas.getContext('2d');
    bufferCtx.drawImage(canvas, x, y, w, h, 0, 0, w, h);

    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bufferCanvas, 0, 0);

    saveToHistory(canvas);
    setCropStart(null);
    setCropEnd(null);
    setEditMode('draw');
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const targetImg = history[prevIndex];

      canvas.width = targetImg.naturalWidth || targetImg.width;
      canvas.height = targetImg.naturalHeight || targetImg.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(targetImg, 0, 0);
      setHistoryIndex(prevIndex);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const targetImg = history[nextIndex];

      canvas.width = targetImg.naturalWidth || targetImg.width;
      canvas.height = targetImg.naturalHeight || targetImg.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(targetImg, 0, 0);
      setHistoryIndex(nextIndex);
    }
  };

  const resetCanvasEdits = () => {
    const canvas = canvasRef.current;
    if (canvas && originalImage) {
      canvas.width = originalImage.naturalWidth || originalImage.width;
      canvas.height = originalImage.naturalHeight || originalImage.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(originalImage, 0, 0);
      setHistory([originalImage]);
      setHistoryIndex(0);
      setCropStart(null);
      setCropEnd(null);
    }
  };

  const handleFinalExportAndSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const finalCompressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
    onSaveScreenshot(finalCompressedBase64);
    onClose();
  };
  return (
    <div className={styles.modalOverlay} style={{ zIndex: 999999999999 }}>
      <div className={styles.modalCard} style={{ maxWidth: '1000px', width: '95%', padding: '16px', maxHeight: '95dvh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Title Block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>Screenshot Studio</h3>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '24px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Dynamic Studio Canvas Render Target Element Frame */}
        <div style={{ flexGrow: 1, display: 'flex', alignItems: 'center', justifycontent: 'center', margin: '10px 0', overflow: 'hidden', background: '#020408', borderRadius: '10px', padding: '5px' }}>
          <canvas 
            ref={canvasRef}
            onPointerDown={handleMouseDown}
            onPointerMove={handleMouseMove}
            onPointerUp={handleMouseUp}
            onPointerLeave={handleMouseUp}
            style={{ 
              display: hasCaptured ? 'block' : 'none',
              maxWidth: '100%', 
              maxHeight: '50vh', 
              objectFit: 'contain',
              boxShadow: '0 12px 36px rgba(0,0,0,0.6)',
              background: '#000',
              touchAction: 'none' 
            }}
          />

          {!hasCaptured && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifycontent: 'center', gap: '15px', padding: '20px 0', width: '100%' }}>
              <p className={styles.modalSubtext} style={{ textAlign: 'center', maxWidth: '440px', color: 'var(--text-muted)', fontSize: '13px' }}>
                Select a screen, application dashboard, or individual browser tab to initiate markup.
              </p>
              <button type="button" className={styles.sendBtn} onClick={handleCapture} style={{ background: 'var(--accent-blue)', margin: '0 auto', fontSize: '14px' }}>
                Open Window Picker
              </button>
              <button type="button" className={styles.sendBtn} onClick={handleCapture} style={{ background: 'var(--accent-blue)', margin: '0 auto', fontSize: '14px' }}>
                {captureType === 'camera' ? 'Launch Camera Feed' : 'Open Window Picker'}
              </button>

            </div>
          )}
        </div>

        {/* RESPONSIVE CONTROL PANEL GRID */}
        {hasCaptured && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: '#090d16', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color)', flexShrink: 0 }}>
            
            {/* Top Toolbar Row: Mode selection and utilities */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', width: '100%' }}>
              <button 
                type="button" 
                className={`${styles.roomBtn} ${editMode === 'draw' ? styles.roomBtnActive : ''}`} 
                onClick={() => setEditMode('draw')}
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                ✏️ Draw
              </button>
              
              <button 
                type="button" 
                className={`${styles.roomBtn} ${editMode === 'crop' ? styles.roomBtnActive : ''}`} 
                onClick={() => setEditMode('crop')}
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                ✂️ Crop
              </button>

              {editMode === 'crop' && cropStart && cropEnd && (
                <button 
                  type="button" 
                  className={styles.sendBtn} 
                  onClick={applyCrop} 
                  style={{ background: 'var(--accent-emerald)', padding: '6px 10px', fontSize: '12px', fontWeight: 600 }}
                >
                  Apply Crop
                </button>
              )}

              {/* Undo, Redo, and Reset Alignment Segment */}
              <div style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                <button type="button" onClick={handleUndo} disabled={historyIndex <= 0} className={styles.roomBtn} style={{ padding: '6px 10px', fontSize: '12px', opacity: historyIndex <= 0 ? 0.3 : 1 }}>
                  ↩️ Undo
                </button>
                <button type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={styles.roomBtn} style={{ padding: '6px 10px', fontSize: '12px', opacity: historyIndex >= history.length - 1 ? 0.3 : 1 }}>
                  ↪️ Redo
                </button>
                <button type="button" className={styles.logoutBtn} onClick={resetCanvasEdits} style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 10px', fontSize: '12px' }}>
                  Reset
                </button>
              </div>
            </div>

            {/* Bottom Toolbar Row: Color palettes and sizing sliders */}
            {editMode === 'draw' && (
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px' }}>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#ffffff', '#000000'].map((color) => (
                    <button 
                      key={color} 
                      type="button"
                      onClick={() => setBrushColor(color)}
                      style={{ 
                        height: '22px', 
                        width: '22px',
                        background: color, 
                        border: brushColor === color ? '2px solid #fff' : '1px solid rgba(255,255,255,0.2)', 
                        borderRadius: '50%',
                        cursor: 'pointer'
                      }} 
                    />
                  ))}
                </div>
                <input 
                  type="range" 
                  min="2" 
                  max="16" 
                  value={brushSize} 
                  onChange={(e) => setBrushSize(parseInt(e.target.value))}
                  style={{ flexGrow: 1, minWidth: '70px', accentColor: 'var(--accent-blue)', cursor: 'pointer' }}
                />
              </div>
            )}
          </div>
        )}

        {/* MODAL BOTTOM ACTION SUBMIT CONTROLS */}
        <div style={{ display: 'flex', justifycontent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', marginTop: '12px', paddingTop: '10px', flexShrink: 0 }}>
          <button type="button" className={styles.modalCancelBtn} onClick={onClose} style={{ padding: '8px 20px', fontSize: '13px' }}>Discard</button>
          {hasCaptured && (
            <button type="button" className={styles.sendBtn} onClick={handleFinalExportAndSend} style={{ background: 'var(--accent-blue)', padding: '8px 24px', fontSize: '13px' }}>
              Send Snapshot
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
