import { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';

export default function TextSpotter() {
  const [imageSrc, setImageSrc] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Step 1: Load the image (Equivalent to imread)
  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setImageSrc(url);
    }
  };

  // Step 2 & 3: Inference and Spotting
  const handleDetectText = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);

    try {
      const worker = await Tesseract.createWorker(['eng', 'jpn']);

      // 1. THE FIX: Explicitly request 'blocks' in the third parameter
      const result = await worker.recognize(imageSrc, undefined, { blocks: true });

      const blocks = result.data.blocks || [];
      const detectedWords = [];

      // 2. Extract words from the layout hierarchy
      blocks.forEach((block) => {
        block.paragraphs?.forEach((paragraph) => {
          paragraph.lines?.forEach((line) => {
            line.words?.forEach((word) => {
              detectedWords.push(word);
            });
          });
        });
      });

      if (detectedWords.length === 0) {
        console.warn('Tesseract did not find any text.');
      } else {
        console.log(`Success! Found ${detectedWords.length} words.`);
      }

      // 3. Draw bounding boxes
      drawResults(detectedWords);

      await worker.terminate();
    } catch (error) {
      console.error('Detection failed:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Visualization (Equivalent to polylines / imshow)
  const drawResults = (words: any[] = []) => {
    // Safety check to prevent the forEach crash
    if (!Array.isArray(words)) {
      console.error('Expected an array of words, but got:', words);
      return;
    }

    if (!canvasRef.current || !imageRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const image = imageRef.current;

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0);

    words.forEach((word) => {
      const { bbox, text, confidence } = word;

      if (confidence > 10) {
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgb(0, 255, 0)';
        ctx.fillRect(bbox.x0, bbox.y0, bbox.x1 - bbox.x0, bbox.y1 - bbox.y0);

        // ctx.fillStyle = 'red';
        // ctx.font = '16px Arial';
        // ctx.fillText(text, bbox.x0, bbox.y0 >= 20 ? bbox.y0 - 5 : 20);
      }
    });
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Text Detection & Spotting</h2>

      <input type="file" accept="image/*" onChange={handleImageUpload} />
      <button onClick={handleDetectText} disabled={!imageSrc || isProcessing}>
        {isProcessing ? 'Processing...' : 'Detect Text'}
      </button>

      <div style={{ position: 'relative', marginTop: '20px' }}>
        {/* Hidden image element to act as our source Mat */}
        {imageSrc && (
          <img
            ref={imageRef}
            src={imageSrc}
            alt="Source"
            style={{ display: 'none' }}
            onLoad={() => {
              // Draw initial image to canvas
              const canvas = canvasRef.current;
              canvas.width = imageRef.current.width;
              canvas.height = imageRef.current.height;
              canvas.getContext('2d').drawImage(imageRef.current, 0, 0);
            }}
          />
        )}

        {/* Output Canvas (Equivalent to imshow) */}
        <canvas ref={canvasRef} style={{ border: '1px solid black', maxWidth: '100%' }} />
      </div>
    </div>
  );
}
