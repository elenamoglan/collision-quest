import React, { useRef, useEffect } from 'react';
import { useCollision } from '../contexts/CollisionContext';
import { Button } from './ui/button';
import { Select } from './ui/select';

const CollisionVisualizer = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    shapes, 
    updateShape, 
    isColliding, 
    debugInfo, 
    collisionPoint,
    selectedPresets,
    setShapePreset 
  } = useCollision();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw shapes
    shapes.forEach((shape, index) => {
      ctx.save();
      ctx.translate(shape.position.x, shape.position.y);
      ctx.rotate(shape.rotation);
      
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.closePath();
      
      ctx.fillStyle = isColliding ? 'rgba(239, 68, 68, 0.5)' : 'rgba(59, 130, 246, 0.5)';
      ctx.fill();
      ctx.strokeStyle = isColliding ? '#ef4444' : '#3b82f6';
      ctx.stroke();
      
      ctx.restore();
    });

    // Draw collision point if exists and shapes are colliding
    if (collisionPoint && isColliding) {
      ctx.beginPath();
      ctx.arc(collisionPoint.x, collisionPoint.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Add a pulsing effect to make the point more visible
      ctx.beginPath();
      ctx.arc(collisionPoint.x, collisionPoint.y, 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }, [shapes, isColliding, collisionPoint]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is near any shape center
    shapes.forEach((shape, index) => {
      const dx = x - shape.position.x;
      const dy = y - shape.position.y;
      if (dx * dx + dy * dy < 2500) { // 50px radius
        const handleMouseMove = (e: MouseEvent) => {
          const newX = e.clientX - rect.left;
          const newY = e.clientY - rect.top;
          updateShape(index as 0 | 1, {
            ...shape,
            position: { x: newX, y: newY }
          });
        };

        const handleMouseUp = () => {
          document.removeEventListener('mousemove', handleMouseMove);
          document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
      }
    });
  };

  return (
    <div className="relative bg-white rounded-lg shadow-lg p-4">
      <div className="flex gap-4 mb-4">
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-2">
            <label className="text-sm font-medium">Shape {index + 1}:</label>
            <select
              value={selectedPresets[index]}
              onChange={(e) => setShapePreset(index as 0 | 1, e.target.value as any)}
              className="border rounded px-2 py-1"
            >
              <option value="square">Square</option>
              <option value="triangle">Triangle</option>
              <option value="pentagon">Pentagon</option>
              <option value="star">Star</option>
            </select>
          </div>
        ))}
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="border border-gray-200 rounded"
        onMouseDown={handleMouseDown}
      />
      <div className="mt-4 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">Debug Information:</h3>
        <ul className="text-sm space-y-1">
          {debugInfo.map((info, index) => (
            <li key={index} className="text-gray-600">{info}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default CollisionVisualizer;