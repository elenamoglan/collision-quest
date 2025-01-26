import { Vector2 } from './vector';

interface Shape {
  points: Array<{ x: number; y: number }>;
  position: { x: number; y: number };
  rotation: number;
}

interface CollisionResult {
  colliding: boolean;
  debug: string[];
  collisionPoint?: { x: number; y: number };
}

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

// Helper function to find the closest point between two shapes
const findClosestPoint = (points1: Vector2[], points2: Vector2[]): { x: number; y: number } => {
  let minDistance = Infinity;
  let closestPoint = { x: 0, y: 0 };

  for (let i = 0; i < points1.length; i++) {
    const p1 = points1[i];
    const p1Next = points1[(i + 1) % points1.length];
    
    for (let j = 0; j < points2.length; j++) {
      const p2 = points2[j];
      const p2Next = points2[(j + 1) % points2.length];
      
      // Check vertex-vertex distances
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      if (dist < minDistance) {
        minDistance = dist;
        closestPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
      }
      
      // Check vertex-edge distances
      const edgePoint1 = getClosestPointOnLineSegment(p2, p1, p1Next);
      const edgePoint2 = getClosestPointOnLineSegment(p1, p2, p2Next);
      
      const edgeDist1 = Math.sqrt((edgePoint1.x - p2.x) ** 2 + (edgePoint1.y - p2.y) ** 2);
      const edgeDist2 = Math.sqrt((edgePoint2.x - p1.x) ** 2 + (edgePoint2.y - p1.y) ** 2);
      
      if (edgeDist1 < minDistance) {
        minDistance = edgeDist1;
        closestPoint = { x: (edgePoint1.x + p2.x) / 2, y: (edgePoint1.y + p2.y) / 2 };
      }
      if (edgeDist2 < minDistance) {
        minDistance = edgeDist2;
        closestPoint = { x: (edgePoint2.x + p1.x) / 2, y: (edgePoint2.y + p1.y) / 2 };
      }
    }
  }
  
  return closestPoint;
};

const getClosestPointOnLineSegment = (p: Vector2, a: Vector2, b: Vector2): Vector2 => {
  const ab = new Vector2(b.x - a.x, b.y - a.y);
  const ap = new Vector2(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ap.dot(ab) / ab.dot(ab)));
  return new Vector2(
    a.x + t * ab.x,
    a.y + t * ab.y
  );
};

// Update GJK algorithm to use the new collision point calculation
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
      // Calculate collision point using the new method
      const collisionPoint = findClosestPoint(points1, points2);
      debug.push("Collision detected - origin enclosed by simplex");
      return { colliding: true, debug, collisionPoint };
    }
  }
  
  debug.push("Max iterations reached");
  return { colliding: false, debug };
};

// Update SAT algorithm
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
  const project = (points: Vector2[], axis: Vector2): { min: number; max: number; minPoint: Vector2; maxPoint: Vector2 } => {
    let min = points[0].dot(axis);
    let max = min;
    let minPoint = points[0];
    let maxPoint = points[0];
    
    for (let i = 1; i < points.length; i++) {
      const projection = points[i].dot(axis);
      if (projection < min) {
        min = projection;
        minPoint = points[i];
      }
      if (projection > max) {
        max = projection;
        maxPoint = points[i];
      }
    }
    
    return { min, max, minPoint, maxPoint };
  };

  // Check projections for overlap
  const axes = [...getAxes(points1), ...getAxes(points2)];
  let minOverlap = Infinity;
  let collisionPoint = null;
  
  for (const axis of axes) {
    const projection1 = project(points1, axis);
    const projection2 = project(points2, axis);
    
    if (projection1.max < projection2.min || projection2.max < projection1.min) {
      debug.push("Gap found - no collision");
      return { colliding: false, debug };
    }

    const overlap = Math.min(projection1.max - projection2.min, projection2.max - projection1.min);
    if (overlap < minOverlap) {
      minOverlap = overlap;
      // Calculate collision point using the new method
      collisionPoint = findClosestPoint(points1, points2);
    }
  }
  
  debug.push("No separating axis found - collision detected!");
  return { colliding: true, debug, collisionPoint };
};

// Improved Lin-Canny algorithm
export const linCanny = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  
  debug.push("Starting Lin-Canny algorithm");

  let minDistance = Infinity;
  let colliding = false;
  let collisionPoint = null;

  // Check each vertex-edge pair
  for (let i = 0; i < points1.length; i++) {
    const vertex = points1[i];
    
    for (let j = 0; j < points2.length; j++) {
      const edge1 = points2[j];
      const edge2 = points2[(j + 1) % points2.length];
      
      // Calculate edge vector and normalize it
      const edgeVector = edge2.sub(edge1);
      const edgeLength = edgeVector.length();
      const normalizedEdge = edgeVector.scale(1 / edgeLength);
      
      // Calculate perpendicular distance from vertex to edge
      const vertexToEdge = vertex.sub(edge1);
      const projection = vertexToEdge.dot(normalizedEdge);
      
      // Check if projection lies within edge segment
      if (projection >= 0 && projection <= edgeLength) {
        const closestPoint = edge1.add(normalizedEdge.scale(projection));
        const distance = vertex.sub(closestPoint).length();
        
        if (distance < minDistance) {
          minDistance = distance;
          collisionPoint = {
            x: (vertex.x + closestPoint.x) / 2,
            y: (vertex.y + closestPoint.y) / 2
          };
        }
        
        if (distance < 0.0001) {
          colliding = true;
        }
      }
    }
  }

  // Also check vertex-vertex pairs for more accurate collision detection
  for (const p1 of points1) {
    for (const p2 of points2) {
      const distance = p1.sub(p2).length();
      if (distance < minDistance) {
        minDistance = distance;
        collisionPoint = {
          x: (p1.x + p2.x) / 2,
          y: (p1.y + p2.y) / 2
        };
        if (distance < 0.0001) {
          colliding = true;
        }
      }
    }
  }
  
  debug.push(`Minimum separation distance: ${minDistance.toFixed(4)}`);
  return { colliding, debug, collisionPoint };
};

// Improved V-Clip algorithm
export const vClip = (shapeA: Shape, shapeB: Shape): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  
  debug.push("Starting V-Clip algorithm");

  let colliding = false;
  let minDistance = Infinity;
  let collisionPoint = null;

  // Find closest feature pair (vertex-vertex, vertex-edge)
  for (let i = 0; i < points1.length; i++) {
    const vertex = points1[i];
    const nextVertex = points1[(i + 1) % points1.length];
    
    for (let j = 0; j < points2.length; j++) {
      const otherVertex = points2[j];
      const nextOtherVertex = points2[(j + 1) % points2.length];
      
      // Check vertex-vertex distance
      const vertexDistance = vertex.sub(otherVertex).length();
      if (vertexDistance < minDistance) {
        minDistance = vertexDistance;
        collisionPoint = {
          x: (vertex.x + otherVertex.x) / 2,
          y: (vertex.y + otherVertex.y) / 2
        };
        if (vertexDistance < 0.0001) {
          colliding = true;
        }
      }
      
      // Check vertex-edge distances both ways
      const edge1ToVertex = getClosestPointOnLineSegment(vertex, otherVertex, nextOtherVertex);
      const edge2ToVertex = getClosestPointOnLineSegment(otherVertex, vertex, nextVertex);
      
      const edge1Distance = vertex.sub(edge1ToVertex).length();
      const edge2Distance = otherVertex.sub(edge2ToVertex).length();
      
      if (edge1Distance < minDistance) {
        minDistance = edge1Distance;
        collisionPoint = {
          x: (vertex.x + edge1ToVertex.x) / 2,
          y: (vertex.y + edge1ToVertex.y) / 2
        };
        if (edge1Distance < 0.0001) {
          colliding = true;
        }
      }
      
      if (edge2Distance < minDistance) {
        minDistance = edge2Distance;
        collisionPoint = {
          x: (otherVertex.x + edge2ToVertex.x) / 2,
          y: (otherVertex.y + edge2ToVertex.y) / 2
        };
        if (edge2Distance < 0.0001) {
          colliding = true;
        }
      }
    }
  }
  
  debug.push(`Minimum separation distance: ${minDistance.toFixed(4)}`);
  return { colliding, debug, collisionPoint };
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
