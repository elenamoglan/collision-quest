import { Vector2 } from './vector';

interface Shape {
  points: { x: number; y: number }[];
  position: { x: number; y: number };
  rotation: number;
}

interface CollisionResult {
  colliding: boolean;
  debug: string[];
}

// Helper function to transform points based on position and rotation
const transformPoints = (shape: Shape): Vector2[] => {
  return shape.points.map(point => {
    const rotated = {
      x: point.x * Math.cos(shape.rotation) - point.y * Math.sin(shape.rotation),
      y: point.x * Math.sin(shape.rotation) + point.y * Math.cos(shape.rotation)
    };
    return new Vector2(
      rotated.x + shape.position.x,
      rotated.y + shape.position.y
    );
  });
};

// GJK Algorithm implementation
export const gjk = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);

  // Initial direction
  const direction = new Vector2(1, 0);
  
  // Get support point in direction
  const support = (points: Vector2[], dir: Vector2): Vector2 => {
    let furthestPoint = points[0];
    let maxDot = furthestPoint.dot(dir);
    
    for (const point of points) {
      const dot = point.dot(dir);
      if (dot > maxDot) {
        maxDot = dot;
        furthestPoint = point;
      }
    }
    return furthestPoint;
  };

  // Simplex helper
  const simplex: Vector2[] = [];
  
  // Add first point
  const firstPoint = support(points1, direction).sub(support(points2, direction.negate()));
  simplex.push(firstPoint);
  
  // New direction towards origin
  let newDirection = firstPoint.negate();
  
  debug.push("Starting GJK algorithm");
  
  // Main GJK loop
  for (let i = 0; i < 32; i++) {
    const newPoint = support(points1, newDirection).sub(support(points2, newDirection.negate()));
    
    if (newPoint.dot(newDirection) <= 0) {
      debug.push("No collision detected");
      return { colliding: false, debug };
    }
    
    simplex.push(newPoint);
    
    if (handleSimplex(simplex, newDirection)) {
      debug.push("Collision detected!");
      return { colliding: true, debug };
    }
  }
  
  debug.push("Max iterations reached");
  return { colliding: false, debug };
};

// SAT Algorithm implementation
export const sat = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  
  debug.push("Starting SAT algorithm");

  // Get axes to test
  const getAxes = (points: Vector2[]): Vector2[] => {
    const axes: Vector2[] = [];
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      const edge = p2.sub(p1);
      axes.push(new Vector2(-edge.y, edge.x).normalize());
    }
    return axes;
  };

  // Project points onto axis
  const project = (points: Vector2[], axis: Vector2): { min: number; max: number } => {
    let min = points[0].dot(axis);
    let max = min;
    
    for (let i = 1; i < points.length; i++) {
      const projection = points[i].dot(axis);
      min = Math.min(min, projection);
      max = Math.max(max, projection);
    }
    
    return { min, max };
  };

  // Check projections for overlap
  const axes = [...getAxes(points1), ...getAxes(points2)];
  
  for (const axis of axes) {
    const projection1 = project(points1, axis);
    const projection2 = project(points2, axis);
    
    if (projection1.max < projection2.min || projection2.max < projection1.min) {
      debug.push("Gap found - no collision");
      return { colliding: false, debug };
    }
  }
  
  debug.push("No separating axis found - collision detected!");
  return { colliding: true, debug };
};

// Helper for GJK simplex handling
const handleSimplex = (simplex: Vector2[], direction: Vector2): boolean => {
  if (simplex.length === 2) {
    return handleLine(simplex, direction);
  }
  return handleTriangle(simplex, direction);
};

const handleLine = (simplex: Vector2[], direction: Vector2): boolean => {
  const b = simplex[0];
  const a = simplex[1];
  const ab = b.sub(a);
  const ao = a.negate();
  direction.copy(ab.triple(ao).triple(ab));
  return false;
};

const handleTriangle = (simplex: Vector2[], direction: Vector2): boolean => {
  const c = simplex[0];
  const b = simplex[1];
  const a = simplex[2];
  const ab = b.sub(a);
  const ac = c.sub(a);
  const ao = a.negate();
  const abc = ab.cross(ac);
  
  if (abc.triple(ac).dot(ao) > 0) {
    simplex.splice(1, 1);
    direction.copy(ac.triple(ao).triple(ac));
    return false;
  }
  
  if (ab.triple(abc).dot(ao) > 0) {
    simplex.splice(0, 1);
    direction.copy(ab.triple(ao).triple(ab));
    return false;
  }
  
  return true;
};