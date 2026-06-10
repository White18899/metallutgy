/**
 * app.js
 * Main script handling SPA routing, page switching transitions,
 * dropdowns, mobile menus, and interactive lab simulators.
 */
(function() {
    document.addEventListener('DOMContentLoaded', () => {
        // Initialize Lucide Icons
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        }

        initTheme();
        initRouter();
        initNavigation();
        initTabs();
        initLabSimulators();
        initFormHandler();
    });

    // ==========================================================================
    // 0. THEME TOGGLER CONTROL
    // ==========================================================================
    function initTheme() {
        const themeToggle = document.getElementById('theme-toggle');
        if (!themeToggle) return;

        // Check stored preference, or system preference
        const storedTheme = localStorage.getItem('theme');
        const systemPrefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;

        if (storedTheme === 'light' || (!storedTheme && systemPrefersLight)) {
            document.body.classList.add('light-theme');
        } else {
            document.body.classList.remove('light-theme');
        }

        themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light-theme');
            const isLight = document.body.classList.contains('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            
            // Dispatch dynamic event for WebGL / canvas-based elements to adapt colors
            window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: isLight ? 'light' : 'dark' } }));
        });
    }

    // ==========================================================================
    // 1. SPA ROUTER WITH TRANSITIONS
    // ==========================================================================
    function initRouter() {
        const sections = document.querySelectorAll('.page-section');
        const navLinks = document.querySelectorAll('.nav-link');
        
        function handleRoute() {
            const hash = window.location.hash || '#home';
            // Parse main section name and query params (e.g. #about?tab=courses)
            const [rawSection, queryStr] = hash.split('?');
            const targetId = rawSection.substring(1);
            
            const targetSection = document.getElementById(targetId);
            if (!targetSection) return;

            // Handle Nav Link Activation
            navLinks.forEach(link => {
                const linkHash = link.getAttribute('href');
                if (linkHash === rawSection) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });

            // Smooth Page Switching Transition
            const activeSection = document.querySelector('.page-section.active');
            if (activeSection && activeSection !== targetSection) {
                // Exit current page
                activeSection.classList.add('exiting');
                activeSection.classList.remove('visible');

                setTimeout(() => {
                    activeSection.classList.remove('active', 'exiting');
                    
                    // Activate next page
                    targetSection.classList.add('active');
                    // Force reflow
                    targetSection.offsetHeight; 
                    targetSection.classList.add('visible');
                    
                    // Execute specific subsection tabs if parameters exist
                    handleQueryParams(targetId, queryStr);
                }, 400); // matches CSS transitions
            } else {
                // Initial load
                targetSection.classList.add('active');
                setTimeout(() => {
                    targetSection.classList.add('visible');
                    handleQueryParams(targetId, queryStr);
                }, 50);
            }
        }

        window.addEventListener('hashchange', handleRoute);
        // Initial Trigger
        handleRoute();
    }

    // Process specific query arguments to toggle tabs
    function handleQueryParams(sectionId, queryStr) {
        if (!queryStr) return;
        const params = new URLSearchParams(queryStr);
        
        if (sectionId === 'about' && params.has('tab')) {
            const tabName = params.get('tab');
            const btn = document.querySelector(`.tab-btn[data-target="about-${tabName}"]`);
            if (btn) btn.click();
        } else if (sectionId === 'faculty' && params.has('role')) {
            const role = params.get('role');
            let element;
            if (role === 'principal') element = document.getElementById('principal-profile');
            else if (role === 'hod') element = document.getElementById('hod-profile');
            else element = document.querySelector('.faculty-grid');
            
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        } else if (sectionId === 'labs' && params.has('id')) {
            const labId = params.get('id');
            const btn = document.querySelector(`.lab-select-btn[data-lab="${labId}"]`);
            if (btn) btn.click();
        } else if (sectionId === 'students' && params.has('tab')) {
            const tabName = params.get('tab');
            const btn = document.querySelector(`.student-tab-btn[data-pane="student-${tabName}"]`);
            if (btn) btn.click();
        } else if (sectionId === 'placements' && params.has('tab')) {
            const tabName = params.get('tab');
            const btn = document.querySelector(`.p-tab-btn[data-target="p-${tabName}"]`);
            if (btn) btn.click();
        }
    }

    // ==========================================================================
    // 2. DROPDOWN MENUS & MOBILE NAVIGATION
    // ==========================================================================
    function initNavigation() {
        const mobileToggle = document.getElementById('mobile-toggle');
        const mainNav = document.getElementById('main-nav');
        const dropdownItems = document.querySelectorAll('.has-dropdown');
        const navLinks = document.querySelectorAll('.nav-links a');

        // Mobile Menu Toggle
        if (mobileToggle && mainNav) {
            mobileToggle.addEventListener('click', () => {
                mainNav.classList.toggle('active');
                const isOpen = mainNav.classList.contains('active');
                mobileToggle.innerHTML = isOpen ? '<i data-lucide="x"></i>' : '<i data-lucide="menu"></i>';
                lucide.createIcons();
            });
        }

        // Close Mobile Menu on link click
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // If it's a dropdown toggle in mobile mode, prevent direct navigation
                if (window.innerWidth <= 768 && link.parentElement.classList.contains('has-dropdown')) {
                    e.preventDefault();
                    link.parentElement.classList.toggle('dropdown-active');
                    return;
                }
                if (mainNav) mainNav.classList.remove('active');
                if (mobileToggle) {
                    mobileToggle.innerHTML = '<i data-lucide="menu"></i>';
                    lucide.createIcons();
                }
            });
        });
    }

    // ==========================================================================
    // 3. TAB INTERFACES TABS
    // ==========================================================================
    function initTabs() {
        // Generic Tab Setup Helper
        function setupTabGroup(buttonsClass, panesClass, activeClass) {
            const buttons = document.querySelectorAll(buttonsClass);
            const panes = document.querySelectorAll(panesClass);

            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove active from buttons
                    buttons.forEach(b => b.classList.remove(activeClass));
                    btn.classList.add(activeClass);

                    // Fetch target pane id
                    const targetId = btn.getAttribute('data-target') || btn.getAttribute('data-pane');
                    
                    // Hide all panes
                    panes.forEach(pane => {
                        pane.classList.remove(activeClass);
                        pane.style.display = 'none';
                    });

                    // Activate targeted pane
                    const targetPane = document.getElementById(targetId);
                    if (targetPane) {
                        targetPane.style.display = 'block';
                        // Trigger reflow
                        targetPane.offsetHeight;
                        targetPane.classList.add(activeClass);
                    }
                });
            });
        }

        // Initialize About Tabs
        setupTabGroup('.tab-btn', '#about .tab-pane', 'active');
        
        // Initialize Placements Tabs
        setupTabGroup('.p-tab-btn', '#placements .p-pane', 'active');

        // Initialize Student Corner Sidebar Tabs
        setupTabGroup('.student-tab-btn', '#students .student-pane', 'active');

        // Initialize Laboratories Panel Selector
        setupTabGroup('.lab-select-btn', '#labs .lab-pane', 'active');
    }

    // ==========================================================================
    // 4. INTERACTIVE LABORATORIES SIMULATORS
    // ==========================================================================
    function initLabSimulators() {
        // --- LAB 1: METALLOGRAPHY ETCHING SIMULATION ---
        const btnEtch = document.getElementById('btn-etch');
        const steelSpecimen = document.getElementById('steel-specimen');
        const etchStatus = document.getElementById('etch-status');

        if (btnEtch && steelSpecimen && etchStatus) {
            btnEtch.addEventListener('click', () => {
                if (steelSpecimen.classList.contains('etched')) {
                    // Reset specimen
                    steelSpecimen.classList.remove('etched');
                    btnEtch.textContent = "Apply Etchant (Nital 2%)";
                    etchStatus.textContent = "Specimen is polished (mirror-like).";
                    etchStatus.style.color = 'var(--text-muted)';
                } else {
                    // Etch specimen
                    etchStatus.textContent = "Etching in progress...";
                    etchStatus.style.color = 'var(--primary)';
                    btnEtch.disabled = true;

                    setTimeout(() => {
                        steelSpecimen.classList.add('etched');
                        btnEtch.disabled = false;
                        btnEtch.textContent = "Re-polish Specimen";
                        etchStatus.textContent = "Etched successfully! revealed: Pearlite (dark layers) & Ferrite (light grains).";
                        etchStatus.style.color = 'var(--secondary)';
                    }, 1500);
                }
            });
        }

        // --- LAB 2: UTM TENSILE SIMULATION ---
        const btnUtm = document.getElementById('btn-utm-test');
        const selectUtm = document.getElementById('utm-material');
        const utmStatus = document.getElementById('utm-status');
        const canvasUtm = document.getElementById('utm-graph');

        if (btnUtm && canvasUtm && utmStatus) {
            const ctx = canvasUtm.getContext('2d');
            let animId = null;

            btnUtm.addEventListener('click', () => {
                if (animId) cancelAnimationFrame(animId);
                
                const material = selectUtm.value;
                utmStatus.textContent = "Securing sample in jaws...";
                btnUtm.disabled = true;

                // Clear Graph
                ctx.clearRect(0, 0, canvasUtm.width, canvasUtm.height);
                drawGraphAxes(ctx, canvasUtm.width, canvasUtm.height);

                let progress = 0;
                const points = [];

                setTimeout(() => {
                    utmStatus.textContent = "Pulling sample... applying load";
                    
                    function animatePull() {
                        progress += 1;
                        let x = (progress / 100) * (canvasUtm.width - 30) + 20;
                        let y = 0;
                        let maxProgress = 100;

                        if (material === 'mild-steel') {
                            // Classic mild steel curve with yield drop and necking
                            // Yield point -> Yield drop -> UTS -> Failure
                            if (progress < 25) {
                                // Linear Elastic
                                y = progress * 2.2;
                            } else if (progress < 35) {
                                // Yield point wobble
                                y = 55 + Math.sin(progress * 0.8) * 3;
                            } else if (progress < 75) {
                                // Strain Hardening to UTS
                                const term = (progress - 35) / 40;
                                y = 55 + Math.sin(term * Math.PI / 2) * 30;
                            } else {
                                // Necking & fracture
                                const term = (progress - 75) / 25;
                                y = 85 - term * term * 25;
                            }
                            maxProgress = 95;
                        } else if (material === 'cast-iron') {
                            // Brittle: straight linear line then sudden snap
                            y = progress * 3.5;
                            maxProgress = 22; // snaps early
                        } else if (material === 'aluminum') {
                            // Smooth yield, no drop, high elongation
                            if (progress < 35) {
                                y = progress * 1.6;
                            } else {
                                const term = (progress - 35) / 65;
                                y = 56 + Math.sin(term * Math.PI / 2) * 20;
                            }
                            maxProgress = 98;
                        }

                        // Convert y coordinate to match canvas flip orientation
                        const graphY = canvasUtm.height - 15 - y;
                        points.push({ x, y: graphY });

                        // Render Line
                        ctx.beginPath();
                        ctx.strokeStyle = 'var(--primary)';
                        ctx.lineWidth = 2;
                        ctx.moveTo(points[0].x, points[0].y);
                        for (let i = 1; i < points.length; i++) {
                            ctx.lineTo(points[i].x, points[i].y);
                        }
                        ctx.stroke();

                        if (progress < maxProgress) {
                            animId = requestAnimationFrame(animatePull);
                        } else {
                            // Rupture!
                            ctx.beginPath();
                            ctx.fillStyle = '#ef4444';
                            ctx.arc(x, graphY, 4, 0, Math.PI * 2);
                            ctx.fill();

                            utmStatus.textContent = "Fracture reached! sample ruptured.";
                            btnUtm.disabled = false;
                        }
                    }
                    
                    animatePull();
                }, 1000);
            });

            // Draw initial Graph outline
            drawGraphAxes(ctx, canvasUtm.width, canvasUtm.height);
        }

        function drawGraphAxes(ctx, w, h) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1.5;
            // Y-Axis (Stress)
            ctx.moveTo(20, 5);
            ctx.lineTo(20, h - 15);
            // X-Axis (Strain)
            ctx.lineTo(w - 5, h - 15);
            ctx.stroke();

            // Label text
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '7px sans-serif';
            ctx.fillText("Stress (σ)", 2, 12);
            ctx.fillText("Strain (ε)", w - 35, h - 4);
        }

        // --- LAB 3: JOMINY END QUENCH SIMULATION ---
        const btnQuench = document.getElementById('btn-quench');
        const btnHardness = document.getElementById('btn-hardness-profile');
        const jominySpecimen = document.getElementById('jominy-specimen');
        const jominyResults = document.getElementById('jominy-results');

        if (btnQuench && btnHardness && jominySpecimen && jominyResults) {
            btnQuench.addEventListener('click', () => {
                // Reset states
                jominySpecimen.className = "quench-visual heated";
                jominyResults.innerHTML = '';
                btnHardness.disabled = true;
                btnQuench.disabled = true;

                setTimeout(() => {
                    // Inject water quench
                    jominySpecimen.className = "quench-visual quenched";
                    
                    setTimeout(() => {
                        btnHardness.disabled = false;
                        btnQuench.disabled = false;
                        jominyResults.innerHTML = '<span style="color:var(--secondary)">Specimen fully quenched to room temp. Ready for hardness testing.</span>';
                    }, 3000);
                }, 800);
            });

            btnHardness.addEventListener('click', () => {
                // Calculate hardness values at different distances from quenched end
                // Quenched end (1.5mm) has fast cooling (mostly Martensite = 58 HRC)
                // Far end (40mm) has slow cooling (Ferrite + Pearlite = 22 HRC)
                const measurements = [
                    { dist: "1.5 mm", hardness: "58 HRC", micro: "100% Martensite (Hardest)" },
                    { dist: "5.0 mm", hardness: "52 HRC", micro: "Martensite + Bainite" },
                    { dist: "10.0 mm", hardness: "45 HRC", micro: "Bainite" },
                    { dist: "20.0 mm", hardness: "32 HRC", micro: "Fine Pearlite" },
                    { dist: "40.0 mm", hardness: "22 HRC", micro: "Coarse Ferrite + Pearlite" }
                ];

                let tableHtml = `
                    <table>
                        <thead>
                            <tr>
                                <th>Distance</th>
                                <th>Hardness</th>
                                <th>Microstructure</th>
                            </tr>
                        </thead>
                        <tbody>
                `;

                measurements.forEach(m => {
                    const isHigh = m.hardness.includes('58') || m.hardness.includes('52');
                    tableHtml += `
                        <tr>
                            <td>${m.dist}</td>
                            <td class="${isHigh ? 'high-h' : ''}">${m.hardness}</td>
                            <td>${m.micro}</td>
                        </tr>
                    `;
                });

                tableHtml += `</tbody></table>`;
                jominyResults.innerHTML = tableHtml;
            });
        }

        // --- LAB 4: XRD DIFFRACTOGRAM SIMULATION ---
        const xrdButtons = document.querySelectorAll('.btn-xrd');
        const canvasXrd = document.getElementById('xrd-graph');
        const xrdStatus = document.getElementById('xrd-status');

        if (canvasXrd && xrdStatus && xrdButtons.length > 0) {
            const ctx = canvasXrd.getContext('2d');
            drawGraphAxes(ctx, canvasXrd.width, canvasXrd.height);

            xrdButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const crystal = btn.getAttribute('data-crystal');
                    xrdStatus.textContent = `Running X-Ray scan... (λ = 1.5406 Å)`;

                    // Clear canvas
                    ctx.clearRect(0, 0, canvasXrd.width, canvasXrd.height);
                    drawGraphAxes(ctx, canvasXrd.width, canvasXrd.height);

                    setTimeout(() => {
                        ctx.beginPath();
                        ctx.strokeStyle = 'var(--secondary)';
                        ctx.lineWidth = 1.5;
                        ctx.moveTo(20, canvasXrd.height - 15);

                        // Render X-Ray peaks (Relative intensity vs 2-Theta)
                        // X goes from 20 to w-5 (2theta from 30° to 90°)
                        const w = canvasXrd.width;
                        const h = canvasXrd.height;
                        const baseLine = h - 15;

                        for (let x = 20; x < w - 5; x++) {
                            // Translate x to angle 2-Theta
                            const twoTheta = 30 + ((x - 20) / (w - 25)) * 60;
                            let y = 0;

                            // Add micro structural noise background
                            y += Math.random() * 2;

                            if (crystal === 'bcc') {
                                // BCC Ferrite Peaks: {110} at ~44.6°, {200} at ~65°, {211} at ~82.3°
                                if (Math.abs(twoTheta - 44.6) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 44.6, 2) / 0.15) * 75; // {110} strongest peak
                                }
                                if (Math.abs(twoTheta - 65.0) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 65.0, 2) / 0.15) * 15; // {200}
                                }
                                if (Math.abs(twoTheta - 82.3) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 82.3, 2) / 0.15) * 30; // {211}
                                }
                            } else {
                                // FCC Austenite Peaks: {111} at ~43.5°, {200} at ~50.6°, {220} at ~74.3°
                                if (Math.abs(twoTheta - 43.5) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 43.5, 2) / 0.15) * 70; // {111}
                                }
                                if (Math.abs(twoTheta - 50.6) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 50.6, 2) / 0.15) * 35; // {200}
                                }
                                if (Math.abs(twoTheta - 74.3) < 1.5) {
                                    y += Math.exp(-Math.pow(twoTheta - 74.3, 2) / 0.15) * 25; // {220}
                                }
                            }

                            ctx.lineTo(x, baseLine - y);
                        }
                        ctx.stroke();

                        // Label peaks
                        ctx.fillStyle = 'var(--primary)';
                        ctx.font = '6px sans-serif';
                        if (crystal === 'bcc') {
                            xrdStatus.textContent = "Scan complete. Identified: α-iron (BCC).";
                            ctx.fillText("{110}", 50, h - 85);
                            ctx.fillText("{200}", 115, h - 30);
                            ctx.fillText("{211}", 165, h - 45);
                        } else {
                            xrdStatus.textContent = "Scan complete. Identified: γ-iron (FCC).";
                            ctx.fillText("{111}", 48, h - 80);
                            ctx.fillText("{200}", 75, h - 50);
                            ctx.fillText("{220}", 140, h - 40);
                        }

                    }, 800);
                });
            });
        }
    }

    // ==========================================================================
    // 5. CONTACT FORM SUBMISSIONS
    // ==========================================================================
    function initFormHandler() {
        const form = document.getElementById('feedback-form');
        const successOverlay = document.getElementById('form-success');
        const closeBtn = document.getElementById('btn-success-close');

        if (form && successOverlay) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();

                // Trigger animations for submissions
                const submitBtn = document.getElementById('btn-submit-form');
                if (submitBtn) {
                    submitBtn.disabled = true;
                    submitBtn.innerHTML = 'Sending message...';
                }

                setTimeout(() => {
                    // Display success overlay modal
                    successOverlay.style.display = 'flex';
                    // Force reflow
                    successOverlay.offsetHeight;
                    successOverlay.classList.add('active');

                    // Reset form fields
                    form.reset();

                    if (submitBtn) {
                        submitBtn.disabled = false;
                        submitBtn.innerHTML = '<i data-lucide="send"></i> Submit Message';
                        if (typeof lucide !== 'undefined') lucide.createIcons();
                    }
                }, 1200);
            });
        }

        if (closeBtn && successOverlay) {
            closeBtn.addEventListener('click', () => {
                successOverlay.classList.remove('active');
                setTimeout(() => {
                    successOverlay.style.display = 'none';
                }, 300);
            });
        }
    }

})();
