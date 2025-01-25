import { Vector2 } from './vector';

interface Shape {
  points: { x: number; y: number };
  position: { x: number; y: number };
  rotation: number;
}

interface CollisionResult {
  colliding: boolean;
  debug: string[];
  collisionPoint?: { x: number; y: number };
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

  // Support function to get furthest point in a direction
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

  // Get Minkowski Difference support point
  const getSupport = (dir: Vector2): Vector2 => {
    const p1 = support(points1, dir);
    const p2 = support(points2, dir.negate());
    return p1.sub(p2);
  };

  // Initialize simplex
  const simplex: Vector2[] = [];
  let direction = new Vector2(1, 0);

  // Get first point for simplex
  let point = getSupport(direction);
  simplex.push(point);
  
  // New direction is towards origin
  direction = point.negate();

  debug.push("Starting GJK algorithm");
  
  let closestPoint = null;
  let minDistance = Infinity;

  // Main GJK loop with collision point detection
  for (let i = 0; i < 32; i++) {
    point = getSupport(direction);
    
    // Track closest point to origin
    const distance = point.length();
    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = point;
    }
    
    if (point.dot(direction) <= 0) {
      debug.push("No collision - point not past origin");
      return { colliding: false, debug };
    }
    
    simplex.push(point);
    
    if (handleSimplex(simplex, direction)) {
      // Calculate collision point as midpoint between closest features
      const p1 = support(points1, direction);
      const p2 = support(points2, direction.negate());
      const collisionPoint = {
        x: (p1.x + p2.x) / 2,
        y: (p1.y + p2.y) / 2
      };
      debug.push("Collision detected - origin enclosed by simplex");
      return { colliding: true, debug, collisionPoint };
    }
  }
  
  debug.push("Max iterations reached");
  return { colliding: false, debug };
};

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
  } else if (simplex.length === 3) {
    return handleTriangle(simplex, direction);
  }
  return false;
};

const handleLine = (simplex: Vector2[], direction: Vector2): boolean => {
  const a = simplex[1];  // Latest point added
  const b = simplex[0];  // First point
  
  const ab = b.sub(a);   // Vector from A to B
  const ao = new Vector2(0, 0).sub(a);  // Vector from A to origin
  
  // Get perpendicular to AB towards origin
  const perp = tripleProduct(ab, ao, ab);
  
  if (perp.length() === 0) {
    // Origin is on AB line
    const abLen = ab.length();
    const aLen = a.length();
    const bLen = b.length();
    return aLen <= abLen && bLen <= abLen;
  }
  
  // Set new direction to perpendicular
  direction.copy(perp);
  return false;
};

const handleTriangle = (simplex: Vector2[], direction: Vector2): boolean => {
  const a = simplex[2];  // Latest point
  const b = simplex[1];
  const c = simplex[0];  // First point
  
  const ab = b.sub(a);
  const ac = c.sub(a);
  const ao = new Vector2(0, 0).sub(a);  // Vector to origin
  
  const abPerp = tripleProduct(ac, ab, ab);
  const acPerp = tripleProduct(ab, ac, ac);
  
  if (abPerp.dot(ao) > 0) {
    // Origin outside AB edge
    simplex.splice(0, 1);  // Remove C
    direction.copy(abPerp);
    return false;
  }
  
  if (acPerp.dot(ao) > 0) {
    // Origin outside AC edge
    simplex.splice(1, 1);  // Remove B
    direction.copy(acPerp);
    return false;
  }
  
  // Origin inside triangle
  return true;
};

const tripleProduct = (a: Vector2, b: Vector2, c: Vector2): Vector2 => {
  const ac = a.dot(c);
  const bc = b.dot(c);
  return new Vector2(
    b.x * ac - a.x * bc,
    b.y * ac - a.y * bc
  );
};

export const linCanny = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  
  debug.push("Starting Lin-Canny algorithm");

  // Find closest features between polygons
  let minDistance = Infinity;
  let colliding = false;

  // Check each vertex of shape A against edges of shape B
  for (let i = 0; i < points1.length; i++) {
    const point = points1[i];
    
    for (let j = 0; j < points2.length; j++) {
      const edge1 = points2[j];
      const edge2 = points2[(j + 1) % points2.length];
      
      // Calculate distance from point to edge
      const edgeVector = edge2.sub(edge1);
      const pointVector = point.sub(edge1);
      
      const projection = pointVector.dot(edgeVector) / edgeVector.dot(edgeVector);
      const closestPoint = edge1.add(edgeVector.scale(Math.max(0, Math.min(1, projection))));
      
      const distance = point.sub(closestPoint).length();
      minDistance = Math.min(minDistance, distance);
      
      if (distance < 0.0001) {
        colliding = true;
        debug.push("Collision detected at vertex-edge pair");
        break;
      }
    }
    
    if (colliding) break;
  }
  
  debug.push(`Minimum distance between shapes: ${minDistance.toFixed(4)}`);
  return { colliding, debug };
};

// V-Clip Algorithm implementation
export const vClip = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  
  debug.push("Starting V-Clip algorithm");

  let colliding = false;
  let minDistance = Infinity;

  // Find closest vertex-edge pair
  for (let i = 0; i < points1.length; i++) {
    const vertex = points1[i];
    
    for (let j = 0; j < points2.length; j++) {
      const edge1 = points2[j];
      const edge2 = points2[(j + 1) % points2.length];
      
      // Calculate closest point on edge
      const edgeDir = edge2.sub(edge1).normalize();
      const vertexToEdge = vertex.sub(edge1);
      const projection = vertexToEdge.dot(edgeDir);
      
      if (projection >= 0 && projection <= edge2.sub(edge1).length()) {
        const closestPoint = edge1.add(edgeDir.scale(projection));
        const distance = vertex.sub(closestPoint).length();
        
        minDistance = Math.min(minDistance, distance);
        
        if (distance < 0.0001) {
          colliding = true;
          debug.push("Collision detected between vertex and edge");
          break;
        }
      }
    }
    
    if (colliding) break;
  }
  
  debug.push(`Minimum separation distance: ${minDistance.toFixed(4)}`);
  return { colliding, debug };
};
