import './App.css';
import { useEffect, useRef, useState } from 'react';
import { Stage, Layer, Image, Circle, Line, Group } from 'react-konva';

const dragTolerance = 20;

type Point = [number, number];
type Polygon = { id: number; points: Point[] };
type DraggingItem =
  | { type: 'marker'; polygonId: number; index: number }
  | { type: 'line'; polygonId: number; from: number; to: number; x: number; y: number }
  | { type: 'polygon'; polygonId: number; x: number; y: number };

function pointToLineDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const A = px - x1;
  const B = py - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;
  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx;
  let yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = px - xx;
  const dy = py - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

function pointInPolygon(px: number, py: number, points: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];

    const intersects = ((yi > py) !== (yj > py)) &&
      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersects) {
      inside = !inside;
    }
  }

  return inside;
}

function App() {
  const [loaded, setLoaded] = useState(false);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const canvasSize = 540;
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [draggingItem, setDraggingItem] = useState<DraggingItem>();
  const [nextPolygonId, setNextPolygonId] = useState(2);
  const [lastTap, setLastTap] = useState<{ polygonId: number; x: number; y: number; time: number } | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);
  const pinchGestureRef = useRef<{
    startCenter: { x: number; y: number };
    startDistance: number;
    startViewport: { x: number; y: number; scale: number };
  } | null>(null);

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current !== null) {
        window.clearTimeout(tapTimeoutRef.current);
      }
    };
  }, []);

  function loadBackgroundImage(file: File) {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(canvasSize / img.width, canvasSize / img.height);
      setImage(img);
      setLoaded(true);
      setImageSize({ width: img.width * scale, height: img.height * scale });
    };
    img.src = URL.createObjectURL(file);
  }

  function getWorldPoint(pointer: { x: number; y: number }) {
    return {
      x: (pointer.x - viewport.x) / viewport.scale,
      y: (pointer.y - viewport.y) / viewport.scale,
    };
  }

  function addPolygon(x: number, y: number) {
    const polygonId = nextPolygonId;
    const newPolygon: Polygon = {
      id: polygonId,
      points: [
        [x - 60, y - 40],
        [x + 60, y - 40],
        [x + 60, y + 40],
        [x - 60, y + 40],
      ],
    };

    setPolygons((current) => [...current, newPolygon]);
    setNextPolygonId(polygonId + 1);
    setDraggingItem({ type: 'polygon', polygonId, x, y });
  }

  return (
    <>
      <section id="center">
        <p>Click a marker to move it, click an edge to add a point, click inside a polygon to move it, double-tap inside a polygon to remove it, and click empty space to add another polygon.</p>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              loadBackgroundImage(file);
            }
          }}
        />
        {loaded && (
          <Stage width={540} height={540} style={{ touchAction: 'none' }}>
            <Layer
              x={viewport.x}
              y={viewport.y}
              scaleX={viewport.scale}
              scaleY={viewport.scale}
              onTouchStart={(e) => {
                const touches = e.evt.touches;
                if (touches.length !== 2) {
                  return;
                }

                const stage = e.target.getStage();
                const rect = stage?.container().getBoundingClientRect();
                if (!rect) {
                  return;
                }

                const [first, second] = touches;
                pinchGestureRef.current = {
                  startCenter: {
                    x: (first.clientX + second.clientX) / 2 - rect.left,
                    y: (first.clientY + second.clientY) / 2 - rect.top,
                  },
                  startDistance: Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY),
                  startViewport: { ...viewport },
                };
              }}
              onTouchMove={(e) => {
                e.evt.preventDefault();

                const touches = e.evt.touches;
                if (touches.length !== 2 || !pinchGestureRef.current) {
                  return;
                }

                const stage = e.target.getStage();
                const rect = stage?.container().getBoundingClientRect();
                if (!rect) {
                  return;
                }

                const [first, second] = touches;
                const center = {
                  x: (first.clientX + second.clientX) / 2 - rect.left,
                  y: (first.clientY + second.clientY) / 2 - rect.top,
                };
                const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY);
                const gesture = pinchGestureRef.current;
                const scaleFactor = distance / gesture.startDistance;
                const nextScale = Math.min(3, Math.max(0.5, gesture.startViewport.scale * scaleFactor));
                const worldPoint = {
                  x: (gesture.startCenter.x - gesture.startViewport.x) / gesture.startViewport.scale,
                  y: (gesture.startCenter.y - gesture.startViewport.y) / gesture.startViewport.scale,
                };
                const panDelta = {
                  x: center.x - gesture.startCenter.x,
                  y: center.y - gesture.startCenter.y,
                };

                setViewport({
                  x: center.x - worldPoint.x * nextScale + panDelta.x,
                  y: center.y - worldPoint.y * nextScale + panDelta.y,
                  scale: nextScale,
                });
              }}
              onTouchEnd={() => {
                pinchGestureRef.current = null;
              }}
              onPointerDown={(e) => {
                const stage = e.target.getStage();
                const pos = stage?.getPointerPosition();
                if (!pos) {
                  return;
                }

                if (e.evt.pointerType === 'touch' && e.evt.isPrimary === false) {
                  return;
                }

                const worldPos = getWorldPoint(pos);

                for (const polygon of polygons) {
                  for (let index = 0; index < polygon.points.length; index++) {
                    const [markerX, markerY] = polygon.points[index];
                    const distance = Math.sqrt((worldPos.x - markerX) ** 2 + (worldPos.y - markerY) ** 2);
                    if (distance < dragTolerance) {
                      setDraggingItem({ type: 'marker', polygonId: polygon.id, index });
                      return;
                    }
                  }

                  for (let i = 0; i < polygon.points.length; i++) {
                    const start = polygon.points[i];
                    const end = polygon.points[(i + 1) % polygon.points.length];
                    const distanceToLine = pointToLineDistance(worldPos.x, worldPos.y, start[0], start[1], end[0], end[1]);
                    if (distanceToLine < dragTolerance) {
                      setDraggingItem({ type: 'line', polygonId: polygon.id, from: i, to: (i + 1) % polygon.points.length, x: worldPos.x, y: worldPos.y });
                      return;
                    }
                  }

                  if (pointInPolygon(worldPos.x, worldPos.y, polygon.points)) {
                    const now = Date.now();
                    const isDoubleTap = lastTap && lastTap.polygonId === polygon.id && Math.hypot(worldPos.x - lastTap.x, worldPos.y - lastTap.y) < dragTolerance && now - lastTap.time < 300;

                    if (isDoubleTap) {
                      setPolygons((current) => current.filter((candidate) => candidate.id !== polygon.id));
                      setLastTap(null);
                      if (tapTimeoutRef.current !== null) {
                        window.clearTimeout(tapTimeoutRef.current);
                        tapTimeoutRef.current = null;
                      }
                      return;
                    }

                    if (tapTimeoutRef.current !== null) {
                      window.clearTimeout(tapTimeoutRef.current);
                    }

                    setLastTap({ polygonId: polygon.id, x: worldPos.x, y: worldPos.y, time: now });
                    tapTimeoutRef.current = window.setTimeout(() => {
                      setLastTap(null);
                      tapTimeoutRef.current = null;
                    }, 300);

                    setDraggingItem({ type: 'polygon', polygonId: polygon.id, x: worldPos.x, y: worldPos.y });
                    return;
                  }
                }

                addPolygon(worldPos.x, worldPos.y);
              }}
              onPointerMove={(e) => {
                const stage = e.target.getStage();
                const pos = stage?.getPointerPosition();
                if (!pos || !draggingItem) {
                  return;
                }

                const worldPos = getWorldPoint(pos);

                if (draggingItem.type === 'marker') {
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    return {
                      ...polygon,
                      points: polygon.points.map((marker, index) => index === draggingItem.index ? [worldPos.x, worldPos.y] : marker),
                    };
                  }));
                } else if (draggingItem.type === 'line') {
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    const newPoints = [...polygon.points];
                    newPoints.splice(draggingItem.to, 0, [worldPos.x, worldPos.y]);
                    return { ...polygon, points: newPoints };
                  }));
                  setDraggingItem({ type: 'marker', polygonId: draggingItem.polygonId, index: draggingItem.to });
                } else if (draggingItem.type === 'polygon') {
                  const dx = worldPos.x - draggingItem.x;
                  const dy = worldPos.y - draggingItem.y;
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    return {
                      ...polygon,
                      points: polygon.points.map(([x, y]) => [x + dx, y + dy] as Point),
                    };
                  }));
                  setDraggingItem({ type: 'polygon', polygonId: draggingItem.polygonId, x: worldPos.x, y: worldPos.y });
                }
              }}
              onPointerUp={() => {
                setDraggingItem(undefined);
                pinchGestureRef.current = null;
              }}
              onPointerLeave={() => {
                setDraggingItem(undefined);
                pinchGestureRef.current = null;
              }}
            >
              {image && (
                <Image x={(canvasSize - imageSize.width) / 2} y={(canvasSize - imageSize.height) / 2} width={imageSize.width} height={imageSize.height} image={image} />
              )}

              {polygons.map((polygon) => (
                <Group key={polygon.id}>
                  <Line points={polygon.points.flat()} stroke="blue" fill="#0000ff77" strokeWidth={2} closed />
                  {polygon.points.map((marker, index) => (
                    <Circle
                      key={`${polygon.id}-${index}`}
                      x={marker[0]}
                      y={marker[1]}
                      radius={5}
                      fill="red"
                    />
                  ))}
                </Group>
              ))}
            </Layer>
          </Stage>
        )}

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
