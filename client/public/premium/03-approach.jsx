// Approach section

// Real 3D shapes via Three.js. One canvas covers the stage; six meshes
// (mix of spheres and tori) sit at pixel coordinates that mirror the old
// CSS layout. Light direction tracks the global --lx / --ly.
function PainShapes({ converge, isMobile }) {
  const wrapRef = React.useRef(null);
  const canvasRef = React.useRef(null);
  const stateRef = React.useRef({ converge: 0 });

  // Shape layout — positions in CSS-percent strings, sizes in px. tubeRatio
  // is the torus tube radius as a fraction of major radius. Tilt rotates the
  // ring around X so it reads in perspective; rot rotates around the view axis.
  // tubeRatio: tube radius as fraction of major radius (slimmer rings now).
  // tilt: rotateX in degrees (0 = facing camera, 90 = edge-on).
  // rot:  rotateZ in degrees. yaw: rotateY for extra orientation variety.
  const shapes = React.useMemo(() => isMobile ? [
    { type: "torus",  left: "-4%",   top: "8%",     size: 180, tubeRatio: 0.20, rot: -14, tilt: 72, yaw:  18, dTilt: -38, dYaw:  26, dRot:  18 },
    { type: "torus",  right: "-6%",  bottom: "10%", size: 140, tubeRatio: 0.18, rot:  28, tilt: 34, yaw: -22, dTilt:  30, dYaw: -34, dRot: -22 },
    { type: "sphere", left: "6%",    bottom: "22%", size: 90 },
    { type: "sphere", right: "10%",  top: "10%",    size: 70 },
    { type: "sphere", left: "42%",   bottom: "6%",  size: 48 },
  ] : [
    { type: "torus",  left: "6%",    top: "12%",    size: 320, tubeRatio: 0.20, rot: -12, tilt: 78, yaw:  14, dTilt: -44, dYaw:  32, dRot:  16 },
    { type: "torus",  right: "5%",   bottom: "8%",  size: 220, tubeRatio: 0.17, rot:  42, tilt: 42, yaw: -28, dTilt:  28, dYaw: -40, dRot: -26 },
    { type: "torus",  right: "9%",   top: "26%",    size: 160, tubeRatio: 0.22, rot:  -8, tilt: 24, yaw:  48, dTilt:  46, dYaw: -34, dRot:  95 },
    { type: "sphere", left: "4%",    bottom: "18%", size: 170 },
    { type: "sphere", right: "14%",  bottom: "26%", size: 110 },
    { type: "sphere", left: "40%",   bottom: "8%",  size: 70 },
    { type: "sphere", right: "4%",   top: "44%",    size: 46 },
  ], [isMobile]);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas || typeof THREE === "undefined") return;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;

    const scene = new THREE.Scene();
    // Orthographic camera in pixel space: 1 world unit == 1 CSS pixel.
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    camera.position.z = 500;

    // Procedural warm cubemap for glossy reflections — top bright cream,
    // bottom warm tan, so the spheres pick up a soft horizon highlight.
    const makeEnvFace = (top, mid, bot) => {
      const sz = 128;
      const c = document.createElement("canvas");
      c.width = c.height = sz;
      const g = c.getContext("2d").createLinearGradient(0, 0, 0, sz);
      g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
      const ctx = c.getContext("2d");
      ctx.fillStyle = g; ctx.fillRect(0, 0, sz, sz);
      return c;
    };
    const envFaces = [
      makeEnvFace("#fff3d8", "#e8d2a8", "#8c6440"),
      makeEnvFace("#fff3d8", "#e8d2a8", "#8c6440"),
      makeEnvFace("#fff8e6", "#fff3d8", "#fff3d8"),
      makeEnvFace("#5a3a20", "#7a5234", "#8c6440"),
      makeEnvFace("#fff3d8", "#e8d2a8", "#8c6440"),
      makeEnvFace("#fff3d8", "#e8d2a8", "#8c6440"),
    ];
    const envCube = new THREE.CubeTexture(envFaces);
    envCube.needsUpdate = true;
    envCube.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileCubemapShader();
    const envMap = pmrem.fromCubemap(envCube).texture;
    scene.environment = envMap;

    // Warm key light (tracks --lx/--ly), cool fill, warm uplight for the
    // bottom sheen, and a soft ambient.
    const keyLight = new THREE.DirectionalLight(0xfff2d8, 1.4);
    const fillLight = new THREE.DirectionalLight(0xe6e8ee, 0.35);
    fillLight.position.set(-3, -2, 4).normalize();
    const upLight = new THREE.DirectionalLight(0xdbae8a, 1);
    upLight.position.set(1, -0.6, -1).normalize();
    const ambient = new THREE.AmbientLight(0xffffff, 0.30);
    scene.add(keyLight, fillLight, upLight, ambient);

    // Two glossy materials matching the original warm palette.
    // Spheres = darker warm tan (#c09878 mid tone from --sph-mid);
    // Tori = pale cream (#ecdebf from --tor-mid).
    const sphereMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#c89a74"),
      roughness: 0.55,
      metalness: 0.0,
      clearcoat: 0.15,
      clearcoatRoughness: 0.5,
      envMapIntensity: 0.55,
    });
    const torusMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color("#ecdebf"),
      roughness: 0.50,
      metalness: 0.0,
      clearcoat: 0.20,
      clearcoatRoughness: 0.45,
      envMapIntensity: 0.6,
    });

    const meshes = shapes.map((s) => {
      const r = s.size / 2;
      const geom = s.type === "torus"
        ? new THREE.TorusGeometry(r * (1 - s.tubeRatio), r * s.tubeRatio, 48, 160)
        : new THREE.SphereGeometry(r, 64, 64);
      const m = new THREE.Mesh(geom, s.type === "torus" ? torusMat : sphereMat);
      if (s.type === "torus") {
        m.rotation.order = "ZYX";
        m.userData.baseTilt = ((s.tilt || 0) * Math.PI) / 180;
        m.userData.baseYaw  = ((s.yaw  || 0) * Math.PI) / 180;
        m.userData.baseRot  = ((s.rot  || 0) * Math.PI) / 180;
        // Per-torus rotation delta applied as converge goes 0 -> 1.
        m.userData.dTilt = ((s.dTilt ?? -28) * Math.PI) / 180;
        m.userData.dYaw  = ((s.dYaw  ??  36) * Math.PI) / 180;
        m.userData.dRot  = ((s.dRot  ??  22) * Math.PI) / 180;
      }
      m.userData.def = s;
      scene.add(m);
      return m;
    });

    const computeHome = (w, h) => {
      meshes.forEach((m) => {
        const s = m.userData.def;
        const px = s.left !== undefined
          ? (parseFloat(s.left) / 100) * w + s.size / 2
          : w - (parseFloat(s.right) / 100) * w - s.size / 2;
        const py = s.top !== undefined
          ? (parseFloat(s.top) / 100) * h + s.size / 2
          : h - (parseFloat(s.bottom) / 100) * h - s.size / 2;
        // Convert to camera space: origin at center, y up.
        m.userData.homeX = px - w / 2;
        m.userData.homeY = h / 2 - py;
      });
    };

    const resize = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      computeHome(w, h);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("resize", resize);

    let raf;
    const tick = () => {
      const conv = stateRef.current.converge;
      const cs = getComputedStyle(document.documentElement);
      const lx = parseFloat(cs.getPropertyValue("--lx")) || 0.94;
      const ly = parseFloat(cs.getPropertyValue("--ly")) || -0.34;
      // CSS --ly is screen-y (down positive); Three.js y is up. Flip ly.
      // Push the light forward (positive z) so it grazes the front faces.
      keyLight.position.set(lx, -ly, 0.6).normalize().multiplyScalar(10);

      const pull = 0.28 * conv;
      meshes.forEach((m) => {
        m.position.x = m.userData.homeX * (1 - pull);
        m.position.y = m.userData.homeY * (1 - pull);
        if (m.userData.baseTilt !== undefined) {
          m.rotation.x = m.userData.baseTilt + m.userData.dTilt * conv;
          m.rotation.y = m.userData.baseYaw  + m.userData.dYaw  * conv;
          m.rotation.z = m.userData.baseRot  + m.userData.dRot  * conv;
        }
      });

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("resize", resize);
      meshes.forEach((m) => m.geometry.dispose());
      sphereMat.dispose();
      torusMat.dispose();
      envMap.dispose();
      envCube.dispose();
      pmrem.dispose();
      renderer.dispose();
    };
  }, [shapes]);

  React.useEffect(() => { stateRef.current.converge = converge; }, [converge]);

  return (
    <div ref={wrapRef} className="pain-shapes" aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      />
    </div>
  );
}

function Approach() {
  const isMobile = window.useIsMobile();
  const { t } = window.useI18n();
  const wrapRef = React.useRef(null);
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    let rafId = null;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        const el = wrapRef.current;
        if (el) {
          const total = el.offsetHeight - window.innerHeight;
          const scrolled = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
          setProgress(total <= 0 ? 0 : scrolled / total);
        }
        rafId = null;
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => { window.removeEventListener('scroll', onScroll); cancelAnimationFrame(rafId); };
  }, []);

  // 0.00–0.30: pain fully visible (reading time)
  // 0.30–0.55: card slides up from bottom of viewport, opacity ramps in quickly
  // 0.55–1.00: card settled, sticky holds before release
  // Linear crossfade window: pain fades out while card lifts + fades in over the same range.
  const fadeStart = 0.18;
  const fadeEnd = 0.68;
  const t01 = Math.max(0, Math.min(1, (progress - fadeStart) / (fadeEnd - fadeStart)));
  const painOpacity = 1 - t01;
  const slideProgress = t01;
  const approachOpacity = t01;
  const expandProgress = slideProgress;

  const glassOn = progress > fadeStart;

  return (
    <div ref={wrapRef} style={{ position: "relative", height: isMobile ? "125vh" : "135vh" }}>
      <div style={{
        position: "sticky", top: 0, height: "100vh",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden",
      }}>
        {/* Decorative shapes — stay visible behind the card, converge toward center as it lifts */}
        <PainShapes converge={slideProgress} isMobile={isMobile} />

        {/* Pain text — pinned, fades as user scrolls */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          padding: isMobile ? "0 18px" : "0 8vw",
          opacity: painOpacity, pointerEvents: painOpacity > 0.1 ? "auto" : "none",
          zIndex: 1,
        }}>
          <div style={{ maxWidth: 760, textAlign: "center" }}>
            <p className="eyebrow" style={{ margin: "0 0 22px" }}>{t('pain.kicker')}</p>
            <h2 className="serif" style={{
              margin: 0,
              fontSize: isMobile ? "clamp(30px, 7vw, 40px)" : "clamp(34px, 4.6vw, 64px)",
              lineHeight: 1.08,
              letterSpacing: "-0.01em",
              color: "var(--ink)",
              fontWeight: 500,
              textWrap: "balance",
            }}>
              {t('pain.h2_pre')} <span className="italic" style={{ color: "var(--wine)" }}>{t('pain.h2_italic')}</span> {t('pain.h2_post')}
            </h2>
            <p style={{
              marginTop: 22,
              fontSize: isMobile ? 14.5 : 15,
              lineHeight: 1.6,
              color: "var(--mute)",
              maxWidth: 520,
              marginLeft: "auto",
              marginRight: "auto",
            }}>
              {t('pain.sub')}
            </p>
          </div>
        </div>

        {/* Approach — card slides up from bottom of viewport */}
        <section id="approach" data-screen-label="02 Approach" style={{
          width: "100%",
          maxWidth: 1240,
          margin: "0 auto",
          padding: isMobile ? "0 18px" : "0 48px",
          position: "relative",
          zIndex: 2,
          transform: `translateY(${(1 - slideProgress) * 100}vh)`,
          willChange: "transform",
          pointerEvents: slideProgress > 0.5 ? "auto" : "none",
        }}>
          <div className="neu-polished-large" style={{
            borderRadius: 14,
            padding: isMobile ? "36px 24px 32px" : "64px 64px 56px",
          }}>
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "1.35fr 1fr",
              gap: isMobile ? 28 : 72,
              alignItems: "start",
            }}>
              <div>
                <div className="eyebrow" style={{ marginBottom: isMobile ? 18 : 28 }}>{t('approach.eyebrow')}</div>
                <h2 className="serif" style={{
                  margin: 0,
                  fontSize: isMobile ? "clamp(32px, 8vw, 42px)" : "clamp(40px, 4vw, 60px)",
                  lineHeight: 1.02, letterSpacing: "-0.02em"
                }}>
                  {t('approach.h2_l1')}<br />
                  {t('approach.h2_l2')}<br />
                  <span className="italic" style={{ color: "var(--wine)" }}>{t('approach.h2_italic')}</span>
                </h2>
              </div>
              <div style={{ paddingTop: isMobile ? 0 : 12 }}>
                <p style={{ fontSize: isMobile ? 16 : 19, lineHeight: 1.55, color: "var(--ink-soft, #322B22)", fontWeight: 400, margin: "0 0 24px", maxWidth: 620 }}>
                  {t('approach.p1')}{" "}
                  <span className="serif italic" style={{ color: "var(--wine)", fontSize: isMobile ? 18 : 22 }}>{t('approach.p1_italic')}</span>
                </p>
                <p style={{ fontSize: isMobile ? 14.5 : 15.5, lineHeight: 1.65, color: "var(--mute)", margin: 0, maxWidth: 620 }}>
                  {t('approach.p2')}
                </p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>);
}
