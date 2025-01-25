import React, { createContext, useContext, useState } from 'react';

type Algorithm = 'GJK' | 'SAT';
type Shape = {
  points: { x: number; y: number }[];
  position: { x: number; y: number };
  rotation: number;
};

interface CollisionContextType {
  algorithm: Algorithm;
  setAlgorithm: (algo: Algorithm) => void;
  shapes: [Shape, Shape];
  updateShape: (index: 0 | 1, shape: Shape) => void;
  isColliding: boolean;
  debugInfo: string[];
}

const CollisionContext = createContext<CollisionContextType | undefined>(undefined);

export const CollisionProvider = ({ children }: { children: React.ReactNode }) => {
  const [algorithm, setAlgorithm] = useState<Algorithm>('GJK');
  const [shapes, setShapes] = useState<[Shape, Shape]>([
    {
      points: [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 },
      ],
      position: { x: 200, y: 200 },
      rotation: 0,
    },
    {
      points: [
        { x: -40, y: -40 },
        { x: 40, y: -40 },
        { x: 40, y: 40 },
        { x: -40, y: 40 },
      ],
      position: { x: 400, y: 200 },
      rotation: 0,
    },
  ]);
  const [isColliding, setIsColliding] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  const updateShape = (index: 0 | 1, shape: Shape) => {
    const newShapes = [...shapes] as [Shape, Shape];
    newShapes[index] = shape;
    setShapes(newShapes);
    checkCollision(newShapes);
  };

  const checkCollision = (currentShapes: [Shape, Shape]) => {
    if (algorithm === 'GJK') {
      const result = gjk(currentShapes[0], currentShapes[1]);
      setIsColliding(result.colliding);
      setDebugInfo(result.debug);
    } else {
      const result = sat(currentShapes[0], currentShapes[1]);
      setIsColliding(result.colliding);
      setDebugInfo(result.debug);
    }
  };

  return (
    <CollisionContext.Provider
      value={{
        algorithm,
        setAlgorithm,
        shapes,
        updateShape,
        isColliding,
        debugInfo,
      }}
    >
      {children}
    </CollisionContext.Provider>
  );
};

export const useCollision = () => {
  const context = useContext(CollisionContext);
  if (context === undefined) {
    throw new Error('useCollision must be used within a CollisionProvider');
  }
  return context;
};