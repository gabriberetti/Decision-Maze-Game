class Game {
    constructor() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);  // Black background
        
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.followCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.currentCamera = this.camera;
        
        // Add camera smoothing properties
        this.cameraLerpFactor = 0.1;
        this.currentCameraPosition = new THREE.Vector3();
        this.currentCameraLookAt = new THREE.Vector3();
        this.targetCameraPosition = new THREE.Vector3();
        this.targetCameraLookAt = new THREE.Vector3();
        
        this.renderer = new THREE.WebGLRenderer({
            canvas: document.querySelector('#game-canvas'),
            antialias: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;  // Increased exposure
        
        // Setup lighting first
        this.setupLighting();
        
        // Initialize UI
        this.ui = new DecisionUI(this);
        
        // Setup cameras with adjusted positions
        this.camera.position.set(0, 35, 15);
        this.camera.lookAt(0, 0, 0);
        this.camera.rotation.z = 0;
        
        // Follow camera setup with adjusted position
        this.followCamera.position.set(0, 4, 4);
        this.followCamera.lookAt(0, 0, 0);
        
        // Create maze with doubled dimensions
        this.maze = new MazeGenerator(20, 20, this);
        this.maze.generate();
        
        // Create animal
        this.animal = new Animal(this);
        
        // Add camera controls
        this.setupCameraControls();
        
        // Load font before adding title
        document.fonts.ready.then(() => {
            this.addTitle();
        });
        
        // Start animation loop
        this.animate();
        
        // Handle window resize
        window.addEventListener('resize', () => this.onWindowResize(), false);
    }
    
    setupCameraControls() {
        const toggleButton = document.getElementById('toggle-camera');
        toggleButton.addEventListener('click', () => this.toggleCamera());
    }
    
    toggleCamera() {
        this.currentCamera = (this.currentCamera === this.camera) ? this.followCamera : this.camera;
        
        // Update button text
        const toggleButton = document.getElementById('toggle-camera');
        toggleButton.textContent = (this.currentCamera === this.camera) ? 'Switch to Follow View' : 'Switch to Top View';
    }
    
    updateFollowCamera() {
        if (!this.animal || !this.animal.model) return;
        
        // Get animal's position and rotation
        const animalPos = this.animal.model.position.clone();
        const angle = this.animal.model.rotation.y;
        
        // Fixed camera configuration
        const distance = 4;    // Distance behind (reduced from 6)
        const height = 2.5;    // Height above (reduced from 4)
        
        // Calculate camera position behind and above the animal
        this.targetCameraPosition.set(
            animalPos.x - Math.sin(angle) * distance,
            animalPos.y + height,
            animalPos.z - Math.cos(angle) * distance
        );
        
        // Look at position is just slightly above the animal
        this.targetCameraLookAt.set(
            animalPos.x,
            animalPos.y + 0.5,
            animalPos.z
        );
        
        // Initialize positions if needed
        if (this.currentCameraPosition.lengthSq() === 0) {
            this.currentCameraPosition.copy(this.targetCameraPosition);
            this.currentCameraLookAt.copy(this.targetCameraLookAt);
        }
        
        // Smooth camera movement
        this.currentCameraPosition.lerp(this.targetCameraPosition, this.cameraLerpFactor);
        this.currentCameraLookAt.lerp(this.targetCameraLookAt, this.cameraLerpFactor);
        
        // Update camera position
        this.followCamera.position.copy(this.currentCameraPosition);
        
        // Create a direction vector from camera to look-at point
        const direction = new THREE.Vector3().subVectors(this.currentCameraLookAt, this.currentCameraPosition);
        direction.y = 0; // Zero out the vertical component to prevent tilt
        direction.normalize();
        
        // Calculate the target quaternion for horizontal-only rotation
        const targetQuaternion = new THREE.Quaternion();
        const up = new THREE.Vector3(0, 1, 0);
        const right = new THREE.Vector3().crossVectors(direction, up).normalize();
        const lookMatrix = new THREE.Matrix4().makeBasis(right, up, direction.negate());
        targetQuaternion.setFromRotationMatrix(lookMatrix);
        
        // Apply the quaternion directly
        this.followCamera.quaternion.copy(targetQuaternion);
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        const deltaTime = 1/60;  // Fixed time step
        
        // Update animal if it exists
        if (this.animal) {
            this.animal.update(deltaTime);
            
            // Update follow camera position
            this.updateFollowCamera();
        }
        
        // Render with current camera
        this.renderer.render(this.scene, this.currentCamera);
    }
    
    onWindowResize() {
        // Update both cameras
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        
        this.followCamera.aspect = window.innerWidth / window.innerHeight;
        this.followCamera.updateProjectionMatrix();
        
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    setupLighting() {
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.2); // Reduced from 0.35
        this.scene.add(ambientLight);
        
        // Main directional light (sun-like)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0); // Reduced from 1.4
        directionalLight.position.set(30, 50, 30);
        directionalLight.castShadow = true;
        
        // Configure shadow properties
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        directionalLight.shadow.camera.left = -50;
        directionalLight.shadow.camera.right = 50;
        directionalLight.shadow.camera.top = 50;
        directionalLight.shadow.camera.bottom = -50;
        
        this.scene.add(directionalLight);
        
        // Add hemisphere light for better ambient illumination
        const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3); // Reduced from 0.45
        this.scene.add(hemisphereLight);
        
        // Add two fill lights from different angles for better wall illumination
        const fillLight1 = new THREE.DirectionalLight(0xffffff, 0.3); // Reduced from 0.5
        fillLight1.position.set(-30, 30, -30);
        this.scene.add(fillLight1);
        
        const fillLight2 = new THREE.DirectionalLight(0xffffff, 0.2); // Reduced from 0.4
        fillLight2.position.set(-50, 30, 50);
        this.scene.add(fillLight2);
    }
    
    start(option1, option2) {
        this.maze.generate();
        this.maze.addExits(option1, option2);
        this.animal.spawn(this.maze.getStartPosition());
        // The animal will automatically start navigating after spawning
        // No need to call additional navigation methods as spawn() handles this
    }

    addTitle() {
        // Add title text as HTML element
        const titleElement = document.createElement('div');
        titleElement.textContent = 'DECISION MAZE';
        titleElement.style.position = 'fixed';
        titleElement.style.top = '20px';
        titleElement.style.left = '20px';
        titleElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui';
        titleElement.style.fontSize = '32px';
        titleElement.style.fontWeight = 'bold';
        titleElement.style.color = '#FFEB00';  // Bright yellow color
        titleElement.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.3)';
        titleElement.style.zIndex = '1000';
        document.body.appendChild(titleElement);

        // Add credit text as HTML element
        const creditElement = document.createElement('div');
        creditElement.textContent = 'Made by Gabriele Beretti, 2025';
        creditElement.style.position = 'fixed';
        creditElement.style.bottom = '20px';
        creditElement.style.left = '20px';
        creditElement.style.fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui';
        creditElement.style.fontSize = '14px';
        creditElement.style.color = 'rgba(255, 255, 255, 0.8)';
        creditElement.style.textShadow = '0 2px 4px rgba(0, 0, 0, 0.2)';
        creditElement.style.zIndex = '1000';
        document.body.appendChild(creditElement);
    }
}

// Initialize game when window loads
window.addEventListener('load', () => {
    const game = new Game();
}); 