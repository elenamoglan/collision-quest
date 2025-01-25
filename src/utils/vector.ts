export class Vector2 {
  constructor(public x: number, public y: number) {}

  add(v: Vector2): Vector2 {
    return new Vector2(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector2): Vector2 {
    return new Vector2(this.x - v.x, this.y - v.y);
  }

  scale(s: number): Vector2 {
    return new Vector2(this.x * s, this.y * s);
  }

  dot(v: Vector2): number {
    return this.x * v.x + this.y * v.y;
  }

  cross(v: Vector2): Vector2 {
    return new Vector2(
      this.x * v.y - this.y * v.x,
      this.x * v.y - this.y * v.x
    );
  }

  triple(v: Vector2): Vector2 {
    return new Vector2(
      this.y * v.x - this.x * v.y,
      this.x * v.y - this.y * v.x
    );
  }

  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector2 {
    const len = this.length();
    if (len === 0) return new Vector2(0, 0);
    return this.scale(1 / len);
  }

  negate(): Vector2 {
    return new Vector2(-this.x, -this.y);
  }

  copy(v: Vector2): Vector2 {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
}