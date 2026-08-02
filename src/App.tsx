import './App.css';
import { useState } from 'react';
import { Stage, Layer, Image, Circle, Line } from 'react-konva';
import Cat from './assets/cat.jpg';

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

  return (
    <>
      <section id="center">
        {loaded && (
          <Stage width={540} height={540}>
            <Layer>
              <Image x={10} y={10} width={520} height={(520 * imageSize.height) / imageSize.width} image={img} />

              <Line points={markers.flat()} stroke="blue" strokeWidth={2} closed />

              {markers.map((marker, index) => (
                <Circle
                  key={index}
                  x={marker[0]}
                  y={marker[1]}
                  radius={5}
                  fill="red"
                  draggable
                  onDragMove={(e) => {
                    const newMarkers = [...markers];
                    newMarkers[index] = [e.target.x(), e.target.y()];
                    setMarkers(newMarkers);
                  }}
                />
              ))}
            </Layer>
          </Stage>
        )}

        <button
          onClick={() => {
            setMarkers([
              ...markers,
              markers.length > 2
                ? [(markers.at(-2)![0] + markers.at(-1)![0]) / 2, (markers.at(-2)![1] + markers.at(-1)![1]) / 2]
                : [270, 270],
            ]);
          }}
        >
          Add point
        </button>

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
