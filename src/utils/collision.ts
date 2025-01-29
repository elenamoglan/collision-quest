import { Vector2 } from "./vector";

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

export interface CollisionConfig {
  collisionThreshold: number;
  epsilon: number;
  maxIterations: number;
  useBroadPhase: boolean; // Enable/disable broad-phase
}

export const defaultConfig: CollisionConfig = {
  collisionThreshold: 0.1,
  epsilon: 1e-6,
  maxIterations: 32, // For GJK
  useBroadPhase: true,
};

interface AABB {
  min: Vector2;
  max: Vector2;
}

const computeAABB = (shape: Shape): AABB => {
  const points = transformPoints(shape);
  let minX = Infinity,
    minY = Infinity;
  let maxX = -Infinity,
    maxY = -Infinity;

  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }

  return {
    min: new Vector2(minX, minY),
    max: new Vector2(maxX, maxY),
  };
};

const aabbOverlap = (a: AABB, b: AABB): boolean => {
  return (
    a.min.x <= b.max.x &&
    a.max.x >= b.min.x &&
    a.min.y <= b.max.y &&
    a.max.y >= b.min.y
  );
};

const transformPoints = (shape: Shape): Vector2[] => {
  return shape.points.map((point) => {
    const rotated = {
      x:
        point.x * Math.cos(shape.rotation) - point.y * Math.sin(shape.rotation),
      y:
        point.x * Math.sin(shape.rotation) + point.y * Math.cos(shape.rotation),
    };
    return new Vector2( 
      rotated.x + shape.position.x,
      rotated.y + shape.position.y
    );
  });
};

export class SweepAndPrune {
  private intervals: { shape: Shape; minX: number; maxX: number }[] = [];

  insert(shape: Shape) {
    const aabb = computeAABB(shape);
    this.intervals.push({ shape, minX: aabb.min.x, maxX: aabb.max.x });
  }

  getPairs(): [Shape, Shape][] {
    this.intervals.sort((a, b) => a.minX - b.minX);
    const active: typeof this.intervals = [];
    const pairs: [Shape, Shape][] = [];

    for (const current of this.intervals) {
      // Remove inactive intervals
      for (let i = active.length - 1; i >= 0; i--) {
        if (active[i].maxX < current.minX) active.splice(i, 1);
      }

      // Check collisions with active intervals
      for (const other of active) {
        const aabbA = computeAABB(current.shape);
        const aabbB = computeAABB(other.shape);
        if (aabbOverlap(aabbA, aabbB)) {
          pairs.push([current.shape, other.shape]);
        }
      }

      active.push(current);
    }

    return pairs;
  }
}

const findClosestPoint = (
  points1: Vector2[],
  points2: Vector2[],
  config: CollisionConfig
): { x: number; y: number } => {
  let minDistance = Infinity;
  let closestPoint = { x: 0, y: 0 };

  // Check all vertices of shape1 against all edges of shape2
  for (let i = 0; i < points1.length; i++) {
    const p1 = points1[i];

    for (let j = 0; j < points2.length; j++) {
      const p2 = points2[j];
      const p2Next = points2[(j + 1) % points2.length];

      // Get closest point on edge
      const edge = p2Next.sub(p2);
      const edgeLength = edge.length();
      if (edgeLength < config.epsilon) continue; // Skip degenerate edges

      const normalized = edge.scale(1 / edgeLength);
      const pointToStart = p1.sub(p2);
      const projection = pointToStart.dot(normalized);

      let closestOnEdge;
      if (projection <= 0) {
        closestOnEdge = p2;
      } else if (projection >= edgeLength) {
        closestOnEdge = p2Next;
      } else {
        closestOnEdge = p2.add(normalized.scale(projection));
      }

      const distance = p1.sub(closestOnEdge).length();
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = {
          x: (p1.x + closestOnEdge.x) / 2,
          y: (p1.y + closestOnEdge.y) / 2,
        };
      }
    }
  }

  // Check all vertices of shape2 against all edges of shape1
  for (let i = 0; i < points2.length; i++) {
    const p2 = points2[i];

    for (let j = 0; j < points1.length; j++) {
      const p1 = points1[j];
      const p1Next = points1[(j + 1) % points1.length];

      const edge = p1Next.sub(p1);
      const edgeLength = edge.length();
      if (edgeLength < config.epsilon) continue; // Skip degenerate edges

      const normalized = edge.scale(1 / edgeLength);
      const pointToStart = p2.sub(p1);
      const projection = pointToStart.dot(normalized);

      let closestOnEdge;
      if (projection <= 0) {
        closestOnEdge = p1;
      } else if (projection >= edgeLength) {
        closestOnEdge = p1Next;
      } else {
        closestOnEdge = p1.add(normalized.scale(projection));
      }

      const distance = p2.sub(closestOnEdge).length();
      if (distance < minDistance) {
        minDistance = distance;
        closestPoint = {
          x: (p2.x + closestOnEdge.x) / 2,
          y: (p2.y + closestOnEdge.y) / 2,
        };
      }
    }
  }

  return closestPoint;
};

// Add the missing helper function
const getClosestPointOnLineSegment = (
  point: Vector2,
  lineStart: Vector2,
  lineEnd: Vector2,
  config: CollisionConfig = defaultConfig // Pass config
): Vector2 => {
  const line = lineEnd.sub(lineStart);
  const len = line.length();
  if (len < config.epsilon) return lineStart; // Degenerate edge

  const t = Math.max(
    0,
    Math.min(1, point.sub(lineStart).dot(line) / (len * len))
  );
  return lineStart.add(line.scale(t));
};

export const linCanny = (
  shapeA: Shape,
  shapeB: Shape,
  config: CollisionConfig = defaultConfig
): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);

  if (
    config.useBroadPhase &&
    !aabbOverlap(computeAABB(shapeA), computeAABB(shapeB))
  ) {
    return { colliding: false, debug: ["Broad-phase: No AABB overlap"] };
  }

  debug.push("Starting Lin-Canny algorithm");

  let minDistance = Infinity;
  let colliding = false;
  let collisionPoint = null;

  // Find closest features between shapes
  const closestPoint = findClosestPoint(points1, points2, config);

  // Check if shapes are colliding by checking distances between all vertices and edges
  for (let i = 0; i < points1.length; i++) {
    const vertex = points1[i];

    for (let j = 0; j < points2.length; j++) {
      const edge1 = points2[j];
      const edge2 = points2[(j + 1) % points2.length];

      const edgeVector = edge2.sub(edge1);
      const edgeLength = edgeVector.length();
      if (edgeLength < config.epsilon) continue; // Skip degenerate edges

      const normalizedEdge = edgeVector.scale(1 / edgeLength);
      const vertexToEdge = vertex.sub(edge1);
      const projection = vertexToEdge.dot(normalizedEdge);

      if (
        projection >= -config.epsilon &&
        projection <= edgeLength + config.epsilon
      ) {
        const closestPoint = edge1.add(normalizedEdge.scale(projection));
        const distance = vertex.sub(closestPoint).length();

        if (distance < minDistance) {
          minDistance = distance;
          collisionPoint = {
            x: (vertex.x + closestPoint.x) / 2,
            y: (vertex.y + closestPoint.y) / 2,
          };
        }

        if (distance < config.collisionThreshold) {
          colliding = true;
        }
      }
    }
  }

  debug.push(`Minimum separation distance: ${minDistance.toFixed(4)}`);
  return { colliding, debug, collisionPoint };
};

export const vClip = (
  shapeA: Shape,
  shapeB: Shape,
  config: CollisionConfig = defaultConfig
): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);

  if (
    config.useBroadPhase &&
    !aabbOverlap(computeAABB(shapeA), computeAABB(shapeB))
  ) {
    return { colliding: false, debug: ["Broad-phase: No AABB overlap"] };
  }

  debug.push("Starting V-Clip algorithm");

  let colliding = false;
  let minDistance = Infinity;
  let collisionPoint = null;

  // Find closest features using the findClosestPoint helper
  const closestPoint = findClosestPoint(points1, points2, config);

  // Check all vertex pairs and vertex-edge pairs
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
          y: (vertex.y + otherVertex.y) / 2,
        };
        if (vertexDistance < config.collisionThreshold) {
          colliding = true;
        }
      }

      // Check vertex-edge distances both ways
      // Example update in vClip:
      const edge1ToVertex = getClosestPointOnLineSegment(
        vertex,
        otherVertex,
        nextOtherVertex,
        config
      );
      const edge2ToVertex = getClosestPointOnLineSegment(
        otherVertex,
        vertex,
        nextVertex,
        config
      );

      const edge1Distance = vertex.sub(edge1ToVertex).length();
      const edge2Distance = otherVertex.sub(edge2ToVertex).length();

      if (edge1Distance < minDistance) {
        minDistance = edge1Distance;
        collisionPoint = {
          x: (vertex.x + edge1ToVertex.x) / 2,
          y: (vertex.y + edge1ToVertex.y) / 2,
        };
        if (edge1Distance < config.collisionThreshold) {
          colliding = true;
        }
      }

      if (edge2Distance < minDistance) {
        minDistance = edge2Distance;
        collisionPoint = {
          x: (otherVertex.x + edge2ToVertex.x) / 2,
          y: (otherVertex.y + edge2ToVertex.y) / 2,
        };
        if (edge2Distance < config.collisionThreshold) {
          colliding = true;
        }
      }
    }
  }

  debug.push(`Minimum separation distance: ${minDistance.toFixed(4)}`);
  return { colliding, debug, collisionPoint };
};

export const gjk = (
  shapeA: Shape,
  shapeB: Shape,
  config: CollisionConfig = defaultConfig
): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);

  if (
    config.useBroadPhase &&
    !aabbOverlap(computeAABB(shapeA), computeAABB(shapeB))
  ) {
    return { colliding: false, debug: ["Broad-phase: No AABB overlap"] };
  }

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
  for (let i = 0; i < config.maxIterations; i++) {
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
      // Use findClosestPoint with config
      const collisionPoint = findClosestPoint(points1, points2, config);
      debug.push("Collision detected - origin enclosed by simplex");
      return { colliding: true, debug, collisionPoint };
    }
  }

  debug.push("Max iterations reached");
  return { colliding: false, debug };
};

export const sat = (
  shapeA: Shape,
  shapeB: Shape,
  config: CollisionConfig = defaultConfig
): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);

  if (config.useBroadPhase && !aabbOverlap(computeAABB(shapeA), computeAABB(shapeB))) {
    return { colliding: false, debug: ["Broad-phase: No AABB overlap"] };
  }

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
  const project = (
    points: Vector2[],
    axis: Vector2
  ): { min: number; max: number; minPoint: Vector2; maxPoint: Vector2 } => {
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

    if (
      projection1.max < projection2.min ||
      projection2.max < projection1.min
    ) {
      debug.push("Gap found - no collision");
      return { colliding: false, debug };
    }

    const overlap = Math.min(
      projection1.max - projection2.min,
      projection2.max - projection1.min
    );
    if (overlap < minOverlap) {
      minOverlap = overlap;
      // Use findClosestPoint with config
      collisionPoint = findClosestPoint(points1, points2, config);
    }
  }

  debug.push("No separating axis found - collision detected!");
  return { colliding: true, debug, collisionPoint };
};

const handleSimplex = (
  simplex: Vector2[],
  direction: Vector2,
  config: CollisionConfig = defaultConfig // Pass config
): boolean => {
  if (simplex.length === 2) {
    return handleLine(simplex, direction, config);
  } else if (simplex.length === 3) {
    return handleTriangle(simplex, direction, config);
  }
  return false;
};

const handleLine = (
  simplex: Vector2[],
  direction: Vector2,
  config: CollisionConfig
): boolean => {
  const a = simplex[1];
  const b = simplex[0];
  const ab = b.sub(a);
  const ao = new Vector2(0, 0).sub(a);

  const abLen = ab.length();
  if (abLen < config.epsilon) {
    // Handle degenerate line segment
    return a.length() <= config.epsilon;
  }

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

const handleTriangle = (
  simplex: Vector2[],
  direction: Vector2,
  config: CollisionConfig
): boolean => {
  const a = simplex[2];
  const b = simplex[1];
  const c = simplex[0];
  const ab = b.sub(a);
  const ac = c.sub(a);
  const ao = new Vector2(0, 0).sub(a);

  const abPerp = tripleProduct(ac, ab, ab);
  const acPerp = tripleProduct(ab, ac, ac);

  if (abPerp.dot(ao) > 0) {
    // Origin outside AB edge
    simplex.splice(0, 1); // Remove C
    direction.copy(abPerp);
    return false;
  }

  if (acPerp.dot(ao) > 0) {
    // Origin outside AC edge
    simplex.splice(1, 1); // Remove B
    direction.copy(acPerp);
    return false;
  }

  // Origin inside triangle
  return true;
};

const tripleProduct = (a: Vector2, b: Vector2, c: Vector2): Vector2 => {
  const ac = a.dot(c);
  const bc = b.dot(c);
  return new Vector2(b.x * ac - a.x * bc, b.y * ac - a.y * bc);
};
