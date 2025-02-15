class Animal {
    constructor(game) {
        this.game = game;
        this.model = null;
        this.mixer = null;
        this.animations = {};
        this.currentPath = [];
        this.moveSpeed = 3.8; // Increased from 4.2 to match larger cell size
        this.rotationSpeed = 0.05;
        this.rotationLerpFactor = 0.08;
        this.targetRotation = 0;
        this.isMoving = false;
        this.targetPosition = null;
        this.nextWaypoint = null;
        this.isLoaded = false;
        this.stuckTimeout = 0;
        this.isCelebrating = false;
        this.celebrationTime = 0;
        this.celebrationDuration = 2.0;
        this.celebrationSpins = 2;
        
        // Animation properties
        this.bobHeight = 0.05; // Reduced from 0.06 to match smaller scale
        this.bobSpeed = 12; // Keeping original speed
        this.bobTime = 0;
        this.tiltAmount = 0.15;
        this.currentTilt = 0;
        this.currentAnimation = null;
        this.animationTransitionDuration = 0.25; // Reduced for quicker animation transitions
        
        // Debug path visualization
        this.pathLine = null;
        this.debugMode = false; // Disable debug mode by default
        
        this.lastPosition = null;
        this.stuckCheckInterval = 0.8; // Reduced from 1.0 to check more frequently
        this.stuckThreshold = 0.15; // Increased from 0.1 to account for faster movement
        this.stuckTime = 0;
        this.maxStuckTime = 1.5; // Reduced from 2.0 for quicker recovery
        
        // Load the fox model
        this.loadModel().then(() => {
            this.isLoaded = true;
            if (this.pendingSpawnPosition) {
                this.spawn(this.pendingSpawnPosition);
                this.pendingSpawnPosition = null;
            }
        }).catch(error => {
            console.error('Error loading model:', error);
            this.createGeometricPlaceholder();
            this.isLoaded = true;
        });
    }
    
    async loadModel() {
        const loader = new THREE.GLTFLoader();
        try {
            const gltf = await loader.loadAsync('Fox.glb');
            this.model = gltf.scene;
            
            // Make the fox model smaller (reduced from 0.03 to 0.025)
            this.model.scale.set(0.025, 0.025, 0.025);
            
            // Initialize animation system
            if (gltf.animations && gltf.animations.length > 0) {
                this.mixer = new THREE.AnimationMixer(this.model);
                
                // Store all available animations
                gltf.animations.forEach(clip => {
                    // Create the animation action
                    const action = this.mixer.clipAction(clip);
                    
                    // Configure the action for smooth looping
                    action.clampWhenFinished = false;
                    action.loop = THREE.LoopRepeat;
                    
                    // Store the animation
                    this.animations[clip.name] = {
                        clip: clip,
                        action: action
                    };
                    
                    console.log(`Loaded animation: ${clip.name}`);
                });
                
                // Set default idle animation if available
                this.playAnimation('Survey');
            }
            
            this.game.scene.add(this.model);
        } catch (error) {
            console.error('Error loading fox model:', error);
            throw error;
        }
    }
    
    createGeometricPlaceholder() {
        const geometry = new THREE.Group();
        
        // Body
        const bodyGeometry = new THREE.BoxGeometry(0.8, 0.5, 1.2); // Reduced from 1.0, 0.6, 1.4
        const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 }); // Orange color for fox
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        // Head
        const headGeometry = new THREE.BoxGeometry(0.4, 0.4, 0.7); // Reduced from 0.5, 0.5, 0.8
        const headMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
        const head = new THREE.Mesh(headGeometry, headMaterial);
        head.position.z = 1.0;
        head.position.y = 0.2;
        
        // Ears (more pointed for fox)
        const earGeometry = new THREE.ConeGeometry(0.12, 0.35, 4); // Reduced from 0.15, 0.4
        const earMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
        const earLeft = new THREE.Mesh(earGeometry, earMaterial);
        const earRight = new THREE.Mesh(earGeometry, earMaterial);
        
        earLeft.position.set(0.15, 0.6, 0.8);
        earRight.position.set(-0.15, 0.6, 0.8);
        earLeft.rotation.x = -0.2;
        earRight.rotation.x = -0.2;
        
        // Tail (bushy fox tail)
        const tailGeometry = new THREE.CylinderGeometry(0.15, 0.08, 0.7, 8); // Reduced from 0.2, 0.1, 0.8
        const tailMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
        const tail = new THREE.Mesh(tailGeometry, tailMaterial);
        tail.position.set(0, 0.2, -0.8);
        tail.rotation.x = Math.PI / 4; // Angle the tail up
        
        // Legs
        const legGeometry = new THREE.BoxGeometry(0.15, 0.4, 0.15); // Reduced from 0.2, 0.5, 0.2
        const legMaterial = new THREE.MeshPhongMaterial({ color: 0xff6600 });
        
        const legs = [];
        const legPositions = [
            [-0.3, -0.55, 0.4],
            [0.3, -0.55, 0.4],
            [-0.3, -0.55, -0.4],
            [0.3, -0.55, -0.4]
        ];
        
        legPositions.forEach(pos => {
            const leg = new THREE.Mesh(legGeometry, legMaterial);
            leg.position.set(...pos);
            legs.push(leg);
        });
        
        // White tip for tail
        const tailTipGeometry = new THREE.SphereGeometry(0.12, 8, 8); // Reduced from 0.15
        const tailTipMaterial = new THREE.MeshPhongMaterial({ color: 0xffffff });
        const tailTip = new THREE.Mesh(tailTipGeometry, tailTipMaterial);
        tailTip.position.set(0, 0.6, -1.0);
        
        // Assemble the fox
        geometry.add(body);
        geometry.add(head);
        geometry.add(earLeft);
        geometry.add(earRight);
        geometry.add(tail);
        geometry.add(tailTip);
        legs.forEach(leg => geometry.add(leg));
        
        this.model = geometry;
        this.model.scale.set(0.1, 0.1, 0.1); // Reduced scale to match the new fox model size
        this.game.scene.add(this.model);
    }
    
    spawn(position) {
        if (!this.isLoaded) {
            this.pendingSpawnPosition = position;
            return;
        }

        if (this.model && this.game.maze) {
            // Reset state
            this.isMoving = false;
            this.targetPosition = null;
            this.currentPath = [];
            this.isCelebrating = false;
            
            // Set initial position and rotation
            this.model.position.copy(position);
            this.model.position.y = 0;
            this.model.rotation.y = Math.PI; // Face the maze
            
            // Start maze navigation immediately
            this.startMazeNavigation();
        }
    }
    
    startMazeNavigation() {
        const maze = this.game.maze;
        if (!maze || !maze.grid) return;
        
        // Get the current cell
        const currentCell = this.getCurrentCell();
        if (!currentCell) return;
        
        // Find path to one of the exits randomly
        const leftExitX = Math.floor(maze.width * 0.25);
        const rightExitX = Math.floor(maze.width * 0.75);
        
        // Add exploration phase before heading to exit
        if (Math.random() < 0.7) { // 70% chance to explore first
            // Choose a random intermediate point in the maze
            const intermediateX = Math.floor(Math.random() * (maze.width - 4)) + 2;
            const intermediateY = Math.floor(Math.random() * (maze.height - 4)) + 2;
            
            let explorationPath = this.aStarSearch(currentCell, { x: intermediateX, y: intermediateY });
            
            if (explorationPath && explorationPath.length > 0) {
                // After reaching the intermediate point, then find path to exit
                const useLeftExit = Math.random() < 0.5;
                const finalPath = useLeftExit ? 
                    this.aStarSearch({ x: intermediateX, y: intermediateY }, { x: leftExitX, y: 0 }) :
                    this.aStarSearch({ x: intermediateX, y: intermediateY }, { x: rightExitX, y: 0 });
                
                if (finalPath && finalPath.length > 0) {
                    // Combine exploration path with final path
                    explorationPath = explorationPath.concat(finalPath.slice(1));
                }
                
                this.convertPathToWorldCoordinates(explorationPath);
                this.isMoving = true;
                this.nextPathPoint();
                return;
            }
        }
        
        // If exploration fails or random chance doesn't trigger, use direct path
        const useLeftExit = Math.random() < 0.5;
        let path = null;
        
        if (useLeftExit) {
            path = this.aStarSearch(currentCell, { x: leftExitX, y: 0 });
            if (!path || path.length === 0) {
                path = this.aStarSearch(currentCell, { x: rightExitX, y: 0 });
            }
        } else {
            path = this.aStarSearch(currentCell, { x: rightExitX, y: 0 });
            if (!path || path.length === 0) {
                path = this.aStarSearch(currentCell, { x: leftExitX, y: 0 });
            }
        }
        
        if (path && path.length > 0) {
            this.convertPathToWorldCoordinates(path);
            this.isMoving = true;
            this.nextPathPoint();
        }
    }

    convertPathToWorldCoordinates(path) {
        const maze = this.game.maze;
        const mazeWidth = (maze.width - 2) * maze.cellSize;
        const mazeHeight = (maze.height - 2) * maze.cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;
        
        this.currentPath = path.map(cell => {
            const worldX = ((cell.x - 1) * maze.cellSize) - halfWidth + (maze.cellSize / 2);
            const worldZ = ((cell.y - 1) * maze.cellSize) - halfHeight + (maze.cellSize / 2);
            return new THREE.Vector3(worldX, 0, worldZ);
        });
    }
    
    isBlockedCell(cell) {
        const maze = this.game.maze;
        if (!maze || !maze.grid || !maze.grid[cell.y] || !maze.grid[cell.y][cell.x]) {
            return true;
        }

        const currentCell = maze.grid[cell.y][cell.x];
        // A cell is blocked if it has too many walls (more than 2 walls usually means it's not part of the path)
        const wallCount = currentCell.walls.filter(wall => wall).length;
        return wallCount > 2;
    }

    findNearestValidCell(startCell) {
        const maze = this.game.maze;
        const maxDistance = 3; // Maximum distance to search for valid cell
        
        // Search in expanding squares around the start cell
        for (let d = 0; d <= maxDistance; d++) {
            for (let dy = -d; dy <= d; dy++) {
                for (let dx = -d; dx <= d; dx++) {
                    if (Math.abs(dx) === d || Math.abs(dy) === d) { // Only check cells on the perimeter
                        const newCell = {
                            x: startCell.x + dx,
                            y: startCell.y + dy
                        };
                        
                        if (this.isValidCell(newCell.x, newCell.y) && !this.isBlockedCell(newCell)) {
                            return newCell;
                        }
                    }
                }
            }
        }
        
        return null;
    }
    
    update(deltaTime) {
        if (!this.isLoaded || !this.model) return;

        // Update animation mixer if it exists
        if (this.mixer) {
            this.mixer.update(deltaTime);
        }

        // Handle celebration
        if (this.isCelebrating) {
            this.celebrationTime += deltaTime;
            
            // Calculate celebration progress (0 to 1)
            const progress = this.celebrationTime / this.celebrationDuration;
            
            // Smooth rotation during celebration using sine wave
            const rotationAngle = this.initialRotation + 
                                (Math.PI * 2 * this.celebrationSpins) * 
                                Math.sin(progress * Math.PI / 2);
            
            this.model.rotation.y = rotationAngle;
            
            // End celebration after duration
            if (this.celebrationTime >= this.celebrationDuration) {
                console.log("Celebration complete");
                this.isCelebrating = false;
                this.celebrationTime = 0;
                this.model.rotation.y = Math.PI; // Reset to default rotation
            }
            
            // Play celebration animation if available, otherwise idle
            this.playAnimation('Survey');
            return;
        }

        // Handle movement
        if (this.isMoving && this.targetPosition && !this.isCelebrating) {
            // Calculate direction to target
            const direction = new THREE.Vector3()
                .subVectors(this.targetPosition, this.model.position)
                .normalize();

            // Move towards target
            const moveDistance = this.moveSpeed * deltaTime;
            const movement = direction.multiplyScalar(moveDistance);
            
            // Calculate next position
            const nextPosition = this.model.position.clone().add(movement);
            
            // Check for wall collision at the next position
            if (!this.checkCollision(nextPosition)) {
                // Only update position if there's no collision
                this.model.position.copy(nextPosition);

                // Calculate target rotation (angle to face movement direction)
                this.targetRotation = Math.atan2(direction.x, direction.z);
                
                // Smoothly interpolate current rotation to target rotation
                const currentRotation = this.model.rotation.y;
                let rotationDiff = this.targetRotation - currentRotation;
                
                // Normalize rotation difference
                rotationDiff = this.normalizeAngle(rotationDiff);
                
                // Apply smooth rotation
                this.model.rotation.y = currentRotation + (rotationDiff * this.rotationLerpFactor);

                // Check if we've reached the target
                const distanceToTarget = this.model.position.distanceTo(this.targetPosition);
                if (distanceToTarget < 0.2) {
                    this.nextPathPoint();
                }

                // Check if we've reached a goal
                this.checkGoalCollision();

                // Play walk animation
                this.playAnimation('walk');
            } else {
                // If we hit a wall, try to recover
                this.recoverFromStuck();
            }

            // Stuck detection
            this.stuckTimeout += deltaTime;
            if (this.stuckTimeout >= this.stuckCheckInterval) {
                this.stuckTimeout = 0;
                
                const currentPos = this.model.position.clone();
                if (this.lastPosition) {
                    const distance = currentPos.distanceTo(this.lastPosition);
                    if (distance < this.stuckThreshold) {
                        this.stuckTime += this.stuckCheckInterval;
                        if (this.stuckTime >= this.maxStuckTime) {
                            this.recoverFromStuck();
                            this.stuckTime = 0;
                        }
                    } else {
                        this.stuckTime = 0;
                    }
                }
                this.lastPosition = currentPos;
            }
        } else {
            // Play idle animation when not moving
            this.playAnimation('Survey');
        }
    }
    
    recoverFromStuck() {
        const maze = this.game.maze;
        if (!maze) return;

        // First try to find a clear path ahead with larger adjustments
        const currentPos = this.model.position.clone();
        const adjustments = [
            { x: 0, z: -0.3 },    // Forward (larger step)
            { x: 0.3, z: 0 },     // Right (larger step)
            { x: -0.3, z: 0 },    // Left (larger step)
            { x: 0, z: 0.3 },     // Back (larger step)
            { x: 0.3, z: -0.3 },  // Forward-Right diagonal
            { x: -0.3, z: -0.3 }, // Forward-Left diagonal
            { x: 0.3, z: 0.3 },   // Back-Right diagonal
            { x: -0.3, z: 0.3 }   // Back-Left diagonal
        ];

        // Try each adjustment
        for (const adj of adjustments) {
            const testPos = currentPos.clone();
            testPos.x += adj.x;
            testPos.z += adj.z;
            
            if (!this.checkCollision(testPos)) {
                // Found a valid position - move there
                this.model.position.copy(testPos);
                
                // Try to find a new path from this position
                const currentCell = this.getCurrentCell();
                if (currentCell) {
                    // Try to find path to current target or exit
                    const maze = this.game.maze;
                    const leftExitX = Math.floor(maze.width * 0.25);
                    const rightExitX = Math.floor(maze.width * 0.75);
                    
                    // Try both exits with increased path finding iterations
                    const leftPath = this.aStarSearch(currentCell, { x: leftExitX, y: 0 });
                    if (leftPath && leftPath.length > 0) {
                        this.convertPathToWorldCoordinates(leftPath);
                        this.nextPathPoint();
                        return;
                    }
                    
                    const rightPath = this.aStarSearch(currentCell, { x: rightExitX, y: 0 });
                    if (rightPath && rightPath.length > 0) {
                        this.convertPathToWorldCoordinates(rightPath);
                        this.nextPathPoint();
                        return;
                    }
                }
            }
        }

        // If still stuck, try to return to the nearest valid cell center
        const currentCell = this.getCurrentCell();
        if (currentCell) {
            const cellCenterX = ((currentCell.x - maze.width/2) * maze.cellSize);
            const cellCenterZ = ((currentCell.y - maze.height/2) * maze.cellSize);
            const centerPos = new THREE.Vector3(cellCenterX, 0, cellCenterZ);
            
            if (!this.checkCollision(centerPos)) {
                this.model.position.copy(centerPos);
                this.findNewPathFromCurrentPosition();
            }
        }
    }
    
    findNewPathFromCurrentPosition() {
        if (!this.targetPosition) return;
        
        const maze = this.game.maze;
        const currentCell = this.getCurrentCell();
        if (!currentCell) return;
        
        // Convert target position to cell coordinates
        const cellSize = maze.cellSize;
        const mazeWidth = (maze.width - 2) * cellSize;
        const mazeHeight = (maze.height - 2) * cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;
        
        const targetX = Math.floor(((this.targetPosition.x + halfWidth) / cellSize)) + 1;
        const targetY = Math.floor(((this.targetPosition.z + halfHeight) / cellSize)) + 1;
        
        // Try to find a new path to the target
        const newPath = this.aStarSearch(currentCell, { x: targetX, y: targetY });
        if (newPath && newPath.length > 0) {
            this.convertPathToWorldCoordinates(newPath);
            this.nextPathPoint();
        }
    }
    
    aStarSearch(start, goal) {
        const openSet = [start];
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();
        
        const getKey = (cell) => `${cell.x},${cell.y}`;
        
        gScore.set(getKey(start), 0);
        fScore.set(getKey(start), this.heuristic(start, goal));
        
        while (openSet.length > 0) {
            const current = this.getLowestFScore(openSet, fScore);
            
            if (current.x === goal.x && current.y === goal.y) {
                return this.reconstructPath(cameFrom, current);
            }
            
            openSet.splice(openSet.indexOf(current), 1);
            
            // Get neighbors with randomized priorities
            const neighbors = this.getValidNeighbors(current);
            // Randomly shuffle neighbors
            this.shuffleArray(neighbors);
            
            for (const neighbor of neighbors) {
                // Add small random cost to encourage path variation
                const randomCost = Math.random() * 0.2; // Small random cost
                const tentativeGScore = gScore.get(getKey(current)) + 1 + randomCost;
                
                if (!gScore.has(getKey(neighbor)) || tentativeGScore < gScore.get(getKey(neighbor))) {
                    cameFrom.set(getKey(neighbor), current);
                    gScore.set(getKey(neighbor), tentativeGScore);
                    const h = this.heuristic(neighbor, goal) + (Math.random() * 0.1); // Add small random factor to heuristic
                    fScore.set(getKey(neighbor), tentativeGScore + h);
                    
                    if (!openSet.find(cell => cell.x === neighbor.x && cell.y === neighbor.y)) {
                        openSet.push(neighbor);
                    }
                }
            }
        }
        
        return null; // No path found
    }
    
    // Improved heuristic with random factor
    heuristic(a, b) {
        const dx = Math.abs(a.x - b.x);
        const dy = Math.abs(a.y - b.y);
        // Add larger random variation to encourage exploration
        const randomFactor = Math.random() * 0.4; // Increased from 0.2
        const verticalWeight = 1.2 + (Math.random() * 0.8); // Increased variation
        return (dx + (dy * verticalWeight)) * (1 + randomFactor);
    }
    
    getLowestFScore(openSet, fScore) {
        return openSet.reduce((lowest, cell) => {
            const key = `${cell.x},${cell.y}`;
            if (!lowest || fScore.get(key) < fScore.get(`${lowest.x},${lowest.y}`)) {
                return cell;
            }
            return lowest;
        });
    }
    
    getValidNeighbors(cell) {
        const maze = this.game.maze;
        if (!maze || !maze.grid || !maze.grid[cell.y] || !maze.grid[cell.y][cell.x]) {
            return [];
        }

        const neighbors = [];
        // Randomize direction priorities
        const directions = [
            { dx: 0, dy: -1, wall: 0 }, // up
            { dx: 1, dy: 0, wall: 1 },  // right
            { dx: -1, dy: 0, wall: 3 }, // left
            { dx: 0, dy: 1, wall: 2 }   // down
        ];
        
        // Shuffle directions for randomness
        this.shuffleArray(directions);
        
        for (const dir of directions) {
            const newX = cell.x + dir.dx;
            const newY = cell.y + dir.dy;
            
            if (this.isValidCell(newX, newY)) {
                const currentCell = maze.grid[cell.y][cell.x];
                const neighborCell = maze.grid[newY][newX];
                
                if (!currentCell.walls[dir.wall]) {
                    const reciprocalWall = (dir.wall + 2) % 4;
                    if (!neighborCell.walls[reciprocalWall]) {
                        neighbors.push({ x: newX, y: newY });
                    }
                }
            }
        }
        
        return neighbors;
    }
    
    isValidCell(x, y) {
        const maze = this.game.maze;
        return x >= 0 && x < maze.width && y >= 0 && y < maze.height;
    }
    
    getCurrentCell() {
        const maze = this.game.maze;
        if (!maze || !this.model) return null;
        
        try {
            const cellSize = maze.cellSize;
            const mazeWidth = (maze.width - 2) * cellSize;
            const mazeHeight = (maze.height - 2) * cellSize;
            const halfWidth = mazeWidth / 2;
            const halfHeight = mazeHeight / 2;
            
            // More precise cell coordinate calculation with new coordinate system
            const x = Math.floor(((this.model.position.x + halfWidth) / cellSize)) + 1;
            const y = Math.floor(((this.model.position.z + halfHeight) / cellSize)) + 1;
            
            // Ensure we're within valid bounds
            if (x >= 0 && x < maze.width && y >= 0 && y < maze.height) {
                // Check if we're in a valid cell (not blocked by walls)
                if (!this.isBlockedCell({ x, y })) {
                    return { x, y };
                }
                
                // If current cell is blocked, find nearest valid cell
                const nearestValidCell = this.findNearestValidCell({ x, y });
                if (nearestValidCell) {
                    return nearestValidCell;
                }
            }
            
            // If we're outside the maze or can't find a valid cell, return a default starting cell
            return { x: Math.floor(maze.width/2), y: maze.height - 2 };
        } catch (error) {
            console.error('Error getting current cell:', error);
            return null;
        }
    }
    
    reconstructPath(cameFrom, current) {
        const path = [current];
        const getKey = (cell) => `${cell.x},${cell.y}`;
        
        while (cameFrom.has(getKey(current))) {
            current = cameFrom.get(getKey(current));
            path.unshift(current);
        }
        
        return path;
    }
    
    nextPathPoint() {
        if (!this.currentPath || this.currentPath.length === 0) {
            const maze = this.game.maze;
            if (maze) {
                const currentCell = this.getCurrentCell();
                // Check if we're at a valid exit position
                if (currentCell && currentCell.y <= 1 && 
                    (Math.abs(currentCell.x - Math.floor(maze.width * 0.25)) <= 1 || 
                     Math.abs(currentCell.x - Math.floor(maze.width * 0.75)) <= 1)) {
                    this.isMoving = false;
                    this.targetPosition = null;
                    this.startCelebration();
                } else {
                    // If we're not at an exit, we might be stuck
                    this.findNewPathFromCurrentPosition();
                }
            }
            return;
        }

        // Get next point and remove it from path
        this.targetPosition = this.currentPath.shift();
        this.isMoving = true;
    }
    
    lerpAngle(start, end, t) {
        // Interpolate between angles
        const diff = end - start;
        let angle = start + diff * t;
        
        // Normalize angle
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        
        return angle;
    }
    
    checkCollision(position) {
        const maze = this.game.maze;
        if (!maze) return false;

        const collisionMargin = 0.2;  // Increased from 0.15 for larger cells
        const outerMargin = 0.2;      // Increased from 0.15 for larger cells

        // Calculate maze dimensions
        const mazeWidth = (maze.width - 2) * maze.cellSize;
        const mazeHeight = (maze.height - 2) * maze.cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;

        // Special case for entry area and exit areas
        if (position.z >= halfHeight - maze.cellSize || 
            (position.z <= -halfHeight + maze.cellSize && 
             (Math.abs(position.x - ((Math.floor(maze.width * 0.25) - maze.width/2) * maze.cellSize)) < maze.cellSize ||
              Math.abs(position.x - ((Math.floor(maze.width * 0.75) - maze.width/2) * maze.cellSize)) < maze.cellSize))) {
            // Allow free movement in entry and exit areas
            return false;
        }

        // Check outer bounds
        if (position.x < -halfWidth - outerMargin || 
            position.x > halfWidth + outerMargin || 
            position.z < -halfHeight - outerMargin || 
            position.z > halfHeight + outerMargin) {
            return true;
        }

        // Get the cell coordinates
        const cellX = Math.floor(((position.x + halfWidth) / maze.cellSize)) + 1;
        const cellY = Math.floor(((position.z + halfHeight) / maze.cellSize)) + 1;
        
        // Check if position is outside the maze bounds
        if (cellX < 0 || cellX >= maze.width || cellY < 0 || cellY >= maze.height) {
            return true;
        }

        // Get local position within the cell
        const localX = (position.x + halfWidth - ((cellX - 1) * maze.cellSize)) / maze.cellSize;
        const localZ = (position.z + halfHeight - ((cellY - 1) * maze.cellSize)) / maze.cellSize;
        
        // Get the current cell
        const cell = maze.grid[cellY][cellX];
        if (!cell || !cell.walls) return true;

        // Check walls with reduced collision margins near exits
        const isNearExit = cellY <= 1;
        const exitCollisionMargin = isNearExit ? 0.1 : collisionMargin;

        if (cell.walls[0] && localZ < exitCollisionMargin) return true; // Top wall
        if (cell.walls[1] && localX > (1 - exitCollisionMargin)) return true; // Right wall
        if (cell.walls[2] && localZ > (1 - exitCollisionMargin)) return true; // Bottom wall
        if (cell.walls[3] && localX < exitCollisionMargin) return true; // Left wall
        
        return false;
    }
    
    // Helper function to normalize angle between -PI and PI
    normalizeAngle(angle) {
        while (angle > Math.PI) angle -= Math.PI * 2;
        while (angle < -Math.PI) angle += Math.PI * 2;
        return angle;
    }

    // Helper function for linear interpolation
    lerp(start, end, t) {
        return start + (end - start) * t;
    }

    playAnimation(primaryAnim, fallbackAnim = null) {
        if (!this.mixer) return;

        // Map animation names to fox animations
        const animationMap = {
            'idle': 'Survey',
            'walk': 'Walk',
            'celebration': 'Survey'
        };

        // Get the mapped animation name
        const mappedAnim = animationMap[primaryAnim] || primaryAnim;
        const mappedFallback = fallbackAnim ? (animationMap[fallbackAnim] || fallbackAnim) : null;

        const animToPlay = this.animations[mappedAnim] ? mappedAnim : mappedFallback;
        if (!animToPlay || !this.animations[animToPlay]) return;

        const newAnim = this.animations[animToPlay];
        
        // If it's the same animation that's currently playing, don't restart it
        if (this.currentAnimation === newAnim.action) {
            return;
        }

        // If there's a current animation, transition from it
        if (this.currentAnimation) {
            this.currentAnimation.fadeOut(this.animationTransitionDuration);
        }

        // Play the new animation
        newAnim.action.reset()
            .setEffectiveTimeScale(1)
            .setEffectiveWeight(1)
            .fadeIn(this.animationTransitionDuration)
            .play();

        this.currentAnimation = newAnim.action;
    }

    isAtCellCenter(cell) {
        if (!cell || !this.model || !this.game.maze) return false;
        
        try {
            const cellSize = this.game.maze.cellSize;
            const centerX = (cell.x - this.game.maze.width/2) * cellSize;
            const centerZ = (cell.y - this.game.maze.height/2) * cellSize;
            
            const distanceToCenter = new THREE.Vector2(
                this.model.position.x - centerX,
                this.model.position.z - centerZ
            ).length();
            
            return distanceToCenter < 0.05; // Increased from 0.03 for larger scale
        } catch (error) {
            console.error('Error checking cell center:', error);
            return false;
        }
    }

    findValidPosition(position) {
        // Try adjustments in cardinal directions with increased step size
        const adjustmentStep = 0.15; // Increased from 0.1 for larger cells
        const adjustments = [
            { x: 0, z: -adjustmentStep },  // Forward (higher priority)
            { x: adjustmentStep, z: 0 },   // Right
            { x: -adjustmentStep, z: 0 },  // Left
            { x: 0, z: adjustmentStep }    // Back
        ];

        // Try to maintain grid alignment
        const cellSize = this.game.maze.cellSize;
        const currentCell = this.getCurrentCell();
        
        if (currentCell) {
            const centerX = (currentCell.x - this.game.maze.width/2) * cellSize;
            const centerZ = (currentCell.y - this.game.maze.height/2) * cellSize;
            
            // Try snapping to cell center first
            const centerPosition = position.clone();
            centerPosition.x = centerX;
            centerPosition.z = centerZ;
            
            if (!this.checkCollision(centerPosition)) {
                return centerPosition;
            }
            
            // If can't snap to center, try adjustments
            for (const adj of adjustments) {
                const adjustedPosition = position.clone();
                adjustedPosition.x += adj.x;
                adjustedPosition.z += adj.z;
                
                if (!this.checkCollision(adjustedPosition)) {
                    return adjustedPosition;
                }
                
                // Try diagonal movements as well
                for (const adj2 of adjustments) {
                    if (adj2.x !== -adj.x && adj2.z !== -adj.z) { // Don't try opposite directions
                        const diagonalPosition = adjustedPosition.clone();
                        diagonalPosition.x += adj2.x;
                        diagonalPosition.z += adj2.z;
                        
                        if (!this.checkCollision(diagonalPosition)) {
                            return diagonalPosition;
                        }
                    }
                }
            }
        }
        
        return null;
    }

    findNextCellInPath() {
        if (!this.currentPath || this.currentPath.length === 0) return null;
        
        const maze = this.game.maze;
        const cellSize = maze.cellSize;
        const nextPoint = this.currentPath[0];
        
        return {
            x: Math.round((nextPoint.x / cellSize) + maze.width/2),
            y: Math.round((nextPoint.z / cellSize) + maze.height/2)
        };
    }

    startCelebration() {
        if (!this.isCelebrating) {
            console.log("Starting celebration animation");
            this.isCelebrating = true;
            this.celebrationTime = 0;
            this.isMoving = false;
            this.targetPosition = null;
            this.currentPath = [];
            
            // Store initial rotation for celebration
            this.initialRotation = this.model.rotation.y;
            
            // Play celebration animation if available, otherwise idle
            this.playAnimation('Survey');
        }
    }

    checkGoalCollision() {
        if (!this.game.maze) return;

        const maze = this.game.maze;
        const mazeWidth = (maze.width - 2) * maze.cellSize;
        const mazeHeight = (maze.height - 2) * maze.cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;

        // Get current position in maze coordinates
        const currentCell = this.getCurrentCell();
        if (!currentCell) return;

        // Get exact position for more precise detection
        const position = this.model.position;
        
        // Calculate exact positions of exits in world coordinates
        const leftExitX = Math.floor(maze.width * 0.25);
        const rightExitX = Math.floor(maze.width * 0.75);
        
        const leftExitWorldX = ((leftExitX - maze.width/2) * maze.cellSize);
        const rightExitWorldX = ((rightExitX - maze.width/2) * maze.cellSize);
        const exitWorldZ = -halfHeight; // Top of maze

        // Define collision thresholds
        const horizontalThreshold = maze.cellSize * 0.75; // More forgiving horizontal threshold
        const verticalThreshold = maze.cellSize * 0.5;   // Stricter vertical threshold

        // Check if we're near the top of the maze
        if (position.z <= exitWorldZ + verticalThreshold) {
            // Check distance to either exit
            const distanceToLeftExit = Math.abs(position.x - leftExitWorldX);
            const distanceToRightExit = Math.abs(position.x - rightExitWorldX);

            if (distanceToLeftExit <= horizontalThreshold || 
                distanceToRightExit <= horizontalThreshold) {
                
                // Double check we're in a valid exit cell
                if (currentCell.y <= 1 && 
                    (Math.abs(currentCell.x - leftExitX) <= 1 || 
                     Math.abs(currentCell.x - rightExitX) <= 1)) {
                    
                    console.log("Goal reached! Starting celebration...");
                    // Stop movement and start celebration
                    this.isMoving = false;
                    this.targetPosition = null;
                    this.currentPath = [];
                    
                    // Determine which exit was reached and show the corresponding option
                    const isLeftExit = Math.abs(currentCell.x - leftExitX) <= 1;
                    const chosenOption = isLeftExit ? this.game.maze.option1 : this.game.maze.option2;
                    
                    // Start celebration and show result after a short delay
                    this.startCelebration();
                    setTimeout(() => {
                        this.game.ui.showResult(chosenOption);
                    }, 1000); // Show result after 1 second
                }
            }
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }
} 