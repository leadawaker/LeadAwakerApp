import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The iOS voice waveform, as a raw WebGL fragment shader.
 *
 * Ported from the 21st.dev `siri-wave` component. The original drives its
 * bass/mid/treble bands and its travel from `iTime` alone, so it dances the
 * same way whether anyone is talking or not. Here those are uniforms, fed
 * every frame by `getParams`, so the caller decides what the wave answers to.
 *
 * `frozen` draws one frame and stops: a still wave, no animation loop.
 */

export interface WaveParams {
  /** Travel speed of the wave along x, in radians per second. */
  speed: number;
  /** Height multiplier, 0 = flat line, 1 = the original's full swing. */
  amp: number;
  /** Voice bands, 0..1. */
  low: number;
  mid: number;
  high: number;
  /** 0 = white line, 1 = full spectral colour. */
  sat: number;
  /** Overall brightness multiplier. */
  gain: number;
  /**
   * 0 = nothing, a small value = a single glowing dot, 1 = the full wave.
   * The wave is born from, and dies back into, a dot by sweeping this.
   */
  reveal: number;
}

export const RESTING_WAVE: WaveParams = {
  speed: 0,
  amp: 0.55,
  low: 0.45,
  mid: 0.4,
  high: 0.3,
  sat: 1,
  gain: 1,
  reveal: 1,
};

const VERTEX_SHADER = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;

const WAVE_SHADER = `precision highp float;
uniform vec2 iResolution;
uniform float uDrift, uAmp, uLow, uMid, uHigh, uSat, uGain, uReveal;
const float PI = 3.14159265359;
const float AMPLITUDE   = 0.32;
const float FREQ        = 1.1;
const float ABER_FREQ   = 1.0;
const float WAVE_SCALE  = 0.6;
const float ABERRATION  = 2.6;
const float THICKNESS   = 3.0;
const float INTENSITY   = 2.;
const float FALLOFF     = 1.7;
const float EDGE_MASK   = 0.4;
const float BAND_FILL   = 30000.0;
const float BAND_THICK  = 0.08;
const float SOFTNESS    = 2.5;
const float LOW_AMP     = 6.0;
const float LOW_INT     = 1.5;
const float MID_ABER    = 0.8;
const float MID_ABAMP   = 0.05;
const float MID_SOFT    = 0.4;
const float HIGH_ABER   = 0.5;
const float HIGH_ABAMP  = 0.06;

vec3 spectral4(int s){
    float x = float(s);
    return clamp(vec3(abs(x-3.0)-1.0, 2.0-abs(x-2.0), 2.0-abs(x-4.0)), 0.0, 1.0);
}

void main(){
    vec2 R = iResolution.xy;
    float aspect = R.x / R.y;
    vec2 p = (gl_FragCoord.xy + 0.5) * 2.0 / R - 1.0;
    p.x *= aspect;
    float yScreen = p.y;
    p /= WAVE_SCALE;

    float low = uLow, mid = uMid, high = uHigh;
    float drift = uDrift;

    float xN  = p.x / max(aspect, 1.0);
    float env = cos(PI*0.5 * min(abs(0.9*xN), 1.0));
    env *= env;

    // Reveal: the horizontal falloff narrows to a point and the swing
    // flattens, so a low reveal is a dot and 1.0 is the untouched wave.
    float rv    = max(uReveal, 0.001);
    float grow  = smoothstep(0.15, 1.0, rv);
    float A1    = (AMPLITUDE + 0.01*low*LOW_AMP) * uAmp * grow;
    float A2    = A1 + (mid*MID_ABAMP + high*HIGH_ABAMP) * uAmp * grow;
    float AB    = ABERRATION + mid*MID_ABER + high*HIGH_ABER;
    float th    = 0.01*THICKNESS;
    float inten = 0.01*(INTENSITY + low*LOW_INT);
    float soft  = 0.01*max(0.0, SOFTNESS + mid*MID_SOFT);

    float yMain = A1 * env * sin(p.x*FREQ + drift);

    float bandAmt = 1e-4 * BAND_FILL * inten;
    vec3 num = vec3(0.0), den = vec3(0.0);
    for(int s = 0; s < 4; s++){
        vec3 hue = mix(vec3(1.0), spectral4(s), uSat);
        den += hue;
        float ab = mix(-AB, AB, float(s)/3.0);
        float yL = A2 * env * sin(p.x*ABER_FREQ + drift + ab);
        float d  = abs(p.y - yL);
        float line = inten / (sqrt(d*d + soft*soft) + th);
        float lo = min(yMain, yL), hi = max(yMain, yL);
        float dBand = max(0.0, max(p.y - hi, lo - p.y));
        float band  = bandAmt / (dBand + BAND_THICK);
        num += hue * (line + band);
    }
    vec3 col = num / den;

    float dM = abs(p.y - yMain);
    col += 0.5 * inten / (sqrt(dM*dM + soft*soft) + th);

    col = pow(max(col, 0.0), vec3(1.5));
    float emT = clamp((abs(yScreen) - 1.0) / (-EDGE_MASK), 0.0, 1.0);
    float em  = emT*emT*(3.0 - 2.0*emT);
    // Width never quite reaches zero, and height is pinched in too while the
    // wave is still small, so the smallest reveal is a round dot, not a
    // vertical streak of the band glow.
    float gauss = exp(-pow(xN*FALLOFF/(0.06 + 0.94*rv), 2.0));
    float pinch = mix(exp(-pow(p.y/(0.07 + 0.6*rv), 2.0)), 1.0, grow);
    col *= em * gauss * pinch * uGain * smoothstep(0.0, 0.05, uReveal);
    gl_FragColor = vec4(col, 1.0);
}`;

/** Wrapping the phase at a whole number of turns keeps floats precise forever. */
const DRIFT_WRAP = Math.PI * 2 * 64;

export interface SiriWaveProps {
  /** Called every frame with the seconds since the last one. */
  getParams?: (dt: number) => WaveParams;
  /** Draw one still frame and stop animating. */
  frozen?: boolean;
  /** Internal render resolution multiplier (lower = cheaper/blurrier). */
  renderScale?: number;
  className?: string;
}

export function SiriWave({ getParams, frozen = false, renderScale = 0.75, className }: SiriWaveProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const getParamsRef = useRef(getParams);
  getParamsRef.current = getParams;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext("webgl");
    if (!gl) return;

    const compile = (type: number, src: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log ?? "shader compile error");
      }
      return shader;
    };

    const program = gl.createProgram()!;
    const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
    const fs = compile(gl.FRAGMENT_SHADER, WAVE_SHADER);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const u = (name: string) => gl.getUniformLocation(program, name);
    const uRes = u("iResolution");
    const uDrift = u("uDrift");
    const uAmp = u("uAmp");
    const uLow = u("uLow");
    const uMid = u("uMid");
    const uHigh = u("uHigh");
    const uSat = u("uSat");
    const uGain = u("uGain");
    const uReveal = u("uReveal");

    // The canvas follows its box. Sized in CSS, so the phone decides.
    const fit = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr * renderScale));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr * renderScale));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    };

    // Starts off-centre so a frozen wave is a curve, not a symmetric blob.
    let drift = 1.2;
    let last = performance.now();
    const draw = (dt: number) => {
      fit();
      const p = getParamsRef.current?.(dt) ?? RESTING_WAVE;
      drift = (drift + p.speed * dt) % DRIFT_WRAP;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uDrift, drift);
      gl.uniform1f(uAmp, p.amp);
      gl.uniform1f(uLow, p.low);
      gl.uniform1f(uMid, p.mid);
      gl.uniform1f(uHigh, p.high);
      gl.uniform1f(uSat, p.sat);
      gl.uniform1f(uGain, p.gain);
      gl.uniform1f(uReveal, p.reveal);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let raf = 0;
    let observer: ResizeObserver | null = null;
    if (frozen) {
      draw(0);
      // A still wave still has to redraw when its box changes size.
      observer = new ResizeObserver(() => draw(0));
      observer.observe(canvas);
    } else {
      const frame = (now: number) => {
        // Clamped so a backgrounded tab does not return with a lurch.
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        draw(dt);
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      observer?.disconnect();
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(buffer);
    };
  }, [frozen, renderScale]);

  return <canvas ref={canvasRef} className={cn("block bg-black", className)} />;
}

export default SiriWave;
