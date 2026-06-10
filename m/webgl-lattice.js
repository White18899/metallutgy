/**
 * webgl-lattice.js
 * Renders interactive 3D crystal structures (BCC, FCC, HCP)
 * and animates crystal phase transformations using Three.js.
 */
(function() {
    // Wait until DOM and libraries load
    window.addEventListener('load', () => {
        initLatticeViewer();
    });

    function initLatticeViewer() {
        const container = document.getElementById('lattice-canvas-container');
        if (!container) return;

        // Clear loading screen
        container.innerHTML = '';

        // Scene Setup
        const scene = new THREE.Scene();
        
        // Camera Setup
        const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
        camera.position.set(0, 0, 6.5);

        // Renderer Setup
        const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        renderer.setSize(container.clientWidth, container.clientHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        container.appendChild(renderer.domElement);

        // Lighting
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        scene.add(ambientLight);

        const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight1.position.set(5, 5, 5);
        scene.add(dirLight1);

        const dirLight2 = new THREE.DirectionalLight(0x06b6d4, 0.5); // Electric cyan fill light
        dirLight2.position.set(-5, -5, -2);
        scene.add(dirLight2);

        // State variables
        let currentType = 'bcc'; // 'bcc', 'fcc', 'hcp'
        let targetType = 'bcc';
        let transitionProgress = 1.0; // 0.0 to 1.0
        const transitionSpeed = 0.025; // Speed of morphing LERP

        // Node definitions
        // We maintain a pool of 17 atoms (which is the max required for HCP structure)
        const totalAtomCount = 17;
        const atomsPool = [];
        
        // Check initial theme to set material colors
        const isInitialLight = document.body.classList.contains('light-theme');

        // Materials
        const atomMaterialIron = new THREE.MeshStandardMaterial({
            color: isInitialLight ? 0x94a3b8 : 0x1e3a8a, // Steel Gray in light mode, Navy Blue in dark mode
            metalness: 0.8,
            roughness: 0.1,
            emissive: isInitialLight ? 0x334155 : 0x082f49,
            emissiveIntensity: 0.3
        });

        const atomMaterialCarbon = new THREE.MeshStandardMaterial({
            color: 0xf97316, // Glowing Copper/Orange for alloy/carbon solute atoms
            metalness: 0.9,
            roughness: 0.1,
            emissive: isInitialLight ? 0x9a3412 : 0xea580c,
            emissiveIntensity: 0.45
        });

        // Create Sphere Geometry for Atom representation
        const sphereGeo = new THREE.SphereGeometry(0.24, 32, 32);

        for (let i = 0; i < totalAtomCount; i++) {
            // Select material: make center atom color different or let all be orange
            const mat = (i === 8 || i >= 14) ? atomMaterialCarbon : atomMaterialIron;
            const mesh = new THREE.Mesh(sphereGeo, mat);
            scene.add(mesh);

            atomsPool.push({
                mesh: mesh,
                currentPos: new THREE.Vector3(0, 0, 0),
                sourcePos: new THREE.Vector3(0, 0, 0),
                targetPos: new THREE.Vector3(0, 0, 0),
                currentScale: 0.01,
                sourceScale: 0.01,
                targetScale: 0.01
            });
        }

        // Coordinate calculations
        const L = 1.0; // Cubical unit cell half-length
        
        // Corner combinations
        const corners = [
            [-L, -L, -L], [L, -L, -L], [L, L, -L], [-L, L, -L],
            [-L, -L, L], [L, -L, L], [L, L, L], [-L, L, L]
        ];

        // Face Center combinations
        const faces = [
            [0, 0, L], [0, 0, -L],  // Front, Back
            [L, 0, 0], [-L, 0, 0],  // Right, Left
            [0, L, 0], [0, -L, 0]   // Top, Bottom
        ];

        // HCP layout helper
        const hcpBottomHex = [];
        const hcpTopHex = [];
        const hcpMidTri = [];

        for (let i = 0; i < 6; i++) {
            const angle = (i * 60) * Math.PI / 180;
            const x = Math.cos(angle) * 1.1;
            const z = Math.sin(angle) * 1.1;
            hcpBottomHex.push([x, -1.2, z]);
            hcpTopHex.push([x, 1.2, z]);
        }

        for (let i = 0; i < 3; i++) {
            const angle = (i * 120 + 30) * Math.PI / 180;
            const x = Math.cos(angle) * 0.63;
            const z = Math.sin(angle) * 0.63;
            hcpMidTri.push([x, 0, z]);
        }

        // Function to define positions for target structure
        function setStructureTargets(type) {
            // Reset active flags
            if (type === 'bcc') {
                // BCC: 9 active atoms (8 corners + 1 center)
                // Corners 0-7
                for (let i = 0; i < 8; i++) {
                    atomsPool[i].targetPos.set(...corners[i]);
                    atomsPool[i].targetScale = 1.0;
                }
                // Center 8
                atomsPool[8].targetPos.set(0, 0, 0);
                atomsPool[8].targetScale = 1.0;
                atomsPool[8].mesh.material = atomMaterialCarbon; // Highlight alloy/carbon center

                // Face centers 9-14 (deactivated)
                for (let i = 9; i < 15; i++) {
                    atomsPool[i].targetPos.set(...faces[i-9]);
                    atomsPool[i].targetScale = 0.001; // Scale down to hide
                }
                // HCP exclusive atoms 15-16
                atomsPool[15].targetScale = 0.001;
                atomsPool[16].targetScale = 0.001;

            } else if (type === 'fcc') {
                // FCC: 14 active atoms (8 corners + 6 face centers)
                // Corners 0-7
                for (let i = 0; i < 8; i++) {
                    atomsPool[i].targetPos.set(...corners[i]);
                    atomsPool[i].targetScale = 1.0;
                }
                // Center 8 (deactivated)
                atomsPool[8].targetPos.set(0, 0, 0);
                atomsPool[8].targetScale = 0.001;

                // Face centers 9-14
                for (let i = 9; i < 15; i++) {
                    atomsPool[i].targetPos.set(...faces[i-9]);
                    atomsPool[i].targetScale = 1.0;
                    atomsPool[i].mesh.material = atomMaterialIron; // Face centers are iron
                }
                // HCP exclusive atoms 15-16
                atomsPool[15].targetScale = 0.001;
                atomsPool[16].targetScale = 0.001;

            } else if (type === 'hcp') {
                // HCP: 17 active atoms
                // Map bottom hex: indices 0-5
                for (let i = 0; i < 6; i++) {
                    atomsPool[i].targetPos.set(...hcpBottomHex[i]);
                    atomsPool[i].targetScale = 0.9;
                    atomsPool[i].mesh.material = atomMaterialIron;
                }
                // Bottom Center: index 6
                atomsPool[6].targetPos.set(0, -1.2, 0);
                atomsPool[6].targetScale = 0.9;
                atomsPool[6].mesh.material = atomMaterialCarbon;

                // Map top hex: indices 7-12
                for (let i = 7; i < 13; i++) {
                    atomsPool[i].targetPos.set(...hcpTopHex[i-7]);
                    atomsPool[i].targetScale = 0.9;
                    atomsPool[i].mesh.material = atomMaterialIron;
                }
                // Top Center: index 13
                atomsPool[13].targetPos.set(0, 1.2, 0);
                atomsPool[13].targetScale = 0.9;
                atomsPool[13].mesh.material = atomMaterialCarbon;

                // Map middle layer: indices 14-16
                for (let i = 14; i < 17; i++) {
                    atomsPool[i].targetPos.set(...hcpMidTri[i-14]);
                    atomsPool[i].targetScale = 0.9;
                    atomsPool[i].mesh.material = atomMaterialIron;
                }
            }

            // Save source state for lerping
            for (let i = 0; i < totalAtomCount; i++) {
                atomsPool[i].sourcePos.copy(atomsPool[i].mesh.position);
                atomsPool[i].sourceScale = atomsPool[i].mesh.scale.x;
            }
        }

        // Initialize positions
        setStructureTargets('bcc');
        // Instantly snap on load
        for (let i = 0; i < totalAtomCount; i++) {
            atomsPool[i].mesh.position.copy(atomsPool[i].targetPos);
            atomsPool[i].mesh.scale.setScalar(atomsPool[i].targetScale);
            atomsPool[i].currentPos.copy(atomsPool[i].targetPos);
            atomsPool[i].currentScale = atomsPool[i].targetScale;
        }

        // --- DYNAMIC BONDS RENDERING ---
        const bondsGroup = new THREE.Group();
        scene.add(bondsGroup);

        const bondMaterial = new THREE.LineBasicMaterial({
            color: isInitialLight ? 0x1e3a8a : 0x3b82f6, // Navy blue bonds in light theme, neon blue in dark theme
            transparent: true,
            opacity: isInitialLight ? 0.6 : 0.35,
            linewidth: 1.5
        });

        // Listen to theme changes dynamically
        window.addEventListener('themechange', (e) => {
            const isLight = e.detail.theme === 'light';
            if (isLight) {
                atomMaterialIron.color.setHex(0x94a3b8); // Steel gray
                atomMaterialIron.emissive.setHex(0x334155);
                atomMaterialCarbon.color.setHex(0xf97316); // Copper/Orange
                atomMaterialCarbon.emissive.setHex(0x9a3412);
                bondMaterial.color.setHex(0x1e3a8a); // Navy blue bonds
                bondMaterial.opacity = 0.6;
            } else {
                atomMaterialIron.color.setHex(0x1e3a8a); // Navy Blue
                atomMaterialIron.emissive.setHex(0x082f49);
                atomMaterialCarbon.color.setHex(0xf97316); // Copper/Orange
                atomMaterialCarbon.emissive.setHex(0xea580c);
                bondMaterial.color.setHex(0x3b82f6); // Neon Blue
                bondMaterial.opacity = 0.35;
            }
            atomMaterialIron.needsUpdate = true;
            atomMaterialCarbon.needsUpdate = true;
            bondMaterial.needsUpdate = true;
        });

        // Function to regenerate lines representing bonds
        function updateBonds() {
            // Remove previous lines
            while (bondsGroup.children.length > 0) {
                bondsGroup.remove(bondsGroup.children[0]);
            }

            // Define connections based on current interpolating positions
            const lines = [];

            if (currentType === 'bcc' || (currentType === 'fcc' && transitionProgress < 0.9)) {
                // BCC structure borders and center connections
                // Cube corners connections (outer frame)
                const cubePairs = [
                    [0, 1], [1, 2], [2, 3], [3, 0], // Bottom loop
                    [4, 5], [5, 6], [6, 7], [7, 4], // Top loop
                    [0, 4], [1, 5], [2, 6], [3, 7]  // Vertical links
                ];
                cubePairs.forEach(pair => {
                    if (atomsPool[pair[0]].currentScale > 0.1 && atomsPool[pair[1]].currentScale > 0.1) {
                        lines.push(atomsPool[pair[0]].currentPos, atomsPool[pair[1]].currentPos);
                    }
                });

                // Center node bonds to corners
                if (atomsPool[8].currentScale > 0.1) {
                    for (let i = 0; i < 8; i++) {
                        lines.push(atomsPool[8].currentPos, atomsPool[i].currentPos);
                    }
                }
            }

            if (currentType === 'fcc' || (currentType === 'bcc' && transitionProgress < 0.9)) {
                // FCC structure links
                // Corners are index 0-7, Faces are 9-14
                const cubePairs = [
                    [0, 1], [1, 2], [2, 3], [3, 0],
                    [4, 5], [5, 6], [6, 7], [7, 4],
                    [0, 4], [1, 5], [2, 6], [3, 7]
                ];
                cubePairs.forEach(pair => {
                    if (atomsPool[pair[0]].currentScale > 0.1 && atomsPool[pair[1]].currentScale > 0.1) {
                        lines.push(atomsPool[pair[0]].currentPos, atomsPool[pair[1]].currentPos);
                    }
                });

                // Map face centers to corners they connect
                // Index mapping: faces[0] at [0,0,1] is atom index 9. Connects to 4, 5, 6, 7 (Z=L face)
                const faceCorners = [
                    [9, [4, 5, 6, 7]],  // Front face
                    [10, [0, 1, 2, 3]], // Back face
                    [11, [1, 2, 5, 6]], // Right face
                    [12, [0, 3, 4, 7]], // Left face
                    [13, [2, 3, 6, 7]], // Top face
                    [14, [0, 1, 4, 5]]  // Bottom face
                ];
                faceCorners.forEach(fc => {
                    const faceIdx = fc[0];
                    const cornerIdxs = fc[1];
                    if (atomsPool[faceIdx].currentScale > 0.1) {
                        cornerIdxs.forEach(cIdx => {
                            lines.push(atomsPool[faceIdx].currentPos, atomsPool[cIdx].currentPos);
                        });
                    }
                });
            }

            if (currentType === 'hcp') {
                // HCP layout bonds
                // Bottom Hexagon: indices 0-5. Center is 6.
                for (let i = 0; i < 6; i++) {
                    const next = (i + 1) % 6;
                    lines.push(atomsPool[i].currentPos, atomsPool[next].currentPos); // outer ring
                    lines.push(atomsPool[6].currentPos, atomsPool[i].currentPos);    // center spokes
                }

                // Top Hexagon: indices 7-12. Center is 13.
                for (let i = 7; i < 13; i++) {
                    const next = 7 + ((i - 7 + 1) % 6);
                    lines.push(atomsPool[i].currentPos, atomsPool[next].currentPos); // outer ring
                    lines.push(atomsPool[13].currentPos, atomsPool[i].currentPos);   // center spokes
                }

                // Vertical outer struts: 0-7, 1-8, 2-9, 3-10, 4-11, 5-12
                for (let i = 0; i < 6; i++) {
                    lines.push(atomsPool[i].currentPos, atomsPool[i + 7].currentPos);
                }

                // Connect middle layer (14-16) to bottom and top hexagons
                // Middle atoms nest in recesses
                for (let j = 14; j < 17; j++) {
                    // Draw lines from middle layer to bottom and top centers for structural wireframe
                    lines.push(atomsPool[j].currentPos, atomsPool[6].currentPos);
                    lines.push(atomsPool[j].currentPos, atomsPool[13].currentPos);
                }
            }

            if (lines.length > 0) {
                const geom = new THREE.BufferGeometry().setFromPoints(lines);
                const segments = new THREE.LineSegments(geom, bondMaterial);
                bondsGroup.add(segments);
            }
        }

        // --- INTERACTIVITY: ROTATION BY MOUSE DRAG ---
        let isDragging = false;
        let previousMousePosition = { x: 0, y: 0 };
        const rotationTarget = new THREE.Euler(0.2, 0.4, 0); // initial angle
        const rotationCurrent = new THREE.Euler(0.2, 0.4, 0);
        const rotationDamping = 0.08;

        const handleDown = (clientX, clientY) => {
            isDragging = true;
            previousMousePosition = { x: clientX, y: clientY };
        };

        const handleMove = (clientX, clientY) => {
            if (!isDragging) return;
            const deltaMove = {
                x: clientX - previousMousePosition.x,
                y: clientY - previousMousePosition.y
            };

            // Rotate structure group
            rotationTarget.y += deltaMove.x * 0.007;
            rotationTarget.x += deltaMove.y * 0.007;

            previousMousePosition = { x: clientX, y: clientY };
        };

        const handleUp = () => {
            isDragging = false;
        };

        // Event listeners for containers
        container.addEventListener('mousedown', (e) => handleDown(e.clientX, e.clientY));
        container.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleUp);

        container.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) handleDown(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        container.addEventListener('touchmove', (e) => {
            if (e.touches.length === 1) handleMove(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        window.addEventListener('touchend', handleUp);


        // --- RAYCASTING FOR INTERACTIVE HOVER TOOLTIPS ---
        const raycaster = new THREE.Raycaster();
        const mouse2D = new THREE.Vector2();
        let hoveredAtomIndex = -1;

        // Create HTML tooltip overlay inside visualizer container
        const tooltip = document.createElement('div');
        tooltip.style.position = 'absolute';
        tooltip.style.background = 'rgba(255, 255, 255, 0.96)';
        tooltip.style.border = '1px solid var(--border-active)';
        tooltip.style.color = '#0f172a';
        tooltip.style.borderRadius = '6px';
        tooltip.style.padding = '8px 12px';
        tooltip.style.fontSize = '0.75rem';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.opacity = '0';
        tooltip.style.transition = 'opacity 0.2s ease';
        tooltip.style.zIndex = '10';
        tooltip.style.boxShadow = '0 5px 15px rgba(30,58,138,0.1)';
        container.appendChild(tooltip);

        container.addEventListener('mousemove', (e) => {
            // Calculate mouse position in normalized device coordinates
            const rect = renderer.domElement.getBoundingClientRect();
            mouse2D.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            mouse2D.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

            // Position tooltip near cursor
            tooltip.style.left = (e.clientX - rect.left + 15) + 'px';
            tooltip.style.top = (e.clientY - rect.top + 15) + 'px';
        });

        function handleHoverRaycast() {
            if (transitionProgress < 0.99) {
                // Disable hovering during phase transitions to prevent visual glitches
                tooltip.style.opacity = '0';
                return;
            }

            raycaster.setFromCamera(mouse2D, camera);
            // Collect all meshes that are scaled up (active)
            const activeMeshes = atomsPool
                .filter(a => a.currentScale > 0.2)
                .map(a => a.mesh);

            const intersects = raycaster.intersectObjects(activeMeshes);

            if (intersects.length > 0) {
                const mesh = intersects[0].object;
                const index = atomsPool.findIndex(a => a.mesh === mesh);

                if (index !== hoveredAtomIndex) {
                    // Reset previous hover state
                    if (hoveredAtomIndex !== -1 && atomsPool[hoveredAtomIndex]) {
                        atomsPool[hoveredAtomIndex].mesh.material.emissiveIntensity = 0.3;
                    }
                    
                    hoveredAtomIndex = index;
                    // Highlight hovered atom
                    mesh.material.emissiveIntensity = 0.8;
                    
                    // Show Tooltip Details based on structure
                    let atomName = "Iron Atom (Fe)";
                    let coordinates = `[${mesh.position.x.toFixed(2)}, ${mesh.position.y.toFixed(2)}, ${mesh.position.z.toFixed(2)}]`;
                    let coordNumber = 8;
                    
                    if (currentType === 'bcc') {
                        coordNumber = 8;
                        if (index === 8) {
                            atomName = "Alloying Interstitial Solute (e.g. Carbon/Alloy)";
                            coordNumber = 8;
                        } else {
                            atomName = "Solvent Crystal Node (Corner)";
                        }
                    } else if (currentType === 'fcc') {
                        coordNumber = 12;
                        if (index >= 9) {
                            atomName = "Solvent Face-Center Node";
                        } else {
                            atomName = "Solvent Crystal Node (Corner)";
                        }
                    } else if (currentType === 'hcp') {
                        coordNumber = 12;
                        if (index === 6 || index === 13) {
                            atomName = "Interstitial Node / Hex Center";
                        } else if (index >= 14) {
                            atomName = "Mid-Layer Close-Packed Atom";
                        } else {
                            atomName = "Hexagonal Boundary Node";
                        }
                    }

                    tooltip.innerHTML = `
                        <strong style="color:var(--primary); font-family:var(--font-heading);">${atomName}</strong><br/>
                        Position: ${coordinates}<br/>
                        Coordination Num: ${coordNumber}
                    `;
                    tooltip.style.opacity = '1';
                }
            } else {
                if (hoveredAtomIndex !== -1) {
                    if (atomsPool[hoveredAtomIndex]) {
                        atomsPool[hoveredAtomIndex].mesh.material.emissiveIntensity = 0.3;
                    }
                    hoveredAtomIndex = -1;
                    tooltip.style.opacity = '0';
                }
            }
        }


        // --- ANIMATION / RENDER LOOP ---
        function animate() {
            requestAnimationFrame(animate);

            // Interpolate structures if transitioning
            if (transitionProgress < 1.0) {
                transitionProgress += transitionSpeed;
                if (transitionProgress > 1.0) transitionProgress = 1.0;

                // Ease-in-out formula
                const ease = transitionProgress === 1 ? 1 : (1 - Math.pow(2, -10 * transitionProgress));

                for (let i = 0; i < totalAtomCount; i++) {
                    const atom = atomsPool[i];
                    atom.currentPos.lerpVectors(atom.sourcePos, atom.targetPos, ease);
                    atom.currentScale = THREE.MathUtils.lerp(atom.sourceScale, atom.targetScale, ease);

                    atom.mesh.position.copy(atom.currentPos);
                    atom.mesh.scale.setScalar(atom.currentScale);
                }

                updateBonds();
            }

            // Raycasting logic
            handleHoverRaycast();

            // Apply inertia rotation
            rotationCurrent.y += (rotationTarget.y - rotationCurrent.y) * rotationDamping;
            rotationCurrent.x += (rotationTarget.x - rotationCurrent.x) * rotationDamping;

            // Combine drag rotation with a subtle auto-rotation if not dragging
            if (!isDragging) {
                rotationTarget.y += 0.002; // Slow default rotation
            }

            // Apply rotation to both meshes and bonds
            atomsPool.forEach(atom => {
                atom.mesh.position.copy(atom.currentPos).applyEuler(rotationCurrent);
            });
            
            // Rotate bonds
            bondsGroup.rotation.copy(rotationCurrent);

            renderer.render(scene, camera);
        }

        // Trigger loop
        animate();
        updateBonds(); // draw initial bonds

        // --- BUTTON CONTROLS BINDING ---
        const buttons = document.querySelectorAll('.lattice-btn');
        const phaseLabel = document.getElementById('phase-name');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.getAttribute('data-type');
                if (type === currentType || transitionProgress < 1.0) return;

                buttons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Initiate structural morphing
                targetType = type;
                currentType = type;
                transitionProgress = 0.0;
                setStructureTargets(type);

                // Update text label info
                if (type === 'bcc') {
                    phaseLabel.textContent = "BCC Ferrite (α-Iron)";
                } else if (type === 'fcc') {
                    phaseLabel.textContent = "FCC Austenite (γ-Iron)";
                } else if (type === 'hcp') {
                    phaseLabel.textContent = "Hexagonal Close-Packed (Zinc/Titanium)";
                }
            });
        });

        // Trigger Transformation button
        const transformBtn = document.getElementById('transform-trigger');
        if (transformBtn) {
            transformBtn.addEventListener('click', () => {
                if (transitionProgress < 1.0) return;

                // Cycle between BCC and FCC to represent the 912°C iron allotropic transition
                let nextType = 'fcc';
                if (currentType === 'fcc') nextType = 'bcc';
                else if (currentType === 'hcp') nextType = 'bcc';

                const targetBtn = document.querySelector(`.lattice-btn[data-type="${nextType}"]`);
                if (targetBtn) targetBtn.click();
            });
        }

        // Resize handler
        window.addEventListener('resize', () => {
            const w = container.clientWidth;
            const h = container.clientHeight;
            camera.aspect = w / h;
            camera.updateProjectionMatrix();
            renderer.setSize(w, h);
        });
    }
})();
