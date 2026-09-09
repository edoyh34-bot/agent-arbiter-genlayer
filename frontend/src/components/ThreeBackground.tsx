import { useEffect, useRef } from 'react'
import * as THREE from 'three'

/**
 * A full-canvas 3D background: a rotating particle constellation that reacts
 * to scroll and pointer movement. Built on raw three.js (no react-three/fiber)
 * so it stays compatible with React 18.
 */
export default function ThreeBackground() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let scrollY = 0
    let targetScroll = 0
    let pointerX = 0
    let pointerY = 0
    let targetPointerX = 0
    let targetPointerY = 0

    const scene = new THREE.Scene()
    scene.fog = new THREE.FogExp2(0x0b0e14, 0.0018)

    const camera = new THREE.PerspectiveCamera(
      60,
      mount.clientWidth / mount.clientHeight,
      0.1,
      200,
    )
    camera.position.z = 14

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    mount.appendChild(renderer.domElement)

    // --- particle field ---
    const COUNT = 700
    const positions = new Float32Array(COUNT * 3)
    const sizes = new Float32Array(COUNT)
    const colors = new Float32Array(COUNT * 3)
    const palette = [new THREE.Color('#f5b545'), new THREE.Color('#5eead4'), new THREE.Color('#7c6cf0')]

    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 40
      positions[i * 3 + 1] = (Math.random() - 0.5) * 24
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30
      sizes[i] = Math.random() * 3 + 1
      const c = palette[i % palette.length]
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1))
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
      vertexShader: `
        attribute float size;
        attribute vec3 color;
        varying vec3 vColor;
        uniform float uTime;
        void main() {
          vColor = color;
          vec3 p = position;
          p.y += sin(uTime * 0.4 + position.x * 0.5) * 1.2;
          p.x += cos(uTime * 0.3 + position.y * 0.4) * 1.2;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = size * (140.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        varying vec3 vColor;
        void main() {
          float d = length(gl_PointCoord - vec2(0.5));
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vColor, a * 0.85);
        }
      `,
    })

    const points = new THREE.Points(geo, mat)
    scene.add(points)

    // --- central wireframe torus knot (the "arbiter") ---
    const knotGeo = new THREE.TorusKnotGeometry(2.6, 0.55, 180, 24)
    const knotMat = new THREE.MeshBasicMaterial({
      color: 0xf5b545,
      wireframe: true,
      transparent: true,
      opacity: 0.35,
    })
    const knot = new THREE.Mesh(knotGeo, knotMat)
    knot.position.set(6.5, -2.5, -4)
    scene.add(knot)

    const ringGeo = new THREE.RingGeometry(4.6, 4.75, 96)
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x5eead4,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.position.set(-7, 3.5, -8)
    scene.add(ring)

    // --- events ---
    const onScroll = () => {
      targetScroll = window.scrollY
    }
    const onPointer = (e: PointerEvent) => {
      targetPointerX = (e.clientX / window.innerWidth - 0.5) * 2
      targetPointerY = (e.clientY / window.innerHeight - 0.5) * 2
    }
    const onResize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pointermove', onPointer, { passive: true })
    window.addEventListener('resize', onResize)

    // --- loop ---
    const clock = new THREE.Clock()
    let raf = 0
    const animate = () => {
      raf = requestAnimationFrame(animate)
      const t = clock.getElapsedTime()

      scrollY += (targetScroll - scrollY) * 0.06
      pointerX += (targetPointerX - pointerX) * 0.04
      pointerY += (targetPointerY - pointerY) * 0.04

      mat.uniforms.uTime.value = t
      points.rotation.y = t * 0.03 + pointerX * 0.25
      points.rotation.x = pointerY * 0.15 + scrollY * 0.0004

      knot.rotation.x = t * 0.18
      knot.rotation.y = t * 0.12
      knot.rotation.z += 0.0015

      ring.rotation.z = t * 0.05
      ring.position.y = 3.5 + Math.sin(t * 0.5) * 0.6

      camera.position.x += (pointerX * 0.8 - camera.position.x) * 0.03
      camera.position.y += (-pointerY * 0.6 + scrollY * 0.002 - camera.position.y) * 0.03
      camera.lookAt(0, 0, 0)

      renderer.render(scene, camera)
    }
    animate()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('resize', onResize)
      geo.dispose()
      mat.dispose()
      knotGeo.dispose()
      knotMat.dispose()
      ringGeo.dispose()
      ringMat.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement)
      }
    }
  }, [])

  return <div ref={mountRef} className="three-bg" aria-hidden="true" />
}
