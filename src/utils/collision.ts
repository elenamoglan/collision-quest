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
  debug.push("Starting enhanced Lin-Canny algorithm");

  let closest = {
    distance: Infinity,
    signedDistance: Infinity,
    point: null as Vector2 | null,
    type: ""
  };

  // 1. Containment Check
  const isInside = (point: Vector2, polygon: Vector2[]): boolean => {
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const a = polygon[i];
      const b = polygon[j];
      const intersect = ((a.y > point.y) !== (b.y > point.y)) &&
        (point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Check if any points are fully contained
  const containedPoints = [
    ...points1.filter(p => isInside(p, points2)),
    ...points2.filter(p => isInside(p, points1))
  ];

  if (containedPoints.length > 0) {
    closest = {
      distance: 0,
      signedDistance: -Infinity, // Negative indicates penetration
      point: containedPoints[0],
      type: "Containment"
    };
    debug.push("Containment detected");
  }

  // 2. Vertex-Edge Check with Signed Distance
  const checkVertexEdges = (vertices: Vector2[], edges: Vector2[]) => {
    vertices.forEach(vertex => {
      edges.forEach((edgeStart, i) => {
        const edgeEnd = edges[(i + 1) % edges.length];
        const edgeVec = edgeEnd.sub(edgeStart);
        const edgeNormal = new Vector2(-edgeVec.y, edgeVec.x).normalize();
        
        // Signed distance calculation
        const toVertex = vertex.sub(edgeStart);
        const signedDist = toVertex.dot(edgeNormal);
        const projection = getClosestPointOnLineSegment(vertex, edgeStart, edgeEnd, config);
        const absDist = vertex.sub(projection).length();

        // Track closest penetration or proximity
        if (signedDist < 0 || absDist < closest.distance) {
          const effectiveDist = signedDist < 0 ? signedDist : absDist;
          
          if (effectiveDist < closest.signedDistance) {
            closest = {
              distance: absDist,
              signedDistance: effectiveDist,
              point: projection.add(vertex).scale(0.5),
              type: signedDist < 0 ? "Penetration" : "Proximity"
            };
          }
        }
      });
    });
  };

  // 3. Edge-Edge Intersection Check
  const checkEdgePairs = () => {
    points1.forEach((aStart, i) => {
      const aEnd = points1[(i + 1) % points1.length];
      points2.forEach((bStart, j) => {
        const bEnd = points2[(j + 1) % points2.length];
        
        // Line segment intersection test
        const intersect = checkLineIntersection(aStart, aEnd, bStart, bEnd);
        if (intersect.intersects) {
          closest = {
            distance: 0,
            signedDistance: -Infinity,
            point: intersect.point,
            type: "Edge-Intersection"
          };
        }
      });
    });
  };

  // Only run these checks if no containment found
  if (closest.type !== "Containment") {
    checkVertexEdges(points1, points2);
    checkVertexEdges(points2, points1);
    checkEdgePairs();
  }

  // Final collision determination
  const colliding = closest.signedDistance < config.collisionThreshold;
  debug.push(`Collision point: ${closest.point ? `(${closest.point.x.toFixed(1)}, ${closest.point.y.toFixed(1)})` : "none"}`);

  return {
    colliding,
    debug,
    collisionPoint: closest.point ? { x: closest.point.x, y: closest.point.y } : null
  };
};

// Helper: Line segment intersection detection
const checkLineIntersection = (a1: Vector2, a2: Vector2, b1: Vector2, b2: Vector2) => {
  const denominator = (b2.y - b1.y) * (a2.x - a1.x) - (b2.x - b1.x) * (a2.y - a1.y);
  
  // Lines are parallel
  if (Math.abs(denominator) < 1e-6) return { intersects: false, point: null };

  const ua = ((b2.x - b1.x) * (a1.y - b1.y) - (b2.y - b1.y) * (a1.x - b1.x)) / denominator;
  const ub = ((a2.x - a1.x) * (a1.y - b1.y) - (a2.y - a1.y) * (a1.x - b1.x)) / denominator;

  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    const x = a1.x + ua * (a2.x - a1.x);
    const y = a1.y + ua * (a2.y - a1.y);
    return { intersects: true, point: new Vector2(x, y) };
  }
  return { intersects: false, point: null };
};

// Helper function to find closest points between two edges
const findClosestEdgePoints = (
  aStart: Vector2,
  aEnd: Vector2,
  bStart: Vector2,
  bEnd: Vector2,
  config: CollisionConfig
) => {
  const edgeA = aEnd.sub(aStart);
  const edgeB = bEnd.sub(bStart);
  const delta = bStart.sub(aStart);

  const a = edgeA.dot(edgeA);
  const b = edgeA.dot(edgeB);
  const c = edgeB.dot(edgeB);
  const d = edgeA.dot(delta);
  const e = edgeB.dot(delta);

  const denom = a * c - b * b;
  let s = denom !== 0 ? (b * e - c * d) / denom : 0;
  let t = (a * e - b * d) / denom;

  s = Math.max(0, Math.min(1, s));
  t = Math.max(0, Math.min(1, t));

  const pointA = aStart.add(edgeA.scale(s));
  const pointB = bStart.add(edgeB.scale(t));

  return {
    pointA,
    pointB,
    distance: pointA.sub(pointB).length(),
  };
};

export const vClip = (
  shapeA: Shape,
  shapeB: Shape,
  config: CollisionConfig = defaultConfig
): CollisionResult => {
  const debug: string[] = [];
  const points1 = transformPoints(shapeA);
  const points2 = transformPoints(shapeB);
  debug.push("Starting V-Clip algorithm");

  let closest = {
    distance: Infinity,
    point: null as Vector2 | null,
    type: "",
  };

  // Improved containment check
  const checkContainment = () => {
    const containsPoint = (p: Vector2, polygon: Vector2[]) => {
      let inside = false;
      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const xi = polygon[i].x,
          yi = polygon[i].y;
        const xj = polygon[j].x,
          yj = polygon[j].y;

        const intersect =
          yi > p.y !== yj > p.y &&
          p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };

    // Check both directions
    if (points1.some((p) => containsPoint(p, points2))) {
      closest = {
        distance: 0,
        point: new Vector2(
          findClosestPoint(points1, points2, config).x,
          findClosestPoint(points1, points2, config).y
        ),
        type: "Containment (ShapeA in ShapeB)",
      };
      return true;
    }
    if (points2.some((p) => containsPoint(p, points1))) {
      closest = {
        distance: 0,
        point: new Vector2(
          findClosestPoint(points2, points1, config).x,
          findClosestPoint(points2, points1, config).y
        ),
        type: "Containment (ShapeB in ShapeA)",
      };
      return true;
    }
    return false;
  };

  // Check edge-vertex distances
  const checkEdges = () => {
    const checkPairs = (vertices: Vector2[], edges: Vector2[]) => {
      vertices.forEach((vertex) => {
        edges.forEach((edgeStart, i) => {
          const edgeEnd = edges[(i + 1) % edges.length];
          const projection = getClosestPointOnLineSegment(
            vertex,
            edgeStart,
            edgeEnd,
            config
          );
          const distance = vertex.sub(projection).length();

          if (distance < closest.distance) {
            closest = {
              distance,
              point: vertex.add(projection).scale(0.5),
              type: `Edge-Vertex (${distance.toFixed(2)})`,
            };
          }
        });
      });
    };

    checkPairs(points1, points2);
    checkPairs(points2, points1);
  };

  // Execution flow
  if (!checkContainment()) {
    checkEdges();
  }

  // Final result
  const colliding = closest.distance < config.collisionThreshold;
  debug.push(
    `Final collision point: ${
      closest.point
        ? `(${closest.point.x.toFixed(2)}, ${closest.point.y.toFixed(2)})`
        : "none"
    }`
  );

  return {
    colliding,
    debug,
    collisionPoint: closest.point
      ? { x: closest.point.x, y: closest.point.y }
      : null,
  };
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

  if (
    config.useBroadPhase &&
    !aabbOverlap(computeAABB(shapeA), computeAABB(shapeB))
  ) {
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
