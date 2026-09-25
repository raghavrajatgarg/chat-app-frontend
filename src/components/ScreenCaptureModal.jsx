import React, { useRef, useState, useEffect } from 'react';
import styles from '../App.module.css';

export default function ScreenCaptureModal({ isOpen, onClose, onSaveScreenshot, captureType = 'screen', selectedImage = null }) {
  console.log("📌 [TRACE 1] ScreenCaptureModal lifecycle rendering loop initialized.");
  console.log(`📊 [TRACE 2] Current Incoming Props Matrix: isOpen=${!!isOpen} (${typeof isOpen}), captureType="${captureType}", hasSelectedImageProp=${!!selectedImage}`);

  const canvasRef = useRef(null);
  const [hasCaptured, setHasCaptured] = useState(false);
  const [editMode, setEditMode] = useState('draw'); 
  const [brushColor, setBrushColor] = useState('#ef4444');
  const [brushSize, setBrushSize] = useState(5);

  const [isDrawing, setIsDrawing] = useState(false);
  const [cropStart, setCropStart] = useState(null);
  const [cropEnd, setCropEnd] = useState(null);
  const [isSelectingCrop, setIsSelectingCrop] = useState(false);

  const [originalImage, setOriginalImage] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // 1. MOBILE CAMERA SYNC PIPELINE HOOK
  useEffect(() => {
    console.log(`🔄 [TRACE 3] useEffect (Camera Sync Monitor) evaluated. State context: isOpen=${!!isOpen}, captureType="${captureType}", hasCapturedState=${hasCaptured}`);
    
    if (isOpen && captureType === 'camera' && selectedImage && !hasCaptured) {
      console.log("📸 [TRACE 4] MATCH VERIFIED! Intercepting mobile camera input payload string...");
      console.log(`📄 [TRACE 5] Base64 Image String length validation weight: ${selectedImage.length} bytes.`);
      
      console.log("⏱️ [TRACE 6] Starting 150ms structural initialization buffer delay...");
      const timer = setTimeout(() => {
        console.log("🎨 [TRACE 7] Buffer finished. Querying canvas target node element tracking reference...");
        const canvas = canvasRef.current;
        if (!canvas) {
          console.error("❌ [TRACE CRITICAL ERROR] canvasRef.current is NULL or UNMOUNTED! The canvas node is unreachable in the current render pass layout.");
          return;
        }
        
        console.log("📐 [TRACE 8] Canvas node verified. Spawning native virtual Image compilation container instance...");
        const ctx = canvas.getContext('2d');
        const imgInstance = new Image();
        imgInstance.src = selectedImage;
        
        imgInstance.onload = () => {
          console.log(`📏 [TRACE 9] Virtual image compiled successfully! Source dimensions: ${imgInstance.naturalWidth}x${imgInstance.naturalHeight}`);
          
          canvas.width = imgInstance.naturalWidth || imgInstance.width;
          canvas.height = imgInstance.naturalHeight || imgInstance.height;
          console.log(`📐 [TRACE 10] Hard-locking layout resolution constraints: ${canvas.width}x${canvas.height}`);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(imgInstance, 0, 0);
          console.log("🖌️ [TRACE 11] Pixels drawn successfully onto the master editing drawing plane context layer.");
          
          console.log("💾 [TRACE 12] Backing up reference frames into local variables history states arrays arrays...");
          setOriginalImage(imgInstance);
          setHistory([imgInstance]);
          setHistoryIndex(0);
          
          console.log("🎉 [TRACE 13] SUCCESS HANDSHAKE! Shifting layout state boundaries: setHasCaptured(true)");
          setHasCaptured(true);
        };

        imgInstance.onerror = (imgErr) => {
          console.error("💥 [TRACE EXCEPTION] Virtual Image serialization rendering failed to load the base64 matrix stack:", imgErr);
        };
      }, 150);

      return () => {
        console.log("🧹 [TRACE Cleanup] Breaking active background timers...");
        clearTimeout(timer);
      };
    }
  }, [isOpen, captureType, selectedImage, hasCaptured]);

  // 2. DISMISS CLEANUP ROUTINE HOOK
  useEffect(() => {
    console.log(`🔄 [TRACE 14] useEffect (Dismiss Cleanup Monitor) fired. isOpen=${!!isOpen}`);
    if (!isOpen) {
      console.log("🧹 [TRACE 15] Modal closed. Wiping local component workspace parameters memory cache...");
      setHasCaptured(false);
      setOriginalImage(null);
      setHistory([]);
      setHistoryIndex(-1);
    }
  }, [isOpen]);

  // HOOK LAWS EXPLICIT ESCAPE ENFORCEMENT LAYER
  if (!isOpen) {
    console.log("🛑 [TRACE 16] Safety check triggered: isOpen is FALSE/NULL. Rendering NULL structural wrapper element.");
    return null;
  }

  console.log(`🎨 [TRACE 17] Processing view layer markup maps. hasCaptured state profile: ${hasCaptured}`);

  const saveToHistory = (canvasElement) => {
    console.log("💾 [TRACE ACTION] saveToHistory called. Index layer position:", historyIndex);
    const dataUrl = canvasElement.toDataURL();
    const img = new Image();
    img.src = dataUrl;
    img.onload = () => {
      const cleanHistory = history.slice(0, historyIndex + 1);
      const updatedHistory = [...cleanHistory, img];
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      console.log(`✅ [TRACE ACTION] History point committed. Total items stored: ${updatedHistory.length}`);
    };
  };

  const handleCapture = async () => {
    console.log("💻 [TRACE EVENT] handleCapture triggered for standard desktop display windows picker capture.");
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: "monitor" },
        audio: false
      });
      console.log("✅ [TRACE EVENT] Media stream channel acquired successfully:", stream);
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        console.log(`📏 [TRACE EVENT] Desktop metadata loaded. Capture frame sizes: ${video.videoWidth}x${video.videoHeight}`);
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
              console.log("🎉 [TRACE EVENT] Desktop screenshot successfully compiled into editor workspace!");
            };
          }
          stream.getTracks().forEach(track => {
            track.stop();
            console.log(`⏹️ [TRACE EVENT] Media stream stopped track: ${track.label}`);
          });
        }, 150);
      };
      await video.play();
    } catch (err) {
      console.error("💥 [TRACE CAPTURE ERROR] Desktop window picker process failed:", err);
    }
  };

  const getCanvasCoords = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);
    return {
      x: ((clientX - rect.left) / rect.width) * canvas.width,
      y: ((clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const handleMouseDown = (e) => {
    console.log("🖱️ [TRACE INPUT] Mouse/Touch interact down triggered.");
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
    if (!hasCaptured || isSelectingCrop === false && isDrawing === false) return;
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
    console.log("🖱️ [TRACE INPUT] Mouse/Touch interaction released.");
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

  const handleFinalExportAndSend = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const finalCompressedBase64 = canvas.toDataURL('image/jpeg', 0.75);
    onSaveScreenshot(finalCompressedBase64);
    onClose();
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
  return (
    <div className={styles.modalOverlay} style={{ zIndex: 999999999999 }}>
      <div className={styles.modalCard} style={{ maxWidth: '1000px', width: '95%', padding: '16px', maxHeight: '95dvh', display: 'flex', flexDirection: 'column' }}>
        
        {/* Header Title Block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', flexShrink: 0 }}>
          <h3 style={{ margin: 0, color: '#fff', fontSize: '16px' }}>Screenshot Editor</h3>
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

{/* Replace your old !hasCaptured section with this clean block layout */}
{!hasCaptured && (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '15px', padding: '40px 0', width: '100%' }}>
    <p className={styles.modalSubtext} style={{ textAlign: 'center', maxWidth: '440px', color: 'var(--text-muted)', fontSize: '13px' }}>
      Select a screen, application dashboard, or individual browser tab to snip and edit.
    </p>
    
    {/* CLEAN FIX: One clean button that handles the mode dynamically */}
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
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-pen" viewBox="0 0 16 16">
  <path d="m13.498.795.149-.149a1.207 1.207 0 1 1 1.707 1.708l-.149.148a1.5 1.5 0 0 1-.059 2.059L4.854 14.854a.5.5 0 0 1-.233.131l-4 1a.5.5 0 0 1-.606-.606l1-4a.5.5 0 0 1 .131-.232l9.642-9.642a.5.5 0 0 0-.642.056L6.854 4.854a.5.5 0 1 1-.708-.708L9.44.854A1.5 1.5 0 0 1 11.5.796a1.5 1.5 0 0 1 1.998-.001m-.644.766a.5.5 0 0 0-.707 0L1.95 11.756l-.764 3.057 3.057-.764L14.44 3.854a.5.5 0 0 0 0-.708z"/>
</svg> Draw
              </button>
              
              <button 
                type="button" 
                className={`${styles.roomBtn} ${editMode === 'crop' ? styles.roomBtnActive : ''}`} 
                onClick={() => setEditMode('crop')}
                style={{ padding: '6px 10px', fontSize: '12px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-aspect-ratio" viewBox="0 0 16 16">
  <path d="M0 3.5A1.5 1.5 0 0 1 1.5 2h13A1.5 1.5 0 0 1 16 3.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 0 12.5zM1.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-9a.5.5 0 0 0-.5-.5z"/>
  <path d="M2 4.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 0 1H3v2.5a.5.5 0 0 1-1 0zm12 7a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1 0-1H13V8.5a.5.5 0 0 1 1 0z"/>
</svg> Crop
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
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-counterclockwise" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 3a5 5 0 1 1-4.546 2.914.5.5 0 0 0-.908-.417A6 6 0 1 0 8 2z"/>
  <path d="M8 4.466V.534a.25.25 0 0 0-.41-.192L5.23 2.308a.25.25 0 0 0 0 .384l2.36 1.966A.25.25 0 0 0 8 4.466"/>
</svg> Undo
                </button>
                <button type="button" onClick={handleRedo} disabled={historyIndex >= history.length - 1} className={styles.roomBtn} style={{ padding: '6px 10px', fontSize: '12px', opacity: historyIndex >= history.length - 1 ? 0.3 : 1 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-arrow-clockwise" viewBox="0 0 16 16">
  <path fill-rule="evenodd" d="M8 3a5 5 0 1 0 4.546 2.914.5.5 0 0 1 .908-.417A6 6 0 1 1 8 2z"/>
  <path d="M8 4.466V.534a.25.25 0 0 1 .41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 0 1 8 4.466"/>
</svg> Redo
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
