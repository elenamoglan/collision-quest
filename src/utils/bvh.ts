import { Vector2 } from './vector';

export interface AABB {
  min: Vector2;
  max: Vector2;
}

export class BVHNode {
  aabb: AABB;
  left: BVHNode | null = null;
  right: BVHNode | null = null;
  shape: Shape | null = null;
  
  constructor(aabb: AABB, shape: Shape | null = null) {
    this.aabb = aabb;
    this.shape = shape;
  }
}

export interface Shape {
  points: Array<{ x: number; y: number }>;
  position: { x: number; y: number };
  rotation: number;
}

export class BVH {
  root: BVHNode | null = null;

  static computeAABB(shape: Shape): AABB {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    // Transform points based on position and rotation
    shape.points.forEach(point => {
      // Apply rotation
      const rotatedX = point.x * Math.cos(shape.rotation) - point.y * Math.sin(shape.rotation);
      const rotatedY = point.x * Math.sin(shape.rotation) + point.y * Math.cos(shape.rotation);
      
      // Apply position
      const worldX = rotatedX + shape.position.x;
      const worldY = rotatedY + shape.position.y;
      
      minX = Math.min(minX, worldX);
      minY = Math.min(minY, worldY);
      maxX = Math.max(maxX, worldX);
      maxY = Math.max(maxY, worldY);
    });

    return {
      min: new Vector2(minX, minY),
      max: new Vector2(maxX, maxY)
    };
  }

  static aabbOverlap(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y
    );
  }

  build(shapes: Shape[]): void {
    if (shapes.length === 0) {
      this.root = null;
      return;
    }

    const buildRecursive = (shapes: Shape[]): BVHNode => {
      if (shapes.length === 1) {
        const aabb = BVH.computeAABB(shapes[0]);
        return new BVHNode(aabb, shapes[0]);
      }

      // Compute combined AABB
      const aabb = shapes.reduce((combined, shape) => {
        const shapeAABB = BVH.computeAABB(shape);
        return {
          min: new Vector2(
            Math.min(combined.min.x, shapeAABB.min.x),
            Math.min(combined.min.y, shapeAABB.min.y)
          ),
          max: new Vector2(
            Math.max(combined.max.x, shapeAABB.max.x),
            Math.max(combined.max.y, shapeAABB.max.y)
          )
        };
      }, BVH.computeAABB(shapes[0]));

      // Split shapes along longest axis
      const width = aabb.max.x - aabb.min.x;
      const height = aabb.max.y - aabb.min.y;
      const splitAxis = width > height ? 'x' : 'y';
      
      shapes.sort((a, b) => {
        const aCenter = BVH.computeAABB(a);
        const bCenter = BVH.computeAABB(b);
        return (
          (aCenter.min[splitAxis] + aCenter.max[splitAxis]) / 2 -
          (bCenter.min[splitAxis] + bCenter.max[splitAxis]) / 2
        );
      });

      const mid = Math.floor(shapes.length / 2);
      const node = new BVHNode(aabb);
      node.left = buildRecursive(shapes.slice(0, mid));
      node.right = buildRecursive(shapes.slice(mid));
      return node;
    };

    this.root = buildRecursive(shapes);
  }

  query(shape: Shape): Shape[] {
    const results: Shape[] = [];
    const queryAABB = BVH.computeAABB(shape);

    const queryNode = (node: BVHNode | null) => {
      if (!node) return;

      if (BVH.aabbOverlap(queryAABB, node.aabb)) {
        if (node.shape) {
          results.push(node.shape);
        } else {
          queryNode(node.left);
          queryNode(node.right);
        }
      }
    };

    queryNode(this.root);
    return results;
  }
}