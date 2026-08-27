import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 15, 25);
camera.lookAt(0, 0, 0);

const world = new CANNON.World();
world.gravity.set(0, -20, 0);
world.defaultContactMaterial.friction = 0.3;
world.defaultContactMaterial.restitution = 0.6;

const VOXEL_SIZE = 0.5;
const EPSILON = 0.001;

const keys = {};
const mouse = { x: 0, y: 0 };
let playerScore = 0;
let aiScore = 0;
let paused = false;
let cameraShake = 0;

window.addEventListener('keydown', (e) => { keys[e.code] = true; if (e.code === 'KeyP') togglePause(); });
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});
window.addEventListener('click', () => kickBall());
document.getElementById('pause').addEventListener('click', togglePause);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function togglePause() {
  paused = !paused;
  document.getElementById('pause').textContent = paused ? '继续 (P)' : '暂停 (P)';
}

const lights = new THREE.Group();
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
lights.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffffff, 0.8);
sunLight.position.set(20, 30, 20);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -40;
sunLight.shadow.camera.right = 40;
sunLight.shadow.camera.top = 40;
sunLight.shadow.camera.bottom = -40;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
lights.add(sunLight);

scene.add(lights);

const voxelGeometry = new THREE.BoxGeometry(VOXEL_SIZE, VOXEL_SIZE, VOXEL_SIZE);
const voxelMaterials = {
  grass: new THREE.MeshLambertMaterial({ color: 0x228b22 }),
  wall: new THREE.MeshLambertMaterial({ color: 0x4169e1 }),
  goal: new THREE.MeshLambertMaterial({ color: 0xffffff }),
  player: new THREE.MeshLambertMaterial({ color: 0xff4444 }),
  ai: new THREE.MeshLambertMaterial({ color: 0x4444ff }),
  ball: new THREE.MeshLambertMaterial({ color: 0xffdd00 }),
  ad: new THREE.MeshLambertMaterial({ color: 0xff00ff }),
  stand: new THREE.MeshLambertMaterial({ color: 0x888888 }),
};

const groundShape = new CANNON.Box(new CANNON.Vec3(20, 0.5, 15));
const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
groundBody.position.set(0, -0.5, 0);
world.addBody(groundBody);

const groundMesh = new THREE.Mesh(
  new THREE.BoxGeometry(40, 1, 30),
  voxelMaterials.grass
);
groundMesh.position.copy(groundBody.position);
groundMesh.receiveShadow = true;
scene.add(groundMesh);

function createVoxelWall(x, y, z, w, h, d, material, destructible = false) {
  const group = new THREE.Group();
  const voxels = [];
  
  for (let i = 0; i < w; i++) {
    for (let j = 0; j < h; j++) {
      for (let k = 0; k < d; k++) {
        const voxel = new THREE.Mesh(voxelGeometry, material);
        voxel.position.set(
          x + i * VOXEL_SIZE - (w * VOXEL_SIZE) / 2,
          y + j * VOXEL_SIZE,
          z + k * VOXEL_SIZE - (d * VOXEL_SIZE) / 2
        );
        voxel.castShadow = true;
        voxel.receiveShadow = true;
        
        if (destructible) {
          voxel.userData.destructible = true;
          voxel.userData.worldPos = voxel.position.clone();
        }
        
        group.add(voxel);
        voxels.push(voxel);
      }
    }
  }
  
  if (!destructible) {
    const shape = new CANNON.Box(new CANNON.Vec3(w * VOXEL_SIZE / 2, h * VOXEL_SIZE / 2, d * VOXEL_SIZE / 2));
    const body = new CANNON.Body({ mass: 0, shape });
    body.position.set(x, y + h * VOXEL_SIZE / 2, z);
    world.addBody(body);
  }
  
  return { group, voxels };
}

const walls = [];
walls.push(createVoxelWall(-20, 0, 0, 1, 8, 60, voxelMaterials.wall));
walls.push(createVoxelWall(20, 0, 0, 1, 8, 60, voxelMaterials.wall));

const adBoards = [];
adBoards.push(createVoxelWall(-18, 0, 13, 36, 4, 2, voxelMaterials.ad, true));
adBoards.push(createVoxelWall(-18, 0, -13, 36, 4, 2, voxelMaterials.ad, true));

const stands = [];
stands.push(createVoxelWall(-18, 4, 14, 36, 6, 2, voxelMaterials.stand, true));
stands.push(createVoxelWall(-18, 4, -14, 36, 6, 2, voxelMaterials.stand, true));

walls.forEach(w => scene.add(w.group));
adBoards.forEach(a => scene.add(a.group));
stands.forEach(s => scene.add(s.group));

function createGoal(x, z) {
  const goal = new THREE.Group();
  
  const postMaterial = voxelMaterials.goal;
  const leftPost = createVoxelWall(x - 3, 0, z, 1, 8, 1, postMaterial);
  const rightPost = createVoxelWall(x + 3, 0, z, 1, 8, 1, postMaterial);
  const topBar = createVoxelWall(x, 4, z, 12, 1, 1, postMaterial);
  
  goal.add(leftPost.group);
  goal.add(rightPost.group);
  goal.add(topBar.group);
  
  const netShape = new CANNON.Box(new CANNON.Vec3(3, 2, 0.5));
  const netBody = new CANNON.Body({ mass: 0, shape: netShape });
  netBody.position.set(x, 2, z);
  netBody.userData = { isGoal: z < 0 ? 'player' : 'ai' };
  world.addBody(netBody);
  
  return goal;
}

const playerGoal = createGoal(0, -14);
const aiGoal = createGoal(0, 14);
scene.add(playerGoal);
scene.add(aiGoal);

const ballRadius = 0.4;
const ballShape = new CANNON.Sphere(ballRadius);
const ballBody = new CANNON.Body({ mass: 1, shape: ballShape });
ballBody.position.set(0, 2, 0);
ballBody.linearDamping = 0.3;
ballBody.angularDamping = 0.3;
world.addBody(ballBody);

const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 16, 16),
  voxelMaterials.ball
);
ballMesh.castShadow = true;
scene.add(ballMesh);

function createPlayer(x, z, material) {
  const mesh = new THREE.Group();
  
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 4; j++) {
      for (let k = 0; k < 2; k++) {
        const voxel = new THREE.Mesh(voxelGeometry, material);
        voxel.position.set(
          (i - 0.5) * VOXEL_SIZE,
          (j + 0.5) * VOXEL_SIZE,
          (k - 0.5) * VOXEL_SIZE
        );
        voxel.castShadow = true;
        mesh.add(voxel);
      }
    }
  }
  
  const shape = new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5));
  const body = new CANNON.Body({ mass: 10, shape });
  body.position.set(x, 1, z);
  body.linearDamping = 0.9;
  body.angularDamping = 0.99;
  body.fixedRotation = true;
  world.addBody(body);
  
  return { mesh, body };
}

const player = createPlayer(0, -10, voxelMaterials.player);
const ai = createPlayer(0, 10, voxelMaterials.ai);
scene.add(player.mesh);
scene.add(ai.mesh);

const debris = [];
const MAX_DEBRIS = 200;

function createDebris(position, color, velocity) {
  if (debris.length >= MAX_DEBRIS) {
    const old = debris.shift();
    scene.remove(old.mesh);
    world.removeBody(old.body);
  }
  
  const size = VOXEL_SIZE * (0.8 + Math.random() * 0.4);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.castShadow = true;
  
  const shape = new CANNON.Box(new CANNON.Vec3(size / 2, size / 2, size / 2));
  const body = new CANNON.Body({ mass: 0.5, shape });
  body.position.copy(position);
  body.velocity.set(
    velocity.x + (Math.random() - 0.5) * 10,
    velocity.y + Math.random() * 15,
    velocity.z + (Math.random() - 0.5) * 10
  );
  body.angularVelocity.set(
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20,
    (Math.random() - 0.5) * 20
  );
  
  world.addBody(body);
  scene.add(mesh);
  
  debris.push({ mesh, body, life: 300 });
}

function checkVoxelCollisions() {
  const ballVel = ballBody.velocity.length();
  if (ballVel < 5) return;
  
  const checkStructures = [...adBoards, ...stands];
  
  checkStructures.forEach(structure => {
    structure.voxels.forEach((voxel, index) => {
      if (!voxel.parent) return;
      
      const worldPos = new THREE.Vector3();
      voxel.getWorldPosition(worldPos);
      const dist = worldPos.distanceTo(new THREE.Vector3(
        ballBody.position.x,
        ballBody.position.y,
        ballBody.position.z
      ));
      
      if (dist < ballRadius + VOXEL_SIZE * 0.7) {
        structure.group.remove(voxel);
        const color = voxel.material.color;
        createDebris(worldPos, color, ballBody.velocity);
        
        playSound('break', 0.3);
        cameraShake = Math.min(cameraShake + 5, 20);
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
      oscillator.frequency.setValueAtTime(150, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(50, audioContext.currentTime + 0.1);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      break;
    case 'goal':
      oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.3);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      break;
    case 'break':
      oscillator.type = 'square';
      oscillator.frequency.setValueAtTime(100, audioContext.currentTime);
      gainNode.gain.setValueAtTime(volume, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
      break;
  }
  
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.3);
}

function kickBall() {
  if (paused) return;
  
  const dx = ballBody.position.x - player.body.position.x;
  const dz = ballBody.position.z - player.body.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  
  if (dist < 2 && dist > EPSILON) {
    const power = 25;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    
    ballBody.velocity.set(dirX * power, 8, dirZ * power);
    
    playSound('kick', 0.6);
    cameraShake = 15;
  }
}

function resetBall() {
  ballBody.position.set(0, 2, 0);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  
  player.body.position.set(0, 1, -10);
  player.body.velocity.set(0, 0, 0);
  
  ai.body.position.set(0, 1, 10);
  ai.body.velocity.set(0, 0, 0);
}

function showMessage(text, duration = 2000) {
  const msg = document.getElementById('message');
  msg.innerHTML = text;
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), duration);
}

function checkGoal() {
  if (ballBody.position.z < -14 && Math.abs(ballBody.position.x) < 3) {
    aiScore++;
    document.getElementById('aiScore').textContent = aiScore;
    showMessage('<span class="goal-text">AI 进球!</span>');
    playSound('goal', 0.8);
    cameraShake = 30;
    setTimeout(resetBall, 2000);
  }
  else if (ballBody.position.z > 14 && Math.abs(ballBody.position.x) < 3) {
    playerScore++;
    document.getElementById('playerScore').textContent = playerScore;
    showMessage('<span class="goal-text">玩家进球! 🎉</span>');
    playSound('goal', 0.8);
    cameraShake = 30;
    setTimeout(resetBall, 2000);
  }
}

function updatePlayer(delta) {
  const speed = 10;
  const force = new CANNON.Vec3();
  
  if (keys['KeyW'] || keys['ArrowUp']) force.z -= speed;
  if (keys['KeyS'] || keys['ArrowDown']) force.z += speed;
  if (keys['KeyA'] || keys['ArrowLeft']) force.x -= speed;
  if (keys['KeyD'] || keys['ArrowRight']) force.x += speed;
  if (keys['Space']) kickBall();
  
  player.body.applyForce(force);
  
  player.body.position.x = Math.max(-18, Math.min(18, player.body.position.x));
  player.body.position.z = Math.max(-13, Math.min(13, player.body.position.z));
}

function updateAI(delta) {
  const toBallX = ballBody.position.x - ai.body.position.x;
  const toBallZ = ballBody.position.z - ai.body.position.z;
  const distToBall = Math.sqrt(toBallX * toBallX + toBallZ * toBallZ);
  
  const speed = 8;
  const force = new CANNON.Vec3();
  
  if (ballBody.position.z > 0) {
    if (distToBall > EPSILON) {
      force.x = (toBallX / distToBall) * speed;
      force.z = (toBallZ / distToBall) * speed;
    }
  } else {
    const toHomeX = 0 - ai.body.position.x;
    const toHomeZ = 10 - ai.body.position.z;
    const distToHome = Math.sqrt(toHomeX * toHomeX + toHomeZ * toHomeZ);
    if (distToHome > EPSILON) {
      force.x = (toHomeX / distToHome) * speed * 0.5;
      force.z = (toHomeZ / distToHome) * speed * 0.5;
    }
  }
  
  ai.body.applyForce(force);
  
  if (distToBall < 2 && distToBall > EPSILON && ballBody.position.z > 5) {
    const toGoalX = 0 - ballBody.position.x;
    const toGoalZ = -14 - ballBody.position.z;
    const distToGoal = Math.sqrt(toGoalX * toGoalX + toGoalZ * toGoalZ);
    if (distToGoal > EPSILON) {
      ballBody.velocity.set(
        (toGoalX / distToGoal) * 20,
        5,
        (toGoalZ / distToGoal) * 20
      );
      playSound('kick', 0.4);
      cameraShake = 10;
    }
  }
  
  ai.body.position.x = Math.max(-18, Math.min(18, ai.body.position.x));
  ai.body.position.z = Math.max(-13, Math.min(13, ai.body.position.z));
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  if (!paused) {
    const delta = Math.min(clock.getDelta(), 0.1);
    
    world.step(1 / 60, delta, 3);
    
    updatePlayer(delta);
    updateAI(delta);
    checkVoxelCollisions();
    checkGoal();
    
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    
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
    
    let targetX = 0;
    let targetY = 15;
    let targetZ = 25;
    
    if (!isNaN(player.body.position.x) && !isNaN(player.body.position.z)) {
      targetX = player.body.position.x * 0.3;
      targetZ = player.body.position.z + 25;
    }
    
    if (cameraShake > 0) {
      targetX += Math.sin(Date.now() * 0.05) * cameraShake * 0.02;
      targetY += Math.cos(Date.now() * 0.03) * cameraShake * 0.02;
      cameraShake *= 0.9;
    }
    
    camera.position.x += (targetX - camera.position.x) * 0.1;
    camera.position.y += (targetY - camera.position.y) * 0.1;
    camera.position.z += (targetZ - camera.position.z) * 0.1;
    camera.lookAt(0, 0, 0);
  }
  
  renderer.render(scene, camera);
}

animate();
