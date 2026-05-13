/**
 * RAJU LUDO — 3D DICE with CANNON.JS PHYSICS
 * Physics-based dice rolling using Cannon-es for realistic tumbling.
 */

import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import gsap from 'gsap';

const DICE_SIZE = 0.5;
const DOT_RADIUS = 0.06;

// Dot positions on each face (relative to face center, normalized -1 to 1)
const DOT_PATTERNS = {
  1: [[0, 0]],
  2: [[-0.5, -0.5], [0.5, 0.5]],
  3: [[-0.5, -0.5], [0, 0], [0.5, 0.5]],
  4: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]],
  5: [[-0.5, -0.5], [0.5, -0.5], [0, 0], [-0.5, 0.5], [0.5, 0.5]],
  6: [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0], [0.5, 0], [-0.5, 0.5], [0.5, 0.5]],
};

// Face normals & rotations to read dice value
const FACE_NORMALS = [
  { value: 1, normal: new CANNON.Vec3(0, 1, 0) },   // top
  { value: 6, normal: new CANNON.Vec3(0, -1, 0) },   // bottom
  { value: 2, normal: new CANNON.Vec3(1, 0, 0) },    // right
  { value: 5, normal: new CANNON.Vec3(-1, 0, 0) },   // left
  { value: 3, normal: new CANNON.Vec3(0, 0, 1) },    // front
  { value: 4, normal: new CANNON.Vec3(0, 0, -1) },   // back
];

/**
 * Creates the 3D dice mesh with dots.
 * @returns {THREE.Group}
 */
export function createDiceMesh() {
  const group = new THREE.Group();

  // Dice cube with rounded edges look
  const geo = new THREE.BoxGeometry(DICE_SIZE, DICE_SIZE, DICE_SIZE, 4, 4, 4);
  
  // Round the edges slightly
  const positions = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    v.fromBufferAttribute(positions, i);
    const max = DICE_SIZE / 2;
    v.x = Math.sign(v.x) * Math.min(Math.abs(v.x), max * 0.95);
    v.y = Math.sign(v.y) * Math.min(Math.abs(v.y), max * 0.95);
    v.z = Math.sign(v.z) * Math.min(Math.abs(v.z), max * 0.95);
    positions.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xFAFAFA,
    roughness: 0.2,
    metalness: 0.05,
  });
  const cube = new THREE.Mesh(geo, mat);
  cube.castShadow = true;
  group.add(cube);

  // Add dots to each face
  const dotMat = new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.5 });

  // Face 1 (top, Y+)
  addDotsToFace(group, 1, dotMat, 'y+');
  // Face 6 (bottom, Y-)
  addDotsToFace(group, 6, dotMat, 'y-');
  // Face 2 (right, X+)
  addDotsToFace(group, 2, dotMat, 'x+');
  // Face 5 (left, X-)
  addDotsToFace(group, 5, dotMat, 'x-');
  // Face 3 (front, Z+)
  addDotsToFace(group, 3, dotMat, 'z+');
  // Face 4 (back, Z-)
  addDotsToFace(group, 4, dotMat, 'z-');

  group.userData = { isDice: true };
  return group;
}

function addDotsToFace(group, faceValue, material, faceDir) {
  const half = DICE_SIZE / 2 + 0.001;
  const dotGeo = new THREE.SphereGeometry(DOT_RADIUS, 8, 6);
  const pattern = DOT_PATTERNS[faceValue];
  const scale = DICE_SIZE * 0.35;

  pattern.forEach(([u, v]) => {
    const dot = new THREE.Mesh(dotGeo, material);

    switch (faceDir) {
      case 'y+': dot.position.set(u * scale, half, v * scale); break;
      case 'y-': dot.position.set(u * scale, -half, -v * scale); break;
      case 'x+': dot.position.set(half, u * scale, v * scale); break;
      case 'x-': dot.position.set(-half, -u * scale, v * scale); break;
      case 'z+': dot.position.set(u * scale, v * scale, half); break;
      case 'z-': dot.position.set(-u * scale, v * scale, -half); break;
    }

    dot.scale.setScalar(0.8); // flatten dots slightly
    group.add(dot);
  });
}

/**
 * The DicePhysics controller — manages Cannon.js physics world for dice.
 */
export class DicePhysics {
  constructor() {
    this.world = new CANNON.World({ gravity: new CANNON.Vec3(0, -40, 0) });
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 12;
    this.world.allowSleep = true;

    // Materials for realistic contact
    this.groundMaterial = new CANNON.Material('ground');
    this.diceMaterial = new CANNON.Material('dice');
    this.world.addContactMaterial(new CANNON.ContactMaterial(
      this.groundMaterial, this.diceMaterial,
      { friction: 0.6, restitution: 0.35 }
    ));

    // Ground plane
    const groundBody = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
    });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // Invisible walls to contain dice on the board area
    this._addWall(new CANNON.Vec3(0, 0, -3), new CANNON.Vec3(0, 0, 1));
    this._addWall(new CANNON.Vec3(0, 0, 3), new CANNON.Vec3(0, 0, -1));
    this._addWall(new CANNON.Vec3(-3, 0, 0), new CANNON.Vec3(1, 0, 0));
    this._addWall(new CANNON.Vec3(3, 0, 0), new CANNON.Vec3(-1, 0, 0));

    this.diceBody = null;
    this.diceMesh = null;
    this.isRolling = false;
  }

  _addWall(position, normal) {
    const wall = new CANNON.Body({
      type: CANNON.Body.STATIC,
      shape: new CANNON.Plane(),
    });
    wall.position.copy(position);
    const q = new CANNON.Quaternion();
    q.setFromVectors(new CANNON.Vec3(0, 0, 1), normal);
    wall.quaternion.copy(q);
    this.world.addBody(wall);
  }

  /**
   * Sets the dice mesh to sync with physics.
   * @param {THREE.Group} mesh
   */
  setDiceMesh(mesh) {
    this.diceMesh = mesh;
  }

  /**
   * Rolls the dice with physics simulation, then snaps to the target value.
   * @param {number} targetValue - The server-authoritative dice result (1-6)
   * @returns {Promise<number>} The displayed dice value
   */
  roll(targetValue) {
    return new Promise((resolve) => {
      if (this.diceBody) {
        this.world.removeBody(this.diceBody);
      }

      // Create physics body
      const shape = new CANNON.Box(new CANNON.Vec3(DICE_SIZE / 2, DICE_SIZE / 2, DICE_SIZE / 2));
      this.diceBody = new CANNON.Body({
        mass: 0.3,
        shape,
        material: this.diceMaterial,
        linearDamping: 0.3,
        angularDamping: 0.25,
      });

      // Start position — high up for dramatic fall
      this.diceBody.position.set(
        (Math.random() - 0.5) * 1.5,
        5 + Math.random() * 2,
        (Math.random() - 0.5) * 1.5
      );

      // Random initial orientation
      this.diceBody.quaternion.setFromEuler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      // Throw: launch upward slightly for a toss feel, then gravity pulls it down
      this.diceBody.velocity.set(
        (Math.random() - 0.5) * 6,
        3 + Math.random() * 4,
        (Math.random() - 0.5) * 6
      );

      // Vigorous spin for realistic tumble
      this.diceBody.angularVelocity.set(
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30,
        (Math.random() - 0.5) * 30
      );

      this.world.addBody(this.diceBody);
      this.isRolling = true;

      // Simulate physics for a fixed duration, then snap to target
      let steps = 0;
      const maxSteps = 180; // ~3 seconds at 60fps
      const timeStep = 1 / 60;

      const simulate = () => {
        if (steps >= maxSteps || this._isDiceStopped()) {
          this.isRolling = false;
          this._snapToValue(targetValue);
          setTimeout(() => resolve(targetValue), 300);
          return;
        }

        this.world.step(timeStep);
        steps++;

        // Sync mesh with physics
        if (this.diceMesh && this.diceBody) {
          this.diceMesh.position.copy(this.diceBody.position);
          this.diceMesh.quaternion.copy(this.diceBody.quaternion);
        }

        requestAnimationFrame(simulate);
      };

      simulate();
    });
  }

  _isDiceStopped() {
    if (!this.diceBody) return true;
    const vel = this.diceBody.velocity.length();
    const angVel = this.diceBody.angularVelocity.length();
    return vel < 0.08 && angVel < 0.08 && this.diceBody.position.y < DICE_SIZE * 1.2;
  }

  /**
   * Smoothly rotates dice to show the target value on top using quaternions.
   * Face mapping: 1=Y+, 6=Y-, 2=X+, 5=X-, 3=Z+, 4=Z-
   */
  _snapToValue(targetValue) {
    if (!this.diceMesh) return;

    // Quaternion rotations that place each face value on top (Y+ facing up)
    // These are exact rotations derived from standard dice face positions
    const targetQuaternion = new THREE.Quaternion();
    const randomYaw = Math.random() * Math.PI * 2; // Random rotation around Y for variety

    switch (targetValue) {
      case 1: // Face 1 is on Y+ by default — no rotation needed
        targetQuaternion.setFromEuler(new THREE.Euler(0, randomYaw, 0));
        break;
      case 6: // Face 6 on Y- — flip 180° around X or Z
        targetQuaternion.setFromEuler(new THREE.Euler(Math.PI, randomYaw, 0));
        break;
      case 2: // Face 2 on X+ — tilt -90° around Z
        targetQuaternion.setFromEuler(new THREE.Euler(0, randomYaw, -Math.PI / 2));
        break;
      case 5: // Face 5 on X- — tilt +90° around Z
        targetQuaternion.setFromEuler(new THREE.Euler(0, randomYaw, Math.PI / 2));
        break;
      case 3: // Face 3 on Z+ — tilt +90° around X
        targetQuaternion.setFromEuler(new THREE.Euler(Math.PI / 2, randomYaw, 0));
        break;
      case 4: // Face 4 on Z- — tilt -90° around X
        targetQuaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, randomYaw, 0));
        break;
      default:
        targetQuaternion.setFromEuler(new THREE.Euler(0, 0, 0));
    }

    // Get the current dice position for a realistic settle
    const currentPos = this.diceMesh.position.clone();
    const landX = currentPos.x;
    const landZ = currentPos.z;

    // Animate the snap using GSAP with slerp for smooth quaternion rotation
    const startQuat = this.diceMesh.quaternion.clone();
    const progress = { t: 0 };

    gsap.to(progress, {
      t: 1,
      duration: 0.4,
      ease: 'power2.out',
      onUpdate: () => {
        this.diceMesh.quaternion.slerpQuaternions(startQuat, targetQuaternion, progress.t);
      },
    });

    // Settle position: small bounce then rest at ground level
    gsap.to(this.diceMesh.position, {
      x: landX,
      y: DICE_SIZE / 2 + 0.3,
      z: landZ,
      duration: 0.15,
      ease: 'power1.out',
      onComplete: () => {
        gsap.to(this.diceMesh.position, {
          y: DICE_SIZE / 2,
          duration: 0.25,
          ease: 'bounce.out',
        });
      },
    });
  }

  /**
   * Steps the physics world (call each frame if rolling).
   */
  update() {
    if (this.isRolling && this.diceBody && this.diceMesh) {
      this.diceMesh.position.copy(this.diceBody.position);
      this.diceMesh.quaternion.copy(this.diceBody.quaternion);
    }
  }
}
