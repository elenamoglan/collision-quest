import React, { createContext, useContext, useState } from 'react';
import { gjk, sat, linCanny, vClip } from '../utils/collision';

type Algorithm = 'GJK' | 'SAT' | 'Lin-Canny' | 'V-Clip';
type Shape = {
  points: Array<{ x: number; y: number }>;
  position: { x: number; y: number };
  rotation: number;
};

type ShapePreset = 'square' | 'triangle' | 'pentagon' | 'star';

interface CollisionContextType {
  algorithm: Algorithm;
  setAlgorithm: (algo: Algorithm) => void;
  shapes: [Shape, Shape];
  updateShape: (index: 0 | 1, shape: Shape) => void;
  isColliding: boolean;
  debugInfo: string[];
  collisionPoint: { x: number; y: number } | null;
  selectedPresets: [ShapePreset, ShapePreset];
  setShapePreset: (index: 0 | 1, preset: ShapePreset) => void;
}

const getPresetPoints = (preset: ShapePreset): { x: number; y: number }[] => {
  switch (preset) {
    case 'triangle':
      return [
        { x: 0, y: -50 },
        { x: 43.3, y: 25 },
        { x: -43.3, y: 25 },
      ];
    case 'pentagon':
      return [
        { x: 0, y: -50 },
        { x: 47.5, y: -15.5 },
        { x: 29.4, y: 40.5 },
        { x: -29.4, y: 40.5 },
        { x: -47.5, y: -15.5 },
      ];
    case 'star':
      return [
        { x: 0, y: -50 },
        { x: 14.5, y: -20 },
        { x: 47.5, y: -15.5 },
        { x: 23.5, y: 7.5 },
        { x: 29.4, y: 40.5 },
        { x: 0, y: 25 },
        { x: -29.4, y: 40.5 },
        { x: -23.5, y: 7.5 },
        { x: -47.5, y: -15.5 },
        { x: -14.5, y: -20 },
      ];
    case 'square':
    default:
      return [
        { x: -50, y: -50 },
        { x: 50, y: -50 },
        { x: 50, y: 50 },
        { x: -50, y: 50 },
      ];
  }
};

const CollisionContext = createContext<CollisionContextType | undefined>(undefined);

export const CollisionProvider = ({ children }: { children: React.ReactNode }) => {
  const [algorithm, setAlgorithm] = useState<Algorithm>('GJK');
  const [selectedPresets, setSelectedPresets] = useState<[ShapePreset, ShapePreset]>(['square', 'square']);
  const [shapes, setShapes] = useState<[Shape, Shape]>([
    {
      points: getPresetPoints('square'),
      position: { x: 200, y: 200 },
      rotation: 0,
    },
    {
      points: getPresetPoints('square'),
      position: { x: 400, y: 200 },
      rotation: 0,
    },
  ]);
  const [isColliding, setIsColliding] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [collisionPoint, setCollisionPoint] = useState<{ x: number; y: number } | null>(null);

  const setShapePreset = (index: 0 | 1, preset: ShapePreset) => {
    const newPresets = [...selectedPresets] as [ShapePreset, ShapePreset];
    newPresets[index] = preset;
    setSelectedPresets(newPresets);

    const newShapes = [...shapes] as [Shape, Shape];
    newShapes[index] = {
      ...shapes[index],
      points: getPresetPoints(preset),
    };
    setShapes(newShapes);
    checkCollision(newShapes);
  };

  const updateShape = (index: 0 | 1, shape: Shape) => {
    const newShapes = [...shapes] as [Shape, Shape];
    newShapes[index] = shape;
    setShapes(newShapes);
    checkCollision(newShapes);
  };

  const checkCollision = (currentShapes: [Shape, Shape]) => {
    let result;
    switch (algorithm) {
      case 'GJK':
        result = gjk(currentShapes[0], currentShapes[1]);
        break;
      case 'SAT':
        result = sat(currentShapes[0], currentShapes[1]);
        break;
      case 'Lin-Canny':
        result = linCanny(currentShapes[0], currentShapes[1]);
        break;
      case 'V-Clip':
        result = vClip(currentShapes[0], currentShapes[1]);
        break;
    }
    setIsColliding(result.colliding);
    setDebugInfo(result.debug);
    setCollisionPoint(result.collisionPoint || null);
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
        collisionPoint,
        selectedPresets,
        setShapePreset,
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