import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { appState } from '../appState';
import { useStore } from '../store';
import type { GraphNode, GraphEdge, PriorityLevel } from '../types';

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_RADIUS: Record<PriorityLevel, number> = {
  critical: 120,
  high:     240,
  medium:   380,
  low:      560,
  background: 760,
};

const TYPE_COLOR: Record<string, number> = {
  client:       0x3b82f6,
  prospect:     0x8b5cf6,
  referrer:     0x10b981,
  adviser:      0xf59e0b,
  jpmorgan:     0xef4444,
  organisation: 0x6b7280,
};

const PRIORITY_GLOW: Record<PriorityLevel, number> = {
  critical:   0xff4444,
  high:       0xff9944,
  medium:     0xffffff,
  low:        0x8888aa,
  background: 0x444466,
};

const NODE_RADIUS = 10;

// ============================================================================
// FIBONACCI SPHERE — evenly distributes N points on a sphere of given radius
// ============================================================================
function fibonacciSphere(n: number, radius: number): THREE.Vector3[] {
  if (n === 0) return [];
  if (n === 1) return [new THREE.Vector3(radius, 0, 0)];
  const golden = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: n }, (_, i) => {
    const y = 1 - (i / (n - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * i;
    return new THREE.Vector3(
      Math.cos(theta) * r * radius,
      y * radius,
      Math.sin(theta) * r * radius,
    );
  });
}

// ============================================================================
// ORBIT CONTROLS (minimal — no dep needed)
// ============================================================================
class OrbitControls {
  camera: THREE.PerspectiveCamera;
  domElement: HTMLElement;
  target = new THREE.Vector3(0, 0, 0);
  spherical = new THREE.Spherical(900, Math.PI / 3, 0.3);
  private isDragging = false;
  private isRightDragging = false;
  private lastX = 0;
  private lastY = 0;
  private listeners: Array<[string, EventListener]> = [];

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.domElement = domElement;
    this.update();
    this.bind();
  }

  private on(type: string, fn: EventListener) {
    this.domElement.addEventListener(type, fn, { passive: false });
    this.listeners.push([type, fn]);
  }

  bind() {
    this.on('mousedown', (e: Event) => {
      const me = e as MouseEvent;
      if (me.button === 0) { this.isDragging = true; }
      if (me.button === 2) { this.isRightDragging = true; }
      this.lastX = me.clientX; this.lastY = me.clientY;
    });
    window.addEventListener('mouseup', () => { this.isDragging = false; this.isRightDragging = false; });
    window.addEventListener('mousemove', (e: MouseEvent) => {
      if (!this.isDragging && !this.isRightDragging) return;
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      this.lastX = e.clientX; this.lastY = e.clientY;
      if (this.isDragging) {
        this.spherical.theta -= dx * 0.005;
        this.spherical.phi   = Math.max(0.1, Math.min(Math.PI - 0.1, this.spherical.phi + dy * 0.005));
      }
      if (this.isRightDragging) {
        const right = new THREE.Vector3().crossVectors(
          this.camera.getWorldDirection(new THREE.Vector3()),
          this.camera.up
        ).normalize();
        const up = this.camera.up.clone().normalize();
        const pan = right.multiplyScalar(-dx * 0.8).add(up.clone().multiplyScalar(dy * 0.8));
        this.target.add(pan);
      }
      this.update();
    });
    this.on('wheel', (e: Event) => {
      const we = e as WheelEvent;
      we.preventDefault();
      this.spherical.radius = Math.max(80, Math.min(2000, this.spherical.radius + we.deltaY * 0.5));
      this.update();
    });
  }

  update() {
    const pos = new THREE.Vector3().setFromSpherical(this.spherical).add(this.target);
    this.camera.position.copy(pos);
    this.camera.lookAt(this.target);
  }

  dispose() {
    this.listeners.forEach(([type, fn]) => this.domElement.removeEventListener(type, fn));
  }
}

// ============================================================================
// CANVAS 3D COMPONENT
// ============================================================================
export default function Canvas3D() {
  const mountRef = useRef<HTMLDivElement>(null);
  const { bumpDetail } = useStore();

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // ── Scene setup ──────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x04060f);
    scene.fog = new THREE.FogExp2(0x04060f, 0.00045);

    const W = container.clientWidth;
    const H = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(55, W / H, 1, 8000);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);

    // ── Ambient + point lights ────────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(0x1a1a2e, 2));
    const sun = new THREE.PointLight(0xffffff, 2, 2000);
    scene.add(sun);

    // ── Star field ───────────────────────────────────────────────────────────
    const starGeo = new THREE.BufferGeometry();
    const starVerts: number[] = [];
    for (let i = 0; i < 3000; i++) {
      const r = 2000 + Math.random() * 2000;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      starVerts.push(
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta),
      );
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starVerts, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.8 })));

    // ── Orbital shell rings ───────────────────────────────────────────────────
    const priorities: PriorityLevel[] = ['critical', 'high', 'medium', 'low', 'background'];
    priorities.forEach((p) => {
      const geo = new THREE.TorusGeometry(PRIORITY_RADIUS[p], 0.4, 8, 128);
      const mat = new THREE.MeshBasicMaterial({ color: PRIORITY_GLOW[p], transparent: true, opacity: 0.12 });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
    });

    // ── Label canvas helper ───────────────────────────────────────────────────
    function makeLabel(text: string, color: string): THREE.Sprite {
      const canvas = document.createElement('canvas');
      canvas.width  = 256;
      canvas.height = 64;
      const ctx = canvas.getContext('2d')!;
      ctx.clearRect(0, 0, 256, 64);
      ctx.font = 'bold 22px Inter, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = color;
      ctx.fillText(text, 128, 40);
      const tex = new THREE.CanvasTexture(canvas);
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(60, 15, 1);
      return sprite;
    }

    // ── Build scene from appState ─────────────────────────────────────────────
    const nodeMeshMap = new Map<string, THREE.Mesh>();
    const edgeLineMap = new Map<string, THREE.Line>();

    function buildScene() {
      // Clear existing nodes/edges
      for (const [, mesh] of nodeMeshMap) scene.remove(mesh.parent ?? mesh);
      for (const [, line] of edgeLineMap) scene.remove(line);
      nodeMeshMap.clear();
      edgeLineMap.clear();

      const nodes = Array.from(appState.simulation.nodes.values());

      // Group by priority
      const byPriority: Record<PriorityLevel, GraphNode[]> = {
        critical: [], high: [], medium: [], low: [], background: [],
      };
      for (const n of nodes) byPriority[n.priority || 'medium'].push(n);

      // Assign 3D positions
      const nodePos = new Map<string, THREE.Vector3>();
      for (const p of priorities) {
        const group = byPriority[p];
        const positions = fibonacciSphere(group.length, PRIORITY_RADIUS[p]);
        group.forEach((n, i) => nodePos.set(n.id, positions[i]));
      }

      // Create node spheres
      for (const n of nodes) {
        const pos = nodePos.get(n.id)!;
        const col = TYPE_COLOR[n.type] ?? 0x888888;
        const geo = new THREE.SphereGeometry(NODE_RADIUS, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          emissive: col,
          emissiveIntensity: 0.3,
          roughness: 0.3,
          metalness: 0.6,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        mesh.userData = { nodeId: n.id };

        // Glow sprite ring
        const glowCanvas = document.createElement('canvas');
        glowCanvas.width  = 128;
        glowCanvas.height = 128;
        const gc = glowCanvas.getContext('2d')!;
        const glow = gc.createRadialGradient(64, 64, 8, 64, 64, 64);
        glow.addColorStop(0, `rgba(${(col >> 16) & 255},${(col >> 8) & 255},${col & 255},0.6)`);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        gc.fillStyle = glow;
        gc.fillRect(0, 0, 128, 128);
        const glowTex = new THREE.CanvasTexture(glowCanvas);
        const glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        glowSprite.scale.set(55, 55, 1);

        const label = makeLabel(n.name, '#e2e8f0');
        label.position.set(0, NODE_RADIUS + 10, 0);

        const group3 = new THREE.Group();
        group3.add(mesh);
        group3.add(glowSprite);
        group3.add(label);
        group3.position.copy(pos);
        mesh.position.set(0, 0, 0);
        scene.add(group3);
        nodeMeshMap.set(n.id, mesh);
      }

      // Create edges
      const edges = Array.from(appState.simulation.edges.values());
      for (const e of edges) {
        const sp = nodePos.get(e.sourceId);
        const tp = nodePos.get(e.targetId);
        if (!sp || !tp) continue;
        const geo = new THREE.BufferGeometry().setFromPoints([sp, tp]);
        const opacity = 0.15 + e.strength * 0.18;
        const mat = new THREE.LineBasicMaterial({
          color: 0x7090ff,
          transparent: true,
          opacity,
        });
        const line = new THREE.Line(geo, mat);
        line.userData = { edgeId: e.id };
        scene.add(line);
        edgeLineMap.set(e.id, line);
      }
    }

    buildScene();

    // ── Raycaster for hover / click ───────────────────────────────────────────
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let hoveredMesh: THREE.Mesh | null = null;
    let clickStartTime = 0;

    function getMeshes(): THREE.Mesh[] {
      return Array.from(nodeMeshMap.values());
    }

    function getNodeId(mesh: THREE.Mesh): string | null {
      return mesh.userData.nodeId ?? null;
    }

    function onMouseMove(e: MouseEvent) {
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);

      const hits = raycaster.intersectObjects(getMeshes());
      const hit  = hits[0]?.object as THREE.Mesh | undefined;

      if (hit !== hoveredMesh) {
        // Reset old
        if (hoveredMesh) {
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.3;
        }
        hoveredMesh = hit ?? null;
        if (hoveredMesh) {
          const mat = hoveredMesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 1.0;
          renderer.domElement.style.cursor = 'pointer';
          showNode3DTooltip(e.clientX, e.clientY, getNodeId(hoveredMesh));
        } else {
          renderer.domElement.style.cursor = 'grab';
          hideNode3DTooltip();
        }
      } else if (hoveredMesh) {
        // Update tooltip position
        showNode3DTooltip(e.clientX, e.clientY, getNodeId(hoveredMesh));
      }
    }

    function onMouseDown() {
      clickStartTime = performance.now();
    }

    function onMouseUp(e: MouseEvent) {
      if (performance.now() - clickStartTime > 200) return; // was a drag
      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x =  ((e.clientX - rect.left)  / rect.width)  * 2 - 1;
      mouse.y = -((e.clientY - rect.top)   / rect.height) * 2 + 1;
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(getMeshes());
      const hit  = hits[0]?.object as THREE.Mesh | undefined;
      if (hit) {
        const id = getNodeId(hit);
        if (id) {
          appState.selectedNodeId = id;
          appState.detailMode = 'node';
          bumpDetail();
          // Fly camera towards selected node group
          const pos = hit.parent?.position ?? hit.position;
          controls.target.lerp(pos, 0.4);
          controls.spherical.radius = Math.max(200, controls.spherical.radius * 0.8);
          controls.update();
        }
      } else {
        // Click on empty space — deselect
        appState.selectedNodeId = null;
        appState.detailMode = null;
        bumpDetail();
      }
    }

    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup',   onMouseUp);

    // ── Tooltip helpers ───────────────────────────────────────────────────────
    function showNode3DTooltip(cx: number, cy: number, nodeId: string | null) {
      if (!nodeId) return;
      const n = appState.simulation.nodes.get(nodeId);
      if (!n) return;
      const tt = document.getElementById('nodeTooltip');
      if (!tt) return;
      const ntName   = document.getElementById('ntName');
      const ntSub    = document.getElementById('ntSub');
      const ntType   = document.getElementById('ntType');
      const ntAvatar = document.getElementById('ntAvatar');
      const ntBody   = document.getElementById('ntBody');
      if (ntName)   ntName.textContent   = n.name;
      if (ntSub)    ntSub.textContent    = n.organisation || n.sector || '';
      if (ntAvatar) ntAvatar.textContent = n.name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const typeLabels: Record<string, string> = {
        client: 'Client', prospect: 'Prospect', referrer: 'Referrer',
        adviser: 'Adviser', jpmorgan: 'JPM', organisation: 'Organisation',
      };
      if (ntType) ntType.textContent = typeLabels[n.type] ?? n.type;
      const priorityLabel: Record<string, string> = {
        critical: '🔴 Critical', high: '🟠 High', medium: '🟡 Medium',
        low: '⚫ Low', background: '🔵 Background',
      };
      const connCount = Array.from(appState.simulation.edges.values())
        .filter((e: GraphEdge) => e.sourceId === n.id || e.targetId === n.id).length;
      const bodyParts: string[] = [];
      bodyParts.push(`<span class="nt-stat">📡 Priority: ${priorityLabel[n.priority] ?? n.priority}</span>`);
      bodyParts.push(`<span class="nt-stat">🔗 ${connCount} connection${connCount !== 1 ? 's' : ''}</span>`);
      if (n.type === 'client' || n.type === 'prospect') {
        if (n.estimatedAUM) bodyParts.push(`<span class="nt-stat">💰 ${n.estimatedAUM}</span>`);
      }
      if (n.notes) bodyParts.push(`<span class="nt-notes">${n.notes.slice(0, 80)}${n.notes.length > 80 ? '…' : ''}</span>`);
      if (ntBody) ntBody.innerHTML = bodyParts.join('');

      const vw = window.innerWidth, vh = window.innerHeight;
      let tx = cx + 16, ty = cy - 10;
      if (tx + 220 > vw) tx = cx - 236;
      if (ty + 180 > vh) ty = vh - 190;
      tt.style.left    = `${tx}px`;
      tt.style.top     = `${ty}px`;
      tt.style.opacity = '1';
      tt.style.pointerEvents = 'none';
    }

    function hideNode3DTooltip() {
      const tt = document.getElementById('nodeTooltip');
      if (tt) tt.style.opacity = '0';
    }

    // ── Selection highlight ───────────────────────────────────────────────────
    function updateSelection() {
      for (const [id, mesh] of nodeMeshMap) {
        const mat = mesh.material as THREE.MeshStandardMaterial;
        if (id === appState.selectedNodeId) {
          mat.emissiveIntensity = 1.2;
          (mesh.parent?.children ?? []).forEach((c) => {
            if (c instanceof THREE.Mesh && c !== mesh) {
              (c.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.2;
            }
          });
        } else if (mesh !== hoveredMesh) {
          mat.emissiveIntensity = 0.3;
        }
      }
    }

    // ── Resize handler ────────────────────────────────────────────────────────
    function onResize() {
      if (!container) return;
      const W2 = container.clientWidth;
      const H2 = container.clientHeight;
      camera.aspect = W2 / H2;
      camera.updateProjectionMatrix();
      renderer.setSize(W2, H2);
    }
    window.addEventListener('resize', onResize);

    // ── Expose rebuild for external triggers ──────────────────────────────────
    (window as unknown as Record<string, unknown>)._rebuild3D = buildScene;

    // ── Render loop ───────────────────────────────────────────────────────────
    let animId = 0;
    const clock = new THREE.Clock();

    function animate() {
      animId = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Gentle pulsing on selected node
      if (appState.selectedNodeId) {
        const mesh = nodeMeshMap.get(appState.selectedNodeId);
        if (mesh) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          mat.emissiveIntensity = 0.8 + Math.sin(t * 3) * 0.4;
        }
      }

      updateSelection();
      renderer.render(scene, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mouseup', () => { /* cleanup in controls */ });
      controls.dispose();
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup',   onMouseUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      hideNode3DTooltip();
    };
  }, [bumpDetail]);

  return (
    <div
      ref={mountRef}
      style={{ width: '100%', height: '100%', position: 'relative', background: '#04060f' }}
    >
      {/* HUD labels */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
        color: 'rgba(180,200,255,0.55)', fontSize: 11, fontFamily: 'Inter,system-ui,sans-serif',
        pointerEvents: 'none', letterSpacing: '0.05em', textAlign: 'center',
      }}>
        Drag to orbit · Scroll to zoom · Right-drag to pan · Click node to inspect
      </div>
      <PriorityLegend3D />
    </div>
  );
}

// ── 3D Priority Legend ────────────────────────────────────────────────────────
function PriorityLegend3D() {
  const entries: Array<{ label: string; color: string; priority: PriorityLevel }> = [
    { priority: 'critical',   label: 'Critical',    color: '#ff4444' },
    { priority: 'high',       label: 'High',        color: '#ff9944' },
    { priority: 'medium',     label: 'Medium',      color: '#ffffffaa' },
    { priority: 'low',        label: 'Low',         color: '#8888aa' },
    { priority: 'background', label: 'Background',  color: '#444466' },
  ];
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12,
      background: 'rgba(4,6,15,0.75)', border: '1px solid rgba(100,120,200,0.3)',
      borderRadius: 8, padding: '10px 14px',
      color: '#c8d4f0', fontSize: 11, fontFamily: 'Inter,system-ui,sans-serif',
      backdropFilter: 'blur(6px)',
    }}>
      <div style={{ fontWeight: 700, marginBottom: 8, opacity: 0.7, letterSpacing: '0.08em', fontSize: 10 }}>
        ORBITAL PRIORITY
      </div>
      {entries.map((e) => (
        <div key={e.priority} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: e.color, boxShadow: `0 0 6px ${e.color}`,
          }} />
          <span style={{ color: e.color, fontWeight: 500 }}>{e.label}</span>
        </div>
      ))}
      <div style={{ borderTop: '1px solid rgba(100,120,200,0.2)', marginTop: 8, paddingTop: 8, opacity: 0.55, fontSize: 10 }}>
        Closer orbit = higher priority
      </div>
    </div>
  );
}
