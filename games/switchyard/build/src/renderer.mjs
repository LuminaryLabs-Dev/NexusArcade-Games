import { WORLD_W, WORLD_H, STATIONS, TRAIN_DIMS } from './constants.mjs';
export class Renderer2D {
  constructor(canvas, sim) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.sim = sim;
    this.scale = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.dpr = 1;

    // Static scenery elements cache (trees, lamp posts)
    this.trees = [];
    this.initScenery();
  }

  initScenery() {
    this.trees = [
      { x: 140, y: 80, r: 18, color: '#2d4a22' },
      { x: 175, y: 105, r: 14, color: '#385e2b' },
      { x: 110, y: 640, r: 16, color: '#2d4a22' },
      { x: 145, y: 665, r: 20, color: '#385e2b' },
      { x: 370, y: 120, r: 15, color: '#2b4720' },
      { x: 480, y: 220, r: 14, color: '#385e2b' },
      { x: 490, y: 500, r: 15, color: '#2d4a22' },
      { x: 670, y: 110, r: 16, color: '#385e2b' },
      { x: 690, y: 620, r: 18, color: '#2d4a22' }
    ];
  }

  resize() {
    const bounds = this.canvas.parentElement.getBoundingClientRect();
    const rect = { width: Math.max(1, bounds.width), height: Math.max(1, bounds.height) };
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);

    const aspect = WORLD_W / WORLD_H;
    const containerAspect = rect.width / rect.height;

    if (containerAspect > aspect) {
      this.scale = rect.height / WORLD_H;
      this.offsetX = (rect.width - WORLD_W * this.scale) / 2;
      this.offsetY = 0;
    } else {
      this.scale = rect.width / WORLD_W;
      this.offsetX = 0;
      this.offsetY = (rect.height - WORLD_H * this.scale) / 2;
    }
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left - this.offsetX) / this.scale,
      y: (clientY - rect.top - this.offsetY) / this.scale
    };
  }

  render() {
    const ctx = this.ctx;
    ctx.save();
    ctx.setTransform(this.scale * this.dpr, 0, 0, this.scale * this.dpr, this.offsetX * this.dpr, this.offsetY * this.dpr);

    // 1. Diorama Ground & Terrain Base
    this.renderGround(ctx);

    // 2. Scenery & Backdrop Trees
    this.renderScenery(ctx);

    // 3. Track Sleepers, Rails, and Junction Frogs
    this.renderRailway(ctx);

    // 4. Station Terminals & Platforms
    this.renderStations(ctx);

    // 5. Interactive Path & Target Station Previews
    this.renderPathPreviews(ctx);

    // 6. Entrance Signals & Switch Levers
    this.renderSignalsAndSwitches(ctx);

    // 7. Hazard & Merge Warning Indicator
    if (this.sim.nearConflictActive) {
      this.renderMergeWarning(ctx);
    }

    // 8. Trains (Locomotive & Trailing Carriages)
    this.renderTrains(ctx);

    // 9. Particles & Visual Effects
    this.renderParticles(ctx);

    // 10. Floating Score & Indicator Labels
    this.renderFloatingScores(ctx);

    ctx.restore();
  }

  renderGround(ctx) {
    // Rich diorama yard ballast bed
    const grad = ctx.createLinearGradient(0, 0, WORLD_W, WORLD_H);
    grad.addColorStop(0, '#161d27');
    grad.addColorStop(0.5, '#1b2330');
    grad.addColorStop(1, '#151b24');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);

    // Subtle diorama ground grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_W; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_H);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD_H; y += 60) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_W, y);
      ctx.stroke();
    }
  }

  renderScenery(ctx) {
    // Trees with drop shadows
    for (const tree of this.trees) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(tree.x + 4, tree.y + 4, tree.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = tree.color;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, Math.PI * 2);
      ctx.fill();

      // Tree highlight
      ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.beginPath();
      ctx.arc(tree.x - tree.r * 0.3, tree.y - tree.r * 0.3, tree.r * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  renderRailway(ctx) {
    const allPaths = Object.values(this.sim.topology.paths);

    // Pass 1: Ballast gravel bed
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#28313e';
    ctx.lineWidth = 26;
    for (const p of allPaths) {
      this.strokeTrackPath(ctx, p);
    }

    // Pass 2: Wooden Sleepers (Ties) spaced along arc length
    ctx.lineWidth = 2;
    for (const p of allPaths) {
      const step = 14;
      for (let d = 4; d < p.length - 4; d += step) {
        const pt = p.getPointAt(d);
        const perpX = -Math.sin(pt.angle) * 10;
        const perpY = Math.cos(pt.angle) * 10;
        ctx.strokeStyle = '#433728';
        ctx.beginPath();
        ctx.moveTo(pt.x - perpX, pt.y - perpY);
        ctx.lineTo(pt.x + perpX, pt.y + perpY);
        ctx.stroke();
      }
    }

    // Pass 3: Parallel Steel Rails
    for (const p of allPaths) {
      // Draw outer dark shadow rail
      this.drawParallelRails(ctx, p, 5, '#4b5563', 2);
      // Draw bright steel head rail
      this.drawParallelRails(ctx, p, 4, '#cbd5e1', 1.5);
    }

    // Pass 4: Highlight currently selected routes from Switches
    this.highlightActiveRoutes(ctx);
  }

  renderPathPreviews(ctx) {
    // Determine which trains to draw projected routing paths for
    const activeTrains = this.sim.trains.filter(t => !t.isRemoved && !t.isDelivering && !t.isCrashed);
    for (const train of activeTrains) {
      const isInspected = this.sim.inspectedTrain && this.sim.inspectedTrain.id === train.id;
      // Predict route based on current switches if not yet committed
      const predA = train.committedBranchA !== null ? train.committedBranchA : this.sim.switchA.state;
      const swTarget = predA === 0 ? this.sim.switchB : this.sim.switchC;
      const predFinal = train.committedBranchFinal !== null ? train.committedBranchFinal : swTarget.state;
      const projectedStationId = this.sim.committedBranchFinalToStation(predA, predFinal);
      const isCorrectStation = projectedStationId === train.destination.id;

      // Draw projected target station halo
      const targetStation = STATIONS[projectedStationId];
      if (targetStation && (isInspected || this.sim.nearConflictActive)) {
        ctx.save();
        ctx.strokeStyle = isCorrectStation ? 'rgba(34, 197, 94, 0.7)' : 'rgba(239, 68, 68, 0.8)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(targetStation.x + 10, targetStation.y - 32, 96, 64);
        ctx.restore();
      }

      // Draw animated dashed trajectory arrow if train is inspected or braking
      if (isInspected || train.isBraking || train.isTurbo) {
        ctx.save();
        const strokeColor = isCorrectStation ? 'rgba(74, 222, 128, 0.65)' : 'rgba(248, 113, 113, 0.75)';
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 3;
        ctx.setLineDash([8, 6]);
        ctx.lineDashOffset = -performance.now() * 0.03;

        // Trace remaining segments from train to destination
        const pathsToDraw = [];
        if (train.stage === 'APPROACH') {
          pathsToDraw.push(train.entrance === 'N' ? this.sim.topology.getPath('N_MERGE') : this.sim.topology.getPath('S_MERGE'));
          pathsToDraw.push(this.sim.topology.getPath('TRUNK'));
          pathsToDraw.push(predA === 0 ? this.sim.topology.getPath('A_UPPER') : this.sim.topology.getPath('A_LOWER'));
          pathsToDraw.push(predA === 0 ? (predFinal === 0 ? this.sim.topology.getPath('B_AMBER') : this.sim.topology.getPath('B_CYAN')) : (predFinal === 0 ? this.sim.topology.getPath('C_MAGENTA') : this.sim.topology.getPath('C_LIME')));
        } else if (train.stage === 'MERGE') {
          pathsToDraw.push(this.sim.topology.getPath('TRUNK'));
          pathsToDraw.push(predA === 0 ? this.sim.topology.getPath('A_UPPER') : this.sim.topology.getPath('A_LOWER'));
          pathsToDraw.push(predA === 0 ? (predFinal === 0 ? this.sim.topology.getPath('B_AMBER') : this.sim.topology.getPath('B_CYAN')) : (predFinal === 0 ? this.sim.topology.getPath('C_MAGENTA') : this.sim.topology.getPath('C_LIME')));
        } else if (train.stage === 'TRUNK') {
          pathsToDraw.push(predA === 0 ? this.sim.topology.getPath('A_UPPER') : this.sim.topology.getPath('A_LOWER'));
          pathsToDraw.push(predA === 0 ? (predFinal === 0 ? this.sim.topology.getPath('B_AMBER') : this.sim.topology.getPath('B_CYAN')) : (predFinal === 0 ? this.sim.topology.getPath('C_MAGENTA') : this.sim.topology.getPath('C_LIME')));
        } else if (train.stage === 'BRANCH_1') {
          pathsToDraw.push(predA === 0 ? (predFinal === 0 ? this.sim.topology.getPath('B_AMBER') : this.sim.topology.getPath('B_CYAN')) : (predFinal === 0 ? this.sim.topology.getPath('C_MAGENTA') : this.sim.topology.getPath('C_LIME')));
        }
        for (const p of pathsToDraw) {
          this.strokeTrackPath(ctx, p);
        }
        ctx.restore();
      }
    }
  }

  strokeTrackPath(ctx, p) {
    ctx.beginPath();
    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i];
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
  }

  drawParallelRails(ctx, p, offset, strokeStyle, lineWidth) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;

    // Left rail
    ctx.beginPath();
    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i];
      const ox = -Math.sin(pt.angle) * offset;
      const oy = Math.cos(pt.angle) * offset;
      if (i === 0) ctx.moveTo(pt.x + ox, pt.y + oy);
      else ctx.lineTo(pt.x + ox, pt.y + oy);
    }
    ctx.stroke();

    // Right rail
    ctx.beginPath();
    for (let i = 0; i < p.points.length; i++) {
      const pt = p.points[i];
      const ox = Math.sin(pt.angle) * offset;
      const oy = -Math.cos(pt.angle) * offset;
      if (i === 0) ctx.moveTo(pt.x + ox, pt.y + oy);
      else ctx.lineTo(pt.x + ox, pt.y + oy);
    }
    ctx.stroke();
  }

  highlightActiveRoutes(ctx) {
    ctx.save();
    ctx.lineWidth = 3;

    // Switch A active branch
    const swA = this.sim.switchA;
    const pathA = swA.state === 0 ? this.sim.topology.getPath('A_UPPER') : this.sim.topology.getPath('A_LOWER');
    ctx.strokeStyle = swA.brightPulse > 0 ? `rgba(250, 204, 21, ${0.4 + swA.brightPulse * 0.5})` : 'rgba(56, 189, 248, 0.45)';
    this.strokeTrackPath(ctx, pathA);

    // Switch B active branch
    const swB = this.sim.switchB;
    const pathB = swB.state === 0 ? this.sim.topology.getPath('B_AMBER') : this.sim.topology.getPath('B_CYAN');
    ctx.strokeStyle = swB.brightPulse > 0 ? `rgba(250, 204, 21, ${0.4 + swB.brightPulse * 0.5})` : 'rgba(56, 189, 248, 0.45)';
    this.strokeTrackPath(ctx, pathB);

    // Switch C active branch
    const swC = this.sim.switchC;
    const pathC = swC.state === 0 ? this.sim.topology.getPath('C_MAGENTA') : this.sim.topology.getPath('C_LIME');
    ctx.strokeStyle = swC.brightPulse > 0 ? `rgba(250, 204, 21, ${0.4 + swC.brightPulse * 0.5})` : 'rgba(56, 189, 248, 0.45)';
    this.strokeTrackPath(ctx, pathC);

    ctx.restore();
  }

  renderStations(ctx) {
    const list = [STATIONS.AMBER, STATIONS.CYAN, STATIONS.MAGENTA, STATIONS.LIME];
    for (const st of list) {
      ctx.save();
      ctx.translate(st.x, st.y);

      // Station Buffer Stops (track dead-end bumpers)
      ctx.fillStyle = '#64748b';
      ctx.fillRect(-8, -12, 16, 24);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, -10, 6, 20);

      // Platform Building Slab
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(16, -26, 90, 52); // Drop shadow
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = st.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(14, -28, 88, 56, 8);
      ctx.fill();
      ctx.stroke();

      // Platform Safety Edge Line (Yellow / Black hazard pattern)
      ctx.fillStyle = st.color;
      ctx.fillRect(14, -28, 6, 56);

      // Station Title & Accessible Symbol
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${st.symbol} ${st.label}`, 26, -6);

      ctx.fillStyle = st.glow;
      ctx.font = '11px -apple-system, sans-serif';
      ctx.fillText(`TERMINAL`, 26, 12);

      ctx.restore();
    }
  }

  renderSignalsAndSwitches(ctx) {
    // Entrance Stop Lines & Signal Lights
    const signals = [this.sim.signalN, this.sim.signalS];
    for (const sig of signals) {
      ctx.save();
      // Draw Stop Line painted across track
      ctx.fillStyle = sig.isGreen ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.9)';
      ctx.fillRect(sig.stopX - 3, sig.stopY - 14, 6, 28);

      // Signal Gantry Pole
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sig.mastX, sig.stopY);
      ctx.lineTo(sig.mastX, sig.mastY);
      ctx.stroke();

      // Signal Lamp Head Box
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(sig.mastX - 16, sig.mastY - 18, 32, 36, 6);
      ctx.fill();
      ctx.stroke();

      // Glowing Lamp
      const lampColor = sig.isGreen ? '#22c55e' : '#ef4444';
      ctx.fillStyle = lampColor;
      ctx.shadowColor = lampColor;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(sig.mastX, sig.mastY, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Clickable Target Hint / Hotspot Ring
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(sig.mastX, sig.mastY, 24, 0, Math.PI * 2);
      ctx.stroke();

      // Label
      ctx.fillStyle = '#cbd5e1';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sig.label, sig.mastX, sig.mastY + (sig.entrance === 'N' ? -24 : 32));

      ctx.restore();
    }

    // Switch Ground Throws & Mechanical Levers
    const switches = [this.sim.switchA, this.sim.switchB, this.sim.switchC];
    for (const sw of switches) {
      ctx.save();
      ctx.translate(sw.x, sw.y);

      // Cast iron base stand
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Mechanical Lever
      ctx.save();
      ctx.rotate(sw.leverCurrentAngle);
      ctx.strokeStyle = sw.locked ? '#94a3b8' : '#f8fafc';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -22);
      ctx.stroke();

      // Counterweight ball at lever tip
      ctx.fillStyle = sw.locked ? '#f59e0b' : '#38bdf8';
      ctx.beginPath();
      ctx.arc(0, -22, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Lock indicator badge if locked
      if (sw.locked || sw.lockPulse > 0) {
        ctx.fillStyle = sw.lockPulse > 0 ? '#ef4444' : '#f59e0b';
        ctx.beginPath();
        ctx.arc(0, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🔒', 0, 0);
      }

      // Switch Name & Current Branch Text
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 12px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sw.label, 0, -32);

      const branchName = sw.branches[sw.state];
      ctx.fillStyle = '#38bdf8';
      ctx.font = '600 11px -apple-system, sans-serif';
      ctx.fillText(`→ ${branchName}`, 0, 32);

      // Clickable circular hotspot hint
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(0, 0, 32, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();
    }
  }

  renderMergeWarning(ctx) {
    // Animated merge junction caution box
    ctx.save();
    const t = performance.now() * 0.005;
    const alpha = 0.4 + Math.sin(t) * 0.3;
    ctx.fillStyle = `rgba(245, 158, 11, ${alpha * 0.25})`;
    ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 6]);

    ctx.beginPath();
    ctx.roundRect(360, 310, 110, 100, 12);
    ctx.fill();
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚠️ CAUTION: MERGE', 415, 300);
    ctx.restore();
  }

  renderTrains(ctx) {
    for (const train of this.sim.trains) {
      if (train.isRemoved) continue;

      // 1. Render Trailing Passenger Carriage
      this.drawCarriage(ctx, train);

      // 2. Render Lead Locomotive
      this.drawLocomotive(ctx, train);
    }
  }

  drawLocomotive(ctx, train) {
    const pos = train.locoPos;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.angle);

    if (train.isDelivering) {
      ctx.globalAlpha = Math.max(0, 1 - train.deliveryProgress);
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.beginPath();
    ctx.roundRect(-TRAIN_DIMS.locoLength / 2 + 3, -TRAIN_DIMS.locoWidth / 2 + 3, TRAIN_DIMS.locoLength, TRAIN_DIMS.locoWidth, 5);
    ctx.fill();

    // Headlight soft beam casting forward
    ctx.fillStyle = 'rgba(254, 240, 138, 0.15)';
    ctx.beginPath();
    ctx.moveTo(TRAIN_DIMS.locoLength / 2, 0);
    ctx.lineTo(TRAIN_DIMS.locoLength / 2 + 45, -18);
    ctx.lineTo(TRAIN_DIMS.locoLength / 2 + 45, 18);
    ctx.closePath();
    ctx.fill();

    // Locomotive Body
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-TRAIN_DIMS.locoLength / 2, -TRAIN_DIMS.locoWidth / 2, TRAIN_DIMS.locoLength, TRAIN_DIMS.locoWidth, 6);
    ctx.fill();
    ctx.stroke();

    // Enamel Destination Color Cowl / Stripe
    ctx.fillStyle = train.destination.color;
    ctx.beginPath();
    ctx.roundRect(0, -TRAIN_DIMS.locoWidth / 2, TRAIN_DIMS.locoLength / 2, TRAIN_DIMS.locoWidth, [0, 6, 6, 0]);
    ctx.fill();

    // Cab Windows
    ctx.fillStyle = '#bae6fd';
    ctx.fillRect(-6, -TRAIN_DIMS.locoWidth / 2 + 2, 5, TRAIN_DIMS.locoWidth - 4);

    // Active Emergency Brake / Turbo Visual Indicators
    if (train.isBraking) {
      // Pulsing red stop badge above cab
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(0, -TRAIN_DIMS.locoWidth / 2 - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('🛑', 0, -TRAIN_DIMS.locoWidth / 2 - 7);
    } else if (train.isTurbo) {
      // Golden lightning boost flare
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(0, -TRAIN_DIMS.locoWidth / 2 - 8, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 9px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⚡', 0, -TRAIN_DIMS.locoWidth / 2 - 7);
    }

    // Embossed Destination Symbol on cab roof
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(train.destination.symbol, 8, 0);

    // Front Headlight lens
    ctx.fillStyle = train.isTurbo ? '#67e8f9' : '#fef08a';
    ctx.beginPath();
    ctx.arc(TRAIN_DIMS.locoLength / 2, 0, train.isTurbo ? 4.5 : 3, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  drawCarriage(ctx, train) {
    const pos = train.carPos;
    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate(pos.angle);

    if (train.isDelivering) {
      ctx.globalAlpha = Math.max(0, 1 - train.deliveryProgress);
    }

    // Drop shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.beginPath();
    ctx.roundRect(-TRAIN_DIMS.carLength / 2 + 3, -TRAIN_DIMS.carWidth / 2 + 3, TRAIN_DIMS.carLength, TRAIN_DIMS.carWidth, 4);
    ctx.fill();

    // Carriage Body
    ctx.fillStyle = '#334155';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(-TRAIN_DIMS.carLength / 2, -TRAIN_DIMS.carWidth / 2, TRAIN_DIMS.carLength, TRAIN_DIMS.carWidth, 4);
    ctx.fill();
    ctx.stroke();

    // Accent Stripe
    ctx.fillStyle = train.destination.color;
    ctx.fillRect(-TRAIN_DIMS.carLength / 2 + 2, -2, TRAIN_DIMS.carLength - 4, 4);

    // Passenger Windows
    ctx.fillStyle = '#fef08a';
    for (let wx = -8; wx <= 8; wx += 8) {
      ctx.fillRect(wx - 2, -TRAIN_DIMS.carWidth / 2 + 2, 4, 2);
      ctx.fillRect(wx - 2, TRAIN_DIMS.carWidth / 2 - 4, 4, 2);
    }

    ctx.restore();
  }

  renderParticles(ctx) {
    for (const p of this.sim.particles) {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1.0;
  }

  renderFloatingScores(ctx) {
    ctx.save();
    for (const f of this.sim.floatingScores) {
      ctx.globalAlpha = Math.max(0, f.life);
      ctx.fillStyle = f.color;
      ctx.font = 'bold 15px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 6;
      ctx.fillText(f.text, f.x, f.y);
    }
    ctx.restore();
  }
}

// =============================================================================
// SECTION 9: USER INTERFACE, ACCESSIBILITY & CONTROLS
// =============================================================================
