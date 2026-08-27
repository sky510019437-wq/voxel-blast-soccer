import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const canvas = document.getElementById('canvas');

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x1a1a2e);
scene.fog = new THREE.Fog(0x1a1a2e, 50, 200);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 25, 35);

const world = new CANNON.World();
world.gravity.set(0, -30, 0);

const VOXEL_SIZE = 0.4;
const EPSILON = 0.001;

const keys = {};
let mouseAim = 0;
let playerScore = 0;
let aiScore = 0;
let paused = false;
let matchTime = 0;
let pointerLocked = false;

window.addEventListener('keydown', (e) => { 
  keys[e.code] = true; 
  if (e.code === 'KeyP') togglePause();
});
window.addEventListener('keyup', (e) => { 
  keys[e.code] = false;
});

document.addEventListener('pointerlockchange', () => {
  pointerLocked = (document.pointerLockElement === canvas);
});

canvas.addEventListener('mousemove', (e) => {
  if (pointerLocked) {
    mouseAim += e.movementX * 0.003;
  }
});

canvas.addEventListener('click', () => {
  if (!pointerLocked) {
    canvas.requestPointerLock();
  } else {
    kickBall();
  }
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function togglePause() {
  paused = !paused;
  document.getElementById('pause').textContent = paused ? '继续 (P)' : '暂停 (P)';
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const mainLight = new THREE.DirectionalLight(0xffffff, 1.2);
mainLight.position.set(30, 50, 30);
mainLight.castShadow = true;
mainLight.shadow.camera.left = -60;
mainLight.shadow.camera.right = 60;
mainLight.shadow.camera.top = 60;
mainLight.shadow.camera.bottom = -60;
mainLight.shadow.mapSize.width = 2048;
mainLight.shadow.mapSize.height = 2048;
scene.add(mainLight);

const fillLight = new THREE.DirectionalLight(0x4466ff, 0.3);
fillLight.position.set(-30, 30, -30);
scene.add(fillLight);

const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);

function createPitch() {
  const pitchGroup = new THREE.Group();
  
  const grassColors = [0x2d5016, 0x3a6b1f];
  const pitchWidth = 70;
  const pitchLength = 105;
  const stripeWidth = 5;
  
  for (let x = -pitchWidth/2; x < pitchWidth/2; x += stripeWidth) {
    const colorIndex = Math.floor((x + pitchWidth/2) / stripeWidth) % 2;
    const stripe = new THREE.Mesh(
      new THREE.PlaneGeometry(stripeWidth, pitchLength),
      new THREE.MeshLambertMaterial({ color: grassColors[colorIndex] })
    );
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(x + stripeWidth/2, 0, 0);
    stripe.receiveShadow = true;
    pitchGroup.add(stripe);
  }
  
  const lineMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  
  function createLine(length, width, x, z, rotation = 0) {
    const line = new THREE.Mesh(
      new THREE.PlaneGeometry(length, width),
      lineMaterial
    );
    line.rotation.x = -Math.PI / 2;
    line.rotation.z = rotation;
    line.position.set(x, 0.02, z);
    pitchGroup.add(line);
  }
  
  createLine(pitchWidth, 0.3, 0, pitchLength/2, 0);
  createLine(pitchWidth, 0.3, 0, -pitchLength/2, 0);
  createLine(0.3, pitchLength, pitchWidth/2, 0, 0);
  createLine(0.3, pitchLength, -pitchWidth/2, 0, 0);
  createLine(pitchWidth, 0.3, 0, 0, 0);
  
  const circleGeometry = new THREE.RingGeometry(9, 9.3, 64);
  const circle = new THREE.Mesh(circleGeometry, lineMaterial);
  circle.rotation.x = -Math.PI / 2;
  circle.position.set(0, 0.02, 0);
  pitchGroup.add(circle);
  
  function createPenaltyBox(z) {
    const boxWidth = 40;
    const boxDepth = 16;
    createLine(boxWidth, 0.3, 0, z + (z > 0 ? boxDepth/2 : -boxDepth/2), 0);
    createLine(0.3, boxDepth, boxWidth/2, z + (z > 0 ? boxDepth/4 : -boxDepth/4), 0);
    createLine(0.3, boxDepth, -boxWidth/2, z + (z > 0 ? boxDepth/4 : -boxDepth/4), 0);
  }
  
  createPenaltyBox(pitchLength/2);
  createPenaltyBox(-pitchLength/2);
  
  const groundShape = new CANNON.Plane();
  const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
  groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
  world.addBody(groundBody);
  
  scene.add(pitchGroup);
  return pitchGroup;
}

function createStadium() {
  const stadiumGroup = new THREE.Group();
  
  const standMaterial = new THREE.MeshLambertMaterial({ color: 0x8b0000 });
  const adColors = [0xff1744, 0x00e676, 0x2979ff, 0xffd600, 0xff6e40];
  
  function createStand(x, z, width, depth, height, destructible = false) {
    const voxels = [];
    const group = new THREE.Group();
    
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        for (let k = 0; k < depth; k++) {
          const voxel = new THREE.Mesh(voxelGeometry, standMaterial);
          voxel.position.set(
            x + i * VOXEL_SIZE,
            j * VOXEL_SIZE + 0.2,
            z + k * VOXEL_SIZE
          );
          voxel.castShadow = true;
          group.add(voxel);
          if (destructible) voxels.push(voxel);
        }
      }
    }
    
    stadiumGroup.add(group);
    return { group, voxels };
  }
  
  function createAdBoard(x, z, width, height, destructible = true) {
    const voxels = [];
    const group = new THREE.Group();
    const color = adColors[Math.floor(Math.random() * adColors.length)];
    const material = new THREE.MeshLambertMaterial({ color });
    
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < height; j++) {
        const voxel = new THREE.Mesh(voxelGeometry, material);
        voxel.position.set(
          x + i * VOXEL_SIZE - (width * VOXEL_SIZE) / 2,
          j * VOXEL_SIZE + 0.2,
          z
        );
        voxel.castShadow = true;
        group.add(voxel);
        if (destructible) voxels.push(voxel);
      }
    }
    
    stadiumGroup.add(group);
    return { group, voxels };
  }
  
  createStand(-40, -30, 20, 10, 25);
  createStand(20, -30, 20, 10, 25);
  createStand(-40, 20, 20, 10, 25);
  createStand(20, 20, 20, 10, 25);
  
  const adBoards = [];
  adBoards.push(createAdBoard(0, 40, 80, 8));
  adBoards.push(createAdBoard(0, -40, 80, 8));
  adBoards.push(createAdBoard(-38, 0, 60, 8));
  adBoards.push(createAdBoard(38, 0, 60, 8));
  
  const wallShape = new CANNON.Box(new CANNON.Vec3(50, 5, 0.5));
  const walls = [
    { x: 0, y: 2.5, z: 42 },
    { x: 0, y: 2.5, z: -42 },
    { x: -40, y: 2.5, z: 0 },
    { x: 40, y: 2.5, z: 0 }
  ];
  
  walls.forEach(pos => {
    const wallBody = new CANNON.Body({ mass: 0, shape: wallShape });
    wallBody.position.set(pos.x, pos.y, pos.z);
    if (Math.abs(pos.z) > 1) {
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0);
    } else {
      wallBody.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
    }
    world.addBody(wallBody);
  });
  
  scene.add(stadiumGroup);
  return { stadiumGroup, adBoards };
}

function createGoal(z) {
  const goalGroup = new THREE.Group();
  const postMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const goalWidth = 7.32;
  const goalHeight = 2.44;
  
  function createPost(x, y, z, w, h, d) {
    for (let i = 0; i < w; i++) {
      for (let j = 0; j < h; j++) {
        for (let k = 0; k < d; k++) {
          const voxel = new THREE.Mesh(voxelGeometry, postMaterial);
          voxel.position.set(
            x + i * VOXEL_SIZE,
            y + j * VOXEL_SIZE,
            z + k * VOXEL_SIZE
          );
          voxel.castShadow = true;
          goalGroup.add(voxel);
        }
      }
    }
  }
  
  const postSize = 2;
  createPost(-goalWidth/2, 0, z, postSize, goalHeight * 5, postSize);
  createPost(goalWidth/2, 0, z, postSize, goalHeight * 5, postSize);
  createPost(-goalWidth/2, goalHeight * 2, z, goalWidth * 2.5, postSize, postSize);
  
  const netGeometry = new THREE.PlaneGeometry(goalWidth, goalHeight * 2);
  const netMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const net = new THREE.Mesh(netGeometry, netMaterial);
  net.position.set(0, goalHeight, z);
  goalGroup.add(net);
  
  const goalShape = new CANNON.Box(new CANNON.Vec3(goalWidth/2, goalHeight, 0.5));
  const goalBody = new CANNON.Body({ mass: 0, shape: goalShape, isTrigger: true });
  goalBody.position.set(0, goalHeight, z);
  goalBody.userData = { isGoal: z < 0 ? 'player' : 'ai' };
  world.addBody(goalBody);
  
  scene.add(goalGroup);
  return goalGroup;
}

function createPlayer(x, z, color, isAI = false) {
  const group = new THREE.Group();
  const material = new THREE.MeshLambertMaterial({ color });
  
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.2, 0.6), material);
  body.position.y = 1.2;
  body.castShadow = true;
  group.add(body);
  
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), material);
  head.position.y = 2.1;
  head.castShadow = true;
  group.add(head);
  
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), material);
  leftLeg.position.set(-0.2, 0.4, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.3), material);
  rightLeg.position.set(0.2, 0.4, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
  
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), material);
  leftArm.position.set(-0.6, 1.2, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), material);
  rightArm.position.set(0.6, 1.2, 0);
  rightArm.castShadow = true;
  group.add(rightArm);
  
  const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1.2, 0.4));
  const physicsBody = new CANNON.Body({ 
    mass: isAI ? 8 : 10, 
    shape,
    linearDamping: 0.1,
    angularDamping: 0.99,
    fixedRotation: true
  });
  physicsBody.position.set(x, 1.2, z);
  world.addBody(physicsBody);
  
  scene.add(group);
  return { mesh: group, body: physicsBody, legs: { left: leftLeg, right: rightLeg } };
}

const ball = (() => {
  const ballRadius = 0.55;
  const ballGroup = new THREE.Group();
  
  const mainBall = new THREE.Mesh(
    new THREE.SphereGeometry(ballRadius, 20, 20),
    new THREE.MeshLambertMaterial({ 
      color: 0xffd700,
      emissive: 0xffaa00,
      emissiveIntensity: 0.3
    })
  );
  mainBall.castShadow = true;
  ballGroup.add(mainBall);
  
  const panelMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 });
  for (let i = 0; i < 12; i++) {
    const panel = new THREE.Mesh(
      new THREE.CircleGeometry(ballRadius * 0.25, 5),
      panelMaterial
    );
    const phi = Math.acos(-1 + (2 * i) / 12);
    const theta = Math.sqrt(12 * Math.PI) * phi;
    panel.position.setFromSphericalCoords(ballRadius, phi, theta);
    panel.lookAt(0, 0, 0);
    ballGroup.add(panel);
  }
  
  const glowGeometry = new THREE.SphereGeometry(ballRadius * 1.15, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({
    color: 0xffff00,
    transparent: true,
    opacity: 0.2,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  ballGroup.add(glow);
  
  const shape = new CANNON.Sphere(ballRadius);
  const physicsBody = new CANNON.Body({ 
    mass: 0.45,
    shape,
    linearDamping: 0.1,
    angularDamping: 0.1
  });
  physicsBody.position.set(0, 2, 0);
  world.addBody(physicsBody);
  
  scene.add(ballGroup);
  return { mesh: ballGroup, body: physicsBody, radius: ballRadius };
})();

const player = createPlayer(0, -20, 0xff4444, false);
const ai = createPlayer(0, 20, 0x2196f3, true);

createPitch();
const stadium = createStadium();
createGoal(52);
createGoal(-52);

const debris = [];
const MAX_DEBRIS = 150;

function createDebris(position, color, velocity) {
  if (debris.length >= MAX_DEBRIS) {
    const old = debris.shift();
    scene.remove(old.mesh);
    world.removeBody(old.body);
  }
  
  const size = VOXEL_SIZE * (0.7 + Math.random() * 0.3);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.castShadow = true;
  
  const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
  const physicsBody = new CANNON.Body({ mass: 0.3, shape });
  physicsBody.position.copy(position);
  physicsBody.velocity.set(
    velocity.x + (Math.random() - 0.5) * 8,
    velocity.y + Math.random() * 12,
    velocity.z + (Math.random() - 0.5) * 8
  );
  physicsBody.angularVelocity.set(
    (Math.random() - 0.5) * 15,
    (Math.random() - 0.5) * 15,
    (Math.random() - 0.5) * 15
  );
  
  world.addBody(physicsBody);
  scene.add(mesh);
  debris.push({ mesh, body: physicsBody, life: 200 });
}

function checkVoxelCollisions() {
  const ballVel = ball.body.velocity.length();
  if (ballVel < 10) return;
  
  stadium.adBoards.forEach(board => {
    board.voxels.forEach(voxel => {
      if (!voxel.parent) return;
      const worldPos = new THREE.Vector3();
      voxel.getWorldPosition(worldPos);
      const dist = worldPos.distanceTo(new THREE.Vector3(
        ball.body.position.x,
        ball.body.position.y,
        ball.body.position.z
      ));
      
      if (dist < ball.radius + VOXEL_SIZE) {
        board.group.remove(voxel);
        createDebris(worldPos, voxel.material.color, ball.body.velocity);
      }
    });
  });
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type, volume = 0.5) {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  
  switch(type) {
    case 'kick':
      oscillator.frequency.setValueAtTime(180, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(60, audioContext.currentTime + 0.15);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      break;
    case 'goal':
      oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1000, audioContext.currentTime + 0.4);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
      break;
  }
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.5);
}

function kickBall() {
  if (paused) return;
  
  const dx = ball.body.position.x - player.body.position.x;
  const dz = ball.body.position.z - player.body.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  if (dist < 3 && dist > EPSILON) {
    const aimX = Math.sin(mouseAim);
    const aimZ = Math.cos(mouseAim);
    const power = keys['ShiftLeft'] || keys['ShiftRight'] ? 15 : 30;
    
    ball.body.velocity.set(aimX * power, 6, aimZ * power);
    playSound('kick', 0.7);
  }
}

function resetBall() {
  ball.body.position.set(0, 2, 0);
  ball.body.velocity.set(0, 0, 0);
  ball.body.angularVelocity.set(0, 0, 0);
  
  player.body.position.set(0, 1.2, -20);
  player.body.velocity.set(0, 0, 0);
  
  ai.body.position.set(0, 1.2, 20);
  ai.body.velocity.set(0, 0, 0);
}

function showMessage(text, duration = 2000) {
  const msg = document.getElementById('message');
  msg.innerHTML = text;
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), duration);
}

function checkGoal() {
  if (ball.body.position.z < -50 && Math.abs(ball.body.position.x) < 4) {
    aiScore++;
    document.getElementById('aiScore').textContent = aiScore;
    showMessage('<span class="goal-text">AI 进球!</span>');
    playSound('goal', 0.9);
    setTimeout(resetBall, 2000);
  }
  else if (ball.body.position.z > 50 && Math.abs(ball.body.position.x) < 4) {
    playerScore++;
    document.getElementById('playerScore').textContent = playerScore;
    showMessage('<span class="goal-text">玩家进球! ⚽</span>');
    playSound('goal', 0.9);
    setTimeout(resetBall, 2000);
  }
}

function updatePlayer(delta) {
  const speed = 300;
  const force = new CANNON.Vec3();
  let moving = false;
  
  if (keys['KeyW'] || keys['ArrowUp']) { 
    force.z -= speed; 
    moving = true;
  }
  if (keys['KeyS'] || keys['ArrowDown']) { 
    force.z += speed; 
    moving = true;
  }
  if (keys['KeyA'] || keys['ArrowLeft']) { 
    force.x -= speed; 
    moving = true;
  }
  if (keys['KeyD'] || keys['ArrowRight']) { 
    force.x += speed; 
    moving = true;
  }
  if (keys['Space']) {
    kickBall();
  }
  
  if (force.length() > EPSILON) {
    player.body.applyForce(force);
    mouseAim = Math.atan2(force.x, -force.z);
  }
  
  player.body.position.x = Math.max(-34, Math.min(34, player.body.position.x));
  player.body.position.z = Math.max(-50, Math.min(50, player.body.position.z));
  
  if (!isNaN(mouseAim)) {
    player.mesh.rotation.y = mouseAim;
  }
  
  if (moving) {
    const legSwing = Math.sin(Date.now() * 0.01) * 0.3;
    player.legs.left.rotation.x = legSwing;
    player.legs.right.rotation.x = -legSwing;
  }
}

function updateAI(delta) {
  const toBallX = ball.body.position.x - ai.body.position.x;
  const toBallZ = ball.body.position.z - ai.body.position.z;
  const distToBall = Math.sqrt(toBallX * toBallX + toBallZ * toBallZ);
  
  const speed = 150;
  const force = new CANNON.Vec3();
  
  if (ball.body.position.z > 10) {
    if (distToBall > EPSILON) {
      force.x = (toBallX / distToBall) * speed;
      force.z = (toBallZ / distToBall) * speed;
    }
  } else {
    const toHomeX = 0 - ai.body.position.x;
    const toHomeZ = 25 - ai.body.position.z;
    const distToHome = Math.sqrt(toHomeX * toHomeX + toHomeZ * toHomeZ);
    if (distToHome > EPSILON) {
      force.x = (toHomeX / distToHome) * speed * 0.6;
      force.z = (toHomeZ / distToHome) * speed * 0.6;
    }
  }
  
  ai.body.applyForce(force);
  
  if (distToBall < 3 && distToBall > EPSILON && ball.body.position.z > 10) {
    const toGoalX = 0 - ball.body.position.x;
    const toGoalZ = -52 - ball.body.position.z;
    const distToGoal = Math.sqrt(toGoalX * toGoalX + toGoalZ * toGoalZ);
    if (distToGoal > EPSILON) {
      ball.body.velocity.set(
        (toGoalX / distToGoal) * 25,
        5,
        (toGoalZ / distToGoal) * 25
      );
      playSound('kick', 0.5);
    }
  }
  
  ai.body.position.x = Math.max(-34, Math.min(34, ai.body.position.x));
  ai.body.position.z = Math.max(-50, Math.min(50, ai.body.position.z));
  
  if (force.length() > EPSILON) {
    ai.mesh.rotation.y = Math.atan2(force.x, -force.z);
  }
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  if (!paused) {
    const delta = Math.min(clock.getDelta(), 0.033);
    matchTime += delta;
    
    world.step(1 / 60, delta, 3);
    
    updatePlayer(delta);
    updateAI(delta);
    checkVoxelCollisions();
    checkGoal();
    
    ball.mesh.position.copy(ball.body.position);
    ball.mesh.quaternion.copy(ball.body.quaternion);
    
    player.mesh.position.copy(player.body.position);
    ai.mesh.position.copy(ai.body.position);
    
    debris.forEach((d, i) => {
      d.mesh.position.copy(d.body.position);
      d.mesh.quaternion.copy(d.body.quaternion);
      d.life--;
      if (d.life <= 0) {
        scene.remove(d.mesh);
        world.removeBody(d.body);
        debris.splice(i, 1);
      }
    });
    
    const targetX = player.body.position.x * 0.4;
    const targetY = 25;
    const targetZ = player.body.position.z + 20;
    const lookX = player.body.position.x * 0.5;
    const lookZ = player.body.position.z - 10;
    
    camera.position.x += (targetX - camera.position.x) * 0.05;
    camera.position.y += (targetY - camera.position.y) * 0.05;
    camera.position.z += (targetZ - camera.position.z) * 0.05;
    camera.lookAt(lookX, 2, lookZ);
    
    const minutes = Math.floor(matchTime / 60);
    const seconds = Math.floor(matchTime % 60);
    document.getElementById('time').textContent = 
      `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  renderer.render(scene, camera);
}

animate();
