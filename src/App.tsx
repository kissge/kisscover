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
  const canvasSize = 540;
  const [polygons, setPolygons] = useState<Polygon[]>([]);
  const [draggingItem, setDraggingItem] = useState<DraggingItem>();
  const [nextPolygonId, setNextPolygonId] = useState(2);
  const [lastTap, setLastTap] = useState<{ polygonId: number; x: number; y: number; time: number } | null>(null);
  const tapTimeoutRef = useRef<number | null>(null);

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
          <Stage width={540} height={540}>
            <Layer
              onPointerDown={(e) => {
                const stage = e.target.getStage();
                const pos = stage?.getPointerPosition();
                if (!pos) {
                  return;
                }

                for (const polygon of polygons) {
                  for (let index = 0; index < polygon.points.length; index++) {
                    const [markerX, markerY] = polygon.points[index];
                    const distance = Math.sqrt((pos.x - markerX) ** 2 + (pos.y - markerY) ** 2);
                    if (distance < dragTolerance) {
                      setDraggingItem({ type: 'marker', polygonId: polygon.id, index });
                      return;
                    }
                  }

                  for (let i = 0; i < polygon.points.length; i++) {
                    const start = polygon.points[i];
                    const end = polygon.points[(i + 1) % polygon.points.length];
                    const distanceToLine = pointToLineDistance(pos.x, pos.y, start[0], start[1], end[0], end[1]);
                    if (distanceToLine < dragTolerance) {
                      setDraggingItem({ type: 'line', polygonId: polygon.id, from: i, to: (i + 1) % polygon.points.length, x: pos.x, y: pos.y });
                      return;
                    }
                  }

                  if (pointInPolygon(pos.x, pos.y, polygon.points)) {
                    const now = Date.now();
                    const isDoubleTap = lastTap && lastTap.polygonId === polygon.id && Math.hypot(pos.x - lastTap.x, pos.y - lastTap.y) < dragTolerance && now - lastTap.time < 300;

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

                    setLastTap({ polygonId: polygon.id, x: pos.x, y: pos.y, time: now });
                    tapTimeoutRef.current = window.setTimeout(() => {
                      setLastTap(null);
                      tapTimeoutRef.current = null;
                    }, 300);

                    setDraggingItem({ type: 'polygon', polygonId: polygon.id, x: pos.x, y: pos.y });
                    return;
                  }
                }

                addPolygon(pos.x, pos.y);
              }}
              onPointerMove={(e) => {
                const stage = e.target.getStage();
                const pos = stage?.getPointerPosition();
                if (!pos || !draggingItem) {
                  return;
                }

                if (draggingItem.type === 'marker') {
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    return {
                      ...polygon,
                      points: polygon.points.map((marker, index) => index === draggingItem.index ? [pos.x, pos.y] : marker),
                    };
                  }));
                } else if (draggingItem.type === 'line') {
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    const newPoints = [...polygon.points];
                    newPoints.splice(draggingItem.to, 0, [pos.x, pos.y]);
                    return { ...polygon, points: newPoints };
                  }));
                  setDraggingItem({ type: 'marker', polygonId: draggingItem.polygonId, index: draggingItem.to });
                } else if (draggingItem.type === 'polygon') {
                  const dx = pos.x - draggingItem.x;
                  const dy = pos.y - draggingItem.y;
                  setPolygons((current) => current.map((polygon) => {
                    if (polygon.id !== draggingItem.polygonId) {
                      return polygon;
                    }

                    return {
                      ...polygon,
                      points: polygon.points.map(([x, y]) => [x + dx, y + dy] as Point),
                    };
                  }));
                  setDraggingItem({ type: 'polygon', polygonId: draggingItem.polygonId, x: pos.x, y: pos.y });
                }
              }}
              onPointerUp={() => {
                setDraggingItem(undefined);
              }}
              onPointerLeave={() => {
                setDraggingItem(undefined);
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
