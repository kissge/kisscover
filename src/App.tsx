import './App.css';
import { useState } from 'react';
import { Stage, Layer, Image, Circle, Line } from 'react-konva';
import Cat from './assets/cat.jpg';

const dragTolerance = 15;

function App() {
  const [loaded, setLoaded] = useState(false);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const img = new window.Image();
  img.onload = () => {
    setLoaded(true);
    setImageSize({ width: img.width, height: img.height });
  };
  img.src = Cat;

  const [markers, setMarkers] = useState([
    [100, 100],
    [200, 200],
    [175, 125],
  ]);
  const [draggingItem, setDraggingItem] = useState<{type: 'marker', index: number} | { type: 'line', from: number, to: number, x: number, y: number } | { type: 'polygon', x: number, y: number }>();

  const [position, setPosition] = useState({ x: 0, y: 0 });

  function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) // in case of 0 length line
        param = dot / len_sq;

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    }
    else if (param > 1) {
      xx = x2;
      yy = y2;
    }
    else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  return (
    <>
      <section id="center">
        {loaded && (
          <Stage width={540} height={540}>
            <Layer onTouchStart={(e) => {
              const pos = e.target.getStage()!.getPointerPosition()!

              // Check if the click is close to any existing marker
              for (let index = 0; index < markers.length; index++) {
                const markerX = markers[index][0];
                const markerY = markers[index][1];
                const distance = Math.sqrt((pos.x - markerX) ** 2 + (pos.y - markerY) ** 2);
                if (distance < dragTolerance) {
                  setDraggingItem({ type: 'marker', index });
                  console.log(`Clicked on marker ${index}`);
                  return;
                }
              }

              // Check if the click is close to any line segment
              for (let i = 0; i < markers.length; i++) {
                const start = markers[i];
                const end = markers[(i + 1) % markers.length];
                const distanceToLine = pointToLineDistance(pos.x, pos.y, start[0], start[1], end[0], end[1]);
                if (distanceToLine < dragTolerance) {
                  setDraggingItem({ type: 'line', from: i, to: (i + 1) % markers.length, x: pos.x, y: pos.y });
                  console.log(`Clicked on line segment from marker ${i} to marker ${(i + 1) % markers.length}, inserting new marker at (${pos.x}, ${pos.y})`);
                  return;
                }
              }

              // Check if the click is inside the polygon formed by the markers using markers, not Path2D
              let inside = false;
              for (let i = 0, j = markers.length - 1; i < markers.length; j = i++) {
                const xi = markers[i][0], yi = markers[i][1];
                const xj = markers[j][0], yj = markers[j][1];

                const intersect = ((yi > pos.y) !== (yj > pos.y)) &&
                  (pos.x < (xj - xi) * (pos.y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
              }

              if (inside) {
                setDraggingItem({ type: 'polygon', x: pos.x, y: pos.y });
              }
            }}
            onTouchMove={(e) => {
              const pos = e.target.getStage()!.getPointerPosition()!;

              if (draggingItem) {
                if (draggingItem.type === 'marker') {
                  const newMarkers = [...markers];
                  newMarkers[draggingItem.index] = [pos.x, pos.y];
                  setMarkers(newMarkers);
                } else if (draggingItem.type === 'line') {
                  const newMarkers = [...markers];
                  newMarkers.splice(draggingItem.to, 0, [pos.x, pos.y]);
                  setMarkers(newMarkers);
                  setDraggingItem({ type: 'marker', index: draggingItem.to });
                } else if (draggingItem.type === 'polygon') {
                  const newMarkers = markers.map(marker => [marker[0] + (pos.x - draggingItem.x), marker[1] + (pos.y - draggingItem.y)]);
                  setMarkers(newMarkers);
                  setDraggingItem({ type: 'polygon', x: pos.x, y: pos.y });
                }
              }
            }}
            onTouchEnd={() => {
              setDraggingItem(undefined);
            }}
            >
              <Image x={10} y={10} width={520} height={(520 * imageSize.height) / imageSize.width} image={img} />

              <Line points={markers.flat()} stroke="blue" fill="#0000ff77" strokeWidth={2} closed />

              {markers.map((marker, index) => (
                <Circle
                  key={index}
                  x={marker[0]}
                  y={marker[1]}
                  radius={5}
                  fill="red"
                />
              ))}
            </Layer>
          </Stage>
        )}

        {JSON.stringify(draggingItem ?? null)}
        {JSON.stringify(position)}

        <button
          onClick={() => {
            const stage = document.querySelector('canvas');
            if (stage) {
              const dataURL = stage.toDataURL();
              const link = document.createElement('a');
              link.href = dataURL;
              link.download = 'image.png';
              link.click();
            }
          }}
        >
          Save as image
        </button>
      </section>
    </>
  );
}

export default App;
