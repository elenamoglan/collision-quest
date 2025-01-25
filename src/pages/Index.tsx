import React from 'react';
import CollisionVisualizer from '../components/CollisionVisualizer';
import AlgorithmSelector from '../components/AlgorithmSelector';
import { CollisionProvider } from '../contexts/CollisionContext';

const Index = () => {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-algorithm-primary text-white p-4">
        <h1 className="text-2xl font-bold">Collision Detection Visualizer</h1>
      </header>
      
      <main className="container mx-auto p-4">
        <CollisionProvider>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-1">
              <AlgorithmSelector />
            </div>
            <div className="lg:col-span-3">
              <CollisionVisualizer />
            </div>
          </div>
        </CollisionProvider>
      </main>
    </div>
  );
};

export default Index;