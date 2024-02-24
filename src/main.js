import * as THREE from "three"
import "./style.css"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

let scene, camera, renderer, material, mesh, clock, controls

const uniforms = {
    sphereColor: { value: new THREE.Color(0x00ff00) }, // Green color
    lightPosition: { value: new THREE.Vector3() },
    cameraPos: { value: new THREE.Vector3() },
    spherePosition: { value: new THREE.Vector3() },
    sphereRotation: { value: new THREE.Euler() },
    customViewMatrix: { value: new THREE.Matrix4() },
    resolution: { value: new THREE.Vector2() },
    projectionMatrixInverse: { value: new THREE.Matrix4() },
}

const ship = {
    position: new THREE.Vector3(0, 0, -5), // Initial position
    velocity: new THREE.Vector3(0, 0, 0),
    acceleration: new THREE.Vector3(0, 0, 0),
    rotation: new THREE.Euler(0, 0, 0), // Initial rotation
    angularVelocity: 0,
    angularAcceleration: 0.5, // Adjust for desired rotation speed
    angularDamping: 0.95, // Damping factor for rotational inertia
    rotationSpeed: 0.1, // radians per frame, not used directly in the updated code
    thrusting: false,
    reverseThrusting: false,
}

function init() {
    scene = new THREE.Scene()

    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    )
    camera.position.z = 5

    clock = new THREE.Clock()

    renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(renderer.domElement)

    controls = new OrbitControls(camera, renderer.domElement)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(5, 5, 5)
    scene.add(light)

    uniforms.lightPosition.value = light.position.clone()
    uniforms.cameraPos.value = camera.position.clone()

    // Shader material setup
    material = new THREE.ShaderMaterial({
        vertexShader: vertexShader,
        fragmentShader: fragmentShader,
        uniforms,
    })

    const geometry = new THREE.PlaneGeometry(10, 10) // Placeholder geometry
    mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
}

function animate() {
    let deltaTime = clock.getDelta()

    updateShip(deltaTime) // Update ship state based on current inputs

    controls.update()

    // Update ship uniforms
    uniforms.spherePosition.value.copy(ship.position)
    uniforms.sphereRotation.value.copy(ship.rotation)
    uniforms.customViewMatrix.value = camera.matrixWorldInverse
    uniforms.resolution.value.set(window.innerWidth, window.innerHeight)
    uniforms.projectionMatrixInverse.value
        .copy(camera.projectionMatrix)
        .invert()

    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}

function updateShip(deltaTime) {
    // Rotation handling
    ship.rotation.z += ship.angularVelocity * deltaTime
    ship.angularVelocity *= ship.angularDamping

    // Thrust handling
    let thrustDirection = ship.thrusting ? 5 : ship.reverseThrusting ? -5 : 0
    let forwardVector = new THREE.Vector3(0, thrustDirection, 0)
    forwardVector.applyAxisAngle(new THREE.Vector3(0, 0, 1), ship.rotation.z)

    ship.acceleration.x = forwardVector.x * Math.abs(thrustDirection) * 0.1 // Use thrustDirection
    ship.acceleration.y = forwardVector.y * Math.abs(thrustDirection) * 0.1

    // Velocity and position updates
    ship.velocity.add(ship.acceleration.clone().multiplyScalar(deltaTime))
    ship.position.add(ship.velocity.clone().multiplyScalar(deltaTime))

    // Reset acceleration
    ship.acceleration.set(0, 0, 0)
}

function onDocumentKeyDown(event) {
    switch (event.code) {
        case "ArrowLeft": // Rotate left
            ship.angularVelocity -= ship.angularAcceleration
            break
        case "ArrowRight": // Rotate right
            ship.angularVelocity += ship.angularAcceleration
            break
        case "ArrowUp": // Start thrusting forward
            ship.thrusting = true
            break
        case "ArrowDown": // Start thrusting backward
            ship.reverseThrusting = true
            break
    }
}

function onDocumentKeyUp(event) {
    if (event.code === "ArrowUp") {
        ship.thrusting = false
    }
    if (event.code === "ArrowDown") {
        ship.reverseThrusting = false
    }
}

// Vertex shader
const vertexShader = `
    void main() {
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`

// Fragment shader for SDF and raymarching
const fragmentShader = `
    precision highp float;

    uniform vec3 lightPosition;
    uniform vec3 sphereColor;
    uniform vec3 cameraPos;
    uniform mat4 customViewMatrix;
    uniform mat4 projectionMatrixInverse;
    uniform vec2 resolution;
    uniform vec3 spherePosition;
    uniform vec3 sphereRotation;

    float sdSphere(vec3 p, float r) {
        return length(p) - r;
    }

    float smin(float a, float b, float k) {
        float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
        return mix(b, a, h) - k * h * (1.0 - h);
    }

    float sdSpaceship(vec3 p) {
        float sphereRadius = 1.25;
        float blendRadius = 0.2;

        vec3 c1 = vec3(0.0, 1.0, 0.0);
        vec3 c2 = vec3(-0.86, -0.5, 0.0);
        vec3 c3 = vec3(0.86, -0.5, 0.0);

        float d1 = sdSphere(p - c1, sphereRadius);
        float d2 = sdSphere(p - c2, sphereRadius);
        float d3 = sdSphere(p - c3, sphereRadius);

        float d = smin(d1, d2, blendRadius);
        d = smin(d, d3, blendRadius);

        return d;
    }

    void main() {
        

        vec2 ndc = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;

    vec4 rayClip = vec4(ndc, -1.0, 1.0);
    vec4 rayEye = projectionMatrixInverse * rayClip;
    rayEye.z = -1.0; // Set to -1.0 for the ray to point forwards.
    rayEye.w = 0.0;  // Set to 0.0 to create a direction vector.

    vec3 rayWorld = normalize(rayEye.xyz); // Not applying customViewMatrix yet

    vec3 rayOrigin = cameraPosition; // Use the camera's position in world space
    vec3 rayDirection = rayWorld; // Use the ray direction without view matrix transformation

    float t = 0.0;
    bool hit = false;
    vec3 p;
    for (int i = 0; i < 100; i++) {
        p = rayOrigin + t * rayDirection;
            float cosTheta = cos(-sphereRotation.z);
            float sinTheta = sin(-sphereRotation.z);
            mat2 rot = mat2(cosTheta, -sinTheta, sinTheta, cosTheta);
            p.xy = rot * (p.xy - spherePosition.xy);

            float d = sdSpaceship(p - spherePosition);
            if (d < 0.01) {
                hit = true;
                break;
            }
            t += d;
        }

        if (hit) {
            vec3 normal = normalize(p - spherePosition); // Approximate normal
            vec3 lightDir = normalize(lightPosition - p);
            float diff = max(dot(lightDir, normal), 0.0);
            vec3 diffuse = diff * sphereColor;
            gl_FragColor = vec4(diffuse, 1.0);
        } else {
            gl_FragColor = vec4(1.0); // Background color
        }
    }   
`

document.addEventListener("keydown", onDocumentKeyDown, false)
document.addEventListener("keyup", onDocumentKeyUp, false)

init()
animate()
