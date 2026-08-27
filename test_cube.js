// Add test cube right after scene is created
const testCube = new THREE.Mesh(
  new THREE.BoxGeometry(5, 5, 5),
  new THREE.MeshBasicMaterial({ color: 0xff0000 })
);
testCube.position.set(0, 0, 0);
scene.add(testCube);
console.log("Test cube added at (0,0,0)");
