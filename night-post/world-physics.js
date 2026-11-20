/* Night Post World Physics Engine (window.NightPostPhysics)
 * Fixed 60 Hz 4-wheel vehicle suspension, hill-rolling gravity, collision damage,
 * carrier/NPC terrain-sole grounding with 0-40 kg water-load weight,
 * and damped 2D pendulum water sloshing + cyan spill particles.
 * Zero emoji anywhere.
 */
(function () {
  "use strict";

  const GRAVITY = 22.0;
  const FIXED_DT = 1 / 60;
  const RIDE_CLEARANCE = 0.08;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  /* --------------------------------------------------------------------------
   * 1. 4-WHEEL TERRAIN-ALIGNED VEHICLE SUSPENSION, HILL-ROLL & DAMAGE
   * -------------------------------------------------------------------------- */
  function createVehicleBody(opts = {}) {
    // Wheel local offsets in vehicle space: +X = right, +Z = forward (matching buildWagon)
    const wheelDefs = opts.wheels || [
      { name: "FL", x: -0.862, z:  1.71, radius: 0.394, front: true },
      { name: "FR", x:  0.862, z:  1.71, radius: 0.394, front: true },
      { name: "RL", x: -0.882, z: -1.61, radius: 0.394, front: false },
      { name: "RR", x:  0.882, z: -1.61, radius: 0.394, front: false }
    ];
    const wheelBase = 3.32;
    const trackWidth = 1.74;

    const body = {
      x: opts.x ?? -23.0,
      y: opts.y ?? 155.0,
      z: opts.z ?? 4.6,
      vx: 0,
      vy: 0,
      vz: 0,
      speed: 0,
      heading: opts.heading ?? -Math.PI * 0.52,
      steerAngle: 0,
      pitch: 0,
      roll: 0,
      pitchVel: 0,
      rollVel: 0,
      heave: 0,
      heaveVel: 0,
      airborne: false,
      airTime: 0,
      groundedWheels: 4,
      slopeAngle: 0,
      wheelHeights: [0, 0, 0, 0],
      underbodyHeights: [0, 0, 0, 0, 0, 0, 0],
      maxSampledHeight: 0,
      rideClearance: RIDE_CLEARANCE,
      underbodySamples: 7,
      wheelOffsets: [0, 0, 0, 0],
      // Structural integrity & damage
      integrity: 100,
      bumperDent: 0,
      hoodTilt: 0,
      lastImpactSpeed: 0,
      lastImpactTime: 0,
      damageShake: 0,
      // Acceleration telemetry for slosh coupling
      accelFwd: 0,
      accelLat: 0,
      prevSpeed: 0,
      prevHeading: opts.heading ?? -Math.PI * 0.52,
      accum: 0,
      massBase: opts.massBase ?? 1650,
      wheelDefs,

      syncFrom(x, y, z, heading, surfaceAt) {
        this.x = x;
        this.z = z;
        this.heading = heading;
        this.prevHeading = heading;
        this.speed = 0;
        this.prevSpeed = 0;
        this.vx = 0;
        this.vy = 0;
        this.vz = 0;
        this.airborne = false;
        this.airTime = 0;
        this.accum = 0;
        if (surfaceAt) {
          const sample = sampleWheels(this, surfaceAt);
          this.maxSampledHeight = sample.maxSampledHeight;
          this.y = Math.max(sample.meanH, sample.maxSampledHeight + this.rideClearance);
          this.pitch = sample.groundPitch;
          this.roll = sample.groundRoll;
          this.slopeAngle = sample.slopeAngle;
          this.heave = 0;
          this.heaveVel = 0;
          this.pitchVel = 0;
          this.rollVel = 0;
        } else {
          this.y = y;
        }
      },

      applyImpact(severity, type = "collision", onImpact) {
        const sev = clamp(severity, 0, 45);
        if (sev <= 0.5) return;
        this.integrity = clamp(this.integrity - sev, 0, 100);
        const dmg = (100 - this.integrity) / 100;
        this.bumperDent = clamp(dmg * 0.24, 0, 0.24);
        this.hoodTilt = clamp(dmg * 0.16, 0, 0.16);
        this.damageShake = Math.min(1, this.damageShake + sev * 0.04);
        this.lastImpactSpeed = sev;
        this.lastImpactTime = performance.now() * 0.001;
        if (onImpact) {
          onImpact({
            x: this.x + Math.sin(this.heading) * 2.1,
            y: this.y + 0.75,
            z: this.z + Math.cos(this.heading) * 2.1,
            severity: sev,
            integrity: this.integrity,
            type
          });
        }
      },

      repair(amount = 100) {
        this.integrity = clamp(this.integrity + amount, 0, 100);
        const dmg = (100 - this.integrity) / 100;
        this.bumperDent = clamp(dmg * 0.24, 0, 0.24);
        this.hoodTilt = clamp(dmg * 0.16, 0, 0.16);
        this.damageShake = 0;
        return this.integrity;
      }
    };

    function sampleWheels(v, surfaceAt) {
      const sinH = Math.sin(v.heading);
      const cosH = Math.cos(v.heading);
      // Forward = (sinH, cosH), Right = (cosH, -sinH)
      // Sample 7 underbody points: FL, FR, RL, RR, center, front-bumper, rear-bumper
      for (let i = 0; i < 4; i++) {
        const wd = v.wheelDefs[i];
        const wx = v.x + sinH * wd.z + cosH * wd.x;
        const wz = v.z + cosH * wd.z - sinH * wd.x;
        v.wheelHeights[i] = surfaceAt(wx, wz);
        v.underbodyHeights[i] = v.wheelHeights[i];
      }
      const hCenter = surfaceAt(v.x, v.z);
      const hFrontBumper = surfaceAt(v.x + sinH * 2.55, v.z + cosH * 2.55);
      const hRearBumper = surfaceAt(v.x - sinH * 2.45, v.z - cosH * 2.45);
      v.underbodyHeights[4] = hCenter;
      v.underbodyHeights[5] = hFrontBumper;
      v.underbodyHeights[6] = hRearBumper;

      const hFL = v.wheelHeights[0];
      const hFR = v.wheelHeights[1];
      const hRL = v.wheelHeights[2];
      const hRR = v.wheelHeights[3];
      const maxSampledHeight = Math.max(hFL, hFR, hRL, hRR, hCenter, hFrontBumper, hRearBumper);
      const meanH = (hFL + hFR + hRL + hRR) * 0.25;
      const safeGroundY = Math.max(meanH, maxSampledHeight + v.rideClearance);
      const frontH = Math.max((hFL + hFR) * 0.5, hFrontBumper - 0.12);
      const rearH = Math.max((hRL + hRR) * 0.5, hRearBumper - 0.12);
      const leftH = (hFL + hRL) * 0.5;
      const rightH = (hFR + hRR) * 0.5;
      const slopeAngle = Math.atan2(frontH - rearH, wheelBase);
      // Positive chassis.rotation.x lifts nose (-Z in inner group rotated 180 deg)
      const groundPitch = clamp(slopeAngle, -0.68, 0.68);
      // Positive chassis.rotation.z lifts left side (+X in inner group rotated 180 deg)
      const groundRoll = clamp(Math.atan2(leftH - rightH, trackWidth), -0.52, 0.52);
      return {
        hFL, hFR, hRL, hRR, hCenter, hFrontBumper, hRearBumper,
        maxSampledHeight, safeGroundY, meanH, frontH, rearH, leftH, rightH,
        slopeAngle, groundPitch, groundRoll
      };
    }

    function substepDrive(v, dt, input, surfaceAt, obstacles, boundsClamp, onImpact) {
      const fwdInput = clamp(input.fwd || 0, -1, 1);
      const sideInput = clamp(input.side || 0, -1, 1);
      const brakeInput = Boolean(input.brake);
      const turbo = Boolean(input.turbo);
      const flowSpeedMult = input.flowSpeedMult || 1.0;
      const waterKg = clamp(input.waterLiters || 0, 0, 40);

      const s0 = sampleWheels(v, surfaceAt);
      v.slopeAngle = s0.slopeAngle;

      // Engine performance degrades with structural damage (45% floor at 0% integrity)
      const integrityFactor = 0.45 + 0.55 * (v.integrity / 100);
      const totalMass = v.massBase + waterKg * 1.0;
      const massRatio = v.massBase / totalMass;

      // Real slope gravity force along heading: a_slope = -g * sin(slope)
      const gravitySlopeAccel = -GRAVITY * Math.sin(s0.slopeAngle);

      // Drive force, rolling resistance, drag, and braking (tuned for crisp 22.0 m/s^2 gravity)
      const maxFwdSpeed = (turbo ? 32.0 : 21.5) * flowSpeedMult * integrityFactor;
      const maxRevSpeed = (turbo ? 16.0 : 11.5) * flowSpeedMult * integrityFactor;
      let driveAccel = 0;
      if (!v.airborne && !brakeInput) {
        if (fwdInput > 0.05) {
          const throttle = clamp(fwdInput, 0, 1);
          const speedRatio = clamp(v.speed / Math.max(1, maxFwdSpeed), 0, 1.3);
          driveAccel = throttle * (turbo ? 21.0 : 15.0) * integrityFactor * massRatio * Math.max(0.05, 1 - speedRatio * 0.88);
        } else if (fwdInput < -0.05) {
          const rev = clamp(-fwdInput, 0, 1);
          const speedRatio = clamp(-v.speed / Math.max(1, maxRevSpeed), 0, 1.3);
          driveAccel = -rev * (turbo ? 15.0 : 11.2) * integrityFactor * massRatio * Math.max(0.05, 1 - speedRatio * 0.88);
        }
      }

      // Rolling resistance & aerodynamic drag
      let resistAccel = 0;
      if (!v.airborne) {
        const rollingMu = 0.36; // small enough that any slope > ~1 deg genuinely rolls downhill
        if (Math.abs(v.speed) > 0.03) {
          resistAccel = -Math.sign(v.speed) * (rollingMu + 0.0085 * v.speed * v.speed);
        }
        if (brakeInput) {
          const brakeDecel = 26.0;
          if (Math.abs(v.speed) < brakeDecel * dt) {
            v.speed = 0;
            driveAccel = 0;
          } else {
            resistAccel += -Math.sign(v.speed) * brakeDecel;
          }
        }
      } else {
        resistAccel = -Math.sign(v.speed) * 0.004 * v.speed * v.speed;
      }

      const netAccel = (brakeInput && Math.abs(v.speed) < 0.05)
        ? 0
        : (driveAccel + (v.airborne ? 0 : gravitySlopeAccel) + resistAccel);

      v.speed = clamp(v.speed + netAccel * dt, -maxRevSpeed * 1.35, maxFwdSpeed * 1.45);
      // Only snap to 0 on nearly flat ground when unpowered
      if (!brakeInput && Math.abs(fwdInput) <= 0.05 && Math.abs(v.speed) < 0.04 && Math.abs(gravitySlopeAccel) < 0.24) {
        v.speed = 0;
      }

      // Steering (requires rolling wheels when grounded, reduced authority in air)
      const revFlip = v.speed < -0.35 ? -1 : 1;
      const steerAuth = v.airborne ? 0.15 : clamp(Math.abs(v.speed) / 2.2, 0.08, 1.0);
      const maxYawRate = Math.min(1.85, 7.6 / Math.max(Math.abs(v.speed), 2.5));
      const yawDelta = -sideInput * revFlip * maxYawRate * steerAuth * dt;
      v.heading += yawDelta;
      v.steerAngle = lerp(v.steerAngle, -sideInput * 0.42, 1 - Math.exp(-dt * 14));

      // Horizontal integration
      const sinH = Math.sin(v.heading);
      const cosH = Math.cos(v.heading);
      let nx = v.x + sinH * v.speed * dt;
      let nz = v.z + cosH * v.speed * dt;

      // Obstacle collisions (rocks, trees, buildings, relay pedestals)
      if (obstacles && obstacles.length > 0) {
        const carR = 1.65;
        for (let i = 0; i < obstacles.length; i++) {
          const ob = obstacles[i];
          const dx = nx - ob.x;
          const dz = nz - ob.z;
          const minR = carR + ob.r;
          const d2 = dx * dx + dz * dz;
          if (d2 < minR * minR && d2 > 1e-6) {
            const d = Math.sqrt(d2);
            const nrmX = dx / d;
            const nrmZ = dz / d;
            const overlap = minR - d;
            nx += nrmX * overlap;
            nz += nrmZ * overlap;

            const vDotN = sinH * v.speed * nrmX + cosH * v.speed * nrmZ;
            if (vDotN < 0) {
              const impactSpeed = Math.abs(vDotN);
              // Bounce back and damp speed
              const restitution = 0.36;
              const bouncedSpeed = -Math.sign(v.speed || 1) * Math.min(Math.abs(v.speed) * restitution, 6.5);
              v.speed = bouncedSpeed;
              v.heaveVel += clamp(impactSpeed * 0.25, 0, 2.2);
              if (impactSpeed > 1.8) {
                const sev = clamp((impactSpeed - 1.5) * 3.8, 2.5, 34);
                v.applyImpact(sev, ob.kind || "obstacle", onImpact);
              }
            }
          }
        }
      }

      if (boundsClamp) {
        const clamped = boundsClamp(nx, nz);
        nx = clamped[0];
        nz = clamped[1];
      }
      v.x = nx;
      v.z = nz;
      v.vx = sinH * v.speed;
      v.vz = cosH * v.speed;

      // Sample 7 underbody points at new position for suspension, zero hill-clipping & airborne gravity
      const s1 = sampleWheels(v, surfaceAt);
      v.slopeAngle = s1.slopeAngle;
      v.maxSampledHeight = s1.maxSampledHeight;
      const minChassisY = s1.maxSampledHeight + v.rideClearance;
      const targetGroundY = s1.safeGroundY;

      // Predict vertical trajectory under crisp -22.0 m/s^2 gravity
      const clearance = v.y - targetGroundY;
      if (clearance > 0.12 || v.vy > 0.45) {
        // Airborne over ridge or drop!
        v.airborne = true;
        v.airTime += dt;
        v.groundedWheels = 0;
        v.vy -= GRAVITY * dt;
        v.y += v.vy * dt;
        // Nose naturally pitches down with downward velocity so car never sticks out horizontally
        const targetAirPitch = clamp(Math.atan2(v.vy, Math.max(Math.abs(v.speed), 6.0)), -0.78, 0.55);
        v.pitch = lerp(v.pitch, targetAirPitch, 1 - Math.exp(-dt * 4.2));
        v.roll = lerp(v.roll, 0, 1 - Math.exp(-dt * 2.5));
        for (let i = 0; i < 4; i++) {
          v.wheelOffsets[i] = lerp(v.wheelOffsets[i], -0.14, 1 - Math.exp(-dt * 12));
        }

        // Check touchdown (hard clamp above all 7 underbody samples)
        if (v.y <= minChassisY) {
          const impactVy = -v.vy;
          v.y = minChassisY;
          v.airborne = false;
          v.airTime = 0;
          v.heave = clamp(-impactVy * 0.024, -0.14, 0);
          v.heaveVel = -impactVy * 0.22;
          v.vy = 0;
          if (impactVy > 6.5) {
            const sev = clamp((impactVy - 5.5) * 3.2, 3.0, 38.0);
            v.applyImpact(sev, "hard_landing", onImpact);
          }
        }
      } else {
        // Grounded: 4-wheel spring-damper suspension with strict 7-point underbody hill clearance
        v.airborne = false;
        v.airTime = 0;
        const prevY = v.y;
        const dropRate = (prevY - targetGroundY) / Math.max(dt, 1e-4);
        if (dropRate > 9.5 && Math.abs(v.speed) > 7.5) {
          v.airborne = true;
          v.vy = -1.6;
        } else {
          v.y = Math.max(minChassisY, lerp(v.y, targetGroundY, 1 - Math.exp(-dt * 32)));
          v.vy = (v.y - prevY) / dt;
        }

        // Suspension heave spring-damper (clamped so chassis never dips into terrain)
        const bumpForce = clamp((targetGroundY - prevY) * 16, -8, 8);
        const heaveAcc = -74.0 * v.heave - 12.5 * v.heaveVel + bumpForce;
        v.heaveVel += heaveAcc * dt;
        v.heave = clamp(v.heave + v.heaveVel * dt, -0.06, 0.22);

        // Pitch & roll spring-damper aligned to 4-wheel ground plane + cornering body roll
        const latG = (v.speed * (yawDelta / dt)) / GRAVITY;
        const bodyRoll = clamp(-latG * 0.085, -0.14, 0.14);
        const bodyPitch = clamp(-netAccel * 0.012, -0.10, 0.10);
        const targetPitch = clamp(s1.groundPitch + bodyPitch, -0.68, 0.68);
        const targetRoll = clamp(s1.groundRoll + bodyRoll, -0.55, 0.55);

        const pAcc = 72.0 * (targetPitch - v.pitch) - 12.0 * v.pitchVel;
        v.pitchVel += pAcc * dt;
        v.pitch = clamp(v.pitch + v.pitchVel * dt, -0.72, 0.72);

        const rAcc = 78.0 * (targetRoll - v.roll) - 12.5 * v.rollVel;
        v.rollVel += rAcc * dt;
        v.roll = clamp(v.roll + v.rollVel * dt, -0.58, 0.58);

        // Per-wheel vertical travel so every wheel stays planted on uneven slopes
        let grounded = 0;
        for (let i = 0; i < 4; i++) {
          const wd = v.wheelDefs[i];
          // Height of wheel mount relative to chassis center due to pitch & roll
          const localGround = v.wheelHeights[i] - v.y;
          const off = clamp(localGround, -0.26, 0.26);
          v.wheelOffsets[i] = lerp(v.wheelOffsets[i], off, 1 - Math.exp(-dt * 22));
          if (Math.abs(localGround) < 0.35) grounded++;
        }
        v.groundedWheels = grounded;
      }

      // Compute accelerations for water slosh coupling
      v.accelFwd = (v.speed - v.prevSpeed) / dt;
      v.accelLat = v.speed * (yawDelta / dt);
      v.prevSpeed = v.speed;
      v.prevHeading = v.heading;
      v.damageShake = Math.max(0, v.damageShake - dt * 2.5);
    }

    body.step = function (dt, input, surfaceAt, obstacles, boundsClamp, onImpact) {
      this.accum = Math.min(this.accum + dt, 0.1);
      while (this.accum >= FIXED_DT) {
        substepDrive(this, FIXED_DT, input, surfaceAt, obstacles, boundsClamp, onImpact);
        this.accum -= FIXED_DT;
      }
      return this;
    };

    // Keep parked wagon aligned to all 7 underbody points on slopes (ZERO hill clipping!)
    body.stepParked = function (dt, surfaceAt, boundsClamp) {
      this.accum = Math.min(this.accum + dt, 0.1);
      while (this.accum >= FIXED_DT) {
        const s = sampleWheels(this, surfaceAt);
        this.slopeAngle = s.slopeAngle;
        this.maxSampledHeight = s.maxSampledHeight;
        const minChassisY = s.maxSampledHeight + this.rideClearance;
        const targetY = s.safeGroundY;
        const clearance = this.y - targetY;
        if (clearance > 0.08) {
          this.vy -= GRAVITY * FIXED_DT;
          this.y += this.vy * FIXED_DT;
          if (this.y <= minChassisY) {
            this.y = minChassisY;
            this.vy = 0;
          }
        } else {
          this.y = Math.max(minChassisY, lerp(this.y, targetY, 1 - Math.exp(-FIXED_DT * 24)));
          this.vy = 0;
        }
        this.pitch = lerp(this.pitch, s.groundPitch, 1 - Math.exp(-FIXED_DT * 16));
        this.roll = lerp(this.roll, s.groundRoll, 1 - Math.exp(-FIXED_DT * 16));
        this.heave = lerp(this.heave, 0, 1 - Math.exp(-FIXED_DT * 12));
        for (let i = 0; i < 4; i++) {
          const off = clamp(this.wheelHeights[i] - this.y, -0.26, 0.16);
          this.wheelOffsets[i] = lerp(this.wheelOffsets[i], off, 1 - Math.exp(-FIXED_DT * 18));
        }
        // Parked handbrake holds gentle slopes; steep cliffs (> ~18 deg) still exert gravity slide
        const sinSlope = Math.sin(s.slopeAngle);
        if (Math.abs(sinSlope) > 0.32) {
          const slideAccel = -GRAVITY * (sinSlope - Math.sign(sinSlope) * 0.30);
          this.speed = clamp(this.speed + slideAccel * FIXED_DT, -14, 14);
          let nx = this.x + Math.sin(this.heading) * this.speed * FIXED_DT;
          let nz = this.z + Math.cos(this.heading) * this.speed * FIXED_DT;
          if (boundsClamp) [nx, nz] = boundsClamp(nx, nz);
          this.x = nx;
          this.z = nz;
          // Re-clamp immediately after slide so it never penetrates a slope mid-substep
          const sPost = sampleWheels(this, surfaceAt);
          this.maxSampledHeight = sPost.maxSampledHeight;
          this.y = Math.max(this.y, sPost.maxSampledHeight + this.rideClearance);
        } else {
          this.speed = lerp(this.speed, 0, 1 - Math.exp(-FIXED_DT * 10));
          if (Math.abs(this.speed) < 0.02) this.speed = 0;
        }
        this.accelFwd = 0;
        this.accelLat = 0;
        this.accum -= FIXED_DT;
      }
      return this;
    };

    return body;
  }

  /* --------------------------------------------------------------------------
   * 2. CARRIER & CAST GRAVITY, GROUNDING & WATER-LOAD WEIGHT (0-40 kg)
   * -------------------------------------------------------------------------- */
  function createCarrierBody(opts = {}) {
    return {
      vx: 0,
      vy: 0,
      vz: 0,
      prevVx: 0,
      prevVz: 0,
      accelX: 0,
      accelZ: 0,
      grounded: true,
      grade: 0,
      carryLeanRad: 0,
      speedMult: 1,
      eyeHeight: opts.eyeHeight ?? 1.68,
      // Ragdoll / tumble state on steep cliff falls or hard hits
      tumbleTimer: 0,
      tumbleDuration: 1.35,
      tumbleRoll: 0,
      tumblePitch: 0,
      tumbleDirX: 0,
      tumbleDirZ: 1,
      fallPeakY: -9999,
      lastLandingImpact: 0,

      jump(strength = 9.8) {
        if (!this.grounded || this.tumbleTimer > 0) return false;
        this.grounded = false;
        this.vy = strength;
        this.fallPeakY = -9999;
        return true;
      },

      triggerTumble(dirX = 0, dirZ = 1, strength = 7.5, duration = 1.35) {
        const mag = Math.hypot(dirX, dirZ) || 1;
        this.tumbleDirX = dirX / mag;
        this.tumbleDirZ = dirZ / mag;
        this.tumbleDuration = clamp(duration, 0.85, 2.2);
        this.tumbleTimer = this.tumbleDuration;
        this.vx = this.tumbleDirX * strength;
        this.vz = this.tumbleDirZ * strength;
        this.vy = Math.max(this.vy, 3.2);
        return true;
      },

      stepFoot(state, dt, moveDirX, moveDirZ, baseSpeed, waterLiters, surfaceAt, boundsClamp, onEvent) {
        const dtSafe = Math.max(dt, 1e-4);
        const waterKg = clamp(waterLiters || 0, 0, 40);
        const loadRatio = waterKg / 40; // 0..1 for 0..40 kg

        // Water load reduces flat/sprint speed proportionally (up to -34% at 40 kg)
        const weightSpeedMult = 1 - loadRatio * 0.34;
        const moveMag = Math.hypot(moveDirX, moveDirZ);
        let dirX = 0, dirZ = 0;
        if (moveMag > 1e-4) {
          dirX = moveDirX / moveMag;
          dirZ = moveDirZ / moveMag;
        }

        // Sample terrain grade & local slope normal
        const g0 = surfaceAt(state.x, state.z);
        const gx = (surfaceAt(state.x + 0.65, state.z) - surfaceAt(state.x - 0.65, state.z)) / 1.3;
        const gz = (surfaceAt(state.x, state.z + 0.65) - surfaceAt(state.x, state.z - 0.65)) / 1.3;
        const slopeMag = Math.hypot(gx, gz);
        let grade = 0;
        if (moveMag > 1e-4) {
          const gAhead = surfaceAt(state.x + dirX * 1.0, state.z + dirZ * 1.0);
          grade = clamp(gAhead - g0, -1.2, 1.2);
        }
        this.grade = grade;

        if (this.tumbleTimer > 0) {
          // Ragdoll downhill tumble physics
          this.tumbleTimer = Math.max(0, this.tumbleTimer - dtSafe);
          const prog = 1 - this.tumbleTimer / Math.max(0.1, this.tumbleDuration);
          // Gravity accelerates tumble downhill
          this.vx += (-gx * GRAVITY * 0.32) * dtSafe;
          this.vz += (-gz * GRAVITY * 0.32) * dtSafe;
          const drag = Math.exp(-dtSafe * (this.grounded ? 2.4 : 0.4));
          this.vx *= drag;
          this.vz *= drag;
          const spd = Math.hypot(this.vx, this.vz);
          this.tumbleRoll += (3.8 + spd * 1.1) * dtSafe;
          this.tumblePitch = Math.sin(prog * Math.PI * 3.0) * 0.72 * (1 - prog * 0.6);
          if (this.tumbleTimer <= 0) {
            this.tumbleRoll = 0;
            this.tumblePitch = 0;
          }
        } else {
          // Smoothly recover any residual tumble angles
          this.tumbleRoll = lerp(this.tumbleRoll, 0, 1 - Math.exp(-dtSafe * 10));
          this.tumblePitch = lerp(this.tumblePitch, 0, 1 - Math.exp(-dtSafe * 10));

          // Uphill penalty increases with carried water; downhill adds momentum
          let slopeMult = 1.0;
          if (grade > 0.02) {
            slopeMult = clamp(1 - grade * (1.15 + loadRatio * 1.35), 0.22, 1.0);
          } else if (grade < -0.02) {
            slopeMult = clamp(1 + (-grade) * (0.18 + loadRatio * 0.28), 1.0, 1.48);
          }

          this.speedMult = weightSpeedMult * slopeMult;
          const effSpeed = baseSpeed * this.speedMult;
          const targetVx = dirX * Math.min(1, moveMag) * effSpeed;
          const targetVz = dirZ * Math.min(1, moveMag) * effSpeed;

          // Heavier water load increases inertia (slower start/stop)
          const response = this.grounded ? lerp(15.0, 8.2, loadRatio) : 3.2;
          this.vx = lerp(this.vx, targetVx, 1 - Math.exp(-dtSafe * response));
          this.vz = lerp(this.vz, targetVz, 1 - Math.exp(-dtSafe * response));

          // Steep cliff slip -> ragdoll tumble downhill!
          if (slopeMag > 1.08 && Math.hypot(this.vx, this.vz) > 4.2 && grade < -0.55) {
            this.triggerTumble(-gx, -gz, Math.max(5.5, Math.hypot(this.vx, this.vz)), 1.25);
            if (onEvent) onEvent({ type: "tumble", intensity: 0.75 });
          } else if (moveMag <= 0.05 && loadRatio > 0.25 && slopeMag > 0.48) {
            this.vx -= gx * GRAVITY * 0.09 * loadRatio * dtSafe;
            this.vz -= gz * GRAVITY * 0.09 * loadRatio * dtSafe;
          }
        }

        let nx = state.x + this.vx * dtSafe;
        let nz = state.z + this.vz * dtSafe;
        if (boundsClamp) {
          const cl = boundsClamp(nx, nz);
          nx = cl[0];
          nz = cl[1];
        }
        state.x = nx;
        state.z = nz;
        state.vx = this.vx;
        state.vz = this.vz;

        // Crisp -22.0 m/s^2 vertical gravity & terrain-sole grounding
        const groundY = surfaceAt(state.x, state.z);
        const footY = state.y - this.eyeHeight;
        if (footY > groundY + 0.06 || this.vy > 0.05) {
          this.grounded = false;
          if (footY > this.fallPeakY) this.fallPeakY = footY;
          this.vy -= GRAVITY * dtSafe;
          const nextFootY = footY + this.vy * dtSafe;
          if (nextFootY <= groundY) {
            const impactVy = -this.vy;
            const dropH = Math.max(0, this.fallPeakY - groundY);
            this.grounded = true;
            this.vy = 0;
            this.fallPeakY = -9999;
            this.lastLandingImpact = impactVy;
            state.y = groundY + this.eyeHeight;
            if (impactVy > 11.5 || dropH > 3.2) {
              const tx = Math.abs(gx) + Math.abs(gz) > 0.12 ? -gx : (this.vx || Math.sin(state.yaw || 0));
              const tz = Math.abs(gx) + Math.abs(gz) > 0.12 ? -gz : (this.vz || Math.cos(state.yaw || 0));
              this.triggerTumble(tx, tz, clamp(impactVy * 0.48, 4.5, 11.0), clamp(0.95 + dropH * 0.12, 1.0, 1.8));
              if (onEvent) onEvent({ type: "hard_land", intensity: clamp(impactVy / 18, 0.35, 1.0), dropH });
            } else if (impactVy > 4.2 && onEvent) {
              onEvent({ type: "land", intensity: clamp(impactVy / 14, 0.15, 0.55), dropH });
            }
          } else {
            state.y = nextFootY + this.eyeHeight;
          }
        } else {
          this.grounded = true;
          this.vy = 0;
          this.fallPeakY = -9999;
          state.y = groundY + this.eyeHeight;
        }

        // Deepened carry-posture forward lean (0..0.24 rad)
        const targetLean = loadRatio * 0.24 * (0.65 + 0.35 * clamp(Math.hypot(this.vx, this.vz) / 5.0, 0, 1));
        this.carryLeanRad = lerp(this.carryLeanRad, targetLean, 1 - Math.exp(-dtSafe * 8));

        // Acceleration telemetry for water slosh
        this.accelX = (this.vx - this.prevVx) / dtSafe;
        this.accelZ = (this.vz - this.prevVz) / dtSafe;
        this.prevVx = this.vx;
        this.prevVz = this.vz;
        return this;
      }
    };
  }

  // Enforce strict terrain-sole grounding on all cast members (ZERO floating NPCs)
  function groundCastList(castList, surfaceAt, carryLeanRad) {
    if (!Array.isArray(castList) || !surfaceAt) return;
    for (let i = 0; i < castList.length; i++) {
      const ch = castList[i];
      if (!ch || !ch.group || !ch.group.visible) continue;
      const st = ch.state || {};
      const pose = String(st.pose || "idle");
      // Skip characters currently mounted/driving/gliding
      if (pose === "ride" || pose === "driving" || pose === "glide") continue;
      const gx = Number.isFinite(ch.group.position.x) ? ch.group.position.x : (st.x || 0);
      const gz = Number.isFinite(ch.group.position.z) ? ch.group.position.z : (st.z || 0);
      const gy = surfaceAt(gx, gz);
      if (Number.isFinite(gy)) {
        ch.group.position.y = gy;
        if (st) st.y = gy;
      }
      // Subtle forward carry lean on carrier when carrying heavy water
      const isCarrier = st.id === "imani" || st.role === "carrier";
      if (isCarrier && Number.isFinite(carryLeanRad) && ch.rig && ch.rig.spine) {
        ch.rig.spine.rotation.x = clamp((ch.rig.spine.rotation.x || 0) + carryLeanRad * 0.55, -0.4, 0.55);
      }
    }
  }

  // Keep Mistletoe strictly terrain-grounded beside the vehicle (NEVER perched on the car roof!)
  function keepCompanionGrounded(donkey, wagon, dt, surfaceAt, boundsClamp) {
    if (!donkey || !wagon || !surfaceAt) return;
    const sinH = Math.sin(wagon.heading);
    const cosH = Math.cos(wagon.heading);
    // Target spot: 3.1m to the right and 1.8m behind the wagon, strictly on terrain
    let tx = wagon.x + cosH * 3.1 - sinH * 1.8;
    let tz = wagon.z - sinH * 3.1 - cosH * 1.8;
    if (boundsClamp) [tx, tz] = boundsClamp(tx, tz);

    const dx = tx - donkey.state.x;
    const dz = tz - donkey.state.z;
    const dist = Math.hypot(dx, dz);
    const stepFn = (x, z) => surfaceAt(x, z);

    if (dist > 28) {
      // Catch up cleanly on ground if far behind
      donkey.place(tx, tz, wagon.heading, stepFn);
    } else if (dist > 1.6) {
      const want = Math.atan2(dx, dz);
      const diff = Math.atan2(Math.sin(want - donkey.state.heading), Math.cos(want - donkey.state.heading));
      const pace = dist > 7.5 || Math.abs(wagon.speed) > 9 ? 2 : dist > 3.5 ? 1 : 0;
      const throttle = clamp((dist - 1.2) * 0.45, 0.2, 1.0);
      donkey.update(dt, { throttle, steer: clamp(diff * 1.6, -1, 1), pace, near: 0, drop: 0 }, stepFn);
    } else {
      donkey.update(dt, { throttle: 0, steer: 0, pace: 0, near: 1, drop: 0 }, stepFn);
    }
    // Guarantee strict terrain-sole grounding
    if (boundsClamp) [donkey.state.x, donkey.state.z] = boundsClamp(donkey.state.x, donkey.state.z);
    const gy = surfaceAt(donkey.state.x, donkey.state.z);
    donkey.state.y = gy;
    donkey.group.position.set(donkey.state.x, gy, donkey.state.z);
  }

  /* --------------------------------------------------------------------------
   * 3. REAL-TIME WATER SLOSHING & SPILLING PHYSICS (2D DAMPED PENDULUM)
   * -------------------------------------------------------------------------- */
  function createWaterSlosh(opts = {}) {
    const omega = opts.omega ?? 4.6;          // natural frequency (rad/s)
    const zeta = opts.zeta ?? 0.22;           // damping ratio
    const spillThreshold = opts.spillThreshold ?? 0.58;
    const spillRateScale = opts.spillRateScale ?? 3.8; // L/s per unit over threshold

    return {
      sloshX: 0,
      sloshZ: 0,
      velX: 0,
      velZ: 0,
      magnitude: 0,
      spilling: false,
      spillRateLps: 0,
      totalSpilledL: 0,
      spillThreshold,

      impulse(ix, iz) {
        this.velX = clamp(this.velX + ix, -8, 8);
        this.velZ = clamp(this.velZ + iz, -8, 8);
      },

      step(dt, drive, waterLiters) {
        const dtSafe = Math.min(Math.max(dt, 1e-4), 0.05);
        const ax = clamp(drive.accelLat || 0, -24, 24);
        const az = clamp(drive.accelFwd || 0, -24, 24);
        const tiltX = clamp(drive.roll || 0, -0.7, 0.7);
        const tiltZ = clamp(drive.pitch || 0, -0.7, 0.7);

        // Forced damped 2D harmonic oscillator: x'' + 2*zeta*w*x' + w^2*x = F_drive
        const fx = -(ax / GRAVITY) * 0.58 + Math.sin(tiltX) * 1.15;
        const fz = -(az / GRAVITY) * 0.58 + Math.sin(tiltZ) * 1.15;

        const w2 = omega * omega;
        const damp = 2 * zeta * omega;

        const accX = w2 * (fx - this.sloshX) - damp * this.velX;
        const accZ = w2 * (fz - this.sloshZ) - damp * this.velZ;

        this.velX += accX * dtSafe;
        this.velZ += accZ * dtSafe;
        this.sloshX = clamp(this.sloshX + this.velX * dtSafe, -1.6, 1.6);
        this.sloshZ = clamp(this.sloshZ + this.velZ * dtSafe, -1.6, 1.6);

        this.magnitude = Math.hypot(this.sloshX, this.sloshZ);
        let spilledL = 0;
        if (this.magnitude > spillThreshold && waterLiters > 0.01) {
          this.spilling = true;
          this.spillRateLps = (this.magnitude - spillThreshold) * spillRateScale;
          spilledL = Math.min(waterLiters, this.spillRateLps * dtSafe);
          this.totalSpilledL += spilledL;
        } else {
          this.spilling = false;
          this.spillRateLps = 0;
        }
        return {
          sloshX: this.sloshX,
          sloshZ: this.sloshZ,
          magnitude: this.magnitude,
          pct: Math.round(clamp((this.magnitude / spillThreshold) * 100, 0, 150)),
          spilling: this.spilling,
          spilledL
        };
      }
    };
  }

  /* --------------------------------------------------------------------------
   * 4. POOLED 3D PARTICLES: #28d8f0 WATER SPILL DROPLETS, SPARKS & SMOKE
   * -------------------------------------------------------------------------- */
  function createPhysicsParticles(T, parentGroup) {
    if (!T || !parentGroup) {
      return { spawnSpill() {}, spawnSparks() {}, spawnSmoke() {}, update() {}, activeCount: 0 };
    }

    const MAX_DROPS = 96;
    const MAX_SPARKS = 48;
    const MAX_SMOKE = 32;

    // Fine translucent gravity-arced #28d8f0 water mist/droplet streaks (size 0.03-0.055m, opacity 0.55)
    const dropGeo = new T.CylinderGeometry(0.008, 0.015, 0.055, 5);
    const dropMat = new T.MeshBasicMaterial({
      color: 0x28d8f0,
      transparent: true,
      opacity: 0.55,
      depthWrite: false
    });
    const dropMesh = new T.InstancedMesh(dropGeo, dropMat, MAX_DROPS);
    dropMesh.frustumCulled = false;
    parentGroup.add(dropMesh);

    const sparkGeo = new T.BoxGeometry(0.06, 0.06, 0.14);
    const sparkMat = new T.MeshBasicMaterial({ color: 0xffc857 });
    const sparkMesh = new T.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
    sparkMesh.frustumCulled = false;
    parentGroup.add(sparkMesh);

    const smokeGeo = new T.SphereGeometry(0.24, 6, 5);
    const smokeMat = new T.MeshBasicMaterial({ color: 0x6e7880, transparent: true, opacity: 0.42 });
    const smokeMesh = new T.InstancedMesh(smokeGeo, smokeMat, MAX_SMOKE);
    smokeMesh.frustumCulled = false;
    parentGroup.add(smokeMesh);

    const dummy = new T.Object3D();
    const zeroMat = new T.Matrix4().makeScale(0, 0, 0);

    function makePool(n) {
      return Array.from({ length: n }, () => ({
        alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, age: 0, life: 1, scale: 1
      }));
    }

    const drops = makePool(MAX_DROPS);
    const sparks = makePool(MAX_SPARKS);
    const smokes = makePool(MAX_SMOKE);
    let dropCursor = 0, sparkCursor = 0, smokeCursor = 0;

    for (let i = 0; i < MAX_DROPS; i++) dropMesh.setMatrixAt(i, zeroMat);
    for (let i = 0; i < MAX_SPARKS; i++) sparkMesh.setMatrixAt(i, zeroMat);
    for (let i = 0; i < MAX_SMOKE; i++) smokeMesh.setMatrixAt(i, zeroMat);
    dropMesh.instanceMatrix.needsUpdate = true;
    sparkMesh.instanceMatrix.needsUpdate = true;
    smokeMesh.instanceMatrix.needsUpdate = true;

    return {
      activeCount: 0,

      spawnSpill(x, y, z, baseVx, baseVz, count = 4) {
        for (let k = 0; k < count; k++) {
          const p = drops[dropCursor];
          dropCursor = (dropCursor + 1) % MAX_DROPS;
          p.alive = true;
          p.x = x + (Math.random() - 0.5) * 0.34;
          p.y = y + (Math.random() - 0.5) * 0.12;
          p.z = z + (Math.random() - 0.5) * 0.34;
          p.vx = (baseVx || 0) * 0.52 + (Math.random() - 0.5) * 2.4;
          p.vy = 1.6 + Math.random() * 2.8;
          p.vz = (baseVz || 0) * 0.52 + (Math.random() - 0.5) * 2.4;
          p.age = 0;
          p.life = 0.42 + Math.random() * 0.32;
          p.scale = 0.55 + Math.random() * 0.45;
        }
      },

      spawnSparks(x, y, z, count = 14) {
        for (let k = 0; k < count; k++) {
          const p = sparks[sparkCursor];
          sparkCursor = (sparkCursor + 1) % MAX_SPARKS;
          p.alive = true;
          p.x = x + (Math.random() - 0.5) * 0.4;
          p.y = y + (Math.random() - 0.5) * 0.3;
          p.z = z + (Math.random() - 0.5) * 0.4;
          const ang = Math.random() * Math.PI * 2;
          const spd = 2.5 + Math.random() * 5.5;
          p.vx = Math.cos(ang) * spd;
          p.vy = 2.0 + Math.random() * 4.2;
          p.vz = Math.sin(ang) * spd;
          p.age = 0;
          p.life = 0.35 + Math.random() * 0.35;
          p.scale = 0.7 + Math.random() * 0.8;
        }
      },

      spawnSmoke(x, y, z, count = 1) {
        for (let k = 0; k < count; k++) {
          const p = smokes[smokeCursor];
          smokeCursor = (smokeCursor + 1) % MAX_SMOKE;
          p.alive = true;
          p.x = x + (Math.random() - 0.5) * 0.35;
          p.y = y;
          p.z = z + (Math.random() - 0.5) * 0.35;
          p.vx = (Math.random() - 0.5) * 0.7;
          p.vy = 1.4 + Math.random() * 1.1;
          p.vz = (Math.random() - 0.5) * 0.7;
          p.age = 0;
          p.life = 1.1 + Math.random() * 0.7;
          p.scale = 0.55 + Math.random() * 0.4;
        }
      },

      update(dt, surfaceAt) {
        let active = 0;
        let dropsDirty = false, sparksDirty = false, smokesDirty = false;

        for (let i = 0; i < MAX_DROPS; i++) {
          const p = drops[i];
          if (!p.alive) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.alive = false;
            dropMesh.setMatrixAt(i, zeroMat);
            dropsDirty = true;
            continue;
          }
          p.vy -= GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const gy = surfaceAt ? surfaceAt(p.x, p.z) : -999;
          if (p.y < gy + 0.025) {
            p.y = gy + 0.025;
            p.vy *= -0.18;
            p.vx *= 0.48;
            p.vz *= 0.48;
          }
          const fade = Math.max(0, 1 - p.age / p.life);
          const s = p.scale * fade;
          const spd = Math.hypot(p.vx, p.vy, p.vz);
          dummy.position.set(p.x, p.y, p.z);
          if (spd > 0.25) {
            const yaw = Math.atan2(p.vx, p.vz);
            const pitch = Math.atan2(Math.hypot(p.vx, p.vz), p.vy);
            dummy.rotation.set(pitch, yaw, 0, "YXZ");
          } else {
            dummy.rotation.set(0, 0, 0);
          }
          const streak = clamp(1.0 + spd * 0.14, 1.0, 2.4);
          dummy.scale.set(s * 0.85, s * streak, s * 0.85);
          dummy.updateMatrix();
          dropMesh.setMatrixAt(i, dummy.matrix);
          dropsDirty = true;
          active++;
        }

        for (let i = 0; i < MAX_SPARKS; i++) {
          const p = sparks[i];
          if (!p.alive) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.alive = false;
            sparkMesh.setMatrixAt(i, zeroMat);
            sparksDirty = true;
            continue;
          }
          p.vy -= GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const s = p.scale * (1 - p.age / p.life);
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(p.age * 8, p.age * 5, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          sparkMesh.setMatrixAt(i, dummy.matrix);
          sparksDirty = true;
          active++;
        }

        for (let i = 0; i < MAX_SMOKE; i++) {
          const p = smokes[i];
          if (!p.alive) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.alive = false;
            smokeMesh.setMatrixAt(i, zeroMat);
            smokesDirty = true;
            continue;
          }
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          const t = p.age / p.life;
          const s = p.scale * (1 + t * 2.2) * (1 - t * 0.4);
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.setScalar(s);
          dummy.updateMatrix();
          smokeMesh.setMatrixAt(i, dummy.matrix);
          smokesDirty = true;
          active++;
        }

        if (dropsDirty) dropMesh.instanceMatrix.needsUpdate = true;
        if (sparksDirty) sparkMesh.instanceMatrix.needsUpdate = true;
        if (smokesDirty) smokeMesh.instanceMatrix.needsUpdate = true;
        this.activeCount = active;
      }
    };
  }

  /* --------------------------------------------------------------------------
   * 5. THROWABLE 3D JERRYCANS & HIGHLAND STONES (-22.0 m/s^2 GRAVITY + BOUNCE)
   * -------------------------------------------------------------------------- */
  function createProjectilePool(T, parentGroup) {
    if (!T || !parentGroup) {
      return { launch() {}, update() {}, activeCount: 0, totalThrown: 0, items: [] };
    }
    const MAX_PROJ = 16;
    const canMat = new T.MeshStandardMaterial({ color: 0x1bb8e8, roughness: 0.35, metalness: 0.1, emissive: 0x063448, emissiveIntensity: 0.35 });
    const stoneMat = new T.MeshStandardMaterial({ color: 0x6c6860, roughness: 0.92, metalness: 0.04 });
    const canGeo = new T.BoxGeometry(0.26, 0.36, 0.18);
    const capGeo = new T.CylinderGeometry(0.036, 0.036, 0.06, 8);
    const stoneGeo = new T.DodecahedronGeometry(0.14, 0);

    function makeCanMesh() {
      const g = new T.Group();
      const body = new T.Mesh(canGeo, canMat);
      g.add(body);
      const cap = new T.Mesh(capGeo, stoneMat);
      cap.position.set(0.06, 0.20, 0);
      g.add(cap);
      g.visible = false;
      return g;
    }
    function makeStoneMesh() {
      const m = new T.Mesh(stoneGeo, stoneMat);
      m.visible = false;
      return m;
    }

    const items = Array.from({ length: MAX_PROJ }, (_, i) => {
      const kind = i % 2 === 0 ? "jerrycan" : "stone";
      const mesh = kind === "jerrycan" ? makeCanMesh() : makeStoneMesh();
      parentGroup.add(mesh);
      return {
        kind, mesh, alive: false,
        x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
        rx: 0, ry: 0, rz: 0, vrx: 0, vry: 0, vrz: 0,
        age: 0, life: 14, bounces: 0, radius: kind === "jerrycan" ? 0.19 : 0.14
      };
    });
    let cursor = 0;

    return {
      activeCount: 0,
      totalThrown: 0,
      items,

      launch(opts = {}) {
        const wantKind = opts.kind || (this.totalThrown % 2 === 0 ? "jerrycan" : "stone");
        let slot = null;
        for (let k = 0; k < MAX_PROJ; k++) {
          const idx = (cursor + k) % MAX_PROJ;
          if (items[idx].kind === wantKind) {
            slot = items[idx];
            cursor = (idx + 1) % MAX_PROJ;
            break;
          }
        }
        if (!slot) {
          slot = items[cursor];
          cursor = (cursor + 1) % MAX_PROJ;
        }
        slot.alive = true;
        slot.x = opts.x || 0;
        slot.y = opts.y || 1.4;
        slot.z = opts.z || 0;
        slot.vx = opts.vx || 0;
        slot.vy = opts.vy || 6.5;
        slot.vz = opts.vz || 0;
        slot.rx = Math.random() * 2;
        slot.ry = Math.random() * 2;
        slot.rz = Math.random() * 2;
        slot.vrx = (Math.random() - 0.5) * 9.5;
        slot.vry = (Math.random() - 0.5) * 7.5;
        slot.vrz = (Math.random() - 0.5) * 9.5;
        slot.age = 0;
        slot.life = 18.0;
        slot.bounces = 0;
        slot.mesh.position.set(slot.x, slot.y, slot.z);
        slot.mesh.visible = true;
        this.totalThrown++;
        return slot;
      },

      update(dt, surfaceAt, onBounce) {
        let active = 0;
        for (let i = 0; i < MAX_PROJ; i++) {
          const p = items[i];
          if (!p.alive) continue;
          p.age += dt;
          if (p.age >= p.life) {
            p.alive = false;
            p.mesh.visible = false;
            continue;
          }
          p.vy -= GRAVITY * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;

          const gy = surfaceAt ? surfaceAt(p.x, p.z) : 0;
          const floorY = gy + p.radius;
          if (p.y <= floorY) {
            const impactSpeed = Math.abs(p.vy);
            p.y = floorY;
            // Sample local terrain gradient for real downhill roll
            const gx = surfaceAt ? (surfaceAt(p.x + 0.5, p.z) - surfaceAt(p.x - 0.5, p.z)) : 0;
            const gz = surfaceAt ? (surfaceAt(p.x, p.z + 0.5) - surfaceAt(p.x, p.z - 0.5)) : 0;
            if (impactSpeed > 1.8) {
              p.vy = impactSpeed * (p.kind === "jerrycan" ? 0.34 : 0.42);
              p.vx = p.vx * 0.68 - gx * 2.4;
              p.vz = p.vz * 0.68 - gz * 2.4;
              p.vrx *= 0.65; p.vry *= 0.65; p.vrz *= 0.65;
              p.bounces++;
              if (onBounce) {
                onBounce({
                  kind: p.kind,
                  x: p.x, y: p.y, z: p.z,
                  intensity: clamp(impactSpeed / 14.0, 0.18, 1.0),
                  bounces: p.bounces
                });
              }
            } else {
              p.vy = 0;
              // Downhill roll + rolling friction
              p.vx += (-gx * GRAVITY * 0.36) * dt;
              p.vz += (-gz * GRAVITY * 0.36) * dt;
              const fric = Math.exp(-dt * 3.8);
              p.vx *= fric;
              p.vz *= fric;
              const spd = Math.hypot(p.vx, p.vz);
              if (spd > 0.08) {
                p.vrx = p.vz * 2.5;
                p.vrz = -p.vx * 2.5;
                p.vry *= 0.9;
              } else {
                p.vx = 0; p.vz = 0;
                p.vrx *= 0.8; p.vry *= 0.8; p.vrz *= 0.8;
              }
            }
          }
          p.rx += p.vrx * dt;
          p.ry += p.vry * dt;
          p.rz += p.vrz * dt;
          p.mesh.position.set(p.x, p.y, p.z);
          p.mesh.rotation.set(p.rx, p.ry, p.rz);
          active++;
        }
        this.activeCount = active;
      }
    };
  }

  window.NightPostPhysics = {
    GRAVITY,
    FIXED_DT,
    RIDE_CLEARANCE,
    createVehicleBody,
    createCarrierBody,
    createWaterSlosh,
    createPhysicsParticles,
    createProjectilePool,
    groundCastList,
    keepCompanionGrounded
  };
})();
