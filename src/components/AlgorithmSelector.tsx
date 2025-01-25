import React from 'react';
import { useCollision } from '../contexts/CollisionContext';

const AlgorithmSelector = () => {
  const { algorithm, setAlgorithm } = useCollision();

  return (
    <div className="bg-white rounded-lg shadow-lg p-4">
      <h2 className="text-xl font-semibold mb-4">Select Algorithm</h2>
      <div className="space-y-2">
        <button
          className={`w-full p-3 rounded-lg text-left ${
            algorithm === 'GJK'
              ? 'bg-algorithm-primary text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => setAlgorithm('GJK')}
        >
          GJK Algorithm
        </button>
        <button
          className={`w-full p-3 rounded-lg text-left ${
            algorithm === 'SAT'
              ? 'bg-algorithm-primary text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => setAlgorithm('SAT')}
        >
          Separating Axis Theorem
        </button>
        <button
          className={`w-full p-3 rounded-lg text-left ${
            algorithm === 'Lin-Canny'
              ? 'bg-algorithm-primary text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => setAlgorithm('Lin-Canny')}
        >
          Lin-Canny Algorithm
        </button>
        <button
          className={`w-full p-3 rounded-lg text-left ${
            algorithm === 'V-Clip'
              ? 'bg-algorithm-primary text-white'
              : 'bg-gray-100 hover:bg-gray-200'
          }`}
          onClick={() => setAlgorithm('V-Clip')}
        >
          V-Clip Algorithm
        </button>
      </div>
      
      <div className="mt-6 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold mb-2">Instructions:</h3>
        <ul className="text-sm space-y-2 text-gray-600">
          <li>• Click and drag shapes to move them</li>
          <li>• Shapes will turn red when colliding</li>
          <li>• Switch algorithms to see different detection methods</li>
        </ul>
      </div>
    </div>
  );
};

export default AlgorithmSelector;