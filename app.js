/**
 * Simuladores de Física - Dinámica de Fluidos 2026
 * Autor: Dr. Eduardo R. Henquín
 */

document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    initSimulators();
    initAboutModal();
    requestAnimationFrame(animatePumpScene);
});

// --- ESTADO GLOBAL PARA ANIMACIÓN DE BOMBEO ---
let pumpState = {
    vol: 1500,
    rho: 1000,
    time_h: 2,
    za: 1.0,
    zb: 3.5,
    pb_bar: 0.2,
    len: 15,
    diam_in: 1.5,
    f: 0.022,
    eta: 0.65,
    q: 0.000208,
    h_total: 6.0,
    p_h: 12.3,
    phase: 0
};

// --- GESTIÓN DE PESTAÑAS ---
function initTabs() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.dataset.tab;
            navBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(target).classList.add('active');
            
            // Renderizar el contenido de la pestaña activada
            renderTabContent(target);
            
            // Trigger resize to fix canvas dimensions if needed
            window.dispatchEvent(new Event('resize'));
        });
    });

    // Sub-tabs eliminadas para la pestaña 6
}

function renderTabContent(tabId) {
    switch(tabId) {
        case 'tab-tanque': updateTanque(); break;
        case 'tab-pitot': updatePitot(); break;
        case 'tab-bernoulli': updateBernoulli(); break;
        case 'tab-venturi': updateVenturi(); break;
        case 'tab-bombas': updatePump(); break;
    }
}

// --- CONSTANTES FÍSICAS ---
const G = 9.81; // m/s2
const RHO_WATER = 1000; // kg/m3

// --- INICIALIZACIÓN DE SIMULADORES ---
function initSimulators() {
    // 2. Tanque y Chorro
    const tankInputs = ['tanque-y2', 'tanque-y1', 'tanque-d', 'tanque-target-x'];
    tankInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateTanque);
    });
    document.getElementById('btn-tanque-reset').addEventListener('click', () => resetInputs('tanque'));
    document.getElementById('btn-tanque-solve').addEventListener('click', solveTanqueForX);
    document.getElementById('tanque-show-dev').addEventListener('change', updateTanque);
    
    // 3. Pitot
    const pitotInputs = ['pitot-dist', 'pitot-rho', 'pitot-dp'];
    pitotInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updatePitot);
    });
    document.getElementById('btn-pitot-reset').addEventListener('click', () => resetInputs('pitot'));
    document.getElementById('btn-pitot-theory').addEventListener('click', () => {
        document.getElementById('pitot-theory-card').classList.toggle('hidden');
    });

    // 4. Bernoulli
    const bernInputs = ['bern-a1', 'bern-a2', 'bern-p1', 'bern-p2'];
    bernInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateBernoulli);
    });
    document.getElementById('btn-bern-reset').addEventListener('click', () => resetInputs('bern'));

    // 5. Venturi
    const ventInputs = ['vent-d1', 'vent-d2', 'vent-dp', 'vent-cd'];
    ventInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updateVenturi);
    });
    document.getElementById('btn-vent-reset').addEventListener('click', () => resetInputs('vent'));
    document.getElementById('vent-show-dev').addEventListener('change', updateVenturi);

    // 6. Sistema de Bombeo
    const pumpInputs = ['pump-vol', 'pump-rho', 'pump-time', 'pump-za', 'pump-zb', 'pump-pb', 'pump-len', 'pump-diam', 'pump-f', 'pump-eta'];
    pumpInputs.forEach(id => {
        document.getElementById(id).addEventListener('input', updatePump);
    });
    document.getElementById('btn-pump-reset').addEventListener('click', () => resetInputs('pump'));

    // Copy buttons
    document.getElementById('btn-tanque-copy').addEventListener('click', () => copyResults('tanque'));
    document.getElementById('btn-pitot-copy').addEventListener('click', () => copyResults('pitot'));
    document.getElementById('btn-vent-copy').addEventListener('click', () => copyResults('vent'));

    // Initial updates - RENDER ALL ON START
    updateTanque();
    updatePitot();
    updateBernoulli();
    updateVenturi();
    updatePump();

    // Iniciar loop de animación
    // (Ya iniciado en DOMContentLoaded)

    // Canvas Resize listeners
    window.addEventListener('resize', () => {
        const activeTab = document.querySelector('.nav-btn.active').dataset.tab;
        renderTabContent(activeTab);
    });
}

// --- UTILIDADES ---
function getSliderValue(id, fallback) {
    const el = document.getElementById(id);
    if (!el) return fallback;
    const value = parseFloat(String(el.value).replace(',', '.'));
    return Number.isFinite(value) ? value : fallback;
}

function setDisplay(id, value, unit = '', decimals = 2) {
    const el = document.getElementById(`val-${id}`);
    if (!el) return;
    el.innerText = `${Number(value).toLocaleString('es-AR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    })}${unit ? ' ' + unit : ''}`;
}

function resetInputs(prefix) {
    const defaults = {
        'tanque': { 'tanque-y2': 100, 'tanque-y1': 20, 'tanque-d': 3.0, 'tanque-target-x': 1.20 },
        'pitot': { 'pitot-dist': 10100, 'pitot-rho': 0.850, 'pitot-dp': 27 },
        'bern': { 'bern-a1': 30, 'bern-a2': 10, 'bern-p1': 200, 'bern-p2': 130 },
        'vent': { 'vent-d1': 10, 'vent-d2': 6, 'vent-dp': 15, 'vent-cd': 1.00 },
        'pump': { 'pump-vol': 1500, 'pump-rho': 1000, 'pump-time': 2, 'pump-za': 1.0, 'pump-zb': 3.5, 'pump-pb': 0.2, 'pump-len': 15, 'pump-diam': 1.5, 'pump-f': 0.022, 'pump-eta': 0.65 }
    };
    
    for (const [id, val] of Object.entries(defaults[prefix])) {
        const el = document.getElementById(id);
        if (el) {
            el.value = val;
            // La actualización del display y el cálculo se disparan al llamar a updateX()
        }
    }
    
    // Renderizar explícitamente después del reset
    if (prefix === 'tanque') updateTanque();
    else if (prefix === 'pitot') updatePitot();
    else if (prefix === 'bern') updateBernoulli();
    else if (prefix === 'vent') updateVenturi();
    else if (prefix === 'pump') updatePump();
}

function getUnit(id) {
    if (id.includes('y2') || id.includes('y1') || id.includes('d')) return 'cm';
    if (id.includes('dp')) return 'kPa';
    if (id.includes('p1') || id.includes('p2')) return 'kPa';
    return '';
}

function copyResults(prefix) {
    let text = `Resultados de Simulación - ${prefix.toUpperCase()}\n`;
    const results = document.querySelectorAll(`#tab-${prefix} .result-item`);
    results.forEach(item => {
        const label = item.querySelector('.result-label').innerText;
        const val = item.querySelector('.result-value').innerText;
        const unit = item.querySelector('.result-unit') ? item.querySelector('.result-unit').innerText : '';
        text += `${label}: ${val} ${unit}\n`;
    });
    
    navigator.clipboard.writeText(text).then(() => {
        alert('Resultados copiados al portapapeles');
    });
}

function formatNum(n, decimals = 2) {
    return parseFloat(n).toLocaleString('es-AR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function renderMathJax(containerId, content) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = content;
    if (window.MathJax && window.MathJax.typesetPromise) {
        MathJax.typesetClear([container]);
        MathJax.typesetPromise([container]);
    }
}

// --- SIMULADOR 2: TANQUE Y CHORRO ---
function updateTanque() {
    let y2_cm = getSliderValue('tanque-y2', 100);
    let y1_cm = getSliderValue('tanque-y1', 20);
    const d_cm = getSliderValue('tanque-d', 3.0);
    const tx_m = getSliderValue('tanque-target-x', 1.20);

    // Validación APB: y2 siempre mayor que y1
    if (y1_cm >= y2_cm) {
        y2_cm = y1_cm + 1;
        document.getElementById('tanque-y2').value = y2_cm;
    }

    setDisplay('tanque-y2', y2_cm, 'cm', 0);
    setDisplay('tanque-y1', y1_cm, 'cm', 0);
    setDisplay('tanque-d', d_cm, 'cm', 1);
    setDisplay('tanque-target-x', tx_m, 'm', 2);

    const h = (y2_cm - y1_cm) / 100; // m
    const y1 = y1_cm / 100; // m
    const v = Math.sqrt(2 * G * h);
    const t = Math.sqrt(2 * y1 / G);
    const x = v * t;
    const a = Math.PI * Math.pow(d_cm / 100, 2) / 4;
    const q = a * v; // m3/s
    const q_ls = q * 1000;
    const q_lh = q_ls * 3600;

    document.getElementById('res-tanque-v').innerText = formatNum(v);
    document.getElementById('res-tanque-x').innerText = formatNum(x);
    document.getElementById('res-tanque-q').innerText = formatNum(q_ls, 3);
    document.getElementById('res-tanque-qh').innerText = formatNum(q_lh, 1);

    drawTanque(y2_cm, y1_cm, x, v);
    renderTanqueEquations(y2_cm, y1_cm, d_cm, h, v, t, x, q_ls, a);
}

function renderTanqueEquations(y2, y1, d, h, v, t, x, q, a) {
    const content = `
        <div class="equation-section">
            <h5>a) Continuidad</h5>
            <div class="equation-step">\\[ Q_{ent} = Q_{sal} \\]</div>
            <div class="equation-note">Si el nivel es constante: $Q_{alimentación} = Q_{orificio}$</div>
        </div>
        <div class="equation-section">
            <h5>b) Energía (Bernoulli)</h5>
            <div class="equation-note">Entre superficie libre (1) y orificio (2):</div>
            <div class="equation-step">\\[ P_1 + \\rho g y_2 + \\frac{1}{2}\\rho v_1^2 = P_2 + \\rho g y_1 + \\frac{1}{2}\\rho v_2^2 \\]</div>
            <div class="equation-note">Con $P_1=P_2$ (ambos a la atmósfera) y $v_1 \\approx 0$ (tanque amplio):</div>
            <div class="equation-step">\\[ \\rho g (y_2 - y_1) = \\frac{1}{2} \\rho v^2 \\implies v = \\sqrt{2g(y_2 - y_1)} \\]</div>
        </div>
        <div class="equation-section">
            <h5>c) Cinemática</h5>
            <div class="equation-step">\\[ t = \\sqrt{2y_1/g} \\]</div>
            <div class="equation-step">\\[ x = v \\cdot t \\]</div>
        </div>
        <div class="equation-section">
            <h5>d) Caudal</h5>
            <div class="equation-step">\\[ A = \\frac{\\pi D^2}{4} \\]</div>
            <div class="equation-step">\\[ Q = A \\cdot v \\]</div>
        </div>
        <div class="equation-section" style="grid-column: 1 / -1;">
            <h5>e) Sustitución numérica</h5>
            <div class="equation-step">
                \\[ v = \\sqrt{2 \\cdot 9,81 \\cdot ${formatNum(h)}} = ${formatNum(v)} \\text{ m/s} \\]
                \\[ t = \\sqrt{2 \\cdot ${formatNum(y1/100)} / 9,81} = ${formatNum(t)} \\text{ s} \\]
                \\[ x = ${formatNum(v)} \\cdot ${formatNum(t)} = ${formatNum(x)} \\text{ m} \\]
                \\[ Q = ${formatNum(a, 6)} \\text{ m}^2 \\cdot ${formatNum(v)} \\text{ m/s} = ${formatNum(q, 3)} \\text{ L/s} \\]
            </div>
        </div>
    `;
    renderMathJax('tanque-equations-content', content);
}

function solveTanqueForX() {
    const targetX = getSliderValue('tanque-target-x', 1.20);
    const y1_cm = getSliderValue('tanque-y1', 20);
    const y1 = y1_cm / 100;
    
    // x = v * t = sqrt(2gh) * sqrt(2y1/g) = sqrt(4 * h * y1) = 2 * sqrt(h * y1)
    // x/2 = sqrt(h * y1) -> (x/2)^2 = h * y1 -> h = (x^2 / 4) / y1
    const h = (targetX * targetX / 4) / y1;
    const y2_cm = (h + y1) * 100;
    
    if (y2_cm > 200) {
        alert("El nivel necesario excede el límite del simulador (200 cm). Reduzca la distancia objetivo.");
        return;
    }
    
    document.getElementById('tanque-y2').value = y2_cm;
    updateTanque();
}

function drawTanque(y2, y1, x_m, v_ms) {
    const canvas = document.getElementById('canvas-tanque');
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);

    // Scaling
    const scale = 1.5; // pixels per cm
    const marginX = 50;
    const marginY = 50;
    const tankW = 100;
    const tankH = 200 * scale;
    
    const groundY = h - marginY;
    const tankBottom = groundY;
    const tankX = marginX;

    // Draw Ground
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, groundY);
    ctx.lineTo(w, groundY);
    ctx.stroke();

    // Draw Tank
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.strokeRect(tankX, groundY - tankH, tankW, tankH);

    // Draw Water
    const waterLevelY = groundY - (y2 * scale);
    ctx.fillStyle = 'rgba(59, 130, 246, 0.4)';
    ctx.fillRect(tankX, waterLevelY, tankW, groundY - waterLevelY);

    // Draw Orifice
    const orificeY = groundY - (y1 * scale);
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(tankX + tankW, orificeY, 4, 0, Math.PI * 2);
    ctx.fill();

    // Draw Stream (Parabola)
    if (y2 > y1) {
        ctx.beginPath();
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        ctx.moveTo(tankX + tankW, orificeY);
        
        // Equation: y = orificeY + (1/2)*g*(x_pixel/v_pixel)^2
        // We know final x is x_m. Let's draw in pixels.
        const v_pix = v_ms * 100 * scale; // pixels/s
        const g_pix = G * 100 * scale;   // pixels/s2
        
        const maxX_pix = x_m * 100 * scale;
        
        for (let px = 0; px <= maxX_pix; px += 2) {
            const time = px / v_pix;
            const py = orificeY + 0.5 * g_pix * time * time;
            if (py > groundY) break;
            ctx.lineTo(tankX + tankW + px, py);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Label Reach
        ctx.fillStyle = '#38bdf8';
        ctx.font = '12px Roboto Mono';
        ctx.fillText(`x = ${formatNum(x_m)} m`, tankX + tankW + maxX_pix/2, groundY + 20);
        
        // Arrow for x
        ctx.beginPath();
        ctx.moveTo(tankX + tankW, groundY + 5);
        ctx.lineTo(tankX + tankW + maxX_pix, groundY + 5);
        ctx.stroke();
    }
    
    // Labels for heights
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Outfit';
    ctx.fillText(`y2 = ${y2}cm`, tankX - 45, waterLevelY + 5);
    ctx.fillText(`y1 = ${y1}cm`, tankX - 45, orificeY + 5);
}

// --- SIMULADOR 3: PITOT ---
function updatePitot() {
    const dist = getSliderValue('pitot-dist', 10100);
    const rho = getSliderValue('pitot-rho', 0.850);
    const dp_kpa = getSliderValue('pitot-dp', 27);

    setDisplay('pitot-dist', dist, 'km', 0);
    setDisplay('pitot-rho', rho, 'kg/m³', 3);
    setDisplay('pitot-dp', dp_kpa, 'kPa', 1);

    const dp_pa = dp_kpa * 1000;
    const v = Math.sqrt(2 * dp_pa / rho);
    const v_kmh = v * 3.6;
    const time = dist / v_kmh;

    document.getElementById('res-pitot-v-ms').innerText = formatNum(v, 1);
    document.getElementById('res-pitot-v-kmh').innerText = formatNum(v_kmh, 1);
    document.getElementById('res-pitot-t').innerText = formatNum(time, 2);

    drawPitot(v_kmh, dp_kpa);
    renderPitotEquations(dist, rho, dp_kpa, dp_pa, v, v_kmh, time);
}

function renderPitotEquations(dist, rho, dp_kpa, dp_pa, v, v_kmh, time) {
    const content = `
        <div class="equation-section">
            <h5>a) Bernoulli</h5>
            <div class="equation-note">Entre flujo libre y punto de estancamiento:</div>
            <div class="equation-step">\\[ P_s + \\frac{1}{2}\\rho v^2 = P_t \\]</div>
            <div class="equation-step">\\[ \\Delta P = P_t - P_s = \\frac{1}{2}\\rho v^2 \\]</div>
        </div>
        <div class="equation-section">
            <h5>b) Despeje</h5>
            <div class="equation-step">\\[ v = \\sqrt{2\\Delta P/\\rho} \\]</div>
        </div>
        <div class="equation-section">
            <h5>c) Tiempo</h5>
            <div class="equation-step">\\[ t = d/v \\]</div>
        </div>
        <div class="equation-section" style="grid-column: 1 / -1;">
            <h5>d) Sustitución numérica</h5>
            <div class="equation-step">
                \\[ \\Delta P = ${dp_kpa} \\text{ kPa} = ${dp_pa} \\text{ Pa} \\]
                \\[ v = \\sqrt{2 \\cdot ${dp_pa} / ${formatNum(rho, 3)}} = ${formatNum(v, 1)} \\text{ m/s} \\]
                \\[ v = ${formatNum(v, 1)} \\cdot 3,6 = ${formatNum(v_kmh, 1)} \\text{ km/h} \\]
                \\[ t = ${formatNum(dist, 0)} \\text{ km} / ${formatNum(v_kmh, 1)} \\text{ km/h} = ${formatNum(time, 2)} \\text{ h} \\]
            </div>
        </div>
    `;
    renderMathJax('pitot-equations-content', content);
}

function drawPitot(v_kmh, dp) {
    const canvas = document.getElementById('canvas-pitot');
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);

    const centerY = h / 2;
    const tubeX = w * 0.4;
    const tubeY = centerY;
    const tubeL = 180;
    const tubeR = 15;

    // 1. Air Flow
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 2;
    const time = Date.now() / 1000;
    for (let i = 0; i < 6; i++) {
        const offset = (time * 100 + i * 60) % 200;
        const lineY = centerY - 100 + i * 40;
        ctx.beginPath();
        ctx.moveTo(w * 0.1 + offset, lineY);
        ctx.lineTo(w * 0.1 + offset + 30, lineY);
        ctx.stroke();
        // Arrow head
        ctx.beginPath();
        ctx.moveTo(w * 0.1 + offset + 25, lineY - 4);
        ctx.lineTo(w * 0.1 + offset + 30, lineY);
        ctx.lineTo(w * 0.1 + offset + 25, lineY + 4);
        ctx.stroke();
    }
    ctx.fillStyle = 'var(--accent)';
    ctx.font = '12px Outfit';
    ctx.fillText("Aire en movimiento", w * 0.1, centerY - 120);
    ctx.fillText(`v = ${formatNum(v_kmh / 3.6, 1)} m/s`, w * 0.1, centerY - 105);

    // 2. Pitot Tube
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.lineJoin = 'round';
    
    // Outer tube
    ctx.beginPath();
    ctx.moveTo(tubeX + tubeL, tubeY - tubeR);
    ctx.lineTo(tubeX, tubeY - tubeR);
    ctx.arc(tubeX, tubeY, tubeR, 1.5 * Math.PI, 0.5 * Math.PI, true);
    ctx.lineTo(tubeX + tubeL, tubeY + tubeR);
    ctx.stroke();

    // Inner passage (Pt)
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
    ctx.beginPath();
    ctx.moveTo(tubeX, tubeY);
    ctx.lineTo(tubeX + tubeL, tubeY);
    ctx.stroke();

    // Static ports (Ps)
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(tubeX + 50, tubeY - tubeR, 3, 0, Math.PI * 2);
    ctx.arc(tubeX + 50, tubeY + tubeR, 3, 0, Math.PI * 2);
    ctx.fill();

    // Labels for Pt and Ps
    ctx.fillStyle = '#f8fafc';
    ctx.font = '11px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText("Pt (Presión Total)", tubeX - 40, tubeY - 25);
    ctx.fillText("Punto de estancamiento", tubeX - 40, tubeY + 35);
    
    ctx.textAlign = 'left';
    ctx.fillText("Ps (Presión Estática)", tubeX + 60, tubeY - tubeR - 10);

    // 3. Sensor connection
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    // From Pt
    ctx.moveTo(tubeX + tubeL, tubeY);
    ctx.lineTo(tubeX + tubeL + 40, tubeY);
    ctx.lineTo(tubeX + tubeL + 40, h - 80);
    // From Ps
    ctx.moveTo(tubeX + 50, tubeY - tubeR);
    ctx.lineTo(tubeX + 50, tubeY - tubeR - 30);
    ctx.lineTo(tubeX + tubeL + 60, tubeY - tubeR - 30);
    ctx.lineTo(tubeX + tubeL + 60, h - 80);
    ctx.stroke();
    ctx.setLineDash([]);

    // Differential Sensor Box
    ctx.fillStyle = 'rgba(30, 41, 59, 0.8)';
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(tubeX + tubeL + 20, h - 80, 60, 40);
    ctx.fillStyle = '#fca5a5';
    ctx.font = 'bold 12px Roboto Mono';
    ctx.fillText("ΔP", tubeX + tubeL + 40, h - 55);
    
    ctx.fillStyle = 'var(--accent)';
    ctx.font = 'bold 14px Roboto Mono';
    ctx.fillText(`${dp} kPa`, tubeX + tubeL + 90, h - 55);

    // 4. Formula & Velocimeter
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px Roboto Mono';
    ctx.fillText("v = √(2ΔP/ρ)", tubeX + tubeL + 20, h - 20);

    // Dial (Velocimeter)
    const dialX = w - 80;
    const dialY = h - 80;
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(dialX, dialY, 50, 0.8 * Math.PI, 2.2 * Math.PI);
    ctx.stroke();
    
    const angle = 0.8 * Math.PI + (Math.min(v_kmh, 1200) / 1200) * 1.4 * Math.PI;
    ctx.beginPath();
    ctx.moveTo(dialX, dialY);
    ctx.lineTo(dialX + Math.cos(angle) * 40, dialY + Math.sin(angle) * 40);
    ctx.stroke();
    
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 14px Roboto Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`${formatNum(v_kmh, 0)} km/h`, dialX, dialY + 15);
    ctx.font = '10px Outfit';
    ctx.fillText("Velocidad calculada", dialX, dialY - 60);

    // Connection arrow from formula to dial
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.3)';
    ctx.beginPath();
    ctx.moveTo(tubeX + tubeL + 150, h - 55);
    ctx.lineTo(dialX - 60, dialY);
    ctx.stroke();
    
    // Small Airplane Context
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.translate(w - 100, 50);
    ctx.scale(0.4, 0.4);
    ctx.fillStyle = '#cbd5e1';
    ctx.beginPath();
    ctx.ellipse(0, 0, 100, 20, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

// --- SIMULADOR 4: BERNOULLI ---
function updateBernoulli() {
    let a1 = getSliderValue('bern-a1', 30);
    let a2 = getSliderValue('bern-a2', 10);
    let p1_kpa = getSliderValue('bern-p1', 200);
    let p2_kpa = getSliderValue('bern-p2', 130);

    // Validaciones APB
    if (a2 >= a1) {
        a2 = a1 - 1;
        document.getElementById('bern-a2').value = a2;
    }
    if (p2_kpa >= p1_kpa) {
        p2_kpa = p1_kpa - 5;
        document.getElementById('bern-p2').value = p2_kpa;
    }

    setDisplay('bern-a1', a1, 'cm²', 0);
    setDisplay('bern-a2', a2, 'cm²', 0);
    setDisplay('bern-p1', p1_kpa, 'kPa', 0);
    setDisplay('bern-p2', p2_kpa, 'kPa', 0);

    const dp = (p1_kpa - p2_kpa) * 1000; // Pa
    if (dp <= 0) {
        document.getElementById('res-bern-v1').innerText = "Err";
        return;
    }

    const ratio = a1 / a2;
    const v1 = Math.sqrt( (2 * dp) / (RHO_WATER * (Math.pow(ratio, 2) - 1)) );
    const v2 = ratio * v1;

    document.getElementById('res-bern-v1').innerText = formatNum(v1);
    document.getElementById('res-bern-v2').innerText = formatNum(v2);
    document.getElementById('res-bern-ratio').innerText = formatNum(ratio, 2);
    drawBernoulli(a1, a2, v1, v2, p1_kpa, p2_kpa);
    renderBernoulliEquations(a1, a2, p1_kpa, p2_kpa, dp, v1, v2);
}

function renderBernoulliEquations(a1, a2, p1, p2, dp, v1, v2) {
    const ratio = a1/a2;
    const content = `
        <div class="equation-section">
            <h5>a) Continuidad</h5>
            <div class="equation-step">\\[ A_1 v_1 = A_2 v_2 \\implies v_2 = (A_1/A_2)v_1 \\]</div>
        </div>
        <div class="equation-section">
            <h5>b) Bernoulli horizontal</h5>
            <div class="equation-step">\\[ P_1 + \\frac{1}{2}\\rho v_1^2 = P_2 + \\frac{1}{2}\\rho v_2^2 \\]</div>
        </div>
        <div class="equation-section">
            <h5>c) Reemplazo y Despeje</h5>
            <div class="equation-step">\\[ P_1 - P_2 = \\frac{1}{2}\\rho [ ((A_1/A_2)v_1)^2 - v_1^2 ] \\]</div>
            <div class="equation-step">\\[ v_1 = \\sqrt{ \\frac{2\\Delta P}{\\rho[(A_1/A_2)^2 - 1]} } \\]</div>
        </div>
        <div class="equation-section" style="grid-column: 1 / -1;">
            <h5>d) Sustitución numérica</h5>
            <div class="equation-step">
                \\[ \\Delta P = ${formatNum(p1-p2)} \\text{ kPa} = ${dp} \\text{ Pa} \\]
                \\[ v_1 = \\sqrt{ \\frac{2 \\cdot ${dp}}{1000 [(${formatNum(ratio, 1)})^2 - 1]} } = ${formatNum(v1)} \\text{ m/s} \\]
                \\[ v_2 = ${formatNum(ratio, 1)} \\cdot ${formatNum(v1)} = ${formatNum(v2)} \\text{ m/s} \\]
            </div>
        </div>
    `;
    renderMathJax('bernoulli-equations-content', content);
}

function drawBernoulli(a1, a2, v1, v2, p1, p2) {
    const canvas = document.getElementById('canvas-bern');
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);

    const centerY = h / 2;
    const r1 = Math.sqrt(a1 / Math.PI) * 10; // scale factor 10
    const r2 = Math.sqrt(a2 / Math.PI) * 10;
    
    // Pipe outline
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, centerY - r1);
    ctx.lineTo(w * 0.3, centerY - r1);
    ctx.lineTo(w * 0.7, centerY - r2);
    ctx.lineTo(w, centerY - r2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, centerY + r1);
    ctx.lineTo(w * 0.3, centerY + r1);
    ctx.lineTo(w * 0.7, centerY + r2);
    ctx.lineTo(w, centerY + r2);
    ctx.stroke();

    // Pressure Gauges (Bars)
    ctx.fillStyle = '#ec4899'; // Pink for pressure
    ctx.fillRect(w * 0.15, centerY - r1 - (p1/5), 20, p1/5);
    ctx.fillRect(w * 0.85, centerY - r2 - (p2/5), 20, p2/5);
    
    // Velocity Arrows
    ctx.strokeStyle = '#10b981'; // Green for velocity
    ctx.lineWidth = 3;
    drawArrow(ctx, w * 0.1, centerY, v1 * 20);
    drawArrow(ctx, w * 0.9, centerY, v2 * 20);
}

function drawArrow(ctx, x, y, length) {
    if (length < 5) return;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.stroke();
    // Head
    ctx.beginPath();
    ctx.moveTo(x + length - 5, y - 5);
    ctx.lineTo(x + length, y);
    ctx.lineTo(x + length - 5, y + 5);
    ctx.stroke();
}

// --- SIMULADOR 5: VENTURI ---
function updateVenturi() {
    let d1 = getSliderValue('vent-d1', 10);
    let d2 = getSliderValue('vent-d2', 6);
    const dp_kpa = getSliderValue('vent-dp', 15);
    const cd = getSliderValue('vent-cd', 1.00);

    // Validación APB
    if (d2 >= d1) {
        d2 = d1 - 0.5;
        document.getElementById('vent-d2').value = d2;
    }

    setDisplay('vent-d1', d1, 'cm', 1);
    setDisplay('vent-d2', d2, 'cm', 1);
    setDisplay('vent-dp', dp_kpa, 'kPa', 0);
    setDisplay('vent-cd', cd, '', 2);

    const a1 = Math.PI * Math.pow(d1 / 100, 2) / 4;
    const a2 = Math.PI * Math.pow(d2 / 100, 2) / 4;
    const dp = dp_kpa * 1000;

    const q_ideal = a2 * Math.sqrt( (2 * dp) / (RHO_WATER * (1 - Math.pow(a2/a1, 2))) );
    const q_real = q_ideal * cd;
    const v2 = q_real / a2;

    document.getElementById('res-vent-q').innerText = formatNum(q_real * 1000, 2);
    document.getElementById('res-vent-qmin').innerText = formatNum(q_real * 60000, 1);
    document.getElementById('res-vent-v2').innerText = formatNum(v2, 2);
    drawVenturi(d1, d2, dp_kpa);
    renderVenturiEquations(d1, d2, a1, a2, dp_kpa, dp, cd, q_real);
}

function renderVenturiEquations(d1, d2, a1, a2, dp_kpa, dp, cd, q) {
    const content = `
        <div class="equation-section">
            <h5>a) Continuidad</h5>
            <div class="equation-step">\\[ A_1 v_1 = A_2 v_2 \\]</div>
        </div>
        <div class="equation-section">
            <h5>b) Bernoulli horizontal</h5>
            <div class="equation-step">\\[ P_1 + \\frac{1}{2}\\rho v_1^2 = P_2 + \\frac{1}{2}\\rho v_2^2 \\]</div>
        </div>
        <div class="equation-section">
            <h5>c) Despeje del Caudal</h5>
            <div class="equation-step">\\[ Q_{ideal} = A_2 \\sqrt{ \\frac{2\\Delta P}{\\rho(1 - (A_2/A_1)^2)} } \\]</div>
            <div class="equation-step">\\[ Q_{real} = C_d \\cdot Q_{ideal} \\]</div>
        </div>
        <div class="equation-section" style="grid-column: 1 / -1;">
            <h5>d) Sustitución dinámica</h5>
            <div class="equation-step">
                \\[ Q = ${cd} \\cdot ${formatNum(a2, 6)} \\sqrt{ \\frac{2 \\cdot ${dp}}{1000 (1 - (${formatNum(a2/a1, 4)})^2)} } \\]
                \\[ Q = ${formatNum(q, 6)} \\text{ m}^3/s = ${formatNum(q*1000, 3)} \\text{ L/s} \\]
            </div>
        </div>
    `;
    renderMathJax('venturi-equations-content', content);
}

function drawVenturi(d1, d2, dp) {
    const canvas = document.getElementById('canvas-vent');
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);
    const centerY = h / 2;
    const s1 = d1 * 4; // scale
    const s2 = d2 * 4;

    // Venturi shape
    ctx.fillStyle = 'rgba(56, 189, 248, 0.1)';
    ctx.beginPath();
    ctx.moveTo(w*0.1, centerY - s1);
    ctx.lineTo(w*0.35, centerY - s1);
    ctx.lineTo(w*0.5, centerY - s2);
    ctx.lineTo(w*0.65, centerY - s1);
    ctx.lineTo(w*0.9, centerY - s1);
    ctx.lineTo(w*0.9, centerY + s1);
    ctx.lineTo(w*0.65, centerY + s1);
    ctx.lineTo(w*0.5, centerY + s2);
    ctx.lineTo(w*0.35, centerY + s1);
    ctx.lineTo(w*0.1, centerY + s1);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Manometer
    ctx.strokeStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(w*0.2, centerY - s1); ctx.lineTo(w*0.2, centerY - s1 - 40);
    ctx.moveTo(w*0.5, centerY - s2); ctx.lineTo(w*0.5, centerY - s1 - 40);
    ctx.stroke();
    
    // U-Tube effect (simulated)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(w*0.18, centerY - s1 - 40 - dp, 10, dp);
    ctx.fillRect(w*0.48, centerY - s1 - 40, 10, 5);
}


// --- SIMULADOR 6: SISTEMA DE BOMBEO ---
function updatePump() {
    const vol = getSliderValue('pump-vol', 1500);
    const rho = getSliderValue('pump-rho', 1000);
    const time_h = getSliderValue('pump-time', 2);
    const za = getSliderValue('pump-za', 1.0);
    const zb = getSliderValue('pump-zb', 3.5);
    const pb_bar = getSliderValue('pump-pb', 0.2);
    const len = getSliderValue('pump-len', 15);
    const diam_in = getSliderValue('pump-diam', 1.5);
    const f = getSliderValue('pump-f', 0.022);
    const eta = getSliderValue('pump-eta', 0.65);

    setDisplay('pump-vol', vol, 'L', 0);
    setDisplay('pump-rho', rho, 'kg/m³', 0);
    setDisplay('pump-time', time_h, 'h', 2);
    setDisplay('pump-za', za, 'm', 1);
    setDisplay('pump-zb', zb, 'm', 1);
    setDisplay('pump-pb', pb_bar, 'bar', 2);
    setDisplay('pump-len', len, 'm', 0);
    setDisplay('pump-diam', diam_in, 'pulgadas', 1);
    setDisplay('pump-f', f, '', 3);
    setDisplay('pump-eta', eta * 100, '%', 0);

    // Validación didáctica zB < zA (No bloquea pero se podría informar)
    // El cálculo físico soporta alturas negativas

    const q = (vol / 1000) / (time_h * 3600); // m3/s
    const dp_pa = pb_bar * 100000; // bar to Pa
    
    const h_est = zb - za;
    const h_p = dp_pa / (rho * G);
    
    // Friction (Darcy-Weisbach)
    const diam_m = diam_in * 0.0254;
    const area = Math.PI * diam_m * diam_m / 4;
    const v = q / area;
    const h_f = f * (len / diam_m) * (v * v / (2 * G));

    const h_total = h_est + h_p + h_f;
    const p_h = rho * G * q * h_total;
    const p_m = p_h / eta;

    document.getElementById('res-pump-q').innerText = formatNum(q * 1000, 2);
    const h_display = document.getElementById('res-pump-h');
    if (h_total < 0) {
        h_display.innerHTML = `<span style="color: var(--danger); font-size: 0.9rem;">${formatNum(h_total, 2)} (No requiere bombeo)</span>`;
    } else {
        h_display.innerText = formatNum(h_total, 2);
    }
    document.getElementById('res-pump-ph').innerText = formatNum(p_h, 1);
    document.getElementById('res-pump-pm-kw').innerText = formatNum(p_m / 1000, 3);
    document.getElementById('res-pump-pm-hp').innerText = formatNum(p_m / 745.7, 2);

    // Guardar en estado global para animación
    pumpState = { ...pumpState, vol, rho, time_h, za, zb, pb_bar, len, diam_in, f, eta, q, h_total, p_h };

    renderPumpEquations(vol, time_h, q, area, v, h_est, h_p, h_f, h_total, p_h, eta, p_m, rho, diam_m);
}

function renderPumpEquations(vol, time, q, a, v, h_est, h_p, h_f, h_total, ph, eta, pm, rho, D) {
    const content = `
        <div class="equation-section">
            <h5>a) Caudal y Velocidad</h5>
            <div class="equation-step">\\[ Q = V/t, \\quad A = \\pi D^2/4, \\quad v = Q/A \\]</div>
        </div>
        <div class="equation-section">
            <h5>b) Altura Manométrica</h5>
            <div class="equation-step">\\[ H_{est} = z_B - z_A \\]</div>
            <div class="equation-note">Donde $z_A$ y $z_B$ son alturas de superficie libre respecto de la bomba ($z=0$).</div>
            <div class="equation-step">\\[ H_p = \\Delta P / (\\rho g), \\quad h_f = f(L/D)(v^2/2g) \\]</div>
            <div class="equation-step">\\[ H = H_{est} + H_p + h_f \\]</div>
        </div>
        <div class="equation-section">
            <h5>c) Potencia</h5>
            <div class="equation-step">\\[ P_h = \\rho g Q H, \\quad P_m = P_h / \\eta \\]</div>
        </div>
        <div class="equation-section" style="grid-column: 1 / -1;">
            <h5>d) Sustitución numérica</h5>
            <div class="equation-step">
                \\[ Q = ${formatNum(q, 6)} \\text{ m}^3/s = ${formatNum(q*1000, 2)} \\text{ L/s} \\]
                \\[ v = ${formatNum(v, 2)} \\text{ m/s}, \\quad H_{est} = ${formatNum(h_est, 1)} \\text{ m} \\]
                \\[ H_p = ${formatNum(h_p, 2)} \\text{ m}, \\quad h_f = ${formatNum(h_f, 2)} \\text{ m} \\]
                \\[ H_{total} = ${formatNum(h_total, 2)} \\text{ m} \\]
                \\[ P_h = ${formatNum(rho, 0)} \\cdot 9,81 \\cdot ${formatNum(q, 6)} \\cdot ${formatNum(h_total, 2)} = ${formatNum(ph, 1)} \\text{ W} \\]
                \\[ P_m = ${formatNum(ph, 1)} / ${eta} = ${formatNum(pm/1000, 3)} \\text{ kW} \\]
            </div>
        </div>
    `;
    renderMathJax('pump-equations-content', content);
}

function animatePumpScene() {
    const activeTab = document.querySelector('.nav-btn.active').dataset.tab;
    if (activeTab === 'tab-bombas') {
        // Velocidad de animación proporcional al caudal
        // Ajustamos la escala para que sea visible
        const speed = Math.max(0.1, pumpState.q * 5000); 
        pumpState.phase = (pumpState.phase + speed) % 100;
        drawPump();
    }
    requestAnimationFrame(animatePumpScene);
}

function drawPump() {
    const canvas = document.getElementById('canvas-pump');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width = canvas.parentElement.clientWidth;
    const h = canvas.height = canvas.parentElement.clientHeight;

    ctx.clearRect(0, 0, w, h);

    const { za, zb, rho, h_total, phase, q } = pumpState;

    // --- CONFIGURACIÓN DE ESCALA Y POSICIÓN ---
    // Referencia fija: Bomba en z=0
    const pumpX = w * 0.35;
    const pumpY = h * 0.75; 
    const pumpR = 25;
    
    // Escala: 0 a 25m para dar margen (zA=10, zB=20)
    const maxZ_visual = 25;
    const hScale = (h * 0.7) / maxZ_visual;

    // Tanques: Geometría estable y contenedora
    const tankAW = w * 0.14;
    const tankBW = w * 0.14;
    const tankAX = w * 0.05;
    const tankBX = w * 0.78;
    
    // Altura del tanque suficiente para cubrir el rango visual
    // Base a z = -2, Tope a z = 22
    const tankBaseY = pumpY + (2 * hScale);
    const tankTopY = pumpY - (22 * hScale);
    const tankH = tankBaseY - tankTopY;

    // Niveles de líquido (exactos respecto a zA y zB)
    const zaY = pumpY - za * hScale;
    const zbY = pumpY - zb * hScale;

    // Colores
    const fluidAlpha = Math.min(0.8, 0.3 + (rho - 700) / 1000);
    const fluidColor = `rgba(59, 130, 246, ${fluidAlpha})`;
    const surfaceColor = `rgba(37, 99, 235, 1)`;

    // --- LÍNEAS DE REFERENCIA zA y zB (DIBUJAR PRIMERO) ---
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(248, 250, 252, 0.3)';
    ctx.lineWidth = 1;
    
    // Línea zA (desde el nivel del agua hasta el indicador lateral)
    ctx.beginPath();
    ctx.moveTo(tankAX + tankAW, zaY);
    ctx.lineTo(w * 0.75, zaY);
    ctx.stroke();
    
    // Línea zB
    ctx.beginPath();
    ctx.moveTo(tankBX, zbY);
    ctx.lineTo(w * 0.75, zbY);
    ctx.stroke();

    // Línea referencia Bomba (z=0)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, pumpY);
    ctx.lineTo(w, pumpY);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- DIBUJO TANQUE A ---
    // Líquido con clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(tankAX, tankTopY, tankAW, tankH);
    ctx.clip();
    ctx.fillStyle = fluidColor;
    ctx.fillRect(tankAX, zaY, tankAW, tankBaseY - zaY);
    // Superficie
    ctx.strokeStyle = surfaceColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tankAX, zaY);
    ctx.lineTo(tankAX + tankAW, zaY);
    ctx.stroke();
    ctx.restore();
    
    // Estructura
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(tankAX, tankTopY, tankAW, tankH);

    // --- DIBUJO TANQUE B ---
    // Líquido con clipping
    ctx.save();
    ctx.beginPath();
    ctx.rect(tankBX, tankTopY, tankBW, tankH);
    ctx.clip();
    ctx.fillStyle = fluidColor;
    ctx.fillRect(tankBX, zbY, tankBW, tankBaseY - zbY);
    // Superficie
    ctx.strokeStyle = surfaceColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tankBX, zbY);
    ctx.lineTo(tankBX + tankBW, zbY);
    ctx.stroke();
    ctx.restore();
    
    // Estructura
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.strokeRect(tankBX, tankTopY, tankBW, tankH);

    // --- CAÑERÍA Y FLUJO ---
    // Puntos de conexión prolijos (llegan a la pared del tanque)
    const points = [
        {x: tankAX + tankAW, y: pumpY},       // Salida Tanque A (Horizontal con bomba)
        {x: pumpX - pumpR, y: pumpY},         // Entrada Bomba
        {x: pumpX + pumpR, y: pumpY},         // Salida Bomba
        {x: tankBX - 40, y: pumpY},           // Codo inferior
        {x: tankBX - 40, y: zbY},             // Codo superior (nivel descarga)
        {x: tankBX, y: zbY}                   // Entrada Tanque B (pared lateral)
    ];

    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.moveTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.lineTo(points[4].x, points[4].y);
    ctx.lineTo(points[5].x, points[5].y);
    ctx.stroke();

    // Animación de flujo
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 20]);
    ctx.lineDashOffset = -phase * 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(points[2].x, points[2].y);
    ctx.lineTo(points[3].x, points[3].y);
    ctx.lineTo(points[4].x, points[4].y);
    ctx.lineTo(points[5].x, points[5].y);
    ctx.stroke();
    ctx.setLineDash([]);

    // --- BOMBA ---
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(pumpX, pumpY, pumpR, 0, Math.PI * 2);
    ctx.stroke();
    
    // Impulsor animado
    ctx.save();
    ctx.translate(pumpX, pumpY);
    ctx.rotate(phase * 0.1);
    ctx.strokeStyle = 'var(--accent)';
    ctx.lineWidth = 2;
    for(let i=0; i<3; i++) {
        ctx.beginPath();
        ctx.moveTo(0,0);
        ctx.lineTo(pumpR - 5, 0);
        ctx.stroke();
        ctx.rotate((Math.PI * 2) / 3);
    }
    ctx.restore();

    ctx.fillStyle = '#f8fafc';
    ctx.textAlign = 'center';
    ctx.font = 'bold 11px Outfit';
    ctx.fillText("BOMBA (z=0)", pumpX, pumpY + pumpR + 15);

    // --- ETIQUETAS DE NIVEL ---
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px Roboto Mono';
    ctx.textAlign = 'left';
    ctx.fillText(`zA = ${formatNum(za,1)}m`, tankAX + 5, zaY - 5);
    ctx.fillText(`zB = ${formatNum(zb,1)}m`, tankBX + 5, zbY - 5);

    // --- FLECHA Δz (DIBUJAR AL FINAL EN ZONA DESPEJADA) ---
    const arrowX = w * 0.72; // Entre el Tanque A y el Tanque B
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(arrowX, zaY);
    ctx.lineTo(arrowX, zbY);
    ctx.stroke();
    
    const headSize = 6;
    if (zb >= za) {
        ctx.beginPath();
        ctx.moveTo(arrowX - headSize, zbY + headSize);
        ctx.lineTo(arrowX, zbY);
        ctx.lineTo(arrowX + headSize, zbY + headSize);
        ctx.stroke();
    } else {
        ctx.beginPath();
        ctx.moveTo(arrowX - headSize, zbY - headSize);
        ctx.lineTo(arrowX, zbY);
        ctx.lineTo(arrowX + headSize, zbY - headSize);
        ctx.stroke();
        
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 10px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText("B < A", arrowX, zbY + 15);
    }

    ctx.fillStyle = '#ef4444';
    ctx.textAlign = 'right';
    ctx.font = 'bold 12px Roboto Mono';
    ctx.fillText(`Δz = ${formatNum(zb-za, 2)}m`, arrowX - 10, (zaY + zbY)/2);

    // H Total flotando arriba
    ctx.fillStyle = 'var(--accent)';
    ctx.font = 'bold 14px Roboto Mono';
    ctx.textAlign = 'center';
    ctx.fillText(`H total = ${formatNum(h_total, 2)} m`, w * 0.5, h * 0.1);
}

// --- MODAL ACERCA DE ---
function initAboutModal() {
    const btnAbout = document.getElementById('btn-about');
    const aboutModal = document.getElementById('about-modal');
    const btnAboutClose = document.getElementById('btn-about-close');
    const backdrop = aboutModal.querySelector('.modal-backdrop');

    const openModal = () => {
        aboutModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        aboutModal.classList.add('hidden');
        document.body.style.overflow = '';
    };

    if (btnAbout) btnAbout.addEventListener('click', openModal);
    if (btnAboutClose) btnAboutClose.addEventListener('click', closeModal);
    if (backdrop) backdrop.addEventListener('click', closeModal);

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !aboutModal.classList.contains('hidden')) {
            closeModal();
        }
    });
}
