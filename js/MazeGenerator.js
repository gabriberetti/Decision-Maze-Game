class MazeGenerator {
    constructor(width, height, game) {
        this.game = game;
        this.width = width;
        this.height = height;
        this.grid = [];
        this.walls = new THREE.Group();
        this.exits = new THREE.Group();
        
        // Adjust cell size to fit the perimeter exactly
        this.cellSize = 2.4;
        this.wallHeight = 2.0;
        
        // Start with basic materials
        this.wallMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x808080,
            specular: 0x111111,
            shininess: 10
        });
        
        this.floorMaterial = new THREE.MeshBasicMaterial({
            color: 0x854836,
            side: THREE.DoubleSide
        });
        
        // Load textures asynchronously
        this.loadTextures();
        
        // Initialize grid
        for (let i = 0; i < height; i++) {
            this.grid[i] = [];
            for (let j = 0; j < width; j++) {
                this.grid[i][j] = {
                    visited: false,
                    walls: [true, true, true, true],
                    isPath: false
                };
            }
        }
    }
    
    loadTextures() {
        const textureLoader = new THREE.TextureLoader();
        
        // Function to handle texture loading
        const loadTexture = (path) => {
            return new Promise((resolve, reject) => {
                textureLoader.load(
                    path,
                    (texture) => {
                        console.log('Texture loaded successfully:', path);
                        texture.encoding = THREE.sRGBEncoding;
                        resolve(texture);
                    },
                    undefined,
                    (error) => {
                        console.error('Error loading texture:', path, error);
                        reject(error);
                    }
                );
            });
        };
        
        // Load all textures with paths relative to the HTML file
        Promise.all([
            loadTexture('textures/Stone-carved_style_exterior_tiles/1024%20Texture/010_basecolor_1024_.png'),
            loadTexture('textures/Stone-carved_style_exterior_tiles/1024%20Texture/010_normal_1024_.png')
        ]).then(([baseTexture, normalTexture]) => {
            // Configure textures
            [baseTexture, normalTexture].forEach(texture => {
                texture.wrapS = THREE.RepeatWrapping;
                texture.wrapT = THREE.RepeatWrapping;
                texture.repeat.set(2, 1); // Adjust repeat for better wall coverage
            });
            
            // Update wall material with textures
            this.wallMaterial = new THREE.MeshStandardMaterial({
                map: baseTexture,
                normalMap: normalTexture,
                roughness: 0.7,
                metalness: 0.0,
                side: THREE.DoubleSide,
                normalScale: new THREE.Vector2(1, 1),
                envMapIntensity: 1.0
            });
            
            // Create a separate floor material with different settings
            this.floorMaterial = new THREE.MeshBasicMaterial({
                color: 0x854836,
                side: THREE.DoubleSide
            });
            
            // Update all existing meshes with new material
            this.walls.traverse((child) => {
                if (child.isMesh) {
                    // Only update wall materials, not floor
                    if (child.rotation.x === 0) { // Walls are vertical (not rotated like the floor)
                        child.material = this.wallMaterial;
                    }
                }
            });
            
            console.log('Materials updated with textures');
        }).catch(error => {
            console.error('Failed to load textures:', error);
            // Keep using the basic material if textures fail to load
        });
    }

    generate() {
        // Clear existing maze
        if (this.walls.parent) {
            this.game.scene.remove(this.walls);
        }
        this.walls.clear();
        this.exits.clear();
        
        // Initialize all cells with walls
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.grid[y][x] = {
                    visited: false,
                    walls: [true, true, true, true],
                    isPath: false
                };
            }
        }
        
        // Create multiple starting points to ensure better coverage
        const startPoints = [
            { x: Math.floor(this.width / 2), y: this.height - 1 },  // Bottom center
            { x: 0, y: 0 },                                         // Top left
            { x: this.width - 1, y: 0 },                           // Top right
            { x: 0, y: this.height - 1 },                          // Bottom left
            { x: this.width - 1, y: this.height - 1 }              // Bottom right
        ];
        
        // Generate maze from each starting point
        for (const start of startPoints) {
            if (!this.grid[start.y][start.x].visited) {
                this.recursiveBacktrackWithBias(start.x, start.y);
            }
        }
        
        // Create paths to exits
        this.createExitPaths();
        
        // Add blocking walls near perimeter to prevent wall following
        this.addPerimeterBlockers();
        
        // Create a safe starting area
        this.createStartingArea();
        
        // Validate and fix wall consistency
        this.validateWallConsistency();
        
        // Create the physical walls
        this.createWalls();
        this.createFloor();
        
        // Add the walls group to the scene
        this.game.scene.add(this.walls);
        
        return this.walls;
    }

    validateWallConsistency() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Check right wall consistency
                if (x < this.width - 1) {
                    const rightWall = this.grid[y][x].walls[1];
                    const neighborLeftWall = this.grid[y][x + 1].walls[3];
                    if (rightWall !== neighborLeftWall) {
                        // Synchronize walls (prefer wall existence for consistency)
                        this.grid[y][x].walls[1] = true;
                        this.grid[y][x + 1].walls[3] = true;
                    }
                }
                
                // Check bottom wall consistency
                if (y < this.height - 1) {
                    const bottomWall = this.grid[y][x].walls[2];
                    const neighborTopWall = this.grid[y + 1][x].walls[0];
                    if (bottomWall !== neighborTopWall) {
                        // Synchronize walls (prefer wall existence for consistency)
                        this.grid[y][x].walls[2] = true;
                        this.grid[y + 1][x].walls[0] = true;
                    }
                }
            }
        }
    }

    setWallsBetweenCells(x1, y1, x2, y2, hasWall) {
        // Helper function to consistently set walls between two adjacent cells
        if (x2 === x1 + 1) { // Right neighbor
            this.grid[y1][x1].walls[1] = hasWall;
            this.grid[y2][x2].walls[3] = hasWall;
        } else if (x2 === x1 - 1) { // Left neighbor
            this.grid[y1][x1].walls[3] = hasWall;
            this.grid[y2][x2].walls[1] = hasWall;
        } else if (y2 === y1 + 1) { // Bottom neighbor
            this.grid[y1][x1].walls[2] = hasWall;
            this.grid[y2][x2].walls[0] = hasWall;
        } else if (y2 === y1 - 1) { // Top neighbor
            this.grid[y1][x1].walls[0] = hasWall;
            this.grid[y2][x2].walls[2] = hasWall;
        }
    }

    recursiveBacktrackWithBias(x, y) {
        this.grid[y][x].visited = true;
        
        // Define directions with reduced bias
        let directions = [
            [0, -1], // up
            [1, 0],  // right
            [-1, 0], // left
            [0, 1]   // down
        ];
        
        // Calculate position-based weights with reduced influence
        const verticalProgress = y / this.height;
        const horizontalProgress = x / this.width;
        
        // Reduce upward bias significantly
        if (y > 0) {
            if (Math.random() < 0.15 + (verticalProgress * 0.2)) {
                directions = [[0, -1], ...directions.slice(1)];
            }
        }
        
        // Reduce horizontal bias
        if (horizontalProgress < 0.4) {
            if (Math.random() < 0.3) {
                directions = [directions[0], [1, 0], ...directions.slice(2)];
            }
        } else if (horizontalProgress > 0.6) {
            if (Math.random() < 0.3) {
                directions = [directions[0], [-1, 0], ...directions.slice(2)];
            }
        }
        
        // Increase random branching significantly
        if (Math.random() < 0.6) {
            this.shuffleArray(directions);
        }
        
        // Add backtracking chance for more complexity
        if (Math.random() < 0.2) {
            const backtrackDirections = [...directions];
            this.shuffleArray(backtrackDirections);
            
            for (const [dx, dy] of backtrackDirections) {
                const newX = x + dx;
                const newY = y + dy;
                
                if (this.isValidCell(newX, newY) && this.grid[newY][newX].visited) {
                    this.setWallsBetweenCells(x, y, newX, newY, false);
                    break;
                }
            }
        }
        
        // Normal path generation with increased randomness
        for (const [dx, dy] of directions) {
            const newX = x + dx;
            const newY = y + dy;
            
            if (this.isValidCell(newX, newY) && !this.grid[newY][newX].visited) {
                this.setWallsBetweenCells(x, y, newX, newY, false);
                this.recursiveBacktrackWithBias(newX, newY);
            }
        }
    }

    createWalls() {
        // Create outer walls first
        const outerWallThickness = 0.2;
        const entryWidth = this.cellSize * 2; // Define entry width for the maze entrance
        
        // Calculate maze dimensions (excluding outer walls)
        const mazeWidth = (this.width - 2) * this.cellSize;
        const mazeHeight = (this.height - 2) * this.cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;

        // Function to create wall geometry with proper UVs
        const createWallGeometry = (width, height, depth) => {
            const geometry = new THREE.BoxGeometry(width, height, depth);
            geometry.attributes.uv2 = geometry.attributes.uv; // For aoMap
            return geometry;
        };

        // Create the perimeter walls as a single group
        const perimeterGroup = new THREE.Group();

        // Create four corner posts
        const cornerGeometry = createWallGeometry(
            outerWallThickness,
            this.wallHeight,
            outerWallThickness
        );

        const corners = [
            { x: -halfWidth, z: -halfHeight },
            { x: halfWidth, z: -halfHeight },
            { x: -halfWidth, z: halfHeight },
            { x: halfWidth, z: halfHeight }
        ];

        corners.forEach(pos => {
            const corner = new THREE.Mesh(cornerGeometry, this.wallMaterial);
            corner.position.set(pos.x, this.wallHeight/2, pos.z);
            perimeterGroup.add(corner);
        });

        // Create the side walls
        const verticalWallGeometry = createWallGeometry(
            outerWallThickness,
            this.wallHeight,
            mazeHeight
        );

        // Left wall
        const leftWall = new THREE.Mesh(verticalWallGeometry, this.wallMaterial);
        leftWall.position.set(-halfWidth, this.wallHeight/2, 0);
        perimeterGroup.add(leftWall);

        // Right wall
        const rightWall = new THREE.Mesh(verticalWallGeometry, this.wallMaterial);
        rightWall.position.set(halfWidth, this.wallHeight/2, 0);
        perimeterGroup.add(rightWall);

        // Create two segments for the bottom wall (left and right of entry)
        // Left segment
        const leftSegment = new THREE.Mesh(
            createWallGeometry(
                (halfWidth - entryWidth/2),
                this.wallHeight,
                outerWallThickness
            ),
            this.wallMaterial
        );
        leftSegment.position.set(
            -halfWidth + (halfWidth - entryWidth/2)/2,
            this.wallHeight/2,
            halfHeight
        );
        perimeterGroup.add(leftSegment);

        // Right segment
        const rightSegment = new THREE.Mesh(
            createWallGeometry(
                (halfWidth - entryWidth/2),
                this.wallHeight,
                outerWallThickness
            ),
            this.wallMaterial
        );
        rightSegment.position.set(
            halfWidth - (halfWidth - entryWidth/2)/2,
            this.wallHeight/2,
            halfHeight
        );
        perimeterGroup.add(rightSegment);

        this.walls.add(perimeterGroup);

        // Create internal walls
        for (let y = 0; y < this.height - 2; y++) {
            for (let x = 0; x < this.width - 2; x++) {
                const cell = this.grid[y + 1][x + 1];  // Offset by 1 to skip outer walls
                const posX = (-halfWidth + (x * this.cellSize));
                const posZ = (-halfHeight + (y * this.cellSize));

                // Create horizontal walls (top and bottom)
                if (cell.walls[0]) { // top wall
                    const wall = new THREE.Mesh(
                        createWallGeometry(this.cellSize, this.wallHeight, outerWallThickness),
                        this.wallMaterial
                    );
                    wall.position.set(posX + this.cellSize/2, this.wallHeight/2, posZ);
                    this.walls.add(wall);
                }

                if (cell.walls[2]) { // bottom wall
                    const wall = new THREE.Mesh(
                        createWallGeometry(this.cellSize, this.wallHeight, outerWallThickness),
                        this.wallMaterial
                    );
                    wall.position.set(posX + this.cellSize/2, this.wallHeight/2, posZ + this.cellSize);
                    this.walls.add(wall);
                }

                // Create vertical walls (left and right)
                if (cell.walls[1]) { // right wall
                    const wall = new THREE.Mesh(
                        createWallGeometry(outerWallThickness, this.wallHeight, this.cellSize),
                        this.wallMaterial
                    );
                    wall.position.set(posX + this.cellSize, this.wallHeight/2, posZ + this.cellSize/2);
                    this.walls.add(wall);
                }

                if (cell.walls[3]) { // left wall
                    const wall = new THREE.Mesh(
                        createWallGeometry(outerWallThickness, this.wallHeight, this.cellSize),
                        this.wallMaterial
                    );
                    wall.position.set(posX, this.wallHeight/2, posZ + this.cellSize/2);
                    this.walls.add(wall);
                }
            }
        }
    }

    addExits(option1, option2) {
        // Store the options
        this.option1 = option1;
        this.option2 = option2;
        
        // Calculate maze dimensions (excluding outer walls)
        const mazeWidth = (this.width - 2) * this.cellSize;
        const mazeHeight = (this.height - 2) * this.cellSize;
        const halfWidth = mazeWidth / 2;
        const halfHeight = mazeHeight / 2;

        // Calculate exit positions in grid coordinates
        const leftExitX = Math.floor(this.width * 0.25);
        const rightExitX = Math.floor(this.width * 0.75);
        
        // Convert to world coordinates
        const leftExitWorldX = (-halfWidth + ((leftExitX - 1) * this.cellSize));
        const rightExitWorldX = (-halfWidth + ((rightExitX - 1) * this.cellSize));
        const exitWorldZ = -halfHeight; // Top of maze
        
        // Add visual indicators for the exits (just the squares)
        const exitGeometry = new THREE.BoxGeometry(this.cellSize * 1.5, 0.1, this.cellSize * 1.5);
        const exitMaterial1 = new THREE.MeshPhongMaterial({ color: 0x00ff00, transparent: true, opacity: 0.5 });
        const exitMaterial2 = new THREE.MeshPhongMaterial({ color: 0xff0000, transparent: true, opacity: 0.5 });
        
        const exitMarker1 = new THREE.Mesh(exitGeometry, exitMaterial1);
        const exitMarker2 = new THREE.Mesh(exitGeometry, exitMaterial2);
        
        exitMarker1.position.set(leftExitWorldX + this.cellSize/2, 0.1, exitWorldZ);
        exitMarker2.position.set(rightExitWorldX + this.cellSize/2, 0.1, exitWorldZ);
        
        this.exits.add(exitMarker1);
        this.exits.add(exitMarker2);
        this.walls.add(this.exits);

        // Ensure exit paths are clear
        if (this.isValidCell(leftExitX, 0)) {
            this.grid[0][leftExitX].walls = [false, false, false, false];
            if (leftExitX > 0) this.grid[0][leftExitX - 1].walls[1] = false;
            if (leftExitX < this.width - 1) this.grid[0][leftExitX + 1].walls[3] = false;
            if (1 < this.height) this.grid[1][leftExitX].walls[0] = false;
        }
        
        if (this.isValidCell(rightExitX, 0)) {
            this.grid[0][rightExitX].walls = [false, false, false, false];
            if (rightExitX > 0) this.grid[0][rightExitX - 1].walls[1] = false;
            if (rightExitX < this.width - 1) this.grid[0][rightExitX + 1].walls[3] = false;
            if (1 < this.height) this.grid[1][rightExitX].walls[0] = false;
        }
    }

    createExitMarker(text, x, z) {
        const group = new THREE.Group();
        
        // Create the text canvas with reduced height
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = 512;
        canvas.height = 128; // Reduced height
        
        // Create colored background with higher opacity
        const isLeftOption = x < 0;
        context.fillStyle = isLeftOption ? '#008000' : '#800000'; // Darker, more visible colors
        context.globalAlpha = 0.9; // More opaque background
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add border
        context.strokeStyle = isLeftOption ? '#00ff00' : '#ff0000'; // Bright border
        context.lineWidth = 6;
        context.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);
        
        // Add text
        context.globalAlpha = 1.0;
        context.fillStyle = '#ffffff'; // White text for better contrast
        context.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, system-ui';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Add text shadow for better visibility
        context.shadowColor = 'rgba(0, 0, 0, 0.5)';
        context.shadowBlur = 8;
        context.shadowOffsetX = 2;
        context.shadowOffsetY = 2;
        context.fillText(text, canvas.width/2, canvas.height/2);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ 
                map: texture,
                transparent: true
            })
        );
        sprite.position.set(x, 2, z); // Raised height for better visibility
        sprite.scale.set(6, 2, 1); // Adjusted scale for more compact appearance
        
        group.add(sprite);
        return group;
    }

    getStartPosition() {
        // Calculate maze dimensions
        const mazeHeight = (this.height - 2) * this.cellSize;
        const halfHeight = mazeHeight / 2;
        
        // Position the animal at the center of the entry point
        return new THREE.Vector3(
            0,              // Center X
            0,              // Ground level
            halfHeight + this.cellSize // One cell outside the maze
        );
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    isValidCell(x, y) {
        return x >= 0 && x < this.width && y >= 0 && y < this.height;
    }

    createFloor() {
        // Calculate the exact maze size (excluding outer walls)
        const mazeWidth = (this.width - 2) * this.cellSize;  // Subtract 2 to exclude outer walls
        const mazeHeight = (this.height - 2) * this.cellSize;

        const floorGeometry = new THREE.PlaneGeometry(
            mazeWidth,
            mazeHeight
        );
        const floor = new THREE.Mesh(floorGeometry, this.floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        this.walls.add(floor);
    }

    widenMainPaths() {
        const leftExitX = Math.floor(this.width * 0.25);
        const rightExitX = Math.floor(this.width * 0.75);
        
        // Mark cells near exits as part of main path
        for (let y = 0; y < 3; y++) {
            if (this.isValidCell(leftExitX, y)) {
                this.grid[y][leftExitX].isPath = true;
                // Clear adjacent walls for wider path
                if (leftExitX > 0) {
                    this.grid[y][leftExitX].walls[3] = false;
                    this.grid[y][leftExitX - 1].walls[1] = false;
                }
                if (leftExitX < this.width - 1) {
                    this.grid[y][leftExitX].walls[1] = false;
                    this.grid[y][leftExitX + 1].walls[3] = false;
                }
            }
            
            if (this.isValidCell(rightExitX, y)) {
                this.grid[y][rightExitX].isPath = true;
                // Clear adjacent walls for wider path
                if (rightExitX > 0) {
                    this.grid[y][rightExitX].walls[3] = false;
                    this.grid[y][rightExitX - 1].walls[1] = false;
                }
                if (rightExitX < this.width - 1) {
                    this.grid[y][rightExitX].walls[1] = false;
                    this.grid[y][rightExitX + 1].walls[3] = false;
                }
            }
        }
    }

    createExitPaths() {
        const leftExitX = Math.floor(this.width * 0.25);
        const rightExitX = Math.floor(this.width * 0.75);
        
        // Create clear paths to both exits
        for (let y = 2; y >= 0; y--) {
            // Clear walls for the main paths
            if (this.isValidCell(leftExitX, y)) {
                this.grid[y][leftExitX].walls[0] = false;  // Remove top wall
                if (y < this.height - 1) {
                    this.grid[y + 1][leftExitX].walls[2] = false;  // Remove bottom wall
                }
            }
            
            if (this.isValidCell(rightExitX, y)) {
                this.grid[y][rightExitX].walls[0] = false;  // Remove top wall
                if (y < this.height - 1) {
                    this.grid[y + 1][rightExitX].walls[2] = false;  // Remove bottom wall
                }
            }
            
            // Create wider corridors while preserving outer walls
            if (leftExitX > 0 && leftExitX < this.width - 1) {
                // Clear side walls for left exit path
                this.grid[y][leftExitX].walls[3] = false;
                this.grid[y][leftExitX - 1].walls[1] = false;
                this.grid[y][leftExitX].walls[1] = false;
                this.grid[y][leftExitX + 1].walls[3] = false;
            }
            
            if (rightExitX > 0 && rightExitX < this.width - 1) {
                // Clear side walls for right exit path
                this.grid[y][rightExitX].walls[3] = false;
                this.grid[y][rightExitX - 1].walls[1] = false;
                this.grid[y][rightExitX].walls[1] = false;
                this.grid[y][rightExitX + 1].walls[3] = false;
            }
        }
        
        // Create a clear starting area while preserving outer walls
        const startX = Math.floor(this.width/2);
        for (let x = startX - 1; x <= startX + 1; x++) {
            if (x > 0 && x < this.width - 1) {
                this.grid[this.height-1][x].walls[2] = false;
                this.grid[this.height-1][x].walls[1] = false;
                this.grid[this.height-1][x].walls[3] = false;
                this.grid[this.height-1][x].isPath = true;
            }
        }
        
        // Ensure the exit cells and their neighbors are completely open
        if (this.isValidCell(leftExitX, 0)) {
            // Clear all walls for the left exit cell
            this.grid[0][leftExitX].walls = [false, false, false, false];
            this.grid[0][leftExitX].isPath = true;
            
            // Clear adjacent cells' walls
            if (leftExitX > 0) {
                this.grid[0][leftExitX - 1].walls[1] = false;
            }
            if (leftExitX < this.width - 1) {
                this.grid[0][leftExitX + 1].walls[3] = false;
            }
            if (1 < this.height) {
                this.grid[1][leftExitX].walls[0] = false;
            }
        }
        
        if (this.isValidCell(rightExitX, 0)) {
            // Clear all walls for the right exit cell
            this.grid[0][rightExitX].walls = [false, false, false, false];
            this.grid[0][rightExitX].isPath = true;
            
            // Clear adjacent cells' walls
            if (rightExitX > 0) {
                this.grid[0][rightExitX - 1].walls[1] = false;
            }
            if (rightExitX < this.width - 1) {
                this.grid[0][rightExitX + 1].walls[3] = false;
            }
            if (1 < this.height) {
                this.grid[1][rightExitX].walls[0] = false;
            }
        }
    }

    addPerimeterBlockers() {
        const leftExitX = Math.floor(this.width * 0.25);
        const rightExitX = Math.floor(this.width * 0.75);
        
        // Add blocking walls along the perimeter
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                // Skip exit areas
                if (y === 0 && (x === leftExitX || x === rightExitX)) {
                    continue;
                }
                
                // Add walls near the perimeter
                if (x === 0 || x === this.width - 1 || y === 0 || y === this.height - 1) {
                    // For left perimeter
                    if (x <= 1) {
                        this.grid[y][x].walls[1] = true; // Right wall
                        if (x + 1 < this.width) {
                            this.grid[y][x + 1].walls[3] = true; // Left wall of next cell
                        }
                    }
                    
                    // For right perimeter
                    if (x >= this.width - 2) {
                        this.grid[y][x].walls[3] = true; // Left wall
                        if (x > 0) {
                            this.grid[y][x - 1].walls[1] = true; // Right wall of previous cell
                        }
                    }
                    
                    // For top perimeter
                    if (y <= 1) {
                        this.grid[y][x].walls[2] = true; // Bottom wall
                        if (y + 1 < this.height) {
                            this.grid[y + 1][x].walls[0] = true; // Top wall of cell below
                        }
                    }
                    
                    // For bottom perimeter
                    if (y >= this.height - 2) {
                        this.grid[y][x].walls[0] = true; // Top wall
                        if (y > 0) {
                            this.grid[y - 1][x].walls[2] = true; // Bottom wall of cell above
                        }
                    }
                }
            }
        }
        
        // Ensure the exit paths are still accessible
        this.clearExitPaths(leftExitX, rightExitX);
    }

    clearExitPaths(leftExitX, rightExitX) {
        // Clear walls leading to exits
        for (let y = 0; y < 3; y++) {
            // Clear path to left exit
            if (this.isValidCell(leftExitX, y)) {
                this.grid[y][leftExitX].walls[0] = false;
                if (y < this.height - 1) {
                    this.grid[y + 1][leftExitX].walls[2] = false;
                }
            }
            
            // Clear path to right exit
            if (this.isValidCell(rightExitX, y)) {
                this.grid[y][rightExitX].walls[0] = false;
                if (y < this.height - 1) {
                    this.grid[y + 1][rightExitX].walls[2] = false;
                }
            }
        }
    }

    createStartingArea() {
        // Calculate the center entry point
        const entryX = Math.floor(this.width / 2);
        
        // Clear a 3x3 area for the entry
        for (let x = entryX - 1; x <= entryX + 1; x++) {
            for (let y = this.height - 3; y < this.height; y++) {
                if (this.isValidCell(x, y)) {
                    // Clear all walls for the entry cells
                    this.grid[y][x].walls = [false, false, false, false];
                    this.grid[y][x].isPath = true;
                    
                    // Clear walls of adjacent cells to ensure clean entry
                    if (x > 0) {
                        this.grid[y][x-1].walls[1] = false; // Clear right wall of left cell
                    }
                    if (x < this.width - 1) {
                        this.grid[y][x+1].walls[3] = false; // Clear left wall of right cell
                    }
                    if (y > 0) {
                        this.grid[y-1][x].walls[2] = false; // Clear bottom wall of cell above
                    }
                }
            }
        }
        
        // Create a funnel shape leading into the maze
        for (let y = this.height - 4; y < this.height - 2; y++) {
            if (this.isValidCell(entryX, y)) {
                // Clear the central path
                this.grid[y][entryX].walls = [false, false, false, false];
                this.grid[y][entryX].isPath = true;
                
                // Clear adjacent cells
                [-1, 1].forEach(offset => {
                    if (this.isValidCell(entryX + offset, y)) {
                        this.grid[y][entryX + offset].walls = [false, false, false, false];
                        this.grid[y][entryX + offset].isPath = true;
                    }
                });
            }
        }
    }
} 