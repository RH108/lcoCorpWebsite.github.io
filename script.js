
let scene, camera, renderer, phoneGroup, screenMaterial;
let scrollPercent = 0;
let currentSection = 0;

const interfaceTextures = [
    'img/MediScan.png',
    'img/Hospitrack.png',
    'img/MediHelper.png'
];

const loadedTextures = [];

function init3D() {
    scene = new THREE.Scene();

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    camera.position.z = 6;

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.getElementById('canvas-container').appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.6);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const loader = new THREE.TextureLoader();
    interfaceTextures.forEach((url, index) => {
        loadedTextures[index] = loader.load(url);
    });

    const screenW = 1.65;
    const screenH = screenW * (896 / 414);

    phoneGroup = new THREE.Group();

    const bodyW = screenW + 0.165;
    const bodyH = screenH + 0.66;
    const bodyD = 0.176;

    const bodyGeo = new THREE.BoxGeometry(bodyW, bodyH, bodyD);
    const bodyMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        metalness: 0.8,
        roughness: 0.2
    });
    const phoneBody = new THREE.Mesh(bodyGeo, bodyMat);
    phoneGroup.add(phoneBody);

    const screenGeo = new THREE.PlaneGeometry(screenW, screenH);
    screenMaterial = new THREE.MeshBasicMaterial({
        map: loadedTextures[0],
        transparent: false
    });
    const screenMesh = new THREE.Mesh(screenGeo, screenMaterial);
    screenMesh.position.z = bodyD / 2 + 0.005;
    screenMesh.position.y = 0.11;
    phoneGroup.add(screenMesh);

    const buttonGeo = new THREE.CircleGeometry(0.154, 32);
    const buttonMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 });
    const homeBtn = new THREE.Mesh(buttonGeo, buttonMat);
    homeBtn.position.set(0, -(bodyH / 1.95 - 0.3), bodyD / 2 + 0.006);
    phoneGroup.add(homeBtn);

    const speakerGroup = new THREE.Group();
    const radius = 0.022;
    const len = 0.22;
    const cylGeo = new THREE.CylinderGeometry(radius, radius, len, 8);
    const sphGeo = new THREE.SphereGeometry(radius, 8, 8);
    const cyl = new THREE.Mesh(cylGeo, buttonMat);
    cyl.rotation.z = Math.PI / 2;
    const sph1 = new THREE.Mesh(sphGeo, buttonMat);
    sph1.position.x = -len / 2;
    const sph2 = new THREE.Mesh(sphGeo, buttonMat);
    sph2.position.x = len / 2;
    speakerGroup.add(cyl, sph1, sph2);
    speakerGroup.position.set(0, (bodyH / 2 - 0.11), bodyD / 2 + 0.006);
    phoneGroup.add(speakerGroup);

    updatePhonePosition();
    scene.add(phoneGroup);

    animate();
}

function updatePhonePosition() {
    if (window.innerWidth > 768) {
        phoneGroup.position.x = 1.6;
        phoneGroup.scale.set(1, 1, 1);
    } else {
        phoneGroup.position.x = 0;
        const scale = Math.min(window.innerWidth / 400, 0.8);
        phoneGroup.scale.set(scale, scale, scale);
    }
}

function animate() {
    requestAnimationFrame(animate);
    const targetRotationY = (-Math.PI / 6) + (scrollPercent * Math.PI * 4);
    phoneGroup.rotation.y += (targetRotationY - phoneGroup.rotation.y) * 0.1;
    phoneGroup.position.y = Math.sin(Date.now() * 0.002) * 0.05;
    renderer.render(scene, camera);
}

function updateScreen() {
    const segment = 1 / 3;
    let index = 0;
    if (scrollPercent > segment * 2) index = 2;
    else if (scrollPercent > segment) index = 1;

    if (index !== currentSection) {
        currentSection = index;
        if (loadedTextures[currentSection]) {
            screenMaterial.map = loadedTextures[currentSection];
            screenMaterial.needsUpdate = true;
        }
    }
}

window.addEventListener('scroll', () => {
    const h = document.documentElement, b = document.body;
    scrollPercent = (h.scrollTop || b.scrollTop) / (h.scrollHeight - h.clientHeight);
    updateScreen();

    if (window.innerWidth > 768) {
        phoneGroup.position.x = 1.6 - (scrollPercent * 0.2);
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    updatePhonePosition();
});

window.onload = init3D;