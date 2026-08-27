import * as THREE from 'three';
import * as CANNON from 'cannon-es';

const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.Fog(0x0a0a1a, 80, 150);

const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 12, 18);

const world = new CANNON.World();
world.gravity.set(0, -25, 0);

const EPSILON = 0.001;
const keys = {};
let playerScore = 0;
let aiScore = 0;
let matchTime = 0;
let paused = false;

window.addEventListener('keydown', (e) => { 
  keys[e.code] = true;
  if (e.code === 'KeyP') togglePause();
  if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code === 'Space') {
    e.preventDefault();
  }
}, { passive: false });

window.addEventListener('keyup', (e) => { 
  keys[e.code] = false;
  if (e.code.startsWith('Key') || e.code.startsWith('Arrow') || e.code === 'Space') {
    e.preventDefault();
  }
}, { passive: false });
window.addEventListener('keydown', (e) => console.log('Key pressed:', e.code, e.key));
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function togglePause() {
  paused = !paused;
  document.getElementById('pause').textContent = paused ? '继续 (P)' : '暂停 (P)';
}

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xffe0b0, 1.5);
sunLight.position.set(25, 40, 25);
sunLight.castShadow = true;
sunLight.shadow.camera.left = -50;
sunLight.shadow.camera.right = 50;
sunLight.shadow.camera.top = 50;
sunLight.shadow.camera.bottom = -50;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
scene.add(sunLight);

const fillLight1 = new THREE.PointLight(0x88bbff, 0.8, 100);
fillLight1.position.set(-30, 25, 0);
scene.add(fillLight1);

const fillLight2 = new THREE.PointLight(0x88bbff, 0.8, 100);
fillLight2.position.set(30, 25, 0);
scene.add(fillLight2);

const groundMaterial = new CANNON.Material('ground');
const groundBody = new CANNON.Body({ 
  mass: 0, 
  shape: new CANNON.Plane(),
  material: groundMaterial
});
groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
world.addBody(groundBody);

const pitchW = 60;
const pitchL = 90;
const pitchGroup = new THREE.Group();

for (let z = 0; z < 18; z++) {
  const isLight = z % 2 === 0;
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(pitchW, pitchL / 18),
    new THREE.MeshLambertMaterial({ color: isLight ? 0x3a7d2f : 0x2d6123 })
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set(0, 0.01, -pitchL/2 + z * pitchL/18 + pitchL/36);
  stripe.receiveShadow = true;
  pitchGroup.add(stripe);
}

const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
function addLine(w, l, x, z) {
  const line = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
  line.rotation.x = -Math.PI / 2;
  line.position.set(x, 0.02, z);
  pitchGroup.add(line);
}

addLine(pitchW, 0.2, 0, pitchL/2);
addLine(pitchW, 0.2, 0, -pitchL/2);
addLine(0.2, pitchL, -pitchW/2, 0);
addLine(0.2, pitchL, pitchW/2, 0);
addLine(pitchW, 0.2, 0, 0);

const circleGeo = new THREE.RingGeometry(8, 8.2, 64);
const circle = new THREE.Mesh(circleGeo, lineMat);
circle.rotation.x = -Math.PI / 2;
circle.position.set(0, 0.02, 0);
pitchGroup.add(circle);

scene.add(pitchGroup);

const standMaterial = new THREE.MeshLambertMaterial({ color: 0x8b1a1a });
const crowdColors = [0xff3333, 0x3333ff, 0xffff33, 0x33ff33, 0xff33ff];

function createStand(x, y, z, w, h, d) {
  const group = new THREE.Group();
  for (let i = 0; i < w; i += 0.6) {
    for (let j = 0; j < h; j += 0.6) {
      for (let k = 0; k < d; k += 0.6) {
        const isCrowd = Math.random() > 0.3 && j > 2;
        const color = isCrowd ? crowdColors[Math.floor(Math.random() * crowdColors.length)] : 0x8b1a1a;
        const cube = new THREE.Mesh(
          new THREE.BoxGeometry(0.5, 0.5, 0.5),
          new THREE.MeshLambertMaterial({ color })
        );
        cube.position.set(x + i, y + j, z + k);
        cube.castShadow = true;
        group.add(cube);
      }
    }
  }
  scene.add(group);
}

createStand(-35, 0, -45, 10, 15, 3);
createStand(25, 0, -45, 10, 15, 3);
createStand(-35, 0, 42, 10, 15, 3);
createStand(25, 0, 42, 10, 15, 3);

createStand(-40, 0, -20, 3, 12, 30);
createStand(37, 0, -20, 3, 12, 30);

function createFloodlight(x, z) {
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.4, 25, 8),
    new THREE.MeshLambertMaterial({ color: 0x666666 })
  );
  pole.position.set(x, 12.5, z);
  pole.castShadow = true;
  scene.add(pole);
  
  const light = new THREE.PointLight(0xffffee, 1.2, 80);
  light.position.set(x, 25, z);
  light.castShadow = true;
  scene.add(light);
  
  const lamp = new THREE.Mesh(
    new THREE.BoxGeometry(2, 0.5, 2),
    new THREE.MeshBasicMaterial({ color: 0xffffaa, emissive: 0xffff00, emissiveIntensity: 0.8 })
  );
  lamp.position.set(x, 25, z);
  scene.add(lamp);
}

createFloodlight(-35, -40);
createFloodlight(35, -40);
createFloodlight(-35, 40);
createFloodlight(35, 40);

const adBoards = [];
function createAdBoard(x, z, w, h, color) {
  const voxels = [];
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  
  for (let i = 0; i < w; i += 0.5) {
    for (let j = 0; j < h; j += 0.5) {
      const cube = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.45, 0.45), mat);
      cube.position.set(x + i - w/2, j + 0.25, z);
      cube.castShadow = true;
      group.add(cube);
      voxels.push(cube);
    }
  }
  
  scene.add(group);
  adBoards.push({ group, voxels, color });
}

createAdBoard(0, 48, 50, 3, 0xff1744);
createAdBoard(0, -48, 50, 3, 0x2196f3);
createAdBoard(-32, 0, 3, 3, 0xffc107);
createAdBoard(32, 0, 3, 3, 0x4caf50);

function createGoal(z) {
  const postMat = new THREE.MeshLambertMaterial({ color: 0xffffff });
  const postGeo = new THREE.CylinderGeometry(0.15, 0.15, 2.5, 8);
  
  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-3.7, 1.25, z);
  leftPost.castShadow = true;
  scene.add(leftPost);
  
  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(3.7, 1.25, z);
  rightPost.castShadow = true;
  scene.add(rightPost);
  
  const crossbar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 7.5, 8),
    postMat
  );
  crossbar.rotation.z = Math.PI / 2;
  crossbar.position.set(0, 2.5, z);
  crossbar.castShadow = true;
  scene.add(crossbar);
  
  const netGeo = new THREE.PlaneGeometry(7.5, 2.5);
  const netMat = new THREE.MeshBasicMaterial({ 
    color: 0xffffff, 
    transparent: true, 
    opacity: 0.3,
    side: THREE.DoubleSide
  });
  const net = new THREE.Mesh(netGeo, netMat);
  net.position.set(0, 1.25, z);
  scene.add(net);
  
  const goalSensor = new CANNON.Box(new CANNON.Vec3(3.5, 1.25, 0.5));
  const goalBody = new CANNON.Body({ mass: 0, shape: goalSensor, isTrigger: true });
  goalBody.position.set(0, 1.25, z);
  goalBody.userData = { isGoal: z < 0 ? 'player' : 'ai' };
  world.addBody(goalBody);
}

createGoal(-46);
createGoal(46);

function createPlayer(x, z, color, name) {
  const group = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color });
  
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), mat);
  head.position.y = 1.8;
  head.castShadow = true;
  group.add(head);
  
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.5), mat);
  body.position.y = 1.0;
  body.castShadow = true;
  group.add(body);
  
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), mat);
  leftArm.position.set(-0.55, 1.0, 0);
  leftArm.castShadow = true;
  group.add(leftArm);
  
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.8, 0.25), mat);
  rightArm.position.set(0.55, 1.0, 0);
  rightArm.castShadow = true;
  group.add(rightArm);
  
  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), mat);
  leftLeg.position.set(-0.25, 0.45, 0);
  leftLeg.castShadow = true;
  group.add(leftLeg);
  
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.9, 0.3), mat);
  rightLeg.position.set(0.25, 0.45, 0);
  rightLeg.castShadow = true;
  group.add(rightLeg);
  
  const shape = new CANNON.Box(new CANNON.Vec3(0.4, 1.0, 0.3));
  const physicsBody = new CANNON.Body({ 
    mass: 10, 
    shape,
    linearDamping: 0.1,
    fixedRotation: true
  });
  physicsBody.position.set(x, 1.0, z);
  world.addBody(physicsBody);
  
  scene.add(group);
  return { mesh: group, body: physicsBody, legs: { left: leftLeg, right: rightLeg }, name };
}

const playerTeam = [];
const aiTeam = [];

playerTeam.push(createPlayer(0, -8, 0xff1744, 'P1'));
playerTeam.push(createPlayer(-8, -15, 0xff1744, 'P2'));
playerTeam.push(createPlayer(8, -15, 0xff1744, 'P3'));

aiTeam.push(createPlayer(0, 30, 0x2196f3, 'AI1'));
aiTeam.push(createPlayer(-8, 25, 0x2196f3, 'AI2'));
aiTeam.push(createPlayer(8, 25, 0x2196f3, 'AI3'));

const mainPlayer = playerTeam[0];

const ballRadius = 1.2;
const ballMesh = new THREE.Mesh(
  new THREE.SphereGeometry(ballRadius, 32, 32),
  new THREE.MeshLambertMaterial({ 
    color: 0xffff00,
    emissive: 0xffff00,
    emissiveIntensity: 0.6
  })
);
ballMesh.castShadow = true;
scene.add(ballMesh);

const ballBody = new CANNON.Body({ 
  mass: 0.45, 
  shape: new CANNON.Sphere(ballRadius),
  linearDamping: 0.05,
  angularDamping: 0.05
});
ballBody.position.set(0, ballRadius + 1, 0);
world.addBody(ballBody);

const debris = [];
const MAX_DEBRIS = 100;

function createDebris(pos, color, vel) {
  if (debris.length >= MAX_DEBRIS) {
    const old = debris.shift();
    scene.remove(old.mesh);
    world.removeBody(old.body);
  }
  
  const size = 0.3 + Math.random() * 0.2;
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.castShadow = true;
  
  const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
  const body = new CANNON.Body({ mass: 0.2, shape });
  body.position.copy(pos);
  body.velocity.set(
    vel.x * 0.5 + (Math.random() - 0.5) * 5,
    Math.random() * 8 + 3,
    vel.z * 0.5 + (Math.random() - 0.5) * 5
  );
  body.angularVelocity.set(
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10,
    (Math.random() - 0.5) * 10
  );
  
  world.addBody(body);
  scene.add(mesh);
  debris.push({ mesh, body, life: 180 });
}

function checkCollisions() {
  if (ballBody.velocity.length() < 8) return;
  
  adBoards.forEach(board => {
    board.voxels.forEach(voxel => {
      if (!voxel.parent) return;
      const pos = new THREE.Vector3();
      voxel.getWorldPosition(pos);
      const dist = pos.distanceTo(new THREE.Vector3(ballBody.position.x, ballBody.position.y, ballBody.position.z));
      if (dist < ballRadius + 0.5) {
        board.group.remove(voxel);
        createDebris(pos, board.color, ballBody.velocity);
        playSound('break');
      }
    });
  });
}

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  
  if (type === 'kick') {
    osc.frequency.setValueAtTime(200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
  } else if (type === 'goal') {
    osc.frequency.setValueAtTime(500, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.6, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
  } else if (type === 'break') {
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
  }
  
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + 0.5);
}

function kickBall(player, power = 28) {
  const dx = ballBody.position.x - player.body.position.x;
  const dz = ballBody.position.z - player.body.position.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  console.log("Kick attempt - dist:", dist, "player:", player.body.position.x, player.body.position.z, "ball:", ballBody.position.x, ballBody.position.z);
  
  if (dist < 5.0 && dist > EPSILON) {
    ballBody.velocity.set((dx / dist) * power, 6, (dz / dist) * power);
    playSound('kick');
  }
}

function resetMatch() {
  ballBody.position.set(0, ballRadius + 0.5, 0);
  ballBody.velocity.set(0, 0, 0);
  ballBody.angularVelocity.set(0, 0, 0);
  
  playerTeam[0].body.position.set(0, 1, -30);
  playerTeam[1].body.position.set(-8, 1, -25);
  playerTeam[2].body.position.set(8, 1, -25);
  
  aiTeam[0].body.position.set(0, 1, 30);
  aiTeam[1].body.position.set(-8, 1, 25);
  aiTeam[2].body.position.set(8, 1, 25);
  
  playerTeam.forEach(p => { p.body.velocity.set(0,0,0); });
  aiTeam.forEach(a => { a.body.velocity.set(0,0,0); });
}

function showMessage(text) {
  const msg = document.getElementById('message');
  msg.innerHTML = text;
  msg.classList.add('show');
  setTimeout(() => msg.classList.remove('show'), 2500);
}

function checkGoals() {
  if (ballBody.position.z < -44 && Math.abs(ballBody.position.x) < 4) {
    aiScore++;
    document.getElementById('aiScore').textContent = aiScore;
    showMessage('AI进球!');
    playSound('goal');
    setTimeout(resetMatch, 2500);
  } else if (ballBody.position.z > 44 && Math.abs(ballBody.position.x) < 4) {
    playerScore++;
    document.getElementById('playerScore').textContent = playerScore;
    showMessage('进球得分! ⚽');
    playSound('goal');
    setTimeout(resetMatch, 2500);
  }
}

function updatePlayerControl(player, delta) {
  const speed = 400;
  const force = new CANNON.Vec3();
  let moving = false;
  
  if (keys['KeyW'] || keys['ArrowUp']) { force.z -= speed; moving = true; }
  if (keys['KeyS'] || keys['ArrowDown']) { force.z += speed; moving = true; }
  if (keys['KeyA'] || keys['ArrowLeft']) { force.x -= speed; moving = true; }
  if (keys['KeyD'] || keys['ArrowRight']) { force.x += speed; moving = true; }
  
  if (force.length() > EPSILON) {
    player.body.applyForce(force);
    player.mesh.rotation.y = Math.atan2(force.x, -force.z);
  }
  
  console.log("Space key check:", keys["Space"], "keys object:", Object.keys(keys).filter(k => keys[k]));
  if (keys['Space']) {
    kickBall(player, keys['ShiftLeft'] || keys['ShiftRight'] ? 18 : 32);
  }
  
  player.body.position.x = Math.max(-28, Math.min(28, player.body.position.x));
  player.body.position.z = Math.max(-44, Math.min(44, player.body.position.z));
  
  if (moving) {
    const swing = Math.sin(Date.now() * 0.015) * 0.4;
    player.legs.left.rotation.x = swing;
    player.legs.right.rotation.x = -swing;
  }
}

function updateAI(player, delta) {
  const toBallX = ballBody.position.x - player.body.position.x;
  const toBallZ = ballBody.position.z - player.body.position.z;
  const dist = Math.sqrt(toBallX * toBallX + toBallZ * toBallZ);
  
  const speed = 200;
  const force = new CANNON.Vec3();
  
  if (ballBody.position.z > 10 && dist > EPSILON) {
    force.x = (toBallX / dist) * speed;
    force.z = (toBallZ / dist) * speed;
  }
  
  if (force.length() > EPSILON) {
    player.body.applyForce(force);
    player.mesh.rotation.y = Math.atan2(force.x, -force.z);
  }
  
  if (dist < 2.5 && dist > EPSILON && ballBody.position.z > 15) {
    kickBall(player, 25);
  }
  
  player.body.position.x = Math.max(-28, Math.min(28, player.body.position.x));
  player.body.position.z = Math.max(-44, Math.min(44, player.body.position.z));
}

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  
  if (!paused) {
    const delta = Math.min(clock.getDelta(), 0.033);
    matchTime += delta;
    
    world.step(1/60, delta, 3);
    
    updatePlayerControl(mainPlayer, delta);
    
    playerTeam.slice(1).forEach(p => updateAI(p, delta));
    aiTeam.forEach(a => updateAI(a, delta));
    
    checkCollisions();
    checkGoals();
    
    ballMesh.position.copy(ballBody.position);
    ballMesh.quaternion.copy(ballBody.quaternion);
    
    [...playerTeam, ...aiTeam].forEach(p => {
      p.mesh.position.copy(p.body.position);
    });
    
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
    
    const targetX = mainPlayer.body.position.x * 0.3;
    const targetY = 15;
    const targetZ = mainPlayer.body.position.z + 18;
    const lookX = mainPlayer.body.position.x * 0.6;
    const lookY = 1;
    const lookZ = mainPlayer.body.position.z - 8;
    
    camera.position.x += (targetX - camera.position.x) * 0.08;
    camera.position.y += (targetY - camera.position.y) * 0.08;
    camera.position.z += (targetZ - camera.position.z) * 0.08;
    camera.lookAt(lookX, lookY, lookZ);
    
    const mins = Math.floor(matchTime / 60);
    const secs = Math.floor(matchTime % 60);
    document.getElementById('time').textContent = `${mins.toString().padStart(2,'0')}:${secs.toString().padStart(2,'0')}`;
  }
  
  renderer.render(scene, camera);
}

animate();
