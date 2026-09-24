import React, { useState } from 'react';
import FilerobotImageEditor, { TABS, TOOLS } from 'react-filerobot-image-editor';
import styles from '../App.module.css';

export default function ScreenCaptureModal({ onSend }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [isOpen, setIsOpen] = useState(false);

  // 1. Trigger the native window/screen selection menu
  const handleCaptureClick = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { cursor: "always" }, 
        audio: false 
      });
      
      const video = document.createElement('video');
      video.srcObject = stream;
      await video.play();

      // Small timeout to ensure video frame loads
      setTimeout(() => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // Kill the screen stream so the browser sharing indicator stops
        stream.getTracks().forEach(track => track.stop());

        setImageSrc(canvas.toDataURL('image/png'));
        setIsOpen(true);
      }, 250);
    } catch (err) {
      console.error("Window capture cancelled or failed:", err);
    }
  };

  return (
    <div className={styles.screenCaptureModal}>
      {/* Button to place in your chat toolbar */}
      <button onClick={handleCaptureClick} style={styles.triggerBtn}>
        📷 Capture Window & Edit
      </button>

      {/* WhatsApp-Style Editor Modal */}
      {isOpen && imageSrc && (
        <FilerobotImageEditor
          source={imageSrc}
          onSave={(editedImageObject) => {
            // editedImageObject contains the final edited image as base64, file, or canvas
            onSend(editedImageObject.imageBase64); 
            setIsOpen(false);
          }}
          onClose={() => setIsOpen(false)}
          annotationsCommon={{
            fill: '#ff0000',
            stroke: '#ff0000',
            strokeWidth: 4,
          }}
          Text={{ text: 'Type here...' }}
          Rotate={{ angle: 90 }}
          tabsIds={[
            TABS.FINETUNE, // Brightness, contrast, etc.
            TABS.ANNOTATE, // Brush/Pen drawing, arrows, shapes, text
            TABS.WATERMARK,
          ]}
          defaultTabId={TABS.ANNOTATE} // Opens directly to drawing tools like WhatsApp
          defaultToolId={TOOLS.PEN}    // Default to the pen/brush tool
        />
      )}
    </div>
  );
}
